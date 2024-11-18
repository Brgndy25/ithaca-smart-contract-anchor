use anchor_lang::prelude::*;

// expect to derive from access_controller account
#[account]
pub struct Ledger {
    pub access_controller: Pubkey,
    pub token_validator: Pubkey,
    pub fundlock: Pubkey,
    pub underlying_token: Pubkey,
    pub strike_token: Pubkey,
    pub underlying_multiplier: i64,
    pub strike_multiplier: i64,
    pub bump: u8,
}

impl Space for Ledger {
    const INIT_SPACE: usize = 8 + // account discriminator
    32 + // access_controller
    32 + // token_validator
    32 + // fundlock
    32 + // underlying_token
    32 + // strike_token
    8 + // underlying_multiplier
    8 + // strike_multiplier
    1; // bump
}
