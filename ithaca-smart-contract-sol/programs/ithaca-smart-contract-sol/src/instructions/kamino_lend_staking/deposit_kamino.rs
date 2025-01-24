use crate::error::{FundlockError, TokenValidatorError};
use crate::state::access_controller_state::AccessController;
use crate::state::fundlock_state::Fundlock;
use crate::{ClientBalance, KLend, TokenValidator, WhitelistedToken};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions;
use anchor_spl::token::{Mint, Token, TokenAccount};
use kamino_lending_interface::*;

#[derive(Accounts)]
pub struct DepositKamino<'info> {
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
        mut,
        seeds = [b"fundlock".as_ref(), access_controller.key().as_ref(), token_validator.key().as_ref()],
        bump = fundlock.bump
    )]
    pub fundlock: Box<Account<'info, Fundlock>>,
    #[account(
        mut,
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
        mut,
        constraint = client_ata.mint == token.key() &&
        client_ata.owner == client.key()
    )]
    pub client_ata: Box<Account<'info, TokenAccount>>,
    #[account( 
        mut,
        seeds = [b"client_balance".as_ref(), fundlock_token_vault.key().as_ref(), client_ata.key().as_ref()],
        bump = client_balance.bump
    )]
    pub client_balance: Box<Account<'info, ClientBalance>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,

    // Accounts associated with the Kamino program
    // All unchecked accounts are safe to use due to them getting validated inside the Kamino Program

    /// CHECK: Safe to use
    #[account(mut)]
    pub reserve: AccountInfo<'info>,
    /// CHECK: Safe to use
    pub lending_market: AccountInfo<'info>,
    /// CHECK: Safe to use
    pub lending_market_authority: AccountInfo<'info>,
    /// CHECK: Safe to use
    #[account(mut)]
    pub reserve_liquidity_supply: AccountInfo<'info>,
    #[account(
        mut,
        constraint = token.decimals > 0 @ TokenValidatorError::NonFungibleToken
    )]
    pub reserve_collateral_token: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = client,
        seeds = [b"fundlock_collateral_vault".as_ref(), fundlock_token_vault.key().as_ref(), reserve_collateral_token.key().as_ref()],
        token::mint = reserve_collateral_token,
        token::authority = fundlock,
        bump
    )]
    pub fundlock_collateral_vault:  Box<Account<'info, TokenAccount>>,
    pub kamino_program: Program<'info, KLend>,
    #[account(address = instructions::ID)]
    /// CHECK: InstructionsSysvar account
    instructions: UncheckedAccount<'info>,
}

impl<'info> DepositKamino<'info> {
    pub fn deposit_kamino(&mut self, amount: u64) -> Result<()> {
        require!(amount > 0, FundlockError::AmountZero);
        require!(self.client_balance.amount >= amount, FundlockError::InsufficientBalance);

        let access_validator_key = self.access_controller.key();
        let token_validator_key = self.token_validator.key();

        let fundlock_collateral_vault_balance_before = self.fundlock_collateral_vault.amount;

        let fundlock_seeds: &[&[&[u8]]] = &[&[
            b"fundlock".as_ref(),
            access_validator_key.as_ref(),
            token_validator_key.as_ref(),
            &[self.fundlock.bump],
        ]];

        let deposit_accounts = DepositReserveLiquidityAccounts {
            owner: &self.fundlock.to_account_info(),
            reserve: &self.reserve.to_account_info(),
            lending_market: &self.lending_market.to_account_info(),
            lending_market_authority: &self.lending_market_authority.to_account_info(),
            reserve_liquidity_supply: &self.reserve_liquidity_supply.to_account_info(),
            reserve_collateral_mint: &self.reserve_collateral_token.to_account_info(),
            user_source_liquidity: &self.fundlock_token_vault.to_account_info(),
            user_destination_collateral: &self.fundlock_collateral_vault.to_account_info(),
            collateral_token_program: &self.token_program.to_account_info(),
            reserve_liquidity_mint: &self.token.to_account_info(),
            liquidity_token_program: &self.token_program.to_account_info(),
            instruction_sysvar_account: &self.instructions.to_account_info(),
        };

        let deposit_ix_args = DepositReserveLiquidityIxArgs {
            liquidity_amount: amount,
        };

        deposit_reserve_liquidity_invoke_signed(deposit_accounts, deposit_ix_args, fundlock_seeds)
            .expect("Failed to deposit Kamino into the reserve liquidity supply");

        self.fundlock_collateral_vault.reload().expect("Failed to reload data for fundlock collateral vault");

        let deposit_collateral_amount: u64 = self.fundlock_collateral_vault.amount - fundlock_collateral_vault_balance_before;

        self.client_balance.collateral_amount += deposit_collateral_amount;

        msg!("User {} Successfully deposited {} of {} into Kamino",self.client.key().to_string(), amount, self.token.key().to_string());
        
        Ok(())
    }
}
