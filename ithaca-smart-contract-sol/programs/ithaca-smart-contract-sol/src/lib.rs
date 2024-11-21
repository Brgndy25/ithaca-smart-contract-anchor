pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

use anchor_spl::token::Mint;
pub use constants::*;
use error::{LedgerError, TokenValidatorError};
pub use instructions::*;
pub use state::*;

declare_id!("8VhqqahqVeiByDsa6FKo6Lmx94o4MTtQEBRruuAsbrSp");

#[program]
pub mod ithaca_smart_contract_sol {
    use std::cell::RefMut;

    use anchor_lang::{solana_program, Discriminator};

    use super::*;

    pub fn init_access_controller(ctx: Context<InitAccessController>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    pub fn grant_role(
        ctx: Context<GrantRole>,
        role_granted: String,
        new_member: Pubkey,
    ) -> Result<()> {
        ctx.accounts
            .grant_role(role_granted, new_member, &ctx.bumps)
    }

    pub fn renounce_role(
        ctx: Context<RenounceRole>,
        role_renounced: String,
        member_pk: Pubkey,
    ) -> Result<()> {
        ctx.accounts.renounce_role(role_renounced, member_pk)
    }

    pub fn check_role(
        ctx: Context<CheckRole>,
        role_checked: String,
        member_pk: Pubkey,
    ) -> Result<()> {
        ctx.accounts.check_role(role_checked, member_pk)
    }

    pub fn init_token_validator(ctx: Context<InitTokenValidator>) -> Result<()> {
        ctx.accounts.init_token_validator(&ctx.bumps)
    }

    pub fn add_token_to_whitelist(
        ctx: Context<AddTokenToWhitelist>,
        token_precision: u8,
    ) -> Result<()> {
        ctx.accounts
            .add_token_to_whitelist(&ctx.bumps, token_precision)
    }

    pub fn remove_token_from_whitelist(ctx: Context<RemoveTokenFromWhitelist>) -> Result<()> {
        ctx.accounts.remove_token_from_whitelist()
    }

    pub fn init_fundlock(
        ctx: Context<InitFundlock>,
        trade_lock: i64,
        release_lock: i64,
    ) -> Result<()> {
        ctx.accounts
            .init_fundlock(trade_lock, release_lock, &ctx.bumps)
    }

    pub fn deposit_fundlock(ctx: Context<DepositFundlock>, amount: u64) -> Result<()> {
        ctx.accounts.deposit_fundlock(amount, &ctx.bumps)
    }

    pub fn withdraw_fundlock(ctx: Context<WithdrawFundlock>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw_fundlock(amount)
    }

    pub fn release_fundlock(ctx: Context<ReleaseFundlock>, index: u64) -> Result<()> {
        ctx.accounts.release_fundlock(index)
    }

    pub fn balance_sheet_fundlock(ctx: Context<BalanceSheetFundlock>) -> Result<()> {
        ctx.accounts.balance_sheet_fundlock()
    }

    pub fn init_ledger(ctx: Context<InitLedger>) -> Result<()> {
        ctx.accounts.init_ledger(&ctx.bumps)
    }

    pub fn create_contracts_and_positions<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateOrUpdatePositions<'info>>,
        position_params: Vec<PositionsParam>,
    ) -> Result<()> {
        let remaining_accounts = &ctx.remaining_accounts;

        for (i, position) in position_params.iter().enumerate() {
            let contract_account_info = &remaining_accounts[i * 2]; // Even indices for contracts
            let position_account_info = &remaining_accounts[i * 2 + 1]; // Odd indices for positions

            // Derive the expected PDAs
            let (expected_contract_pda, _contract_bump) = Pubkey::find_program_address(
                &[
                    b"contract",
                    ctx.accounts.ledger.key().as_ref(),
                    position.contract_id.to_le_bytes().as_ref(),
                ],
                ctx.program_id,
            );
            let (expected_position_pda, _position_bump) = Pubkey::find_program_address(
                &[
                    b"position",
                    contract_account_info.key.as_ref(),
                    position.client.as_ref(),
                ],
                ctx.program_id,
            );

            // Ensure the passed accounts match the expected PDAs
            require!(
                contract_account_info.key == &expected_contract_pda,
                LedgerError::AccountOrderViolated
            );
            require!(
                position_account_info.key == &expected_position_pda,
                LedgerError::AccountOrderViolated
            );

            // Handle contract account creation
            if contract_account_info.data_is_empty() {
                let init_space = Contract::INIT_SPACE;
                let lamports = Rent::get()?.minimum_balance(init_space);
                let ledger = ctx.accounts.ledger.key();
                let contract_id_le_bytes = position.contract_id.to_le_bytes();
                let seeds = [b"contract", ledger.as_ref(), contract_id_le_bytes.as_ref()];
                let (pda, bump) = Pubkey::find_program_address(&seeds, &crate::ID);
                let signer = [
                    b"contract",
                    ledger.as_ref(),
                    contract_id_le_bytes.as_ref(),
                    &[bump],
                ];

                solana_program::program::invoke_signed(
                    &solana_program::system_instruction::create_account(
                        &ctx.accounts.caller.key,
                        &pda,
                        lamports,
                        init_space as u64,
                        ctx.program_id,
                    ),
                    &[
                        ctx.accounts.caller.to_account_info(),
                        contract_account_info.to_account_info(),
                    ],
                    &[&signer],
                )?;
            }

            let contract_account = Contract {
                contract_id: position.contract_id,
                bump: _contract_bump,
            };

            let data = contract_account.try_to_vec()?;

            let mut final_data = vec![0u8; 8 + data.len()]; // Account discriminator (8 bytes) + contract data
            final_data[8..].copy_from_slice(&data);
            final_data[0..8].copy_from_slice(&Contract::DISCRIMINATOR);
            let mut contract_data = contract_account_info
                .try_borrow_mut_data()
                .expect("Error borrowing contract data");

            // Copy the data to the account
            contract_data[0..final_data.len()].copy_from_slice(&final_data);

            // Handle position account creation
            if position_account_info.data_is_empty() {
                let init_space = Position::INIT_SPACE;
                let lamports = Rent::get()?.minimum_balance(init_space);
                let seeds = [
                    b"position",
                    contract_account_info.key.as_ref(),
                    position.client.as_ref(),
                ];
                let (pda, bump) = Pubkey::find_program_address(&seeds, &crate::ID);
                let signer = [
                    b"position",
                    contract_account_info.key.as_ref(),
                    position.client.as_ref(),
                    &[bump],
                ];

                solana_program::program::invoke_signed(
                    &solana_program::system_instruction::create_account(
                        &ctx.accounts.caller.key,
                        &pda,
                        lamports,
                        init_space as u64,
                        ctx.program_id,
                    ),
                    &[
                        ctx.accounts.caller.to_account_info(),
                        position_account_info.to_account_info(),
                    ],
                    &[&signer],
                )?;
            }

            let position_account = Position {
                contract_id: position.contract_id,
                client: position.client,
                size: position.size,
                bump: _position_bump,
            };

            let data = position_account.try_to_vec()?;

            let mut final_data = vec![0u8; 8 + data.len()]; // Account discriminator (8 bytes) + position data
            final_data[8..].copy_from_slice(&data);
            final_data[0..8].copy_from_slice(&Position::DISCRIMINATOR);
            let mut position_data = position_account_info
                .try_borrow_mut_data()
                .expect("Error borrowing position data");

            // Copy the data to the account
            position_data[0..final_data.len()].copy_from_slice(&final_data);
        }
        Ok(())
    }

    // pub fn print_contract_and_position_data(
    //     ctx: Context<PrintContractAndPositionData>,
    // ) -> Result<()> {
    //     Ok(())
    // }

    /// Expect accounts to be passed in order of:
    /// 0.Client Underlying Balance in remaining accounts[0]
    /// 1.Client Strike Balance in remaining accounts[1]
    /// 2.Withdrawals associated with the client underlying balance in remaining accounts[2]
    /// 3.Withdrawals associated with the client strike balance in remaining accounts[3]
    /// 4.Client PK in FundMovementParam[0].client
    /// 5.Underlying amount in FundMovementParam[0].underlying_amount
    /// 6.Strike amount in FundMovementParam[0].strike_amount

    // This is a ledger associatied instruction

    pub fn update_fund_movements(
        ctx: Context<UpdateFundMovements>,
        fund_movements: Vec<FundMovementParam>,
        backend_id: u64,
    ) -> Result<()> {
        let mut client_balance_underlying_account_datas: Vec<RefMut<'_, &mut [u8]>> = Vec::new();
        let mut client_balance_strike_account_datas: Vec<RefMut<'_, &mut [u8]>> = Vec::new();
        let mut withdrawals_underlying_account_datas: Vec<RefMut<'_, &mut [u8]>> = Vec::new();
        let mut withdrawals_strike_account_datas: Vec<RefMut<'_, &mut [u8]>> = Vec::new();
        let remaining_accounts = &ctx.remaining_accounts;
        for i in 0..fund_movements.len() {
            let client_balance_underlying_data = remaining_accounts[i * 4]
                .try_borrow_mut_data()
                .expect("Error borrowing data");
            client_balance_underlying_account_datas.push(client_balance_underlying_data);

            let client_balance_strike_data = remaining_accounts[i * 4 + 1]
                .try_borrow_mut_data()
                .expect("Error borrowing data");
            client_balance_strike_account_datas.push(client_balance_strike_data);

            let withdrawals_underlying_data = remaining_accounts[i * 4 + 2]
                .try_borrow_mut_data()
                .expect("Error borrowing data");
            withdrawals_underlying_account_datas.push(withdrawals_underlying_data);

            let withdrawals_strike_data = remaining_accounts[i * 4 + 3]
                .try_borrow_mut_data()
                .expect("Error borrowing data");
            withdrawals_strike_account_datas.push(withdrawals_strike_data);
        }
        ctx.accounts.update_fund_movements(
            fund_movements,
            client_balance_underlying_account_datas,
            withdrawals_underlying_account_datas,
            client_balance_strike_account_datas,
            withdrawals_strike_account_datas,
            backend_id,
        )
    }

    //This is a dummy function to make sure we can fetch account data and have them in IDL
    pub fn dummy_for_idl(_ctx: Context<DummyContextForIdl>) -> Result<()> {
        Ok(())
    }
}

// This is a ledger associatied instruction context
#[derive(Accounts)]
pub struct CreateOrUpdatePositions<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"access_controller", access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Box<Account<'info, AccessController>>,
    #[account(
        seeds = [b"role", access_controller.key().as_ref(), Roles::UtilityAccount.as_str().as_bytes()],
        bump = role_util.bump
    )]
    pub role_util: Box<Account<'info, Role>>,
    #[account(
        seeds = [b"member", role_util.key().as_ref(), caller.key().as_ref()],
        bump = member_util.bump
    )]
    pub member_util: Box<Account<'info, Member>>,
    #[account(
        seeds = [b"token_validator", access_controller.key().as_ref()],
        bump = token_validator.bump
    )]
    pub token_validator: Box<Account<'info, TokenValidator>>,
    #[account(
        constraint = underlying_token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub underlying_token: Box<Account<'info, Mint>>,
    #[account(
        seeds = [b"whitelisted_token", token_validator.key().as_ref(), underlying_token.key().as_ref()],
        bump = whitelisted_underlying_token.bump
    )]
    pub whitelisted_underlying_token: Box<Account<'info, WhitelistedToken>>,
    #[account(
        constraint = strike_token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub strike_token: Box<Account<'info, Mint>>,
    #[account(
        seeds = [b"whitelisted_token", token_validator.key().as_ref(), strike_token.key().as_ref()],
        bump = whitelisted_strike_token.bump
    )]
    pub whitelisted_strike_token: Box<Account<'info, WhitelistedToken>>,
    #[account(
        seeds = [
            b"ledger",
            access_controller.key().as_ref(),
            token_validator.key().as_ref(),
            underlying_token.key().as_ref(),
            strike_token.key().as_ref()
        ],
        bump = ledger.bump
    )]
    pub ledger: Box<Account<'info, Ledger>>,
    pub system_program: Program<'info, System>,
}

// This is a dummy context to make sure we can fetch account data and have them in IDL
#[derive(Accounts)]
pub struct DummyContextForIdl<'info> {
    #[account()]
    pub contract_account: Box<Account<'info, Contract>>,
    #[account()]
    pub position_account: Box<Account<'info, Position>>,
}
