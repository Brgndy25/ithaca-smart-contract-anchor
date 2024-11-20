use crate::error::{FundlockError, TokenValidatorError};
use crate::state::access_controller_state::AccessController;
use crate::state::fundlock_state::Fundlock;
use crate::{ClientBalance, TokenValidator, WhitelistedToken, Withdrawals};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct ReleaseFundlock<'info> {
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
        mut,
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
        mut,
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

impl<'info> ReleaseFundlock<'info> {
    pub fn release_fundlock(&mut self, index: u64) -> Result<()> {
        require!(
            self.withdrawals.withdrawal_queue.len() > index as usize,
            FundlockError::InvalidIndex
        );
        require!(
            self.withdrawals.withdrawal_queue[index as usize].timestamp
                + self.fundlock.release_lock
                < Clock::get()?.unix_timestamp,
            FundlockError::ReleaseLockActive
        );

        require!(
            self.fundlock_token_vault.amount
                >= self.withdrawals.withdrawal_queue[index as usize].amount,
            FundlockError::InsufficientFundsInVault
        );

        let amount_released = self.withdrawals.withdrawal_queue[index as usize].amount;

        let cpi_accounts = Transfer {
            from: self.fundlock_token_vault.to_account_info(),
            to: self.client_ata.to_account_info(),
            authority: self.fundlock.to_account_info(),
        };

        let access_validator_key = self.access_controller.key();
        let token_validator_key = self.token_validator.key();

        let fundlock_seeds: &[&[&[u8]]] = &[&[
            b"fundlock".as_ref(),
            access_validator_key.as_ref(),
            token_validator_key.as_ref(),
            &[self.fundlock.bump],
        ]];

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            fundlock_seeds,
        );

        transfer(cpi_ctx, amount_released).expect("Error transferring tokens");

        self.withdrawals.withdrawal_queue.remove(index as usize);
        self.withdrawals.active_withdrawals_amount -= amount_released;

        // Log the current active withdrawals amount
        msg!(
            "Current client's active withdrawals amount: {}",
            self.withdrawals.active_withdrawals_amount
        );

        msg!("Current withdrawals for the client:");
        for (i, withdrawal) in self.withdrawals.withdrawal_queue.iter().enumerate() {
            msg!(
                "Index: {}, Amount: {}, Timestamp: {}",
                i,
                withdrawal.amount,
                withdrawal.timestamp
            );
        }
        Ok(())
    }
}
