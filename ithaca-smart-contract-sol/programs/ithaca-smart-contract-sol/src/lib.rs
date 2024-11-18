pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("8VhqqahqVeiByDsa6FKo6Lmx94o4MTtQEBRruuAsbrSp");

#[program]
pub mod ithaca_smart_contract_sol {
    use std::cell::RefMut;

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
}
