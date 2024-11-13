use crate::constants::*;
use anchor_lang::prelude::*;

// expect to derive from access_controller account
#[account]
pub struct Fundlock {
    pub access_controller: Pubkey,
    pub token_validator: Pubkey,
    pub trade_lock: i64,
    pub release_lock: i64,
    pub bump: u8,
}

#[account]
pub struct WithdrawalState {
    pub amount: u64,
    pub timestamp: i64,
    pub bump: u8,
}

//will be dervied using tokens mint to differentiate client balance between different tokens
#[account]
pub struct Balance {
    pub client: Pubkey,
    pub balance: u64,
    pub bump: u8,
}

#[account]
pub struct Withdrawals {
    pub withdrawals: Vec<WithdrawalState>,
    pub bump: u8,
}

impl Space for Fundlock {
    const INIT_SPACE: usize = 8 + // account discriminator
    32 + // access controller pubkey
    32 + // token validator pubkey
    8 + // trade lock
    8 + // release lock
    1; // bump
}

impl Space for WithdrawalState {
    const INIT_SPACE: usize = 8 + // account discriminator
    8 + // amount
    8 + // timestamp
    1; // bump
}

impl Space for Balance {
    const INIT_SPACE: usize = 8 + // account discriminator
    32 + // client pubkey
    8 + // balance
    1; // bump
}

impl Space for Withdrawals {
    const INIT_SPACE: usize = 8 + // account discriminator
    4 + (ALLOWED_WITHDRAWAL_LIMIT * 24) + // withdrawals limited to 5 per client
    8; // bump
}
