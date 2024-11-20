use crate::error::TokenValidatorError;
use crate::state::access_controller_state::{AccessController, Member, Role};
use crate::{Roles, TokenValidator, WhitelistedToken};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
pub struct RemoveTokenFromWhitelist<'info> {
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
        seeds = [b"token_validator".as_ref(), access_controller.key().as_ref()],
        bump = token_validator.bump
    )]
    pub token_validator: Account<'info, TokenValidator>,
    #[account(
        constraint = token_to_remove.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub token_to_remove: Account<'info, Mint>,
    // closing the whitelisted token account to remove the token from the whitelist
    #[account(
        mut,
        close = admin,
        seeds = [b"whitelisted_token".as_ref(), token_validator.key().as_ref(), token_to_remove.key().as_ref()],
        bump = whitelisted_token.bump
    )]
    pub whitelisted_token: Account<'info, WhitelistedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> RemoveTokenFromWhitelist<'info> {
    pub fn remove_token_from_whitelist(&mut self) -> Result<()> {
        msg!(
            "Token {} removed from whitelist",
            self.token_to_remove.key()
        );
        Ok(())
    }
}
