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
    #[msg("The withdrawal queue limit of 5 has been reached")]
    WithdrawalLimitReached,
    #[msg("Withdrawal under this index is not found")]
    InvalidIndex,
    #[msg("The withdrawal is still in a release lock state")]
    ReleaseLockActive,
    #[msg("Insufficient funds in fundlock vault for the operation")]
    InsufficientFundsInVault,
    #[msg("Invalid amount of accounts provided")]
    InvalidAccountsAmount,
    #[msg("Account order for update balances violated")]
    AccountOrderViolated,
}

#[error_code]
pub enum LedgerError {
    #[msg("The provided positions array is empty")]
    EmptyPoistionsArray,
    #[msg("The provided contract id doesnt match the existing one")]
    InvalidContractId,
    #[msg("The provided account order is violated")]
    AccountOrderViolated,
}
