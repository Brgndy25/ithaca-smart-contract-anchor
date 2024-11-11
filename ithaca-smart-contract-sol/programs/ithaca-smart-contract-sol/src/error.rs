use anchor_lang::prelude::*;

#[error_code]
pub enum AccessControlError {
    #[msg("Custom error message")]
    CustomError,
}
