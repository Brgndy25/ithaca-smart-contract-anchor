use crate::error::TokenValidatorError;
use crate::state::access_controller_state::{AccessController, Role};
use crate::state::fundlock_state::Fundlock;
use crate::{ClientBalance, Roles, TokenValidator, WhitelistedToken};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct BalanceSheetFundlock<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account()]
    pub client: SystemAccount<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Box<Account<'info, AccessController>>,
    #[account(
        seeds = [b"role".as_ref(), access_controller.key().as_ref(), Roles::Admin.as_str().as_bytes()],
        bump = role.bump
    )]
    pub role: Box<Account<'info, Role>>,
    #[account(
        seeds = [b"token_validator".as_ref(), role.key().as_ref()],
        bump = token_validator.bump
    )]
    pub token_validator: Box<Account<'info, TokenValidator>>,
    #[account(
        seeds = [b"fundlock".as_ref(), access_controller.key().as_ref(), token_validator.key().as_ref()],
        bump = fundlock.bump
    )]
    pub fundlock: Box<Account<'info, Fundlock>>,
    #[account(
        constraint = token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub token: Box<Account<'info, Mint>>,
    #[account(
        seeds = [b"whitelisted_token".as_ref(), token_validator.key().as_ref(), token.key().as_ref()],
        bump = whitelisted_token.bump
    )]
    pub whitelisted_token: Box<Account<'info, WhitelistedToken>>,
    #[account(
        seeds = [b"fundlock_token_vault".as_ref(), fundlock.key().as_ref(), token.key().as_ref()],
        token::mint = token,
        token::authority = fundlock,
        bump,
    )]
    pub fundlock_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [b"client_balance".as_ref(), fundlock_token_vault.key().as_ref(), client_ata.key().as_ref()],
        bump = client_balance.bump
    )]
    pub client_balance: Box<Account<'info, ClientBalance>>,
    #[account(
        constraint = client_ata.mint == token.key() && client_ata.owner == client.key()
    )]
    pub client_ata: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
}

impl<'info> BalanceSheetFundlock<'info> {
    pub fn balance_sheet_fundlock(&mut self) -> Result<()> {
        // Log the balance sheet of the client
        msg!(
            "Client: {} token: {} balance is: {}",
            self.client.key(),
            self.token.key(),
            self.client_balance.amount
        );
        Ok(())
    }
}
