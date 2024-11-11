use crate::constants::*;
use crate::state::access_controller_state::{AccessController, Member, Role};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitAccessController<'info> {
    // Admin account must sign the transaction
    #[account(mut)]
    pub admin: Signer<'info>,
    // using "access_controller" and signer's pk as the seeds, generate a new PDA
    #[account(
        init,
        payer = admin,
        seeds = [b"access_controller".as_ref(), admin.key().as_ref()],
        bump,
        space = AccessController::INIT_SPACE,
    )]
    pub access_controller: Account<'info, AccessController>,
    // using "role" and access_controller's pk as the seeds, generate a new PDA
    #[account(
        init,
        payer = admin,
        seeds = [b"role".as_ref(), access_controller.key().as_ref()],
        bump,
        space = AccessController::INIT_SPACE,
    )]
    pub role: Account<'info, Role>,
    // using "member" and signer's role's pk as the seeds, generate a new PDA
    #[account(
        init,
        payer = admin,
        seeds = [b"member".as_ref(), role.key().as_ref()],
        bump,
        space = AccessController::INIT_SPACE,
    )]
    pub member: Account<'info, Member>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitAccessController<'info> {
    // Will init the three accounts and include the signer as the admin of the access
    // controller, and the signer's pubkey as the first member of the role ADMIN_ROLE
    pub fn initialize(&mut self, bumps: &InitAccessControllerBumps) -> Result<()> {
        self.access_controller.set_inner(AccessController {
            admin: self.admin.key(), // Set admin public key
            bump: bumps.access_controller,
        });
        self.role.set_inner(Role {
            role: ADMIN_ROLE.to_string(),
            bump: bumps.role,
        });
        self.member.set_inner(Member {
            member: self.admin.key(),
            bump: bumps.member,
        });
        Ok(())
    }
}
