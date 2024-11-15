use crate::error::FundlockError;
use crate::state::access_controller_state::{AccessController, Role};
use crate::state::fundlock_state::Fundlock;
use crate::{ClientBalance, Ledger, Roles, TokenValidator};
use anchor_lang::prelude::*;
use std::cell::RefMut;

#[derive(Accounts)]
pub struct UpdateBalancesFundlock<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
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
    // TODO! Add Ledger account as a signer
    // pub ledger: Box<Account<'info, Ledger>>,
    pub system_program: Program<'info, System>,
}

impl<'info> UpdateBalancesFundlock<'info> {
    pub fn update_balances_fundlock(
        &mut self,
        amounts: Vec<u64>,
        clients: Vec<Pubkey>,
        mut account_datas: Vec<RefMut<'_, &mut [u8]>>,
        backend_id: u64,
    ) -> Result<()> {
        require!(
            account_datas.len() == amounts.len()
                && account_datas.len() == clients.len()
                && account_datas.len() > 0,
            FundlockError::InvalidAccountsAmount
        );
        for i in 0..account_datas.len() {
            let data = &mut account_datas[i];

            let mut client_balance = ClientBalance::try_deserialize(&mut data.as_ref())
                .expect("Error Desarializing Client Balance");

            client_balance.amount += amounts[i];

            client_balance.try_serialize(&mut **data)?;
            msg!(
                "Balance of {} client updated successfully to {}",
                clients[i],
                client_balance.amount.to_string()
            );
        }
        msg!("Balances updated successfully! Backend ID: {}", backend_id);
        Ok(())
    }
}
