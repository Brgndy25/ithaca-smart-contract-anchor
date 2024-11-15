use crate::error::TokenValidatorError;
use crate::state::access_controller_state::{AccessController, Role};
use crate::state::fundlock_state::Fundlock;
use crate::{ClientBalance, Roles, TokenValidator, WhitelistedToken, Withdrawals};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct FundFromWithdrawal<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
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
        constraint = client_ata.mint == token.key() &&
        client_ata.owner == client.key()
    )]
    pub client_ata: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [b"withdrawals".as_ref(), fundlock.key().as_ref(), client_balance.key().as_ref()],
        bump = withdrawals.bump
    )]
    pub withdrawals: Box<Account<'info, Withdrawals>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> FundFromWithdrawal<'info> {
    pub fn fund_from_withdrawal(&mut self, amount: u64) -> bool {
        let mut funded_sum: u64 = 0;
        let trade_lock = self.fundlock.trade_lock;
        for index in 0..self.withdrawals.withdrawal_queue.len() {
            let withdrawal = &mut self.withdrawals.withdrawal_queue[index];

            if withdrawal.timestamp + trade_lock > Clock::get().unwrap().unix_timestamp {
                let left_to_fund = amount - funded_sum;
                let available_amount = withdrawal.amount;

                if available_amount <= left_to_fund {
                    funded_sum += available_amount;
                    withdrawal.amount = 0;
                    withdrawal.timestamp = 0;
                    self.withdrawals.active_withdrawals_amount -= available_amount;
                    self.withdrawals.withdrawal_queue.remove(index);
                    msg!(
                        "Funded from withdrawal: client={}, token={}, amount={}, index={}",
                        self.client.key(),
                        self.token.key(),
                        available_amount,
                        index
                    );
                } else {
                    funded_sum += left_to_fund;
                    withdrawal.amount -= left_to_fund;
                    self.withdrawals.active_withdrawals_amount -= left_to_fund;
                    msg!(
                        "Funded from withdrawal: client={}, token={}, amount={}, index={}",
                        self.client.key(),
                        self.token.key(),
                        left_to_fund,
                        index
                    );
                }
            }
            if funded_sum == amount {
                return true;
            }
        }
        false
    }
}
