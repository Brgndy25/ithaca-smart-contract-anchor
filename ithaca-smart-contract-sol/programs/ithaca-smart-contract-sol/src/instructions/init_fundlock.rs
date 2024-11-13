use crate::state::access_controller_state::{AccessController, Role};
use crate::state::fundlock_state::Fundlock;
use crate::{Roles, TokenValidator};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitFundlock<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Account<'info, AccessController>,
    #[account(
        seeds = [b"role".as_ref(), access_controller.key().as_ref(), Roles::Admin.as_str().as_bytes()],
        bump = role.bump
    )]
    pub role: Account<'info, Role>,
    #[account(
        seeds = [b"token_validator".as_ref(), role.key().as_ref()],
        bump = token_validator.bump
    )]
    pub token_validator: Account<'info, TokenValidator>,
    #[account(
        init,
        payer = caller,
        seeds = [b"fundlock".as_ref(), access_controller.key().as_ref(), token_validator.key().as_ref()],
        space = Fundlock::INIT_SPACE,
        bump
    )]
    pub fundlock: Account<'info, Fundlock>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitFundlock<'info> {
    //will init the token validator account which we will use to whitelist tokens
    pub fn init_fundlock(
        &mut self,
        trade_lock: i64,
        release_lock: i64,
        bumps: &InitFundlockBumps,
    ) -> Result<()> {
        self.fundlock.set_inner(Fundlock {
            access_controller: self.access_controller.key(),
            token_validator: self.token_validator.key(),
            trade_lock,
            release_lock,
            bump: bumps.fundlock,
        });
        Ok(())
    }
}
