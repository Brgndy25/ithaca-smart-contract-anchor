use crate::error::{AccessControlError, TokenValidatorError};
use crate::state::access_controller_state::{AccessController, Role};
use crate::state::fundlock_state::Fundlock;
use crate::{Ledger, Member, Roles, TokenValidator, WhitelistedToken};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
pub struct InitLedger<'info> {
    // Expect the caller to be a member of admin role
    #[account(mut)]
    pub admin: Signer<'info>,
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
        seeds = [b"member".as_ref(), role.key().as_ref(), admin.key().as_ref()],
        bump = member.bump
    )]
    pub member: Account<'info, Member>,
    #[account(
        seeds = [b"token_validator".as_ref(), role.key().as_ref()],
        bump = token_validator.bump
    )]
    pub token_validator: Account<'info, TokenValidator>,
    #[account(
        seeds = [b"fundlock".as_ref(), access_controller.key().as_ref(), token_validator.key().as_ref()],
        bump = fundlock.bump
    )]
    pub fundlock: Account<'info, Fundlock>,
    #[account(
        constraint = underlying_token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub underlying_token: Account<'info, Mint>,
    #[account(
        seeds = [b"whitelisted_token".as_ref(), token_validator.key().as_ref(), underlying_token.key().as_ref()],
        bump = whitelisted_underlying_token.bump
    )]
    pub whitelisted_underlying_token: Account<'info, WhitelistedToken>,
    #[account(
        constraint = strike_token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub strike_token: Account<'info, Mint>,
    #[account(
        seeds = [b"whitelisted_token".as_ref(), token_validator.key().as_ref(), strike_token.key().as_ref()],
        bump = whitelisted_strike_token.bump
    )]
    pub whitelisted_strike_token: Account<'info, WhitelistedToken>,
    #[account(
        init,
        payer = admin,
        seeds = [b"ledger".as_ref(), 
        access_controller.key().as_ref(), 
        token_validator.key().as_ref(), 
        underlying_token.key().as_ref(),
        strike_token.key().as_ref(), ],
        space = Ledger::INIT_SPACE,
        bump
    )]
    pub ledger: Account<'info, Ledger>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitLedger<'info> {
    pub fn init_ledger(&mut self, bumps: &InitLedgerBumps) -> Result<()> {
        require!(
            self.role.role == Roles::Admin.as_str(),
            AccessControlError::UnauthorizedAdmin
        );
        let strike_token_diff: u8 =
            self.strike_token.decimals - self.whitelisted_strike_token.token_precision;
        let underlying_token_diff: u8 =
            self.underlying_token.decimals - self.whitelisted_underlying_token.token_precision;

        let underlying_multiplier = 10_i64.pow(underlying_token_diff as u32);
        let strike_multiplier = 10_i64.pow(strike_token_diff as u32);
        self.ledger.set_inner(Ledger {
            access_controller: self.access_controller.key(),
            token_validator: self.token_validator.key(),
            fundlock: self.fundlock.key(),
            underlying_token: self.underlying_token.key(),
            strike_token: self.strike_token.key(),
            underlying_multiplier,
            strike_multiplier,
            bump: bumps.ledger,
        });
        Ok(())
    }
}
