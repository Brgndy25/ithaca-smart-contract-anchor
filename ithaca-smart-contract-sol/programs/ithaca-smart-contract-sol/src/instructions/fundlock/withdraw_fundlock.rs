use crate::error::{FundlockError, TokenValidatorError};
use crate::state::access_controller_state::AccessController;
use crate::state::fundlock_state::Fundlock;
use crate::{
    ClientBalance, TokenValidator, WhitelistedToken, WithdrawalState, Withdrawals,
    ALLOWED_WITHDRAWAL_LIMIT,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct WithdrawFundlock<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Box<Account<'info, AccessController>>,
    #[account(
        seeds = [b"token_validator".as_ref(), access_controller.key().as_ref()],
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
        mut,
        seeds = [b"client_balance".as_ref(), fundlock_token_vault.key().as_ref(), client_ata.key().as_ref()],
        bump = client_balance.bump
    )]
    pub client_balance: Box<Account<'info, ClientBalance>>,
    #[account(
        constraint = client_ata.mint == token.key() &&
        client_ata.owner == client.key()
    )]
    pub client_ata: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [b"withdrawals".as_ref(), fundlock.key().as_ref(), client_balance.key().as_ref()],
        bump = withdrawals.bump
    )]
    pub withdrawals: Box<Account<'info, Withdrawals>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> WithdrawFundlock<'info> {
    pub fn withdraw_fundlock(&mut self, amount: u64) -> Result<()> {
        require!(amount > 0, FundlockError::AmountZero);
        require!(
            self.client_balance.amount >= amount,
            FundlockError::InsufficientFunds
        );
        require!(
            self.withdrawals.withdrawal_queue.len() < ALLOWED_WITHDRAWAL_LIMIT,
            FundlockError::WithdrawalLimitReached
        );

        let withdrawal = WithdrawalState {
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        };

        self.withdrawals.withdrawal_queue.push(withdrawal);

        self.client_balance.set_inner(ClientBalance {
            amount: self.client_balance.amount - amount,
            token: self.token.key(),
            client: self.client.key(),
            client_ata: self.client_ata.key(),
            bump: self.client_balance.bump,
        });

        self.withdrawals.active_withdrawals_amount += amount;
        self.withdrawals.client = self.client.key();
        // self.withdrawals.bump = bumps.withdrawals;

        let index = self.withdrawals.withdrawal_queue.len() - 1;

        // Log the index of the new element
        msg!("New withdrawal added at index: {}", index);

        //log the active withdrawal amoun
        msg!(
            "Active withdrawal amount: {}",
            self.withdrawals.active_withdrawals_amount.to_string()
        );

        // Log the withdrawal event
        msg!(
            "Withdraw queued: client={}, token={}, amount={}, slot={}",
            self.client.key(),
            self.token.key(),
            amount,
            index
        );
        Ok(())
    }
}
