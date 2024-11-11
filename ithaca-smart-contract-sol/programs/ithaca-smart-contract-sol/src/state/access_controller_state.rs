use anchor_lang::prelude::*;

// expect to derive from the account init signer/payer
#[account]
pub struct AccessController {
    pub admin: Pubkey,
    //pub roles: Vec<Role>,
    pub bump: u8,
}

// expect to derive from AccessController account
#[account]
pub struct Role {
    pub role: String,
    pub bump: u8,
}

// expect to derive from Role account
#[account]
pub struct Member {
    pub member: Pubkey,
    pub bump: u8,
}

impl Space for AccessController {
    const INIT_SPACE: usize = 8 + // account discriminator
    32 + // admin pubkey
    1; // bump
}

impl Space for Role {
    const INIT_SPACE: usize = 8 + // account discriminator
    32 + // role string (expected max size of 32 bytes)
    1; // bump
}

impl Space for Member {
    const INIT_SPACE: usize = 8 + // account discriminator
    32 + // role member pubkey
    1; // bump
}
