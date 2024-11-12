use crate::error::{AccessControlError, TokenValidatorError};
use crate::state::access_controller_state::{AccessController, Member, Role};
use crate::{Roles, TokenValidator, WhitelistedToken};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
pub struct AddTokenToWhitelist<'info> {
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
        constraint = new_token_to_whitelist.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub new_token_to_whitelist: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        seeds = [b"whitelisted_token".as_ref(), token_validator.key().as_ref(), new_token_to_whitelist.key().as_ref()],
        space = WhitelistedToken::INIT_SPACE,
        bump
    )]
    pub whitelisted_token: Account<'info, WhitelistedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> AddTokenToWhitelist<'info> {
    // will init the whitelisted token account which we will use to check if the token
    // has been whitelisted
    pub fn add_token_to_whitelist(&mut self) -> Result<()> {
        require!(
            self.role.role == Roles::Admin.as_str(),
            AccessControlError::UnauthorizedAdmin
        );
        self.whitelisted_token.set_inner(WhitelistedToken {
            token_mint: self.new_token_to_whitelist.key(),
            bump: self.whitelisted_token.bump,
        });
        Ok(())
    }
}
