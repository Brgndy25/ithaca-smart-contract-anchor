use anchor_lang::prelude::*;

#[error_code]
pub enum AccessControlError {
    #[msg("Unauthorized: The signer does not match the member associated with this role.")]
    UnauthorizedSigner,
    #[msg("Cannot renounce the last member of a role.")]
    LastMember,
}
