use crate::error::{FundlockError, TokenValidatorError};
use crate::state::access_controller_state::{AccessController, Role};
use crate::state::fundlock_state::Fundlock;
use crate::{Roles, TokenValidator, WhitelistedToken};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct DepositFundlock<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
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
        seeds = [b"fundlock".as_ref(), access_controller.key().as_ref(), token_validator.key().as_ref()],
        bump = fundlock.bump
    )]
    pub fundlock: Account<'info, Fundlock>,
    #[account(
        constraint = token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub token: Account<'info, Mint>,
    // Passing the whitelisted token account to check if the token is whitelisted
    #[account(
        seeds = [b"whitelisted_token".as_ref(), token_validator.key().as_ref(), token.key().as_ref()],
        bump = whitelisted_token.bump
    )]
    pub whitelisted_token: Account<'info, WhitelistedToken>,
    #[account(
        init_if_needed,
        payer = client,
        seeds = [b"client_balance".as_ref(), fundlock.key().as_ref(), client_ata.key().as_ref()],
        token::mint = token,
        token::authority = fundlock,
        bump,
    )]
    pub client_balance: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = client_ata.mint == token.key() &&
        client_ata.owner == client.key())]
    pub client_ata: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> DepositFundlock<'info> {
    // Make sure the amount passed is in lamports
    pub fn deposit_fundlock(&mut self, amount: u64) -> Result<()> {
        require!(amount > 0, FundlockError::DepositAmountZero);
        require!(
            self.whitelisted_token.token_mint == self.token.key(),
            TokenValidatorError::TokenNotWhitelisted
        );

        let cpi_accounts = Transfer {
            from: self.client_ata.to_account_info(),
            to: self.client_balance.to_account_info(),
            authority: self.client.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        transfer(cpi_ctx, amount)
    }
}
