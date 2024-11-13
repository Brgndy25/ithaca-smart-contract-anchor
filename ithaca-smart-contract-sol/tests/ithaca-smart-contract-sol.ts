import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
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

  //Payer Keypair that is going to pay for token creation
  const payer = Keypair.generate();

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
  let fetchedaccessControllerAccount;

  let tokenValidatorAccount: PublicKey;
  let fetchedTokenValidatorAccount;

  let fundlockAccount: PublicKey;
  let fetchedFundlockAccount;

  let trade_lock = new anchor.BN(10 * 60 * 1000); // 10 minutes
  let release_lock = new anchor.BN(20 * 60 * 1000); // 10 minutes


  let usdcMint: PublicKey;
  let whitelistedUsdcTokenAccount: PublicKey;
  let fetchedWhitelistedUsdcTokenAccount;

  let mockMint: PublicKey;
  let whitelistedMockTokenAccount: PublicKey;
  let fetchedwhitelistedMockTokenAccount;

  let roleAccountAdmin: PublicKey;
  let memberAccountAdmin: PublicKey;

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
      [admin, utilityAccount, payer].map(async (account) => {
        await provider.connection
          .requestAirdrop(account.publicKey, 100 * LAMPORTS_PER_SOL)
          .then(confirmTx);
      })
    );

    assert.equal(await getAccountBalance(provider.connection, admin.publicKey), 100, "Airdrop failed");
    assert.equal(await getAccountBalance(provider.connection, utilityAccount.publicKey), 100, "Airdrop failed");
    assert.equal(await getAccountBalance(provider.connection, payer.publicKey), 100, "Airdrop failed");
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

    let whitelist;
    try {
      whitelist = await provider.connection.getAccountInfo(memberAccountMockUtilityAccount);
    } catch (err) {
      console.error("Error fetching account info:", err);
    }

    // Check if the account has been closed
    assert.equal(whitelist, null, "Member account should be null after being closed");

    // If the account still exists, check if the account data length is zero and it has no lamports
    if (whitelist) {
      assert.equal(whitelist.data.length, 0, "Member account data length should be zero");
      assert.equal(whitelist.lamports, 0, "Member account should have no lamports");
    }
  });

  it("Checks the role of the Utility Account Member", async () => {
    let checkRoleTx = await program.methods.checkRole(UTILITY_ACCOUNT_ROLE, utilityAccount.publicKey).accountsPartial({
      accessController: accessControllerAccount,
      member: memberAccountUtilityAccount,
      role: roleAccountUtilityAccount,
      caller: utilityAccount.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([utilityAccount]).rpc().then(confirmTx).then(log);

  });

  it("Check Role should failed due to mock utility account not having a role initialized", async () => {

    try {
      let checkRoleTx = await program.methods.checkRole(UTILITY_ACCOUNT_ROLE, mockUtilityAccount.publicKey).accountsPartial({
        accessController: accessControllerAccount,
        member: memberAccountMockUtilityAccount,
        role: roleAccountUtilityAccount,
        caller: mockUtilityAccount.publicKey,
        systemProgram: SystemProgram.programId,
      }).signers([mockUtilityAccount]).rpc().then(confirmTx).then(log);

      // If the transaction succeeds, the test should fail
      assert.fail("The transaction should have failed due to the Mock Utility Account not existing.");
    } catch (err) {
      // Check that the error is the expected one
      console.log("Expected error:", err);
      assert.ok(err, "The transaction failed as expected.");
    }

  });


  it("Find Token Validator Account PDA", async () => {

    tokenValidatorAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("token_validator"),
        roleAccountAdmin.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Token Validator Account:", memberAccountMockUtilityAccount.toString());

  });

  it("Initialize Token Validator Account", async () => {
    let initTokenValidatorTx = await program.methods.initTokenValidator().accountsPartial({
      accessController: accessControllerAccount,
      role: roleAccountAdmin,
      member: memberAccountAdmin,
      systemProgram: SystemProgram.programId,
      admin: admin.publicKey,
      tokenValidator: tokenValidatorAccount,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    fetchedTokenValidatorAccount = await program.account.tokenValidator.fetch(tokenValidatorAccount);

    assert.equal(fetchedTokenValidatorAccount.accessController.toString(), accessControllerAccount.toString(), "Token Validator Account not initialized");

  });

  it("Create a token mint with params equal to USDC on SOL", async () => {
    usdcMint = await splToken.createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    console.log("USDC Mint:", usdcMint.toString());
  });

  it("Find a whitelisted USDC token account PDA", async () => {
    whitelistedUsdcTokenAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("whitelisted_token"),
        tokenValidatorAccount.toBuffer(),
        usdcMint.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Whitelisted USDC Token Account:", whitelistedUsdcTokenAccount.toString());
  });

  it("Whitelist USDC Token Account", async () => {
    let whitelistTokenTx = await program.methods.addTokenToWhitelist().accountsPartial({
      accessController: accessControllerAccount,
      member: memberAccountAdmin,
      role: roleAccountAdmin,
      tokenValidator: tokenValidatorAccount,
      whitelistedToken: whitelistedUsdcTokenAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
      newTokenToWhitelist: usdcMint,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    fetchedWhitelistedUsdcTokenAccount = await program.account.whitelistedToken.fetch(whitelistedUsdcTokenAccount);

    assert.equal(fetchedWhitelistedUsdcTokenAccount.tokenMint.toString(), usdcMint.toString(), "USDC Token not whitelisted");
  });

  it("Create a mock token mint", async () => {
    mockMint = await splToken.createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );
  });

  it("Find a whitelisted Mock token account PDA", async () => {
    whitelistedMockTokenAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("whitelisted_token"),
        tokenValidatorAccount.toBuffer(),
        mockMint.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Whitelisted Mock Token Account:", whitelistedMockTokenAccount.toString());
  });

  it("Whitelist Mock Token Account", async () => {
    let whitelistTokenTx = await program.methods.addTokenToWhitelist().accountsPartial({
      accessController: accessControllerAccount,
      member: memberAccountAdmin,
      role: roleAccountAdmin,
      tokenValidator: tokenValidatorAccount,
      whitelistedToken: whitelistedMockTokenAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
      newTokenToWhitelist: mockMint,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    fetchedwhitelistedMockTokenAccount = await program.account.whitelistedToken.fetch(whitelistedMockTokenAccount);

    assert.equal(fetchedwhitelistedMockTokenAccount.tokenMint.toString(), mockMint.toString(), "Mock Token not whitelisted");
  });

  it("Remove Mock Token Account from Whitelist", async () => {
    let removeWhitelistTokenTx = await program.methods.removeTokenFromWhitelist().accountsPartial({
      accessController: accessControllerAccount,
      member: memberAccountAdmin,
      role: roleAccountAdmin,
      tokenValidator: tokenValidatorAccount,
      whitelistedToken: whitelistedMockTokenAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
      tokenToRemove: mockMint,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    let whitelistedMockTokenAccountInfo;
    try {
      whitelistedMockTokenAccountInfo = await provider.connection.getAccountInfo(whitelistedMockTokenAccount);
    } catch (err) {
      console.error("Error fetching account info:", err);
    }

    // Check if the account has been closed
    assert.equal(whitelistedMockTokenAccountInfo, null, "Member account should be null after being closed");

    // If the account still exists, check if the account data length is zero and it has no lamports
    if (whitelistedMockTokenAccountInfo) {
      assert.equal(whitelistedMockTokenAccountInfo.data.length, 0, "Member account data length should be zero");
      assert.equal(whitelistedMockTokenAccountInfo.lamports, 0, "Member account should have no lamports");
    }
  });

  it("Find Fundlock Account PDA", async () => {

    fundlockAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("fundlock"),
        accessControllerAccount.toBuffer(),
        tokenValidatorAccount.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Fundlock Account:", fundlockAccount.toString());
  });

  it("Initialize Fundlock Account", async () => {
    let initFundlockTx = await program.methods.initFundlock(trade_lock, release_lock).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      role: roleAccountAdmin,
      systemProgram: SystemProgram.programId,
      caller: admin.publicKey,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    fetchedFundlockAccount = await program.account.fundlock.fetch(fundlockAccount);

    assert.equal(fetchedFundlockAccount.accessController.toString(), accessControllerAccount.toString(), "Fundlock Account not initialized");

    assert.equal(fetchedFundlockAccount.tokenValidator.toString(), tokenValidatorAccount.toString(), "Fundlock Account not initialized");

    assert.equal(fetchedFundlockAccount.tradeLock.toString(), trade_lock.toString(), "Trade Lock not initialized");

    assert.equal(fetchedFundlockAccount.releaseLock.toString(), release_lock.toString(), "Release Lock not initialized");
  });
});
