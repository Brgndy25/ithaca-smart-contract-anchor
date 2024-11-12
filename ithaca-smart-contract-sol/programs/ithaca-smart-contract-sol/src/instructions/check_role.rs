use crate::error::AccessControlError;
use crate::state::access_controller_state::{AccessController, Member, Role};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(_role_checked: String, _member_pk: Pubkey)]
pub struct CheckRole<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Account<'info, AccessController>,
    #[account(
        mut,
        seeds = [b"role".as_ref(), access_controller.key().as_ref(), _role_checked.as_str().as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'info, Role>,
    #[account(
        mut,
        seeds = [b"member".as_ref(), role.key().as_ref(), _member_pk.as_ref()],
        bump = member.bump,
    )]
    pub member: Account<'info, Member>,
    pub system_program: Program<'info, System>,
}

impl<'info> CheckRole<'info> {
    // Will check the role according to the signer's pubkey
    pub fn check_role(&mut self, _role_checked: String, _member_pk: Pubkey) -> Result<()> {
        require!(
            !self.member.to_account_info().data_is_empty(),
            AccessControlError::NoRole
        );

        msg!("{:?} has a role assigned: {:?}", _member_pk, self.role.role);
        Ok(())
    }
}
