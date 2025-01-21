use anchor_lang::prelude::*;
use std::str::FromStr;

pub const ALLOWED_WITHDRAWAL_LIMIT: usize = 5;
pub const KAMINO_PROGRAM_ID: &str = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";

#[derive(Clone)]
pub struct KLend;

impl anchor_lang::Id for KLend {
    fn id() -> Pubkey {
        Pubkey::from_str(KAMINO_PROGRAM_ID).unwrap()
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Roles {
    Admin,
    UtilityAccount,
    Liquidator,
}

impl Roles {
    pub fn as_str(&self) -> &'static str {
        match self {
            Roles::Admin => "DEFAULT_ADMIN_ROLE",
            Roles::UtilityAccount => "UTILITY_ACCOUNT_ROLE",
            Roles::Liquidator => "LIQUIDATOR_ROLE",
        }
    }

    pub fn from_str(role: &str) -> Option<Self> {
        match role {
            "DEFAULT_ADMIN_ROLE" => Some(Roles::Admin),
            "UTILITY_ACCOUNT_ROLE" => Some(Roles::UtilityAccount),
            "LIQUIDATOR_ROLE" => Some(Roles::Liquidator),
            _ => None,
        }
    }

    pub fn is_valid_role(role: &str) -> bool {
        matches!(
            role,
            "DEFAULT_ADMIN_ROLE" | "UTILITY_ACCOUNT_ROLE" | "LIQUIDATOR_ROLE"
        )
    }
}
