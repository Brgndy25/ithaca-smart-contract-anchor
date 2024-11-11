use anchor_lang::prelude::*;

#[error_code]
pub enum AccessControlError {
    #[msg("Only admin is authorized to perform this action")]
    UnauthorizedAdmin,
    #[msg("Invalid role: The provided role does not exist")]
    InvalidRole,
}
