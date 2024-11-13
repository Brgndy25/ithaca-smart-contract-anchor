use anchor_lang::prelude::*;

#[error_code]
pub enum AccessControlError {
    #[msg("Only admin is authorized to perform this action")]
    UnauthorizedAdmin,
    #[msg("Invalid role: The provided role does not exist")]
    InvalidRole,
    #[msg("Cannot renounce the last member from the role")]
    LastMember,
    #[msg("This member doesn't not have any role assigned")]
    NoRole,
}

#[error_code]
pub enum TokenValidatorError {
    #[msg("The provided token is not a fungible token")]
    NonFungibleToken,
    #[msg("The provided token is not whitelisted")]
    TokenNotWhitelisted,
}

#[error_code]
pub enum FundlockError {
    #[msg("The amount cannot be zero")]
    AmountZero,
    #[msg("Insufficient funds for the operation")]
    InsufficientFunds,
}
