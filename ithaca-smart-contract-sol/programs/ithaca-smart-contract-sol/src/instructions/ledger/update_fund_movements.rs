use std::cell::RefMut;
use anchor_lang::prelude::*;
use crate::error::{FundlockError, LedgerError, TokenValidatorError};
use crate::state::{AccessController, Fundlock, Ledger, Member, FundMovementParam, TokenValidator, Role};
use crate::{ClientBalance, Roles, WhitelistedToken, Withdrawals};
use anchor_spl::token::Mint;

#[derive(Accounts)]
pub struct UpdateFundMovements<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Account<'info, AccessController>,
    #[account(
        seeds = [b"role".as_ref(), access_controller.key().as_ref(), Roles::UtilityAccount.as_str().as_bytes()],
        bump = role.bump
    )]
    pub role: Account<'info, Role>,
    #[account(
        seeds = [b"member".as_ref(), role.key().as_ref(), caller.key().as_ref()],
        bump = member.bump
    )]
    pub member: Account<'info, Member>,
    #[account(
        seeds = [b"token_validator".as_ref(), access_controller.key().as_ref()],
        bump = token_validator.bump
    )]
    pub token_validator: Account<'info, TokenValidator>,
    #[account(
        seeds = [b"fundlock".as_ref(), access_controller.key().as_ref(), token_validator.key().as_ref()],
        bump = fundlock.bump
    )]
    pub fundlock: Account<'info, Fundlock>,
    #[account(
        constraint = underlying_token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub underlying_token: Account<'info, Mint>,
    #[account(
        seeds = [b"whitelisted_token".as_ref(), token_validator.key().as_ref(), underlying_token.key().as_ref()],
        bump = whitelisted_underlying_token.bump
    )]
    pub whitelisted_underlying_token: Account<'info, WhitelistedToken>,
    #[account(
        constraint = strike_token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub strike_token: Account<'info, Mint>,
    #[account(
        seeds = [b"whitelisted_token".as_ref(), token_validator.key().as_ref(), strike_token.key().as_ref()],
        bump = whitelisted_strike_token.bump
    )]
    pub whitelisted_strike_token: Account<'info, WhitelistedToken>,
    #[account(
        seeds = [b"ledger".as_ref(), 
        access_controller.key().as_ref(), 
        token_validator.key().as_ref(), 
        underlying_token.key().as_ref(),
        strike_token.key().as_ref(), ],
        bump = ledger.bump
    )]
    pub ledger: Account<'info, Ledger>,
    pub system_program: Program<'info, System>,
}

impl<'info> UpdateFundMovements<'info> {
    pub fn update_fund_movements(
        &mut self,
        fund_movements: Vec<FundMovementParam>,
        client_balance_underlying_datas: Vec<RefMut<'_, &mut [u8]>>,
        client_underlying_withdrawal_datas: Vec<RefMut<'_, &mut [u8]>>,
        client_balance_strike_datas: Vec<RefMut<'_, &mut [u8]>>,
        client_strike_withdrawal_datas: Vec<RefMut<'_, &mut [u8]>>,
        backend_id: u64,
    ) -> Result<()> {
        require!(!fund_movements.is_empty(), LedgerError::EmptyFundMovementArray);
        let transfer_count = self.validate_and_count_amounts(&fund_movements);
        self.process_fund_movement(
            fund_movements, 
            backend_id, 
            transfer_count?,
            client_balance_underlying_datas,
            client_underlying_withdrawal_datas,
            client_balance_strike_datas,
            client_strike_withdrawal_datas
        )?;
        msg!("Fund movements updated successfully, backend id {}", backend_id);
        Ok(())
    }

    fn validate_and_count_amounts(&self, fund_movements: &[FundMovementParam]) -> Result<usize> {
        let mut transfer_count = 0;
        for fund_movement in fund_movements {
            require!(
                fund_movement.underlying_amount != 0 || fund_movement.strike_amount != 0,
                LedgerError::EmptyAmountsArray
            );
            if fund_movement.underlying_amount != 0 {
                transfer_count += 1;
            }
            if fund_movement.strike_amount != 0 {
                transfer_count += 1;
            }
        }
        Ok(transfer_count)
    }

    fn process_fund_movement(
        &mut self,
        fund_movements: Vec<FundMovementParam>,
        backend_id: u64,
        transfer_count: usize,
        client_balance_underlying_datas: Vec<RefMut<'_, &mut [u8]>>,
        client_underlying_withdrawal_datas: Vec<RefMut<'_, &mut [u8]>>,
        client_balance_strike_datas: Vec<RefMut<'_, &mut [u8]>>,
        client_strike_withdrawal_datas: Vec<RefMut<'_, &mut [u8]>>,
    ) -> Result<()> {
        let (clients, tokens, amounts) = self.initialize_data(fund_movements, transfer_count)?;
        msg!("Clients: {:?}", clients);
        msg!("Tokens: {:?}", tokens);
        msg!("Amounts: {:?}", amounts);
        self.update_balances_fundlock(
            amounts, 
            clients, 
            tokens, 
            client_balance_underlying_datas,
            client_underlying_withdrawal_datas,
            client_balance_strike_datas,
            client_strike_withdrawal_datas, 
            backend_id
        ).expect("Failed to update balances");
        Ok(())
    }

    fn initialize_data(
        &self,
        fund_movements: Vec<FundMovementParam>,
        transfer_count: usize,
    ) -> Result<(Vec<Pubkey>, Vec<Pubkey>, Vec<i64>)> {
        let mut clients = Vec::with_capacity(transfer_count);
        let mut tokens = Vec::with_capacity(transfer_count);
        let mut amounts = Vec::with_capacity(transfer_count);

        let strike_multiplier = self.ledger.strike_multiplier;
        let underlying_multiplier = self.ledger.underlying_multiplier;

        for fund_movement in fund_movements {
            if fund_movement.underlying_amount != 0 {
                clients.push(fund_movement.client);
                tokens.push(self.ledger.underlying_token);
                amounts.push(-fund_movement.underlying_amount * underlying_multiplier);
            }
            if fund_movement.strike_amount != 0 {
                clients.push(fund_movement.client);
                tokens.push(self.ledger.strike_token);
                amounts.push(-fund_movement.strike_amount * strike_multiplier);
            }
        }
        Ok((clients, tokens, amounts))
    }

    pub fn update_balances_fundlock(
        &mut self,
        amounts: Vec<i64>,
        clients: Vec<Pubkey>,
        tokens: Vec<Pubkey>,
        mut client_balance_underlying_datas: Vec<RefMut<'_, &mut [u8]>>,
        mut client_underlying_withdrawal_datas: Vec<RefMut<'_, &mut [u8]>>,
        mut client_balance_strike_datas: Vec<RefMut<'_, &mut [u8]>>,
        mut client_strike_withdrawal_datas: Vec<RefMut<'_, &mut [u8]>>,
        backend_id: u64,
    ) -> Result<()> {
        for i in 0..client_balance_underlying_datas.len() {
            {
                let client_balance_underlying_data = &mut client_balance_underlying_datas[i];
                let mut client_balance_underlying =
                    ClientBalance::try_deserialize(&mut client_balance_underlying_data.as_ref())
                        .expect("Error Deserializing Client Balance");

                        require!(
                            client_balance_underlying.token == tokens[i * 2] && client_balance_underlying.client == clients[i * 2],
                            FundlockError::AccountOrderViolated
                        );

                let withdrawals_data = &mut client_underlying_withdrawal_datas[i];
                let withdrawals_underlying_account_info =
                    Withdrawals::try_deserialize(&mut withdrawals_data.as_ref())
                        .expect("Error Deserializing Withdrawals");

                let client_under_from_withdrawals = withdrawals_underlying_account_info.client;

                require!(
                    clients[i * 2] == client_under_from_withdrawals,
                    FundlockError::AccountOrderViolated
                );

                msg!("Client {} balance underlying before: {:?}", clients[i * 2], client_balance_underlying.amount.to_string());

                let _change_in_underlying_balance: i64;
                if amounts[i] > 0 || client_balance_underlying.amount >= amounts[i * 2].abs() as u64 {
                    _change_in_underlying_balance = amounts[i * 2];
                    msg!("Funding from client balance: client={}, amount={}, token={}", clients[i * 2], amounts[i * 2], tokens[i * 2]);

                } else {
                    msg!("Client {} underlying withdrawal active amount before: {}", clients[i * 2], withdrawals_underlying_account_info.active_withdrawals_amount);
                    let amount_to_deduct = amounts[i * 2].abs() as u64;
                    _change_in_underlying_balance = -(client_balance_underlying.amount as i64);
                    let shortage = amount_to_deduct - client_balance_underlying.amount;
                    require!(
                        self.fund_from_withdrawal(
                            clients[i * 2],
                            tokens[i * 2],
                            shortage,
                            withdrawals_data
                        ),
                        FundlockError::InsufficientFunds
                    );
                    msg!("Client {} underlying withdrawal active amount after: {}", clients[i * 2], withdrawals_underlying_account_info.active_withdrawals_amount);
                }
                client_balance_underlying.amount = (client_balance_underlying.amount as i64 + _change_in_underlying_balance) as u64;
                client_balance_underlying
                    .try_serialize(&mut **client_balance_underlying_data)
                    .expect("Error Serializing Client Balance");
                msg!("Client {} ew underlying balance: {}", clients[i * 2], client_balance_underlying.amount);

            }

            let client_balance_strike_data = &mut client_balance_strike_datas[i];
            let mut client_balance_strike =
                ClientBalance::try_deserialize(&mut client_balance_strike_data.as_ref())
                    .expect("Error Deserializing Client Balance");

                require!(
                    client_balance_strike.token == tokens[i * 2 + 1] && client_balance_strike.client == clients[i * 2 + 1],
                    FundlockError::AccountOrderViolated,
                );

            let withdrawals_data = &mut client_strike_withdrawal_datas[i];
            let withdrawals_strike_account_info =
                Withdrawals::try_deserialize(&mut withdrawals_data.as_ref())
                    .expect("Error Deserializing Withdrawals");

            let client_strike_from_withdrawals = withdrawals_strike_account_info.client;

            require!(
                clients[i * 2 + 1] == client_strike_from_withdrawals,
                FundlockError::AccountOrderViolated
            );

                msg!("Client {} balance strike before: {:?}", clients[i * 2 + 1], client_balance_strike.amount.to_string());
            let _change_in_strike_balance: i64;
            if amounts[i *2 +1] > 0 || client_balance_strike.amount >= amounts[i * 2 +1].abs() as u64 {
                _change_in_strike_balance = amounts[i * 2 +1];
                msg!("Funding from client balance: client={}, amount={}, token={}", clients[i * 2 + 1], amounts[i* 2 + 1], tokens[i * 2 + 1]);
            } else {
                msg!("Client {} strike withdrawal active amount before: {}", clients[i * 2 + 1], withdrawals_strike_account_info.active_withdrawals_amount);
                let amount_to_deduct = amounts[i * 2 + 1].abs() as u64;
                _change_in_strike_balance = -(client_balance_strike.amount as i64);
                let shortage = amount_to_deduct - client_balance_strike.amount;
                require!(
                    self.fund_from_withdrawal(
                        clients[i * 2+1],
                        tokens[i*2+1],
                        shortage,
                        withdrawals_data
                    ),
                    FundlockError::InsufficientFunds
                );
                msg!("Client {} strike withdrawal active amount after: {}", clients[i * 2 + 1], withdrawals_strike_account_info.active_withdrawals_amount);
            }
            client_balance_strike.amount = (client_balance_strike.amount as i64 + _change_in_strike_balance) as u64;
            client_balance_strike
                .try_serialize(&mut **client_balance_strike_data)
                .expect("Error Serializing Client Balance");
            msg!("Client {} new strike balance: {}", clients[i * 2 + 1], client_balance_strike.amount);
        }
        msg!("Balances updated successfully! Backend ID: {}", backend_id);
        Ok(())
    }

    pub fn fund_from_withdrawal(
        &mut self,
        client: Pubkey,
        token: Pubkey,
        amount: u64,
        withdrawal_data: &mut RefMut<'_, &mut [u8]>,
    ) -> bool {
        let mut funded_sum: u64 = 0;
        let trade_lock = self.fundlock.trade_lock;
        let mut withdrawal_account_info =
            Withdrawals::try_deserialize(&mut withdrawal_data.as_ref())
                .expect("Error Deserializing Withdrawals");
        let withdrawals = &mut withdrawal_account_info.withdrawal_queue;

        for index in 0..withdrawals.len() {
            if let Some(withdrawal) = withdrawals.get_mut(index) {
                if withdrawal.timestamp + trade_lock > Clock::get().unwrap().unix_timestamp {
                    let left_to_fund = amount - funded_sum;
                    let available_amount = withdrawal.amount;

                    if available_amount <= left_to_fund {
                        funded_sum += available_amount;
                        withdrawal.amount = 0;
                        withdrawal.timestamp = 0;
                        withdrawal_account_info.active_withdrawals_amount -= available_amount;
                        withdrawals.remove(index);
                        msg!(
                            "Funded from withdrawal: client={}, token={}, amount={}, index={}",
                            client,
                            token,
                            available_amount,
                            index
                        );
                    } else {
                        funded_sum += left_to_fund;
                        withdrawal.amount -= left_to_fund;
                        withdrawal_account_info.active_withdrawals_amount -= left_to_fund;
                        msg!(
                            "Funded from withdrawal: client={}, token={}, amount={}, index={}",
                            client,
                            token,
                            left_to_fund,
                            index
                        );
                    }

                    if funded_sum == amount {
                        withdrawal_account_info
                            .try_serialize(&mut **withdrawal_data)
                            .expect("Error Serializing Withdrawals");
                        return true;
                    }
                }
            }
        }
        false
    }
}
