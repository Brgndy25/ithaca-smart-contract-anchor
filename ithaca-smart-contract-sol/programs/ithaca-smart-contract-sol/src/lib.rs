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
}
