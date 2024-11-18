use crate::error::FundlockError;
use crate::state::access_controller_state::{AccessController, Role};
use crate::state::fundlock_state::Fundlock;
use crate::{ClientBalance, Ledger, Roles, TokenValidator, Withdrawals, ALLOWED_WITHDRAWAL_LIMIT};
use anchor_lang::prelude::*;
use std::cell::RefMut;

#[derive(Accounts)]
pub struct UpdateBalancesFundlock<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Box<Account<'info, AccessController>>,
    #[account(
        seeds = [b"role".as_ref(), access_controller.key().as_ref(), Roles::Admin.as_str().as_bytes()],
        bump = role.bump
    )]
    pub role: Box<Account<'info, Role>>,
    #[account(
        seeds = [b"token_validator".as_ref(), role.key().as_ref()],
        bump = token_validator.bump
    )]
    pub token_validator: Box<Account<'info, TokenValidator>>,
    #[account(
        seeds = [b"fundlock".as_ref(), access_controller.key().as_ref(), token_validator.key().as_ref()],
        bump = fundlock.bump
    )]
    pub fundlock: Box<Account<'info, Fundlock>>,
    // TODO! Add Ledger account as a signer
    // pub ledger: Box<Account<'info, Ledger>>,
    pub system_program: Program<'info, System>,
}

impl<'info> UpdateBalancesFundlock<'info> {
    pub fn update_balances_fundlock(
        &mut self,
        amounts: Vec<i64>,
        client_atas: Vec<Pubkey>,
        tokens: Vec<Pubkey>,
        mut client_balance_account_datas: Vec<RefMut<'_, &mut [u8]>>,
        mut withdrawals_account_datas: Vec<RefMut<'_, &mut [u8]>>,
        backend_id: u64,
    ) -> Result<()> {
        require!(
            client_balance_account_datas.len() == amounts.len()
                && client_balance_account_datas.len() == client_atas.len()
                && client_balance_account_datas.len() > 0,
            FundlockError::InvalidAccountsAmount
        );
        for i in 0..client_balance_account_datas.len() {
            {
                let client_balance_data = &mut client_balance_account_datas[i];
                let mut client_balance =
                    ClientBalance::try_deserialize(&mut client_balance_data.as_ref())
                        .expect("Error Deserializing Client Balance");
                require!(
                    client_balance.token == tokens[i]
                        && client_balance.client_ata == client_atas[i],
                    FundlockError::AccountOrderViolated
                );

                let withdrawals_data = &mut withdrawals_account_datas[i];

                let mut withdrawals_account_info =
                    Withdrawals::try_deserialize(&mut withdrawals_data.as_ref())
                        .expect("Error Deserializing Withdrawals");

                let client_ata_from_withdrawals = withdrawals_account_info.client_ata;

                require!(
                    client_ata_from_withdrawals == client_atas[i],
                    FundlockError::AccountOrderViolated
                );

                let change_in_balance: i64;

                if amounts[i] > 0 || client_balance.amount >= amounts[i].abs() as u64 {
                    change_in_balance = amounts[i];
                } else {
                    let amount_to_deduct = amounts[i].abs() as u64;
                    change_in_balance = -(client_balance.amount as i64);
                    let shortage = amount_to_deduct - client_balance.amount;
                    require!(
                        self.fund_from_withdrawal(
                            client_atas[i],
                            tokens[i],
                            shortage,
                            withdrawals_data
                        ),
                        FundlockError::InsufficientFunds
                    );
                }
                client_balance.amount = (client_balance.amount as i64 + change_in_balance) as u64;
                client_balance
                    .try_serialize(&mut **client_balance_data)
                    .expect("Error Serializing Client Balance");
            }
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

        for index in 0..ALLOWED_WITHDRAWAL_LIMIT {
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
