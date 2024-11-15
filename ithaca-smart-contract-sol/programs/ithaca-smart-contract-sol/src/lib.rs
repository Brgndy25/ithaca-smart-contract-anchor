pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("DUT4uZiHydPwJtvPDzDPMtNuxoMbfJi5uuFWcq6UPxbk");

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

    pub fn add_token_to_whitelist(ctx: Context<AddTokenToWhitelist>) -> Result<()> {
        ctx.accounts.add_token_to_whitelist(&ctx.bumps)
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
        ctx.accounts.withdraw_fundlock(amount, &ctx.bumps)
    }

    pub fn release_fundlock(ctx: Context<ReleaseFundlock>, index: u64) -> Result<()> {
        ctx.accounts.release_fundlock(index)
    }

    pub fn update_balances_fundlock(
        ctx: Context<UpdateBalancesFundlock>,
        amounts: Vec<u64>,
        backend_id: u64,
    ) -> Result<()> {
        let mut account_datas: Vec<RefMut<'_, &mut [u8]>> = Vec::new();
        let mut clients: Vec<Pubkey> = Vec::new();
        let remaining_accounts = &ctx.remaining_accounts;
        for i in 0..remaining_accounts.len() {
            let data = remaining_accounts[i]
                .try_borrow_mut_data()
                .expect("Error borrowing data");
            account_datas.push(data);
            clients.push(remaining_accounts[i].key());
        }
        ctx.accounts
            .update_balances_fundlock(amounts, clients, account_datas, backend_id)
    }
}
