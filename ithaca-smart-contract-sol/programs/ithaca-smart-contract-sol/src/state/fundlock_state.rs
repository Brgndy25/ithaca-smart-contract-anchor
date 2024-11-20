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
pub struct ClientBalance {
    pub amount: u64,
    pub token: Pubkey,
    pub client: Pubkey,
    pub client_ata: Pubkey,
    pub bump: u8,
}

#[account]
pub struct WithdrawalState {
    pub amount: u64,
    pub timestamp: i64,
}

#[account]
pub struct Withdrawals {
    pub withdrawal_queue: Vec<WithdrawalState>,
    pub active_withdrawals_amount: u64,
    pub client: Pubkey,
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

impl Space for ClientBalance {
    const INIT_SPACE: usize = 8 + // account discriminator
    8 + // amount
    32 + // token pubkey
    32 + // client pubkey
    32 + // client ata pubkey
    1; // bump
}

impl Space for Withdrawals {
    const INIT_SPACE: usize = 8 + // account discriminator
    4 + (ALLOWED_WITHDRAWAL_LIMIT * 16) + // withdrawals limited to 5 per client
    8 + // active withdrawals amount
    32 + // client balance pda
    8; // bump
}
