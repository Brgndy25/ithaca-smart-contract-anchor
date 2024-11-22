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

// Unique per ledger and contract id,
#[account]
pub struct Contract {
    pub contract_id: u64,
    pub bump: u8,
}

// Unique per contract and client
// Client pubkey X
#[account]
pub struct Position {
    pub contract_id: u64,
    pub client: Pubkey,
    pub size: u64,
    pub bump: u8,
}

// Used as a parameter only, will not get init as an onchain account
#[account]
pub struct PositionsParam {
    pub contract_id: u64,
    pub client: Pubkey,
    pub size: u64,
}

#[account]
pub struct FundMovementParam {
    pub client: Pubkey,
    pub underlying_amount: i64,
    pub strike_amount: i64,
}

#[account]
pub struct FundMovementParamOptimized {
    pub underlying_amount: i64,
    pub strike_amount: i64,
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

impl Space for Contract {
    const INIT_SPACE: usize = 8 + // account discriminator
    8 + // contract_id
    1; // bump
}

impl Space for Position {
    const INIT_SPACE: usize = 8 + // account discriminator
    8 + // contract_id
    32 + // client
    8 + // size
    1; // bump
}
