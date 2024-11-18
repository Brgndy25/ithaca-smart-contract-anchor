use anchor_lang::prelude::*;

// expect to derive from access_controller account
#[account]
pub struct TokenValidator {
    pub access_controller: Pubkey,
    pub bump: u8,
}

// expect to derive from whitelistedToken account
#[account]
pub struct WhitelistedToken {
    pub token_mint: Pubkey,
    // Decimals on chain
    pub token_decimals: u8,
    // Precision from backend
    pub token_precision: u8,
    pub bump: u8,
}

impl Space for TokenValidator {
    const INIT_SPACE: usize = 8 + // account discriminator
    32 + // access controller pubkey
    1; // bump
}

impl Space for WhitelistedToken {
    const INIT_SPACE: usize = 8 + // account discriminator
    32 + // token mint pubkey
    1 + // token decimals
    1 + // token precision
    1; // bump
}
