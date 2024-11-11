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
}
