use crate::error::AccessControlError;
use crate::state::access_controller_state::{AccessController, Member, Role};
use crate::{Roles, TokenValidator};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitTokenValidator<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Account<'info, AccessController>,
    // using admin role to ensure this method is called by an admin member
    #[account(
        seeds = [b"role".as_ref(), access_controller.key().as_ref(), Roles::Admin.as_str().as_bytes()],
        bump = role.bump
    )]
    pub role: Account<'info, Role>,
    #[account(
        seeds = [b"member".as_ref(), role.key().as_ref(), admin.key().as_ref()],
        bump = member.bump
    )]
    pub member: Account<'info, Member>,
    #[account(
        init,
        payer = admin,
        seeds = [b"token_validator".as_ref(), role.key().as_ref()],
        space = TokenValidator::INIT_SPACE,
        bump
    )]
    pub token_validator: Account<'info, TokenValidator>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitTokenValidator<'info> {
    //will init the token validator account which we will use to whitelist tokens
    pub fn init_token_validator(&mut self, bumps: &InitTokenValidatorBumps) -> Result<()> {
        require!(
            self.role.role == Roles::Admin.as_str(),
            AccessControlError::UnauthorizedAdmin
        );
        self.token_validator.set_inner(TokenValidator {
            access_controller: self.access_controller.key(),
            bump: bumps.token_validator,
        });

        msg!("Token validator initialized successfully");

        Ok(())
    }
}
