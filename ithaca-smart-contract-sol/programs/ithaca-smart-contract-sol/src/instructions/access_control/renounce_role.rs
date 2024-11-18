use crate::error::AccessControlError;
use crate::state::access_controller_state::{AccessController, Member, Role};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(_role_renounced: String, _member_pk: Pubkey)]
pub struct RenounceRole<'info> {
    #[account(mut,
    constraint = admin.key() == access_controller.admin @ AccessControlError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Account<'info, AccessController>,
    #[account(
        mut,
        seeds = [b"role".as_ref(), access_controller.key().as_ref(), _role_renounced.as_str().as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'info, Role>,
    #[account(
        mut,
        close = admin,
        seeds = [b"member".as_ref(), role.key().as_ref(), _member_pk.as_ref()],
        bump = member.bump,
    )]
    pub member: Account<'info, Member>,
    pub system_program: Program<'info, System>,
}

impl<'info> RenounceRole<'info> {
    // Will renounce the role according to the signer's pubkey
    pub fn renounce_role(&mut self, _role_renounced: String, _member_pk: Pubkey) -> Result<()> {
        require!(self.role.member_count != 1, AccessControlError::LastMember);
        Ok(())
    }
}
