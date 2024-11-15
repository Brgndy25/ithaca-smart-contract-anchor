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
import { set } from "@coral-xyz/anchor/dist/cjs/utils/features";

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

async function printTimestamp(provider: anchor.AnchorProvider) {
  // Fetch the Clock sysvar account
  const clock = await provider.connection.getAccountInfo(
    anchor.web3.SYSVAR_CLOCK_PUBKEY
  );

  if (clock) {
    // Decode the account data to access the timestamp
    const timestamp = new anchor.BN(clock.data.slice(32, 40), 'le').toNumber();
    console.log("Current block timestamp:", timestamp);
  } else {
    console.log("Failed to retrieve Clock sysvar.");
  }
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

  // Client One Keypair
  const clientOne = Keypair.generate();
  let clientOneUsdcAta: Account;
  let clientOneUsdcBalance: PublicKey;
  let clientOneMockAta: Account;
  let clientOneMockBalance: PublicKey;
  let clientOneUsdcWithdrawals: PublicKey;
  let fetchedClientOneUsdcWithdrawals;
  let fetchedClientOneUsdcBalance;
  const amountToDepositClientOne = new anchor.BN(10000000);
  const amountToWithdrawClientOne = new anchor.BN((amountToDepositClientOne.toNumber() / 5));

  // Client Two Keypair
  const clientTwo = Keypair.generate();
  let clientTwoUsdcAta: Account;
  let clientTwoUsdcBalance: PublicKey;
  let clientTwoUsdcWithdrawals: PublicKey;
  let fetchedClientTwoUsdcWithdrawals;
  let fetchedClientTwoUsdcBalance;
  const amountToDepositClientTwo = new anchor.BN(10000000);
  const amountToWithdrawClientTwo = new anchor.BN((amountToDepositClientTwo.toNumber() / 5));

  // Roles
  const ADMIN_ROLE: string = "DEFAULT_ADMIN_ROLE";
  const UTILITY_ACCOUNT_ROLE: string = "UTILITY_ACCOUNT_ROLE";
  const LIQUIDATOR_ROLE: string = "LIQUIDATOR_ROLE";

  let accessControllerAccount: PublicKey;
  let fetchedaccessControllerAccount;

  let tokenValidatorAccount: PublicKey;
  let fetchedTokenValidatorAccount;

  let fundlockAccount: PublicKey;
  let fundlockTokenVault: PublicKey;
  let fetchedFundlockAccount;

  // let releaseLock = new anchor.BN(2 * 60 * 1000); // 2 minutes
  let releaseLock = new anchor.BN(2 * 60); // 2 minutes in seconds
  let tradeLock = new anchor.BN(2 * 60); // 2 minutes in seconds


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
      [admin, utilityAccount, payer, clientOne, clientTwo].map(async (account) => {
        await provider.connection
          .requestAirdrop(account.publicKey, 100 * LAMPORTS_PER_SOL)
          .then(confirmTx);
      })
    );

    assert.equal(await getAccountBalance(provider.connection, admin.publicKey), 100, "Airdrop failed");
    assert.equal(await getAccountBalance(provider.connection, utilityAccount.publicKey), 100, "Airdrop failed");
    assert.equal(await getAccountBalance(provider.connection, payer.publicKey), 100, "Airdrop failed");
    assert.equal(await getAccountBalance(provider.connection, clientOne.publicKey), 100, "Airdrop failed");
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
    let initFundlockTx = await program.methods.initFundlock(tradeLock, releaseLock).accountsPartial({
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

    assert.equal(fetchedFundlockAccount.tradeLock.toString(), tradeLock.toString(), "Trade Lock not initialized");

    assert.equal(fetchedFundlockAccount.releaseLock.toString(), releaseLock.toString(), "Release Lock not initialized");
  });

  it("Create a USDC ATA for the client One", async () => {
    clientOneUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientOne,
      usdcMint,
      clientOne.publicKey
    );

    console.log("Client one's USDC Ata:", clientOneUsdcAta.toString());
  });

  it("Create a USDC ATA for the client two", async () => {
    clientTwoUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientTwo,
      usdcMint,
      clientTwo.publicKey
    );

    console.log("Client two's USDC Ata:", clientTwoUsdcAta.toString());
  });

  it("Mint USDC to the client One", async () => {
    let mintToClientOneTx = await splToken.mintTo(
      provider.connection,
      payer,
      usdcMint,
      clientOneUsdcAta.address,
      payer,
      1000000000
    );

    assert.equal(await getTokenAccountBalance(provider.connection, clientOneUsdcAta.address), "1000000000", "USDC not minted to client one");

    console.log("Mint to Client One Transaction:", mintToClientOneTx.toString());
  });

  it("Mint USDC to the client Two", async () => {
    let mintToClientTwoTx = await splToken.mintTo(
      provider.connection,
      payer,
      usdcMint,
      clientTwoUsdcAta.address,
      payer,
      1000000000
    );

    assert.equal(await getTokenAccountBalance(provider.connection, clientTwoUsdcAta.address), "1000000000", "USDC not minted to client two");

    console.log("Mint to Client Two Transaction:", mintToClientTwoTx.toString());
  });

  it("Find the address for fundlock token vault", async () => {

    fundlockTokenVault = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("fundlock_token_vault"),
        fundlockAccount.toBuffer(),
        usdcMint.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Fundlock Token Vault:", fundlockTokenVault.toString());
  });

  it("Find a balance PDA for client one's USDC balance", async () => {

    clientOneUsdcBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockTokenVault.toBuffer(),
        clientOneUsdcAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client One's USDC Balance:", clientOneUsdcBalance.toString());

  });

  it("Find a balance PDA for client two's USDC balance", async () => {

    clientTwoUsdcBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockTokenVault.toBuffer(),
        clientTwoUsdcAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Two's USDC Balance:", clientTwoUsdcBalance.toString());

  });

  it("Deposit USDC from client one to the Fundlock Account", async () => {
    let depositUsdcTx = await program.methods.depositFundlock(amountToDepositClientOne).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      role: roleAccountAdmin,
      fundlock: fundlockAccount,
      client: clientOne.publicKey,
      clientAta: clientOneUsdcAta.address,
      token: usdcMint,
      clientBalance: clientOneUsdcBalance,
      fundlockTokenVault: fundlockTokenVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
    }).signers([clientOne]).rpc().then(confirmTx).then(log);

    fetchedClientOneUsdcBalance = await program.account.clientBalance.fetch(clientOneUsdcBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockTokenVault)).toString(), amountToDepositClientOne.toString(), "USDC not deposited to fundlock");

    assert.equal(fetchedClientOneUsdcBalance.amount.toString(), amountToDepositClientOne.toString(), "Client One's USDC Balance State not updated");
  });

  it("Deposit USDC from client two to the Fundlock Account", async () => {
    let depositUsdcTx = await program.methods.depositFundlock(amountToDepositClientTwo).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      role: roleAccountAdmin,
      fundlock: fundlockAccount,
      client: clientTwo.publicKey,
      clientAta: clientTwoUsdcAta.address,
      token: usdcMint,
      clientBalance: clientTwoUsdcBalance,
      fundlockTokenVault: fundlockTokenVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
    }).signers([clientTwo]).rpc().then(confirmTx).then(log);

    fetchedClientTwoUsdcBalance = await program.account.clientBalance.fetch(clientTwoUsdcBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockTokenVault)).toString(), (amountToDepositClientOne.add(amountToDepositClientTwo)).toString(), "USDC not deposited to fundlock");

    assert.equal(fetchedClientTwoUsdcBalance.amount.toString(), amountToDepositClientTwo.toString(), "Client Two's USDC Balance State not updated");
  });

  it("Create a Mock Token ATA for the client One", async () => {
    clientOneMockAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientOne,
      mockMint,
      clientOne.publicKey
    );

    console.log("Client one's Mock Ata:", clientOneMockAta.toString());
  });

  it("Mint Mock Token to the client One", async () => {
    let mintToClientOneTx = await splToken.mintTo(
      provider.connection,
      payer,
      mockMint,
      clientOneMockAta.address,
      payer,
      1000000000
    );

    assert.equal(await getTokenAccountBalance(provider.connection, clientOneMockAta.address), "1000000000", "Mock not minted to client one");

    console.log("Mint to Client One Transaction:", mintToClientOneTx.toString());
  });

  it("Find a balance PDA for client one's Mock Token and state PDA", async () => {

    clientOneMockBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockAccount.toBuffer(),
        clientOneMockAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client One's Mock Balance:", clientOneMockBalance.toString());

  });


  it("Deposit Mock Token from client one to the Fundlock Account (should fail)", async () => {
    try {
      let depositMockTx = await program.methods.depositFundlock(amountToDepositClientOne).accountsPartial({
        accessController: accessControllerAccount,
        tokenValidator: tokenValidatorAccount,
        role: roleAccountAdmin,
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        clientAta: clientOneMockAta.address,
        token: mockMint,
        clientBalance: clientOneMockBalance,
        fundlockTokenVault: fundlockTokenVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        whitelistedToken: whitelistedMockTokenAccount,
      }).signers([clientOne]).rpc().then(confirmTx).then(log);

      // If the transaction succeeds, the test should fail
      assert.fail("The transaction should have failed.");
    } catch (err) {
      // Check that the error is the expected one
      console.log("Expected error:", err);
      assert.ok(err, "The transaction failed as expected.");
    }

    // Check if the clientOneMockBalance account does not exist after the execution
    try {
      const clientOneMockBalanceInfo = await provider.connection.getAccountInfo(clientOneMockBalance);
      assert.fail("The account should not exist.");
    } catch (err) {
      console.log("Expected error when fetching account info:", err);
      assert.ok(err, "The account does not exist as expected.");
    }
  });

  it(" Find Withdrawals PDA for client one's USDC", async () => {
    clientOneUsdcWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientOneUsdcBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client One's USDC Withdrawals:", clientOneUsdcWithdrawals.toString());
  });

  it(" Find Withdrawals PDA for client two's USDC", async () => {
    clientTwoUsdcWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientTwoUsdcBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Two's USDC Withdrawals:", clientTwoUsdcWithdrawals.toString());
  });

  it("Que a withdraw request of 1/5 of deposited amount client one", async () => {
    let withdrawUsdcTx = await program.methods.withdrawFundlock(amountToWithdrawClientOne).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      role: roleAccountAdmin,
      fundlock: fundlockAccount,
      client: clientOne.publicKey,
      clientAta: clientOneUsdcAta.address,
      token: usdcMint,
      clientBalance: clientOneUsdcBalance,
      fundlockTokenVault: fundlockTokenVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
      withdrawals: clientOneUsdcWithdrawals
    }).signers([clientOne]).rpc().then(confirmTx).then(log);

    fetchedClientOneUsdcWithdrawals = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);

    assert.equal(fetchedClientOneUsdcWithdrawals.activeWithdrawalsAmount.toString(), amountToWithdrawClientOne.toString(), "Client active withdrawals amount not updated");

    assert.equal(fetchedClientOneUsdcWithdrawals.withdrawalQueue.length, 1, "Client One's USDC Withdrawals Queue not updated");

    assert.equal(fetchedClientOneUsdcWithdrawals.withdrawalQueue[0].amount.toString(), amountToWithdrawClientOne.toString(), "Client One's USDC Withdrawal index 0 Amount not updated");

    console.log("Withdraw Timestamp:", fetchedClientOneUsdcWithdrawals.withdrawalQueue[0].timestamp.toString());
    console.log("Sysvar Timestamp", await printTimestamp(provider));
  });

  it("queue a withdraw request of 1/5 of deposited amount client two", async () => {
    let withdrawUsdcTx = await program.methods.withdrawFundlock(amountToWithdrawClientTwo).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      role: roleAccountAdmin,
      fundlock: fundlockAccount,
      client: clientTwo.publicKey,
      clientAta: clientTwoUsdcAta.address,
      token: usdcMint,
      clientBalance: clientTwoUsdcBalance,
      fundlockTokenVault: fundlockTokenVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
      withdrawals: clientTwoUsdcWithdrawals
    }).signers([clientTwo]).rpc().then(confirmTx).then(log);

    fetchedClientTwoUsdcWithdrawals = await program.account.withdrawals.fetch(clientTwoUsdcWithdrawals);

    assert.equal(fetchedClientTwoUsdcWithdrawals.activeWithdrawalsAmount.toString(), amountToWithdrawClientTwo.toString(), "Client active withdrawals amount not updated");

    assert.equal(fetchedClientTwoUsdcWithdrawals.withdrawalQueue.length, 1, "Client Two's USDC Withdrawals Queue not updated");

    assert.equal(fetchedClientTwoUsdcWithdrawals.withdrawalQueue[0].amount.toString(), amountToWithdrawClientTwo.toString(), "Client Two's USDC Withdrawal index 0 Amount not updated");

    console.log("Withdraw Timestamp:", fetchedClientTwoUsdcWithdrawals.withdrawalQueue[0].timestamp.toString());
    console.log("Sysvar Timestamp", await printTimestamp(provider));
  });

  it("Queue 4 more withdraw requests of 1/5 of deposited amount to make sure the withdrawals account can hold all the states client one", async () => {
    const withdrawAmount = amountToWithdrawClientOne;

    for (let i = 0; i < 4; i++) {
      await program.methods.withdrawFundlock(withdrawAmount).accountsPartial({
        accessController: accessControllerAccount,
        tokenValidator: tokenValidatorAccount,
        role: roleAccountAdmin,
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        clientAta: clientOneUsdcAta.address,
        token: usdcMint,
        clientBalance: clientOneUsdcBalance,
        systemProgram: SystemProgram.programId,
        fundlockTokenVault: fundlockTokenVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        whitelistedToken: whitelistedUsdcTokenAccount,
        withdrawals: clientOneUsdcWithdrawals
      }).signers([clientOne]).rpc().then(confirmTx).then(log);
    }

    fetchedClientOneUsdcWithdrawals = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);

    // Assert the total active withdrawals amount
    const expectedTotalWithdrawAmount = withdrawAmount.mul(new anchor.BN(5));
    assert.equal(fetchedClientOneUsdcWithdrawals.activeWithdrawalsAmount.toString(), expectedTotalWithdrawAmount.toString(), "Client active withdrawals amount not updated");

    // Assert the length of the withdrawal queue
    assert.equal(fetchedClientOneUsdcWithdrawals.withdrawalQueue.length, 5, "Client One's USDC Withdrawals Queue not updated");

    // Assert each withdrawal in the queue
    for (let i = 0; i < 4; i++) {
      assert.equal(fetchedClientOneUsdcWithdrawals.withdrawalQueue[i].amount.toString(), withdrawAmount.toString(), `Client One's USDC Withdrawal index ${i} Amount not updated`);
    }
  });

  it("Attempt to queue an additional withdraw request (should fail)", async () => {
    const withdrawAmount = amountToWithdrawClientOne;

    // Perform the additional withdrawal
    try {
      await program.methods.withdrawFundlock(withdrawAmount).accountsPartial({
        accessController: accessControllerAccount,
        tokenValidator: tokenValidatorAccount,
        role: roleAccountAdmin,
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        clientAta: clientOneUsdcAta.address,
        token: usdcMint,
        clientBalance: clientOneUsdcBalance,
        fundlockTokenVault: fundlockTokenVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        whitelistedToken: whitelistedUsdcTokenAccount,
        withdrawals: clientOneUsdcWithdrawals
      }).signers([clientOne]).rpc().then(confirmTx).then(log);

      // If the transaction succeeds, the test should fail
      assert.fail("The transaction should have failed.");
    } catch (err) {
      // Check that the error is the expected one
      console.log("Expected error:", err);
      assert.ok(err, "The transaction failed as expected.");
    }

    // Fetch the withdrawals account to verify no changes were made
    fetchedClientOneUsdcWithdrawals = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);

    // Assert the total active withdrawals amount remains the same
    const expectedTotalWithdrawAmount = withdrawAmount.mul(new anchor.BN(5));
    assert.equal(fetchedClientOneUsdcWithdrawals.activeWithdrawalsAmount.toString(), expectedTotalWithdrawAmount.toString(), "Client active withdrawals amount should not have changed");

    // Assert the length of the withdrawal queue remains the same
    assert.equal(fetchedClientOneUsdcWithdrawals.withdrawalQueue.length, 5, "Client One's USDC Withdrawals Queue length should not have changed");

    // Assert each withdrawal in the queue remains the same
    for (let i = 0; i < 4; i++) {
      assert.equal(fetchedClientOneUsdcWithdrawals.withdrawalQueue[i].amount.toString(), withdrawAmount.toString(), `Client One's USDC Withdrawal index ${i} Amount should not have changed`);
    }
  });

  it("Try to release the first withdraw request while release lock is active (should fail)", async () => {
    let index = new anchor.BN(0);


    try {
      let releaseFundlockTx = await program.methods.releaseFundlock(index).accountsPartial({
        accessController: accessControllerAccount,
        tokenValidator: tokenValidatorAccount,
        role: roleAccountAdmin,
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        clientAta: clientOneUsdcAta.address,
        token: usdcMint,
        clientBalance: clientOneUsdcBalance,
        fundlockTokenVault: fundlockTokenVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        whitelistedToken: whitelistedUsdcTokenAccount,
        withdrawals: clientOneUsdcWithdrawals
      }).signers([clientOne]).rpc().then(confirmTx).then(log);

      // If the transaction succeeds, the test should fail
      assert.fail("The transaction should have failed.");
    } catch (err) {
      // Check that the error is the expected one
      console.log("Expected error:", err);
      assert.ok(err, "The transaction failed as expected.");
    }
    console.log(await printTimestamp(provider));
  });

  it("Wait for 2 minutes to pass", async () => {
    await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 2))
    console.log("WAIT", await printTimestamp(provider));

  });

  it("Release the first withdraw request after release lock passes", async () => {
    let clientOneUsdcBalanceBeforeRelease = await getTokenAccountBalance(provider.connection, clientOneUsdcAta.address);
    let fetchedClientOneUsdcWithdrawalsBeforeRelease = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);
    let index = new anchor.BN(0);
    let amountToRelease = fetchedClientOneUsdcWithdrawalsBeforeRelease.withdrawalQueue[0].amount;

    let releaseFundlockTx = await program.methods.releaseFundlock(index).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      role: roleAccountAdmin,
      fundlock: fundlockAccount,
      client: clientOne.publicKey,
      clientAta: clientOneUsdcAta.address,
      token: usdcMint,
      clientBalance: clientOneUsdcBalance,
      fundlockTokenVault: fundlockTokenVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
      withdrawals: clientOneUsdcWithdrawals
    }).signers([clientOne]).rpc().then(confirmTx).then(log);

    let fetchedClientOneUsdcWithdrawalsAfterRelease = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);

    let clientUpdatedBalance = +clientOneUsdcBalanceBeforeRelease + amountToRelease.toNumber();

    assert.equal(fetchedClientOneUsdcWithdrawalsAfterRelease.activeWithdrawalsAmount.toString(), amountToWithdrawClientOne.mul(new anchor.BN(4)).toString(), "Client active USDC withdrawals amount not updated");

    assert.equal(await getTokenAccountBalance(provider.connection, clientOneUsdcAta.address), clientUpdatedBalance.toString(), "Client One's USDC Balance not updated");

    let fundlockExpectedBalance = amountToWithdrawClientOne.mul(new anchor.BN(4)).add(amountToDepositClientOne);

    assert.equal(await getTokenAccountBalance(provider.connection, fundlockTokenVault), fundlockExpectedBalance.toString(), "Fundlock USDC Balance not updated");

    assert.equal(fetchedClientOneUsdcWithdrawalsAfterRelease.withdrawalQueue.length, 4, "Client One's USDC Withdrawals Queue not updated");
  });

  it("updates the balances", async () => {
    let amountsToAdd = new anchor.BN(15000000);
    let backendId = new anchor.BN(15)
    let amounts = [amountsToAdd, amountsToAdd]
    let fecthedClientOneUsdcBalanceBefore = await program.account.clientBalance.fetch(clientOneUsdcBalance);
    let fetchedClientTwoUsdcBalanceBefore = await program.account.clientBalance.fetch(clientTwoUsdcBalance);

    let clientOneUpdatedBalance = fecthedClientOneUsdcBalanceBefore.amount.add(amountsToAdd);
    let clientTwoUpdatedBalance = fetchedClientTwoUsdcBalanceBefore.amount.add(amountsToAdd);


    let updateBalancesTx = await program.methods.updateBalancesFundlock(amounts, backendId).accountsPartial({
      caller: admin.publicKey,
      accessController: accessControllerAccount,
      role: roleAccountAdmin,
      tokenValidator: tokenValidatorAccount,
      systemProgram: SystemProgram.programId,
    }).remainingAccounts([
      { pubkey: clientOneUsdcBalance, isWritable: true, isSigner: false },
      { pubkey: clientTwoUsdcBalance, isWritable: true, isSigner: false },

    ]).signers([admin]).rpc().then(confirmTx).then(log);

    let fecthedClientUsdcBalanceAfter = await program.account.clientBalance.fetch(clientOneUsdcBalance);
    assert.equal(fecthedClientUsdcBalanceAfter.amount.toString(), clientOneUpdatedBalance.toString(), "Client One's USDC Balance not updated");

    let fetchedClientTwoUsdcBalanceAfter = await program.account.clientBalance.fetch(clientTwoUsdcBalance);
    assert.equal(fetchedClientTwoUsdcBalanceAfter.amount.toString(), clientTwoUpdatedBalance.toString(), "Client Two's USDC Balance not updated");
  });

  it("Should print the balance sheet", async () => {
    let balanceSheet = await program.methods.balanceSheetFundlock().accountsPartial({
      caller: payer.publicKey,
      client: clientOne.publicKey,
      accessController: accessControllerAccount,
      role: roleAccountAdmin,
      token: usdcMint,
      fundlock: fundlockAccount,
      fundlockTokenVault: fundlockTokenVault,
      clientAta: clientOneUsdcAta.address,
      clientBalance: clientOneUsdcBalance,
      whitelistedToken: whitelistedUsdcTokenAccount,
      tokenValidator: tokenValidatorAccount,
      systemProgram: SystemProgram.programId,
    }).signers([payer]).rpc().then(log);
  });

});