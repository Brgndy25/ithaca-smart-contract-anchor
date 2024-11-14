use crate::error::AccessControlError;
use crate::state::access_controller_state::{AccessController, Member, Role};
use crate::Roles;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(role_granted: String, new_member: Pubkey)]
pub struct GrantRole<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [b"access_controller".as_ref(), access_controller.admin.as_ref()],
        bump = access_controller.bump,
    )]
    pub access_controller: Account<'info, AccessController>,
    #[account(
        init_if_needed,
        payer = admin,
        seeds = [b"role".as_ref(), access_controller.key().as_ref(), role_granted.as_str().as_bytes()],
        space = Role::INIT_SPACE,
        bump
    )]
    pub role: Account<'info, Role>,
    #[account(
        init,
        payer = admin,
        seeds = [b"member".as_ref(), role.key().as_ref(), new_member.as_ref()],
        space = Member::INIT_SPACE,
        bump 
    )]
    pub member: Account<'info, Member>,
    pub system_program: Program<'info, System>,
}

impl<'info> GrantRole<'info> {
    //will grant the role to the new member according to the role's name
    pub fn grant_role(&mut self, role_granted: String, new_member: Pubkey, bumps: &GrantRoleBumps) -> Result<()> {
        require!(
            self.access_controller.admin == *self.admin.key,
            AccessControlError::UnauthorizedAdmin
        );
        require!(
            Roles::is_valid_role(&role_granted),
            AccessControlError::InvalidRole
        );
        self.role.set_inner(Role {
            role: role_granted.clone(),
            member_count: self.role.member_count + 1,
            bump: bumps.role,
        });
        self.member.set_inner(Member {
            member: new_member,
            bump: bumps.member,
        });

        msg!("User {} granted role {} successfully", new_member.to_string(), role_granted);

        Ok(())

    }
}
