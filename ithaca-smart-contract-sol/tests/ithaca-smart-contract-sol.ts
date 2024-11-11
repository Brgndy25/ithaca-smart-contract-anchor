import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { IthacaSmartContractSol } from "../target/types/ithaca_smart_contract_sol";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  Account,
} from "@solana/spl-token";
import {
  Transaction,
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";

const assert = require("assert");

const confirmTx = async (signature: string) => {
  const latestBlockhash = await anchor
    .getProvider()
    .connection.getLatestBlockhash();
  await anchor.getProvider().connection.confirmTransaction({
    signature,
    ...latestBlockhash,
  });
  return signature;
};

const log = async (signature: string): Promise<string> => {
  console.log(
    `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${anchor.getProvider().connection.rpcEndpoint
    }`
  );
  return signature.toString();
};

async function getAccountBalance(
  connection: Connection,
  pk: PublicKey
): Promise<number> {
  let amount = (await connection.getAccountInfo(pk)).lamports;

  return amount / LAMPORTS_PER_SOL;
}

async function getTokenAccountBalance(
  connection: Connection,
  pk: PublicKey
): Promise<string> {
  let amount = await (await connection.getTokenAccountBalance(pk)).value.amount;

  return amount;
}


describe("ithaca-smart-contract-sol", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.IthacaSmartContractSol as Program<IthacaSmartContractSol>;

  //Admin Keypair
  const admin = Keypair.generate();

  // Utility Account Keypair
  const utilityAccount = Keypair.generate();

  // Mock Utility Account Keypair to test renounce role
  const mockUtilityAccount = Keypair.generate();

  // Roles
  const ADMIN_ROLE: string = "DEFAULT_ADMIN_ROLE";
  const UTILITY_ACCOUNT_ROLE: string = "UTILITY_ACCOUNT_ROLE";
  const LIQUIDATOR_ROLE: string = "LIQUIDATOR_ROLE";

  let accessControllerAccount: PublicKey;

  let roleAccountAdmin: PublicKey;
  let memberAccountAdmin: PublicKey;

  let fetchedaccessControllerAccount;

  let fetchedRoleAccountAdmin;
  let fetchedmemberAccountAdmin;

  let roleAccountUtilityAccount: PublicKey;
  let memberAccountUtilityAccount: PublicKey;

  let fetchedRoleAccountUtilityAccount;
  let fetchedMemberAccountUtilityAccount;

  let memberAccountMockUtilityAccount: PublicKey;

  let fetchedMemberAccountMockUtilityAccount;

  // Airdrop some SOL to pay for the fees. Confirm the airdrop before proceeding.
  it("Airdrops", async () => {
    await Promise.all(
      [admin, utilityAccount].map(async (account) => {
        await provider.connection
          .requestAirdrop(account.publicKey, 100 * LAMPORTS_PER_SOL)
          .then(confirmTx);
      })
    );

    assert.equal(await getAccountBalance(provider.connection, admin.publicKey), 100, "Airdrop failed");
    assert.equal(await getAccountBalance(provider.connection, utilityAccount.publicKey), 100, "Airdrop failed");
  });

  it("Find Access Controller and Admin member and role PDAs", async () => {

    accessControllerAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("access_controller"),
        admin.publicKey.toBuffer(),
      ],
      program.programId
    )[0];


    roleAccountAdmin = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("role"),
        accessControllerAccount.toBuffer(),
        anchor.utils.bytes.utf8.encode(ADMIN_ROLE),

      ],
      program.programId
    )[0];

    memberAccountAdmin = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("member"),
        roleAccountAdmin.toBuffer(),
        admin.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Access Controller Account:", accessControllerAccount.toString());
    console.log("Admin Role Account:", roleAccountAdmin.toString());
    console.log("Admin Member Account:", memberAccountAdmin.toString());

  });

  it("Access Controller Is Initialized", async () => {
    const initAccessControllerTx = await program.methods.initAccessController().accountsPartial({
      accessController: accessControllerAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    console.log("Your transaction signature", initAccessControllerTx);

    fetchedaccessControllerAccount = await program.account.accessController.fetch(accessControllerAccount);

    fetchedRoleAccountAdmin = await program.account.role.fetch(roleAccountAdmin);

    fetchedmemberAccountAdmin = await program.account.member.fetch(memberAccountAdmin);

    assert.equal(fetchedaccessControllerAccount.admin.toString(), admin.publicKey.toString(), "Access Controller not initialized");

    assert.equal(fetchedRoleAccountAdmin.role.toString(), ADMIN_ROLE, "Role not initialized");

    assert.equal(fetchedmemberAccountAdmin.member.toString(), admin.publicKey.toString(), "Member not initialized");

    assert.equal(fetchedRoleAccountAdmin.memberCount.toString(), "1", "Member count not as expected");

  })

  it("Find Utility Account member and role PDAs", async () => {

    roleAccountUtilityAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("role"),
        accessControllerAccount.toBuffer(),
        anchor.utils.bytes.utf8.encode(UTILITY_ACCOUNT_ROLE),
      ],
      program.programId
    )[0];

    memberAccountUtilityAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("member"),
        roleAccountUtilityAccount.toBuffer(),
        utilityAccount.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Utility Account Role Account:", roleAccountUtilityAccount.toString());
    console.log("Utility Account Member Account:", memberAccountUtilityAccount.toString());

  });

  it("Utility Account Role Is Granted", async () => {

    let grantRoleTx = await program.methods.grantRole(UTILITY_ACCOUNT_ROLE, utilityAccount.publicKey).accountsPartial({
      accessController: accessControllerAccount,
      member: memberAccountUtilityAccount,
      role: roleAccountUtilityAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    console.log("Your transaction signature", grantRoleTx);

    fetchedRoleAccountUtilityAccount = await program.account.role.fetch(roleAccountUtilityAccount);
    fetchedMemberAccountUtilityAccount = await program.account.member.fetch(memberAccountUtilityAccount);

    assert.equal(fetchedRoleAccountUtilityAccount.role.toString(), UTILITY_ACCOUNT_ROLE, "Role not initialized");

    assert.equal(fetchedMemberAccountUtilityAccount.member.toString(), utilityAccount.publicKey.toString(), "Member not initialized");

    assert.equal(fetchedRoleAccountUtilityAccount.memberCount.toString(), "1", "Member count not as expected");
  });

  it("Find Mock Utility Account member PDA", async () => {

    memberAccountMockUtilityAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("member"),
        roleAccountUtilityAccount.toBuffer(),
        mockUtilityAccount.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Mock Utility Account Member Account:", memberAccountMockUtilityAccount.toString());

  });

  it("Mock Utility Account Role Is Granted", async () => {

    let grantRoleTx = await program.methods.grantRole(UTILITY_ACCOUNT_ROLE, mockUtilityAccount.publicKey).accountsPartial({
      accessController: accessControllerAccount,
      member: memberAccountMockUtilityAccount,
      role: roleAccountUtilityAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    console.log("Your transaction signature", grantRoleTx);

    fetchedRoleAccountUtilityAccount = await program.account.role.fetch(roleAccountUtilityAccount);
    fetchedMemberAccountMockUtilityAccount = await program.account.member.fetch(memberAccountMockUtilityAccount);

    assert.equal(fetchedRoleAccountUtilityAccount.role.toString(), UTILITY_ACCOUNT_ROLE, "Role not initialized");

    assert.equal(fetchedMemberAccountMockUtilityAccount.member.toString(), mockUtilityAccount.publicKey.toString(), "Member not initialized");

    assert.equal(fetchedRoleAccountUtilityAccount.memberCount.toString(), "2", "Member count not as expected");
  });

  it("Mock Utility Account Role Is Renounced", async () => {

    let renounceRoleTx = await program.methods.renounceRole(UTILITY_ACCOUNT_ROLE, mockUtilityAccount.publicKey).accountsPartial({
      accessController: accessControllerAccount,
      member: memberAccountMockUtilityAccount,
      role: roleAccountUtilityAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    console.log("Your transaction signature", renounceRoleTx);

    let memberAccountInfo;
    try {
      memberAccountInfo = await provider.connection.getAccountInfo(memberAccountMockUtilityAccount);
    } catch (err) {
      console.error("Error fetching account info:", err);
    }

    // Check if the account has been closed
    assert.equal(memberAccountInfo, null, "Member account should be null after being closed");

    // If the account still exists, check if the account data length is zero and it has no lamports
    if (memberAccountInfo) {
      assert.equal(memberAccountInfo.data.length, 0, "Member account data length should be zero");
      assert.equal(memberAccountInfo.lamports, 0, "Member account should have no lamports");
    }
  });
});
