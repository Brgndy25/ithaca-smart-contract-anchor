use anchor_lang::prelude::*;

// expect to derive from access_controller account
#[account]
pub struct Ledger {
//TODO ADD LEDGER STATES
    pub bump: u8,
}


impl Space for Ledger {
    const INIT_SPACE: usize = 8 + // account discriminator
    1; // bump
}