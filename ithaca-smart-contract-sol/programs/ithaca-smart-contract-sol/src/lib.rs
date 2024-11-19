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

    use anchor_lang::solana_program;

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

    // Expect accounts to be passed in order of:
    // 0.Client Balance in remaining accounts[0]
    // 1.Withdrawals associated with the client balance in remaining accounts[1]
    // 2.Token Associated with the Client Balance in tokens[0]
    // 3.Client ATA in clients_ata[0]

    /// TODO! Move update balance fundlock as an in internal ledger only function

    pub fn update_balances_fundlock(
        ctx: Context<UpdateBalancesFundlock>,
        amounts: Vec<i64>,
        tokens: Vec<Pubkey>,
        clients_ata: Vec<Pubkey>,
        backend_id: u64,
    ) -> Result<()> {
        let mut client_balance_account_datas: Vec<RefMut<'_, &mut [u8]>> = Vec::new();
        let mut withdrawals_account_datas: Vec<RefMut<'_, &mut [u8]>> = Vec::new();
        let remaining_accounts = &ctx.remaining_accounts;
        for i in (0..remaining_accounts.len()).step_by(2) {
            let client_data = remaining_accounts[i]
                .try_borrow_mut_data()
                .expect("Error borrowing data");
            client_balance_account_datas.push(client_data);
            let withdrawal_data = remaining_accounts[i + 1]
                .try_borrow_mut_data()
                .expect("Error borrowing data");
            withdrawals_account_datas.push(withdrawal_data);
        }
        ctx.accounts.update_balances_fundlock(
            amounts,
            clients_ata,
            tokens,
            client_balance_account_datas,
            withdrawals_account_datas,
            backend_id,
        )
    }

    pub fn balance_sheet_fundlock(ctx: Context<BalanceSheetFundlock>) -> Result<()> {
        ctx.accounts.balance_sheet_fundlock()
    }

    pub fn init_ledger(ctx: Context<InitLedger>) -> Result<()> {
        ctx.accounts.init_ledger(&ctx.bumps)
    }

    // TODO! Try to refrac the code into a separate instruction for ledger
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

            // Handle contract account creation (check for ownership with crate::ID)
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
                        init_space as u64 - 8,
                        ctx.program_id,
                    ),
                    &[
                        ctx.accounts.caller.to_account_info(),
                        contract_account_info.to_account_info(),
                    ],
                    &[&signer],
                )?;

                let mut contract_data = contract_account_info
                    .try_borrow_mut_data()
                    .expect("Error borrowing contract data");
                let mut contract_account = Contract::try_from_slice(&contract_data)?;
                contract_account.contract_id = position.contract_id;
                contract_account.bump = _contract_bump;
                let data = &mut contract_account.try_to_vec()?;
                contract_data[0..data.len()].copy_from_slice(data);
            } else {
                let mut contract_data = contract_account_info
                    .try_borrow_mut_data()
                    .expect("Error borrowing contract data");
                let mut contract_account = Contract::try_from_slice(&contract_data)?;
                contract_account.contract_id = position.contract_id;
                contract_account.bump = _contract_bump;
                let data = &mut contract_account.try_to_vec()?;
                contract_data[0..data.len()].copy_from_slice(data);
            }
            // Handle position account creation (check for ownership with crate::ID)
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
                        init_space as u64 - 8,
                        ctx.program_id,
                    ),
                    &[
                        ctx.accounts.caller.to_account_info(),
                        position_account_info.to_account_info(),
                    ],
                    &[&signer],
                )?;

                let position_data = &mut position_account_info
                    .try_borrow_mut_data()
                    .expect("Error borrowing position data");
                let mut position_account = Position::try_from_slice(&position_data)?;
                position_account.contract_id = position.contract_id;
                position_account.client = position.client;
                position_account.size = position.size;
                position_account.bump = _position_bump;
                let data = &mut position_account.try_to_vec()?;
                position_data[0..data.len()].copy_from_slice(data);
            } else {
                let position_data = &mut position_account_info
                    .try_borrow_mut_data()
                    .expect("Error borrowing position data");
                let mut position_account = Position::try_from_slice(&position_data)?;
                position_account.contract_id = position.contract_id;
                position_account.client = position.client;
                position_account.size = position.size;
                position_account.bump = _position_bump;
                let data = &mut position_account.try_to_vec()?;
                position_data[0..data.len()].copy_from_slice(data);
            }
        }

        Ok(())
    }
}

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
        seeds = [b"role", access_controller.key().as_ref(), Roles::Admin.as_str().as_bytes()],
        bump = role.bump
    )]
    pub role: Box<Account<'info, Role>>,
    #[account(
        seeds = [b"member", role.key().as_ref(), caller.key().as_ref()],
        bump = member.bump
    )]
    pub member: Box<Account<'info, Member>>,
    #[account(
        seeds = [b"token_validator", role.key().as_ref()],
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
