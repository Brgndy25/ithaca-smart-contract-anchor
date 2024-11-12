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
