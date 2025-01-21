import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { IthacaSmartContractSol } from "../target/types/ithaca_smart_contract_sol";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  Account,
  NATIVE_MINT,
  createSyncNativeInstruction
} from "@solana/spl-token";
import {
  Transaction,
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  TransactionInstruction,
  TransactionSignature,
  Signer,
  PUBLIC_KEY_LENGTH,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";

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

export async function wrapSol(
  connection: Connection,
  signer: Signer,
  amount: number
): Promise<TransactionSignature> {
  // wSol ATA 
  const wSolAta = await getOrCreateAssociatedTokenAccount(connection, signer, NATIVE_MINT, signer.publicKey);

  // wrap Sol
  let transaction = new Transaction().add(
    // trasnfer SOL
    SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: wSolAta.address,
      lamports: amount,
    }),
    // sync wrapped SOL balance
    createSyncNativeInstruction(wSolAta.address)
  );

  // submit transaction
  const txSignature = await sendAndConfirmTransaction(connection, transaction, [signer]);

  // validate transaction was successful
  try {
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txSignature,
    }, 'confirmed');
  } catch (error) {
    console.log(`Error wrapping sol: ${error}`);
  };

  return txSignature;
}

describe("ithaca-smart-contract-sol", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.IthacaSmartContractSol as Program<IthacaSmartContractSol>;

  console.log("PROGRAM ID:", program.programId.toString());

  //Payer Keypair that is going to pay for token creation
  const payer = Keypair.generate();

  //Admin Keypair
  const admin = Keypair.generate();
  console.log("Admin Keypair:", admin.publicKey.toString());

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
  const amountToDepositClientOne = new anchor.BN(30000000);
  const amountToDepositClientOneSol = new anchor.BN(1000000000);
  const amountToWithdrawClientOne = new anchor.BN((amountToDepositClientOne.toNumber() / 5));
  const amountToWithdrawClientOneSol = new anchor.BN((amountToDepositClientOneSol.toNumber() / 5));
  // Client Two Keypair
  const clientTwo = Keypair.generate();
  let clientTwoUsdcAta: Account;
  let clientTwoUsdcBalance: PublicKey;
  let clientTwoUsdcWithdrawals: PublicKey;
  let fetchedClientTwoUsdcWithdrawals;
  let fetchedClientTwoUsdcBalance;
  const amountToDepositClientTwo = new anchor.BN(70000000);
  const amountToWithdrawClientTwo = new anchor.BN((amountToDepositClientTwo.toNumber() / 5));
  const amountToDepositClientTwoSol = new anchor.BN(1000000000);
  const amountToWithdrawClientTwoSol = new anchor.BN((amountToDepositClientTwoSol.toNumber() / 5));

  // Client Three Keypair
  const clientThree = Keypair.generate();
  let clientThreeUsdcAta: Account;
  let clientThreeUsdcBalance: PublicKey;
  let clientThreeUsdcWithdrawals: PublicKey;
  let fetchedClientThreeUsdcWithdrawals;
  let fetchedClientThreeUsdcBalance;
  const amountToDepositClientThree = new anchor.BN(5000000);
  const amountToWithdrawClientThree = amountToDepositClientThree;
  const amountToDepositClientThreeSol = new anchor.BN(500000000);
  const amountToWithdrawClientThreeSol = amountToDepositClientThreeSol;
  // Client Four Keypair
  const clientFour = Keypair.generate();
  let clientFourUsdcAta: Account;
  let clientFourUsdcBalance: PublicKey;
  let clientFourUsdcWithdrawals: PublicKey;
  let fetchedClientFourUsdcWithdrawals;
  let fetchedClientFourUsdcBalance;
  const amountToDepositClientFour = new anchor.BN(8000000);
  const amountToWithdrawClientFour = amountToDepositClientFour;
  const amountToDepositClientFourSol = new anchor.BN(600000000);
  const amountToWithdrawClientFourSol = amountToDepositClientFourSol;

  // Client Five Keypair
  const clientFive = Keypair.generate();
  let clientFiveUsdcAta: Account;
  let clientFiveUsdcBalance: PublicKey;
  let clientFiveUsdcWithdrawals: PublicKey;
  let fetchedClientFiveUsdcWithdrawals;
  let fetchedClientFiveUsdcBalance;
  const amountToDepositClientFive = new anchor.BN(9000000);
  const amountToWithdrawClientFive = amountToDepositClientFive;
  const amountToDepositClientFiveSol = new anchor.BN(700000000);
  const amountToWithdrawClientFiveSol = amountToDepositClientFiveSol;

  // Client One wSOL ATA
  let clientOneWsolAta: Account;
  let clientOneWsolBalance: PublicKey;
  let clientOneWsolWithdrawals: PublicKey;
  let fetchedClientOneWsolWithdrawals;
  let fetchedClientOneWsolBalance;

  // Client Two wSOL ATA
  let clientTwoWsolAta: Account;
  let clientTwoWsolBalance: PublicKey;
  let clientTwoWsolWithdrawals: PublicKey;
  let fetchedClientTwoWsolWithdrawals;
  let fetchedClientTwoWsolBalance;

  // Client Three wSOL ATA
  let clientThreeWsolAta: Account;
  let clientThreeWsolBalance: PublicKey;
  let clientThreeWsolWithdrawals: PublicKey;
  let fetchedClientThreeWsolWithdrawals;
  let fetchedClientThreeWsolBalance;

  // Client Four wSOL ATA
  let clientFourWsolAta: Account;
  let clientFourWsolBalance: PublicKey;
  let clientFourWsolWithdrawals: PublicKey;
  let fetchedClientFourWsolWithdrawals;
  let fetchedClientFourWsolBalance;

  // Client Five wSOL ATA
  let clientFiveWsolAta: Account;
  let clientFiveWsolBalance: PublicKey;
  let clientFiveWsolWithdrawals: PublicKey;
  let fetchedClientFiveWsolWithdrawals;
  let fetchedClientFiveWsolBalance;

  // Roles
  const ADMIN_ROLE: string = "DEFAULT_ADMIN_ROLE";
  const UTILITY_ACCOUNT_ROLE: string = "UTILITY_ACCOUNT_ROLE";
  const LIQUIDATOR_ROLE: string = "LIQUIDATOR_ROLE";

  let accessControllerAccount: PublicKey;
  let fetchedaccessControllerAccount;

  let tokenValidatorAccount: PublicKey;
  let fetchedTokenValidatorAccount;

  let fundlockAccount: PublicKey;
  let fundlockUsdcTokenVault: PublicKey;
  let fetchedFundlockAccount;
  let fundlockWsolTokenVault: PublicKey;
  let fetchedFundlockWsolTokenVault;

  let releaseLock = new anchor.BN(30); // 30 seconds
  let tradeLock = new anchor.BN(30); // 30 seconds

  let usdcMint: PublicKey;
  let whitelistedUsdcTokenAccount: PublicKey;
  let usdcPrecision = 3;
  let fetchedWhitelistedUsdcTokenAccount;

  let mockMint: PublicKey;
  let whitelistedMockTokenAccount: PublicKey;
  let fetchedwhitelistedMockTokenAccount;

  let nativeMint = new PublicKey("So11111111111111111111111111111111111111112");
  let whitelistedNativeTokenAccount: PublicKey;
  let nativePrecision = 4;

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

  let usdcWSolLedger: PublicKey;

  let contractAccounts = []
  let positionAccounts = []

  // Kamino ACCS

  let kaminoLendProgramId = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
  let kaminoMainMarket = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
  let kaminoReserve1 = new PublicKey("9DrvZvyWh1HuAoZxvYWMvkf2XCzryCpGgHqrMjyDWpmo");
  let KaminoSolColToken = new PublicKey("2UywZrUdyqs5vDchy7fKQJKau2RVyuzBev2XKGPDSiX1");
  let KaminoSolLiqResSup = new PublicKey("GafNuUXj9rxGLn4y79dPu6MHSuPWeJR6UtTWuexpGh3U");
  let KaminoSolState = new PublicKey("d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q");
  let kaminoScopeAcc = new PublicKey("3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C");

  let fundlockSolCollateralVault: PublicKey;
  let clientOneSolCollateralBalance: PublicKey;


  // Airdrop some SOL to pay for the fees. Confirm the airdrop before proceeding.
  it("Airdrops", async () => {
    await Promise.all(
      [admin, utilityAccount, payer, clientOne, clientTwo, clientThree, clientFour, clientFive].map(async (account) => {
        await provider.connection
          .requestAirdrop(account.publicKey, 200 * LAMPORTS_PER_SOL)
          .then(confirmTx);
      })
    );

    // assert.equal(await getAccountBalance(provider.connection, admin.publicKey), 100, "Airdrop failed");
    // assert.equal(await getAccountBalance(provider.connection, utilityAccount.publicKey), 100, "Airdrop failed");
    // assert.equal(await getAccountBalance(provider.connection, payer.publicKey), 100, "Airdrop failed");
    // assert.equal(await getAccountBalance(provider.connection, clientOne.publicKey), 100, "Airdrop failed");
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
        accessControllerAccount.toBuffer(),
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
    let whitelistTokenTx = await program.methods.addTokenToWhitelist(usdcPrecision).accountsPartial({
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
    assert.equal(fetchedWhitelistedUsdcTokenAccount.tokenDecimals.toString(), "6", "USDC Token precision not as expected");
    assert.equal(fetchedWhitelistedUsdcTokenAccount.tokenPrecision.toString(), usdcPrecision.toString(), "USDC Token precision not as expected");
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
    let whitelistTokenTx = await program.methods.addTokenToWhitelist(6).accountsPartial({
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

  // it("Create a native token mint", async () => {
  //   nativeMint = await splToken.createMint(
  //     provider.connection,
  //     payer,
  //     payer.publicKey,
  //     payer.publicKey,
  //     9
  //   );
  // });

  it("Find a whitelisted Native token account PDA", async () => {
    whitelistedNativeTokenAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("whitelisted_token"),
        tokenValidatorAccount.toBuffer(),
        nativeMint.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Whitelisted Native Token Account:", whitelistedNativeTokenAccount.toString());
  });

  it("Whitelist Native Token Account", async () => {
    let whitelistTokenTx = await program.methods.addTokenToWhitelist(nativePrecision).accountsPartial({
      accessController: accessControllerAccount,
      member: memberAccountAdmin,
      role: roleAccountAdmin,
      tokenValidator: tokenValidatorAccount,
      whitelistedToken: whitelistedNativeTokenAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
      newTokenToWhitelist: nativeMint,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    let fetchedwhitelistedNativeTokenAccount = await program.account.whitelistedToken.fetch(whitelistedNativeTokenAccount);

    assert.equal(fetchedwhitelistedNativeTokenAccount.tokenMint.toString(), nativeMint.toString(), "Native Token not whitelisted");
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
      member: memberAccountAdmin,
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

    console.log("Client one's USDC Ata:", clientOneUsdcAta.address.toString());
  });

  it("Create a USDC ATA for the client two", async () => {
    clientTwoUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientTwo,
      usdcMint,
      clientTwo.publicKey
    );

    console.log("Client two's USDC Ata:", clientTwoUsdcAta.address.toString());
  });

  it("Create a USDC ATA for the client three", async () => {
    clientThreeUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientThree,
      usdcMint,
      clientThree.publicKey
    );

    console.log("Client three's USDC Ata:", clientThreeUsdcAta.address.toString());
  });

  it("Create a USDC ATA for the client four", async () => {
    clientFourUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientFour,
      usdcMint,
      clientFour.publicKey
    );

    console.log("Client four's USDC Ata:", clientFourUsdcAta.address.toString());
  });

  it("Create a USDC ATA for the client five", async () => {
    clientFiveUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientFive,
      usdcMint,
      clientFive.publicKey
    );

    console.log("Client five's USDC Ata:", clientFiveUsdcAta.address.toString());
  });

  it("Mint USDC to the client One", async () => {
    let mintToClientOneTx = await splToken.mintTo(
      provider.connection,
      payer,
      usdcMint,
      clientOneUsdcAta.address,
      payer,
      1000000000
    ).then(confirmTx);

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
    ).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientTwoUsdcAta.address), "1000000000", "USDC not minted to client two");

    console.log("Mint to Client Two Transaction:", mintToClientTwoTx.toString());
  });

  it("Mint USDC to the client Three", async () => {
    let mintToClientThreeTx = await splToken.mintTo(
      provider.connection,
      payer,
      usdcMint,
      clientThreeUsdcAta.address,
      payer,
      1000000000
    ).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientThreeUsdcAta.address), "1000000000", "USDC not minted to client three");

    console.log("Mint to Client Three Transaction:", mintToClientThreeTx.toString());
  });

  it("Mint USDC to the client Four", async () => {
    let mintToClientFourTx = await splToken.mintTo(
      provider.connection,
      payer,
      usdcMint,
      clientFourUsdcAta.address,
      payer,
      1000000000
    ).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientFourUsdcAta.address), "1000000000", "USDC not minted to client four");

    console.log("Mint to Client Four Transaction:", mintToClientFourTx.toString());
  });

  it("Mint USDC to the client Five", async () => {
    let mintToClientFiveTx = await splToken.mintTo(
      provider.connection,
      payer,
      usdcMint,
      clientFiveUsdcAta.address,
      payer,
      1000000000
    ).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientFiveUsdcAta.address), "1000000000", "USDC not minted to client five");

    console.log("Mint to Client Five Transaction:", mintToClientFiveTx.toString());
  });

  it("Create a wSOL ATA for the client One", async () => {
    clientOneWsolAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientOne,
      nativeMint,
      clientOne.publicKey
    );

    console.log("Client one's wSOL Ata:", clientOneWsolAta.address.toString());
  });

  it("Create a wSOL ATA for the client two", async () => {
    clientTwoWsolAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientTwo,
      nativeMint,
      clientTwo.publicKey
    );

    console.log("Client two's wSOL Ata:", clientTwoWsolAta.address.toString());
  });

  it("Create a wSOL ATA for the client three", async () => {
    clientThreeWsolAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientThree,
      nativeMint,
      clientThree.publicKey
    );

    console.log("Client three's wSOL Ata:", clientThreeWsolAta.address.toString());
  });

  it("Create a wSOL ATA for the client four", async () => {
    clientFourWsolAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientFour,
      nativeMint,
      clientFour.publicKey
    );

    console.log("Client four's wSOL Ata:", clientFourWsolAta.address.toString());
  });

  it("Create a wSOL ATA for the client five", async () => {
    clientFiveWsolAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      clientFive,
      nativeMint,
      clientFive.publicKey
    );

    console.log("Client five's wSOL Ata:", clientFiveWsolAta.address.toString());
  });

  it("Mint wSOL to the client One", async () => {
    let mintToClientOneTx = await wrapSol(provider.connection, clientOne, 1000000000).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientOneWsolAta.address), "1000000000", "wSOL not minted to client one");

    console.log("Mint to Client One Transaction:", mintToClientOneTx.toString());
  });

  it("Mint wSOL to the client Two", async () => {
    let mintToClientTwoTx = await wrapSol(provider.connection, clientTwo, 1000000000).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientTwoWsolAta.address), "1000000000", "wSOL not minted to client two");

    console.log("Mint to Client Two Transaction:", mintToClientTwoTx.toString());
  });

  it("Mint wSOL to the client Three", async () => {
    let mintToClientThreeTx = await wrapSol(provider.connection, clientThree, 1000000000).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientThreeWsolAta.address), "1000000000", "wSOL not minted to client three");

    console.log("Mint to Client Three Transaction:", mintToClientThreeTx.toString());
  });

  it("Mint wSOL to the client Four", async () => {
    let mintToClientFourTx = await wrapSol(provider.connection, clientFour, 1000000000).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientFourWsolAta.address), "1000000000", "wSOL not minted to client four");

    console.log("Mint to Client Four Transaction:", mintToClientFourTx.toString());
  });

  it("Mint wSOL to the client Five", async () => {
    let mintToClientFiveTx = await wrapSol(provider.connection, clientFive, 1000000000).then(confirmTx);

    assert.equal(await getTokenAccountBalance(provider.connection, clientFiveWsolAta.address), "1000000000", "wSOL not minted to client five");

    console.log("Mint to Client Five Transaction:", mintToClientFiveTx.toString());
  });

  it("Find the address for fundlock USDC token vault", async () => {

    fundlockUsdcTokenVault = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("fundlock_token_vault"),
        fundlockAccount.toBuffer(),
        usdcMint.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Fundlock Token Vault:", fundlockUsdcTokenVault.toString());
  });

  it("Find the address for fundlock wSOL token vault", async () => {

    fundlockWsolTokenVault = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("fundlock_token_vault"),
        fundlockAccount.toBuffer(),
        nativeMint.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Fundlock wSOL Token Vault:", fundlockWsolTokenVault.toString());
  });

  it("Find a balance PDA for client one's USDC balance", async () => {

    clientOneUsdcBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockUsdcTokenVault.toBuffer(),
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
        fundlockUsdcTokenVault.toBuffer(),
        clientTwoUsdcAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Two's USDC Balance:", clientTwoUsdcBalance.toString());

  });

  it("Find a balance PDA for client three's USDC balance", async () => {

    clientThreeUsdcBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockUsdcTokenVault.toBuffer(),
        clientThreeUsdcAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Three's USDC Balance:", clientThreeUsdcBalance.toString());

  });

  it("Find a balance PDA for client four's USDC balance", async () => {

    clientFourUsdcBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockUsdcTokenVault.toBuffer(),
        clientFourUsdcAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Four's USDC Balance:", clientFourUsdcBalance.toString());

  });

  it("Find a balance PDA for client five's USDC balance", async () => {

    clientFiveUsdcBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockUsdcTokenVault.toBuffer(),
        clientFiveUsdcAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Five's USDC Balance:", clientFiveUsdcBalance.toString());

  });

  it("Find a balance PDA for client one's wSOL balance", async () => {
    clientOneWsolBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockWsolTokenVault.toBuffer(),
        clientOneWsolAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client One's wSOL Balance:", clientOneWsolBalance.toString());
  });

  it("Find a balance PDA for client two's wSOL balance", async () => {
    clientTwoWsolBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockWsolTokenVault.toBuffer(),
        clientTwoWsolAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Two's wSOL Balance:", clientTwoWsolBalance.toString());
  });

  it("Find a balance PDA for client three's wSOL balance", async () => {
    clientThreeWsolBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockWsolTokenVault.toBuffer(),
        clientThreeWsolAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Three's wSOL Balance:", clientThreeWsolBalance.toString());
  });

  it("Find a balance PDA for client four's wSOL balance", async () => {
    clientFourWsolBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockWsolTokenVault.toBuffer(),
        clientFourWsolAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Four's wSOL Balance:", clientFourWsolBalance.toString());
  });

  it("Find a balance PDA for client five's wSOL balance", async () => {
    clientFiveWsolBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_balance"),
        fundlockWsolTokenVault.toBuffer(),
        clientFiveWsolAta.address.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Five's wSOL Balance:", clientFiveWsolBalance.toString());
  });

  it("Find Withdrawals PDA for client one's USDC", async () => {
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

  it("Find Withdrawals PDA for client two's USDC", async () => {
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

  it("Find Withdrawals PDA for client three's USDC", async () => {
    clientThreeUsdcWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientThreeUsdcBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Three's USDC Withdrawals:", clientThreeUsdcWithdrawals.toString());
  });

  it("Find Withdrawals PDA for client four's USDC", async () => {
    clientFourUsdcWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientFourUsdcBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Four's USDC Withdrawals:", clientFourUsdcWithdrawals.toString());
  });

  it("Find Withdrawals PDA for client five's USDC", async () => {
    clientFiveUsdcWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientFiveUsdcBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Five's USDC Withdrawals:", clientFiveUsdcWithdrawals.toString());
  });

  it("Find Withdrawals PDA for client one's wSOL", async () => {
    clientOneWsolWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientOneWsolBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client One's wSOL Withdrawals:", clientOneWsolWithdrawals.toString());
  });

  it("Find Withdrawals PDA for client two's wSOL", async () => {
    clientTwoWsolWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientTwoWsolBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Two's wSOL Withdrawals:", clientTwoWsolWithdrawals.toString());
  });

  it("Find Withdrawals PDA for client three's wSOL", async () => {
    clientThreeWsolWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientThreeWsolBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Three's wSOL Withdrawals:", clientThreeWsolWithdrawals.toString());
  });

  it("Find Withdrawals PDA for client four's wSOL", async () => {
    clientFourWsolWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientFourWsolBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Four's wSOL Withdrawals:", clientFourWsolWithdrawals.toString());
  });

  it("Find Withdrawals PDA for client five's wSOL", async () => {
    clientFiveWsolWithdrawals = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("withdrawals"),
        fundlockAccount.toBuffer(),
        clientFiveWsolBalance.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client Five's wSOL Withdrawals:", clientFiveWsolWithdrawals.toString());
  });

  it("Deposit USDC from client one to the Fundlock Account", async () => {
    let depositUsdcTx = await program.methods.depositFundlock(amountToDepositClientOne).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientOne.publicKey,
      clientAta: clientOneUsdcAta.address,
      token: usdcMint,
      clientBalance: clientOneUsdcBalance,
      fundlockTokenVault: fundlockUsdcTokenVault,
      withdrawals: clientOneUsdcWithdrawals,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
    }).signers([clientOne]).rpc().then(confirmTx).then(log);

    fetchedClientOneUsdcBalance = await program.account.clientBalance.fetch(clientOneUsdcBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockUsdcTokenVault)).toString(), amountToDepositClientOne.toString(), "USDC not deposited to fundlock");

    assert.equal(fetchedClientOneUsdcBalance.amount.toString(), amountToDepositClientOne.toString(), "Client One's USDC Balance State not updated");
  });

  it("Deposit USDC from client two to the Fundlock Account", async () => {
    let depositUsdcTx = await program.methods.depositFundlock(amountToDepositClientTwo).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientTwo.publicKey,
      clientAta: clientTwoUsdcAta.address,
      token: usdcMint,
      clientBalance: clientTwoUsdcBalance,
      fundlockTokenVault: fundlockUsdcTokenVault,
      withdrawals: clientTwoUsdcWithdrawals,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
    }).signers([clientTwo]).rpc().then(confirmTx).then(log);

    fetchedClientTwoUsdcBalance = await program.account.clientBalance.fetch(clientTwoUsdcBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockUsdcTokenVault)).toString(), (amountToDepositClientOne.add(amountToDepositClientTwo)).toString(), "USDC not deposited to fundlock");

    assert.equal(fetchedClientTwoUsdcBalance.amount.toString(), amountToDepositClientTwo.toString(), "Client Two's USDC Balance State not updated");
  });

  it("Deposit USDC from client three to the Fundlock Account", async () => {
    let depositUsdcTx = await program.methods.depositFundlock(amountToDepositClientThree).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientThree.publicKey,
      clientAta: clientThreeUsdcAta.address,
      token: usdcMint,
      clientBalance: clientThreeUsdcBalance,
      fundlockTokenVault: fundlockUsdcTokenVault,
      systemProgram: SystemProgram.programId,
      withdrawals: clientThreeUsdcWithdrawals,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
    }).signers([clientThree]).rpc().then(confirmTx).then(log);

    fetchedClientThreeUsdcBalance = await program.account.clientBalance.fetch(clientThreeUsdcBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockUsdcTokenVault)).toString(), (amountToDepositClientOne.add(amountToDepositClientTwo).add(amountToDepositClientThree)).toString(), "USDC not deposited to fundlock");

    assert.equal(fetchedClientThreeUsdcBalance.amount.toString(), amountToDepositClientThree.toString(), "Client Three's USDC Balance State not updated");
  });

  it("Deposit USDC from client four to the Fundlock Account", async () => {
    let depositUsdcTx = await program.methods.depositFundlock(amountToDepositClientFour).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientFour.publicKey,
      clientAta: clientFourUsdcAta.address,
      token: usdcMint,
      clientBalance: clientFourUsdcBalance,
      fundlockTokenVault: fundlockUsdcTokenVault,
      systemProgram: SystemProgram.programId,
      withdrawals: clientFourUsdcWithdrawals,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
    }).signers([clientFour]).rpc().then(confirmTx).then(log);

    fetchedClientFourUsdcBalance = await program.account.clientBalance.fetch(clientFourUsdcBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockUsdcTokenVault)).toString(), (amountToDepositClientOne.add(amountToDepositClientTwo).add(amountToDepositClientThree).add(amountToDepositClientFour)).toString(), "USDC not deposited to fundlock");

    assert.equal(fetchedClientFourUsdcBalance.amount.toString(), amountToDepositClientFour.toString(), "Client Four's USDC Balance State not updated");
  });

  it("Deposit USDC from client five to the Fundlock Account", async () => {
    let depositUsdcTx = await program.methods.depositFundlock(amountToDepositClientFive).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientFive.publicKey,
      clientAta: clientFiveUsdcAta.address,
      token: usdcMint,
      clientBalance: clientFiveUsdcBalance,
      fundlockTokenVault: fundlockUsdcTokenVault,
      systemProgram: SystemProgram.programId,
      withdrawals: clientFiveUsdcWithdrawals,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
    }).signers([clientFive]).rpc().then(confirmTx).then(log);

    fetchedClientFiveUsdcBalance = await program.account.clientBalance.fetch(clientFiveUsdcBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockUsdcTokenVault)).toString(), (amountToDepositClientOne.add(amountToDepositClientTwo).add(amountToDepositClientThree).add(amountToDepositClientFour).add(amountToDepositClientFive)).toString(), "USDC not deposited to fundlock");

    assert.equal(fetchedClientFiveUsdcBalance.amount.toString(), amountToDepositClientFive.toString(), "Client Five's USDC Balance State not updated");
  });

  it("Deposit Native from client one to the Fundlock Account", async () => {
    let depositNativeTx = await program.methods.depositFundlock(amountToDepositClientOneSol).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientOne.publicKey,
      clientAta: clientOneWsolAta.address,
      token: nativeMint,
      clientBalance: clientOneWsolBalance,
      fundlockTokenVault: fundlockWsolTokenVault,
      systemProgram: SystemProgram.programId,
      withdrawals: clientOneWsolWithdrawals,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedNativeTokenAccount,
    }).signers([clientOne]).rpc().then(confirmTx).then(log);

    fetchedClientOneWsolBalance = await program.account.clientBalance.fetch(clientOneWsolBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockWsolTokenVault)).toString(), amountToDepositClientOneSol.toString(), "Native not deposited to fundlock");

    let fetchedClientOneWsolWithdrawals = await program.account.withdrawals.fetch(clientOneWsolWithdrawals);
    assert.equal(fetchedClientOneWsolWithdrawals.client.toString(), clientOne.publicKey.toString(), "Client One's wSOL Withdrawals State not updated");

    assert.equal(fetchedClientOneWsolBalance.amount.toString(), amountToDepositClientOneSol.toString(), "Client One's Native Balance State not updated");
  });

  it("Deposit Native from client two to the Fundlock Account", async () => {
    let depositNativeTx = await program.methods.depositFundlock(amountToDepositClientTwoSol).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientTwo.publicKey,
      clientAta: clientTwoWsolAta.address,
      token: nativeMint,
      clientBalance: clientTwoWsolBalance,
      fundlockTokenVault: fundlockWsolTokenVault,
      systemProgram: SystemProgram.programId,
      withdrawals: clientTwoWsolWithdrawals,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedNativeTokenAccount,
    }).signers([clientTwo]).rpc().then(confirmTx).then(log);

    fetchedClientTwoWsolBalance = await program.account.clientBalance.fetch(clientTwoWsolBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockWsolTokenVault)).toString(), (amountToDepositClientOneSol.add(amountToDepositClientTwoSol)).toString(), "Native not deposited to fundlock");

    assert.equal(fetchedClientTwoWsolBalance.amount.toString(), amountToDepositClientTwoSol.toString(), "Client Two's Native Balance State not updated");
  });

  it("Deposit Native from client three to the Fundlock Account", async () => {
    let depositNativeTx = await program.methods.depositFundlock(amountToDepositClientThreeSol).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientThree.publicKey,
      clientAta: clientThreeWsolAta.address,
      token: nativeMint,
      clientBalance: clientThreeWsolBalance,
      fundlockTokenVault: fundlockWsolTokenVault,
      systemProgram: SystemProgram.programId,
      withdrawals: clientThreeWsolWithdrawals,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedNativeTokenAccount,
    }).signers([clientThree]).rpc().then(confirmTx).then(log);

    fetchedClientThreeWsolBalance = await program.account.clientBalance.fetch(clientThreeWsolBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockWsolTokenVault)).toString(), (amountToDepositClientOneSol.add(amountToDepositClientTwoSol).add(amountToDepositClientThreeSol)).toString(), "Native not deposited to fundlock");

    assert.equal(fetchedClientThreeWsolBalance.amount.toString(), amountToDepositClientThreeSol.toString(), "Client Three's Native Balance State not updated");
  });

  it("Deposit Native from client four to the Fundlock Account", async () => {
    let depositNativeTx = await program.methods.depositFundlock(amountToDepositClientFourSol).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientFour.publicKey,
      clientAta: clientFourWsolAta.address,
      token: nativeMint,
      clientBalance: clientFourWsolBalance,
      fundlockTokenVault: fundlockWsolTokenVault,
      systemProgram: SystemProgram.programId,
      withdrawals: clientFourWsolWithdrawals,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedNativeTokenAccount,
    }).signers([clientFour]).rpc().then(confirmTx).then(log);

    fetchedClientFourWsolBalance = await program.account.clientBalance.fetch(clientFourWsolBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockWsolTokenVault)).toString(), (amountToDepositClientOneSol.add(amountToDepositClientTwoSol).add(amountToDepositClientThreeSol).add(amountToDepositClientFourSol)).toString(), "Native not deposited to fundlock");

    assert.equal(fetchedClientFourWsolBalance.amount.toString(), amountToDepositClientFourSol.toString(), "Client Four's Native Balance State not updated");

    assert.equal(fetchedClientFourWsolBalance.client.toString(), clientFour.publicKey.toString(), "Client Four's Native Balance State not updated");
  });

  it("Deposit Native from client five to the Fundlock Account", async () => {
    let depositNativeTx = await program.methods.depositFundlock(amountToDepositClientFiveSol).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientFive.publicKey,
      clientAta: clientFiveWsolAta.address,
      token: nativeMint,
      clientBalance: clientFiveWsolBalance,
      fundlockTokenVault: fundlockWsolTokenVault,
      systemProgram: SystemProgram.programId,
      withdrawals: clientFiveWsolWithdrawals,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedNativeTokenAccount,
    }).signers([clientFive]).rpc().then(confirmTx).then(log);

    fetchedClientFiveWsolBalance = await program.account.clientBalance.fetch(clientFiveWsolBalance);

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockWsolTokenVault)).toString(), (amountToDepositClientOneSol.add(amountToDepositClientTwoSol).add(amountToDepositClientThreeSol).add(amountToDepositClientFourSol).add(amountToDepositClientFiveSol)).toString(), "Native not deposited to fundlock");

    assert.equal(fetchedClientFiveWsolBalance.amount.toString(), amountToDepositClientFiveSol.toString(), "Client Five's Native Balance State not updated");

    assert.equal(fetchedClientFiveWsolBalance.client.toString(), clientFive.publicKey.toString(), "Client Five's Native Balance State not updated");
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
    ).then(confirmTx);

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
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        clientAta: clientOneMockAta.address,
        token: mockMint,
        clientBalance: clientOneMockBalance,
        fundlockTokenVault: fundlockUsdcTokenVault,
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

  it("Que a USDC withdraw request of 1/5 of deposited amount client one", async () => {
    let withdrawUsdcTx = await program.methods.withdrawFundlock(amountToWithdrawClientOne).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientOne.publicKey,
      clientAta: clientOneUsdcAta.address,
      token: usdcMint,
      clientBalance: clientOneUsdcBalance,
      fundlockTokenVault: fundlockUsdcTokenVault,
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

  it("queue a USDC withdraw request of 1/5 of deposited amount client two", async () => {
    let fecthedClientTwoUsdcBalanceBefore = await program.account.clientBalance.fetch(clientTwoUsdcBalance);
    console.log("Client Two USDC Balance Before Withdrawal:", fecthedClientTwoUsdcBalanceBefore.amount.toString());
    let withdrawUsdcTx = await program.methods.withdrawFundlock(amountToWithdrawClientTwo).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientTwo.publicKey,
      clientAta: clientTwoUsdcAta.address,
      token: usdcMint,
      clientBalance: clientTwoUsdcBalance,
      fundlockTokenVault: fundlockUsdcTokenVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
      withdrawals: clientTwoUsdcWithdrawals
    }).signers([clientTwo]).rpc().then(confirmTx).then(log);

    let fecthedClientTwoUsdcBalanceAfter = await program.account.clientBalance.fetch(clientTwoUsdcBalance);
    console.log("Client Two USDC Balance After Withdrawal:", fecthedClientTwoUsdcBalanceAfter.amount.toString());

    fetchedClientTwoUsdcWithdrawals = await program.account.withdrawals.fetch(clientTwoUsdcWithdrawals);

    assert.equal(fetchedClientTwoUsdcWithdrawals.activeWithdrawalsAmount.toString(), amountToWithdrawClientTwo.toString(), "Client active withdrawals amount not updated");

    assert.equal(fetchedClientTwoUsdcWithdrawals.withdrawalQueue.length, 1, "Client Two's USDC Withdrawals Queue not updated");

    assert.equal(fetchedClientTwoUsdcWithdrawals.withdrawalQueue[0].amount.toString(), amountToWithdrawClientTwo.toString(), "Client Two's USDC Withdrawal index 0 Amount not updated");
  });

  it("queue a USDC withdrawal request of full amount of deposited amount client three", async () => {
    let fecthedClientThreeUsdcBalanceBefore = await program.account.clientBalance.fetch(clientThreeUsdcBalance);
    console.log("Client Three USDC Balance Before Withdrawal:", fecthedClientThreeUsdcBalanceBefore.amount.toString());
    let withdrawUsdcTx = await program.methods.withdrawFundlock(amountToWithdrawClientThree).accountsPartial({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientThree.publicKey,
      clientAta: clientThreeUsdcAta.address,
      token: usdcMint,
      clientBalance: clientThreeUsdcBalance,
      fundlockTokenVault: fundlockUsdcTokenVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedUsdcTokenAccount,
      withdrawals: clientThreeUsdcWithdrawals
    }).signers([clientThree]).rpc().then(confirmTx).then(log);

    let fecthedClientThreeUsdcBalanceAfter = await program.account.clientBalance.fetch(clientThreeUsdcBalance);
    console.log("Client Three USDC Balance After Withdrawal:", fecthedClientThreeUsdcBalanceAfter.amount.toString());

    fetchedClientThreeUsdcWithdrawals = await program.account.withdrawals.fetch(clientThreeUsdcWithdrawals);

    assert.equal(fetchedClientThreeUsdcWithdrawals.activeWithdrawalsAmount.toString(), amountToWithdrawClientThree.toString(), "Client active withdrawals amount not updated");

    assert.equal(fetchedClientThreeUsdcWithdrawals.withdrawalQueue.length, 1, "Client Three's USDC Withdrawals Queue not updated");

    assert.equal(fetchedClientThreeUsdcWithdrawals.withdrawalQueue[0].amount.toString(), amountToWithdrawClientThree.toString(), "Client Three's USDC Withdrawal index 0 Amount not updated");
  });

  it("Queue 4 more USDC withdraw  requests of 1/5 of deposited amount to make sure the withdrawals account can hold all the states client one", async () => {
    const withdrawAmount = amountToWithdrawClientOne;

    for (let i = 0; i < 4; i++) {
      await program.methods.withdrawFundlock(withdrawAmount).accountsPartial({
        accessController: accessControllerAccount,
        tokenValidator: tokenValidatorAccount,
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        clientAta: clientOneUsdcAta.address,
        token: usdcMint,
        clientBalance: clientOneUsdcBalance,
        systemProgram: SystemProgram.programId,
        fundlockTokenVault: fundlockUsdcTokenVault,
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
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        clientAta: clientOneUsdcAta.address,
        token: usdcMint,
        clientBalance: clientOneUsdcBalance,
        fundlockTokenVault: fundlockUsdcTokenVault,
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
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        clientAta: clientOneUsdcAta.address,
        token: usdcMint,
        clientBalance: clientOneUsdcBalance,
        fundlockTokenVault: fundlockUsdcTokenVault,
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

  it("Find PDA for USDC and SOL Ledger Market", async () => {
    usdcWSolLedger = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("ledger"),
        accessControllerAccount.toBuffer(),
        tokenValidatorAccount.toBuffer(),
        nativeMint.toBuffer(),
        usdcMint.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("USDC-wSOL Ledger Market:", usdcWSolLedger.toString());
  });

  it("Create a usdc and wrapped sol ledger market", async () => {
    let initLedger = await program.methods.initLedger().accountsPartial({
      admin: admin.publicKey,
      accessController: accessControllerAccount,
      role: roleAccountAdmin,
      member: memberAccountAdmin,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      underlyingToken: nativeMint,
      strikeToken: usdcMint,
      whitelistedUnderlyingToken: whitelistedNativeTokenAccount,
      whitelistedStrikeToken: whitelistedUsdcTokenAccount,
      ledger: usdcWSolLedger,
      systemProgram: SystemProgram.programId,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    let fetchedLedger = await program.account.ledger.fetch(usdcWSolLedger);
    assert.equal(fetchedLedger.underlyingToken.toString(), nativeMint.toString(), "Underlying Token not set");
    assert.equal(fetchedLedger.strikeToken.toString(), usdcMint.toString(), "Strike Token not set");
    assert.equal(fetchedLedger.accessController.toString(), accessControllerAccount.toString(), "Access Controller not set");
    assert.equal(fetchedLedger.tokenValidator.toString(), tokenValidatorAccount.toString(), "Token Validator not set");
    console.log("Ledger Market Initialized:", fetchedLedger.toString());
    console.log("Underlying Multiplier:", fetchedLedger.underlyingMultiplier.toString());
    console.log("Strike Multiplier:", fetchedLedger.strikeMultiplier.toString());
  })

  it("Create Positions for all clients", async () => {

    const positionsParam1 = [
      { contractId: new anchor.BN(1), client: clientOne.publicKey, size: new anchor.BN(1000) },
      { contractId: new anchor.BN(2), client: clientTwo.publicKey, size: new anchor.BN(2000) },
      { contractId: new anchor.BN(3), client: clientThree.publicKey, size: new anchor.BN(3000) },
      { contractId: new anchor.BN(4), client: clientFour.publicKey, size: new anchor.BN(4000) },
      { contractId: new anchor.BN(5), client: clientFive.publicKey, size: new anchor.BN(5000) },
      { contractId: new anchor.BN(6), client: clientOne.publicKey, size: new anchor.BN(1000) },
      { contractId: new anchor.BN(7), client: clientTwo.publicKey, size: new anchor.BN(2000) },
      { contractId: new anchor.BN(8), client: clientThree.publicKey, size: new anchor.BN(3000) },
      { contractId: new anchor.BN(9), client: clientFour.publicKey, size: new anchor.BN(4000) },
      { contractId: new anchor.BN(10), client: clientFive.publicKey, size: new anchor.BN(5000) },
    ];

    let remainingAccounts = [];

    for (const position of positionsParam1) {
      const [contractPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("contract"), usdcWSolLedger.toBuffer(), position.contractId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const [positionPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("position"), contractPda.toBuffer(), position.client.toBuffer()],
        program.programId
      );

      remainingAccounts.push({
        pubkey: contractPda,
        isWritable: true,
        isSigner: false,
      });

      contractAccounts.push(contractPda)

      remainingAccounts.push({
        pubkey: positionPda,
        isWritable: true,
        isSigner: false,
      });

      positionAccounts.push(positionPda);
    }

    let createOrUpdatePositions = await program.methods.createContractsAndPositions(positionsParam1).accountsPartial({
      caller: utilityAccount.publicKey,
      accessController: accessControllerAccount,
      roleUtil: roleAccountUtilityAccount,
      memberUtil: memberAccountUtilityAccount,
      tokenValidator: tokenValidatorAccount,
      whitelistedStrikeToken: whitelistedUsdcTokenAccount,
      whitelistedUnderlyingToken: whitelistedNativeTokenAccount,
      strikeToken: usdcMint,
      underlyingToken: nativeMint,
      ledger: usdcWSolLedger,
      systemProgram: SystemProgram.programId,
    }).remainingAccounts(remainingAccounts).signers([utilityAccount]).instruction();

    const [lookupTableDeriveInst, lookupTableDeriveAddress] =
      anchor.web3.AddressLookupTableProgram.createLookupTable({
        authority: utilityAccount.publicKey,
        payer: utilityAccount.publicKey,
        recentSlot: await provider.connection.getSlot() - 1,
      });

    const extendInstruction = anchor.web3.AddressLookupTableProgram.extendLookupTable({
      payer: utilityAccount.publicKey,
      authority: utilityAccount.publicKey,
      lookupTable: lookupTableDeriveAddress,
      addresses: [
        utilityAccount.publicKey,
        accessControllerAccount,
        roleAccountUtilityAccount,
        memberAccountUtilityAccount,
        tokenValidatorAccount,
        usdcWSolLedger,
        whitelistedUsdcTokenAccount,
        whitelistedNativeTokenAccount,
        usdcMint,
        nativeMint,
        SystemProgram.programId,
      ],
    });

    let transactionsLookup = new Transaction();
    transactionsLookup.add(lookupTableDeriveInst);
    transactionsLookup.add(extendInstruction);

    const sx = await provider.connection.sendTransaction(transactionsLookup, [utilityAccount]).then(log).then(confirmTx);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const [lookupTableRemInst, lookupTableRemAddress] =
      anchor.web3.AddressLookupTableProgram.createLookupTable({
        authority: utilityAccount.publicKey,
        payer: utilityAccount.publicKey,
        recentSlot: await provider.connection.getSlot() - 1,
      });

    let uniqueAccounts = [];
    let seenPubkeys = new Set();

    for (let account of remainingAccounts) {
      if (!seenPubkeys.has(account.pubkey)) {
        uniqueAccounts.push(account);
        seenPubkeys.add(account.pubkey);
      }
    }

    let remPkUnique = uniqueAccounts.map(account => account.pubkey);

    const extendInstructionRemFirstHalf = anchor.web3.AddressLookupTableProgram.extendLookupTable({
      payer: utilityAccount.publicKey,
      authority: utilityAccount.publicKey,
      lookupTable: lookupTableRemAddress,
      addresses: remPkUnique,
    });

    let transactionsLookupRemFirstHalf = new Transaction();
    transactionsLookupRemFirstHalf.add(lookupTableRemInst);
    transactionsLookupRemFirstHalf.add(extendInstructionRemFirstHalf);

    const sxRemFirstHalf = await provider.connection.sendTransaction(transactionsLookupRemFirstHalf, [utilityAccount]).then(log).then(confirmTx);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const lutAccountDer = (await provider.connection.getAddressLookupTable(lookupTableDeriveAddress)).value;
    const lutAccountRem = (await provider.connection.getAddressLookupTable(lookupTableRemAddress)).value;

    const computeUnitInstructions = [
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }),
      anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    ];

    const messagev0 = new anchor.web3.TransactionMessage({
      payerKey: utilityAccount.publicKey,
      recentBlockhash: (await provider.connection.getRecentBlockhash()).blockhash,
      instructions: [computeUnitInstructions[0], computeUnitInstructions[1], createOrUpdatePositions]
    }).compileToV0Message([lutAccountDer, lutAccountRem])

    const transactionV0 = new anchor.web3.VersionedTransaction(messagev0);

    transactionV0.sign([utilityAccount]);

    console.log("Transaction Size: ", transactionV0.serialize().length);

    const txv0 = await provider.connection.sendRawTransaction(transactionV0.serialize()).then(log).then(confirmTx);

    const [contractPda1] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("contract"), usdcWSolLedger.toBuffer(), new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [positionPda1] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), contractPda1.toBuffer(), clientOne.publicKey.toBuffer()],
      program.programId
    );

    const [contractPda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("contract"), usdcWSolLedger.toBuffer(), new anchor.BN(2).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [positionPda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), contractPda2.toBuffer(), clientTwo.publicKey.toBuffer()],
      program.programId
    );

    const [contractPda3] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("contract"), usdcWSolLedger.toBuffer(), new anchor.BN(3).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [positionPda3] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), contractPda3.toBuffer(), clientThree.publicKey.toBuffer()],
      program.programId
    );

    const [contractPda4] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("contract"), usdcWSolLedger.toBuffer(), new anchor.BN(4).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [positionPda4] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), contractPda4.toBuffer(), clientThree.publicKey.toBuffer()],
      program.programId
    );

    const [contractPda5] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("contract"), usdcWSolLedger.toBuffer(), new anchor.BN(5).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [positionPda5] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), contractPda5.toBuffer(), clientFour.publicKey.toBuffer()],
      program.programId
    );

    const [contractPda6] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("contract"), usdcWSolLedger.toBuffer(), new anchor.BN(6).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [positionPda6] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), contractPda6.toBuffer(), clientFive.publicKey.toBuffer()],
      program.programId
    );

    const [contractPda7] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("contract"), usdcWSolLedger.toBuffer(), new anchor.BN(7).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [positionPda7] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("position"), contractPda7.toBuffer(), clientFive.publicKey.toBuffer()],
      program.programId
    );

    /// TODO! Fix assertions
    // const fetchedContract1 = await program.account.contract.fetch(contractPda1);
    // const fetchedPosition1 = await program.account.position.fetch(positionPda1);
    // const fetchedContract2 = await program.account.contract.fetch(contractPda2);
    // const fetchedPosition2 = await program.account.position.fetch(positionPda2);
    // const fetchedContract3 = await program.account.contract.fetch(contractPda3);
    // const fetchedPosition3 = await program.account.position.fetch(positionPda3);
    // const fetchedContract4 = await program.account.contract.fetch(contractPda4);
    // const fetchedPosition4 = await program.account.position.fetch(positionPda4);
    // const fetchedContract5 = await program.account.contract.fetch(contractPda5);
    // const fetchedPosition5 = await program.account.position.fetch(positionPda5);
    // const fetchedContract6 = await program.account.contract.fetch(contractPda6);
    // const fetchedPosition6 = await program.account.position.fetch(positionPda6);
    // const fetchedContract7 = await program.account.contract.fetch(contractPda7);
    // const fetchedPosition7 = await program.account.position.fetch(positionPda7);

    // assert.equal(fetchedContract1.contractId.toString(), "1", `Contract ID mismatch for contract ${contractPda1.toString()}`);
    // assert.equal(fetchedPosition1.client.toString(), clientOne.publicKey.toString(), `Client mismatch for position ${positionPda1.toString()}`);
    // assert.equal(fetchedPosition1.size.toString(), "1000", `Size mismatch for position ${positionPda1.toString()}`);
    // assert.equal(fetchedContract2.contractId.toString(), "2", `Contract ID mismatch for contract ${contractPda2.toString()}`);
    // assert.equal(fetchedPosition2.client.toString(), clientTwo.publicKey.toString(), `Client mismatch for position ${positionPda2.toString()}`);
    // assert.equal(fetchedPosition2.size.toString(), "2000", `Size mismatch for position ${positionPda2.toString()}`);
    // assert.equal(fetchedContract3.contractId.toString(), "3", `Contract ID mismatch for contract ${contractPda3.toString()}`);
    // assert.equal(fetchedPosition3.client.toString(), clientThree.publicKey.toString(), `Client mismatch for position ${positionPda3.toString()}`);
    // assert.equal(fetchedPosition3.size.toString(), "3000", `Size mismatch for position ${positionPda3.toString()}`);
    // assert.equal(fetchedContract4.contractId.toString(), "4", `Contract ID mismatch for contract ${contractPda4.toString()}`);
    // assert.equal(fetchedPosition4.client.toString(), clientThree.publicKey.toString(), `Client mismatch for position ${positionPda4.toString()}`);
    // assert.equal(fetchedPosition4.size.toString(), "4000", `Size mismatch for position ${positionPda4.toString()}`);
    // assert.equal(fetchedContract5.contractId.toString(), "5", `Contract ID mismatch for contract ${contractPda5.toString()}`);
    // assert.equal(fetchedPosition5.client.toString(), clientFour.publicKey.toString(), `Client mismatch for position ${positionPda5.toString()}`);
    // assert.equal(fetchedPosition5.size.toString(), "5000", `Size mismatch for position ${positionPda5.toString()}`);
    // assert.equal(fetchedContract6.contractId.toString(), "6", `Contract ID mismatch for contract ${contractPda6.toString()}`);
    // assert.equal(fetchedPosition6.client.toString(), clientFive.publicKey.toString(), `Client mismatch for position ${positionPda6.toString()}`);
    // assert.equal(fetchedPosition6.size.toString(), "1000", `Size mismatch for position ${positionPda6.toString()}`);
    // assert.equal(fetchedContract7.contractId.toString(), "7", `Contract ID mismatch for contract ${contractPda7.toString()}`);
    // assert.equal(fetchedPosition7.client.toString(), clientFive.publicKey.toString(), `Client mismatch for position ${positionPda7.toString()}`);
    // assert.equal(fetchedPosition7.size.toString(), "2000", `Size mismatch for position ${positionPda7.toString()}`);
  });

  it("Update the fund movements of all clients", async () => {

    console.log("EXPECTED CLIENTS: ", clientOne.publicKey.toString(), clientTwo.publicKey.toString(), clientThree.publicKey.toString(), clientFour.publicKey.toString(), clientFive.publicKey.toString());

    const fundMovements1 = [
      { underlyingAmount: new anchor.BN(100), strikeAmount: new anchor.BN(-2000) }, // Client One
      { underlyingAmount: new anchor.BN(150), strikeAmount: new anchor.BN(2500) }, // Client Two
      { underlyingAmount: new anchor.BN(-200), strikeAmount: new anchor.BN(-3000) }, // Client Tthree
      { underlyingAmount: new anchor.BN(-100), strikeAmount: new anchor.BN(-2000) }, // Client Four
      { underlyingAmount: new anchor.BN(-50), strikeAmount: new anchor.BN(-500) }, // Client Five
    ];

    let backendId = new anchor.BN(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

    let remainingAccounts1 = [
      { pubkey: clientOneWsolBalance, isWritable: true, isSigner: false },
      { pubkey: clientOneUsdcBalance, isWritable: true, isSigner: false },
      { pubkey: clientOneWsolWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientOneUsdcWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientTwoWsolBalance, isWritable: true, isSigner: false },
      { pubkey: clientTwoUsdcBalance, isWritable: true, isSigner: false },
      { pubkey: clientTwoWsolWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientTwoUsdcWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientThreeWsolBalance, isWritable: true, isSigner: false },
      { pubkey: clientThreeUsdcBalance, isWritable: true, isSigner: false },
      { pubkey: clientThreeWsolWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientThreeUsdcWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientFourWsolBalance, isWritable: true, isSigner: false },
      { pubkey: clientFourUsdcBalance, isWritable: true, isSigner: false },
      { pubkey: clientFourWsolWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientFourUsdcWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientFiveWsolBalance, isWritable: true, isSigner: false },
      { pubkey: clientFiveUsdcBalance, isWritable: true, isSigner: false },
      { pubkey: clientFiveWsolWithdrawals, isWritable: true, isSigner: false },
      { pubkey: clientFiveUsdcWithdrawals, isWritable: true, isSigner: false },
    ];

    // Fetch balances and withdrawals before the update
    let fetchedClientOneWsolBalanceBefore = await program.account.clientBalance.fetch(clientOneWsolBalance);
    let fetchedClientOneUsdcBalanceBefore = await program.account.clientBalance.fetch(clientOneUsdcBalance);
    let fetchedClientTwoWsolBalanceBefore = await program.account.clientBalance.fetch(clientTwoWsolBalance);
    let fetchedClientTwoUsdcBalanceBefore = await program.account.clientBalance.fetch(clientTwoUsdcBalance);

    let fetchedClientOneWsolWithdrawalsBefore = await program.account.withdrawals.fetch(clientOneWsolWithdrawals);
    let fetchedClientOneUsdcWithdrawalsBefore = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);
    let fetchedClientTwoWsolWithdrawalsBefore = await program.account.withdrawals.fetch(clientTwoWsolWithdrawals);
    let fetchedClientTwoUsdcWithdrawalsBefore = await program.account.withdrawals.fetch(clientTwoUsdcWithdrawals);

    let fetchedClientThreeWsolBalanceBefore = await program.account.clientBalance.fetch(clientThreeWsolBalance);
    let fetchedClientThreeUsdcBalanceBefore = await program.account.clientBalance.fetch(clientThreeUsdcBalance);
    let fetchedClientThreeWsolWithdrawalsBefore = await program.account.withdrawals.fetch(clientThreeWsolWithdrawals);
    let fetchedClientThreeUsdcWithdrawalsBefore = await program.account.withdrawals.fetch(clientThreeUsdcWithdrawals);

    let fetchedClientFourWsolBalanceBefore = await program.account.clientBalance.fetch(clientFourWsolBalance);
    let fetchedClientFourUsdcBalanceBefore = await program.account.clientBalance.fetch(clientFourUsdcBalance);
    let fetchedClientFourWsolWithdrawalsBefore = await program.account.withdrawals.fetch(clientFourWsolWithdrawals);
    let fetchedClientFourUsdcWithdrawalsBefore = await program.account.withdrawals.fetch(clientFourUsdcWithdrawals);

    let fetchedClientFiveWsolBalanceBefore = await program.account.clientBalance.fetch(clientFiveWsolBalance);
    let fetchedClientFiveUsdcBalanceBefore = await program.account.clientBalance.fetch(clientFiveUsdcBalance);
    let fetchedClientFiveWsolWithdrawalsBefore = await program.account.withdrawals.fetch(clientFiveWsolWithdrawals);
    let fetchedClientFiveUsdcWithdrawalsBefore = await program.account.withdrawals.fetch(clientFiveUsdcWithdrawals);

    let updateFundMovementsTx1 = await program.methods.updateFundMovements(fundMovements1, backendId).accountsPartial({
      caller: utilityAccount.publicKey,
      accessController: accessControllerAccount,
      role: roleAccountUtilityAccount,
      member: memberAccountUtilityAccount,
      tokenValidator: tokenValidatorAccount,
      ledger: usdcWSolLedger,
      whitelistedStrikeToken: whitelistedUsdcTokenAccount,
      whitelistedUnderlyingToken: whitelistedNativeTokenAccount,
      strikeToken: usdcMint,
      underlyingToken: nativeMint,
      systemProgram: SystemProgram.programId,
    }).remainingAccounts(remainingAccounts1).signers([utilityAccount]).instruction();

    const [lookupTableDeriveInst, lookupTableDeriveAddress] =
      anchor.web3.AddressLookupTableProgram.createLookupTable({
        authority: utilityAccount.publicKey,
        payer: utilityAccount.publicKey,
        recentSlot: await provider.connection.getSlot() - 1,
      });

    const extendInstruction = anchor.web3.AddressLookupTableProgram.extendLookupTable({
      payer: utilityAccount.publicKey,
      authority: utilityAccount.publicKey,
      lookupTable: lookupTableDeriveAddress,
      addresses: [
        utilityAccount.publicKey,
        accessControllerAccount,
        roleAccountUtilityAccount,
        memberAccountUtilityAccount,
        tokenValidatorAccount,
        usdcWSolLedger,
        whitelistedUsdcTokenAccount,
        usdcMint,
        nativeMint,
        SystemProgram.programId,
      ],
    });

    let transactionsLookup = new Transaction();
    transactionsLookup.add(lookupTableDeriveInst);
    transactionsLookup.add(extendInstruction);

    const sx = await provider.connection.sendTransaction(transactionsLookup, [utilityAccount]).then(log).then(confirmTx);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const [lookupTableRemInst, lookupTableRemAddress] =
      anchor.web3.AddressLookupTableProgram.createLookupTable({
        authority: utilityAccount.publicKey,
        payer: utilityAccount.publicKey,
        recentSlot: await provider.connection.getSlot() - 1,
      });

    let remPkUnique = remainingAccounts1.map(account => account.pubkey);

    const extendInstructionRem = anchor.web3.AddressLookupTableProgram.extendLookupTable({
      payer: utilityAccount.publicKey,
      authority: utilityAccount.publicKey,
      lookupTable: lookupTableRemAddress,
      addresses: remPkUnique,
    });

    let transactionsLookupRem = new Transaction();
    transactionsLookupRem.add(lookupTableRemInst);
    transactionsLookupRem.add(extendInstructionRem);

    const sxRem = await provider.connection.sendTransaction(transactionsLookupRem, [utilityAccount]).then(log).then(confirmTx);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const lutAccountDer = (await provider.connection.getAddressLookupTable(lookupTableDeriveAddress)).value;
    const lutAccountRem = (await provider.connection.getAddressLookupTable(lookupTableRemAddress)).value;

    const computeUnitInstructions = [
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }),
      anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    ];

    const messagev0 = new anchor.web3.TransactionMessage({
      payerKey: utilityAccount.publicKey,
      recentBlockhash: (await provider.connection.getRecentBlockhash()).blockhash,
      instructions: [computeUnitInstructions[0], computeUnitInstructions[1], updateFundMovementsTx1]
    }).compileToV0Message([lutAccountDer, lutAccountRem])

    const transactionV0 = new anchor.web3.VersionedTransaction(messagev0);

    transactionV0.sign([utilityAccount]);

    console.log("Transaction Size: ", transactionV0.serialize().length);

    const txv0 = await provider.connection.sendRawTransaction(transactionV0.serialize()).then(log).then(confirmTx);

    // Fetch updated balances and withdrawals
    let fetchedClientOneWsolBalanceAfter = await program.account.clientBalance.fetch(clientOneWsolBalance);
    let fetchedClientOneUsdcBalanceAfter = await program.account.clientBalance.fetch(clientOneUsdcBalance);
    let fetchedClientTwoWsolBalanceAfter = await program.account.clientBalance.fetch(clientTwoWsolBalance);
    let fetchedClientTwoUsdcBalanceAfter = await program.account.clientBalance.fetch(clientTwoUsdcBalance);

    let fetchedClientOneWsolWithdrawalsAfter = await program.account.withdrawals.fetch(clientOneWsolWithdrawals);
    let fetchedClientOneUsdcWithdrawalsAfter = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);
    let fetchedClientTwoWsolWithdrawalsAfter = await program.account.withdrawals.fetch(clientTwoWsolWithdrawals);
    let fetchedClientTwoUsdcWithdrawalsAfter = await program.account.withdrawals.fetch(clientTwoUsdcWithdrawals);

    let fetchedClientThreeWsolBalanceAfter = await program.account.clientBalance.fetch(clientThreeWsolBalance);
    let fetchedClientThreeUsdcBalanceAfter = await program.account.clientBalance.fetch(clientThreeUsdcBalance);
    let fetchedClientThreeWsolWithdrawalsAfter = await program.account.withdrawals.fetch(clientThreeWsolWithdrawals);
    let fetchedClientThreeUsdcWithdrawalsAfter = await program.account.withdrawals.fetch(clientThreeUsdcWithdrawals);

    let fetchedClientFourWsolBalanceAfter = await program.account.clientBalance.fetch(clientFourWsolBalance);
    let fetchedClientFourUsdcBalanceAfter = await program.account.clientBalance.fetch(clientFourUsdcBalance);
    let fetchedClientFourWsolWithdrawalsAfter = await program.account.withdrawals.fetch(clientFourWsolWithdrawals);
    let fetchedClientFourUsdcWithdrawalsAfter = await program.account.withdrawals.fetch(clientFourUsdcWithdrawals);

    let fetchedClientFiveWsolBalanceAfter = await program.account.clientBalance.fetch(clientFiveWsolBalance);
    let fetchedClientFiveUsdcBalanceAfter = await program.account.clientBalance.fetch(clientFiveUsdcBalance);
    let fetchedClientFiveWsolWithdrawalsAfter = await program.account.withdrawals.fetch(clientFiveWsolWithdrawals);
    let fetchedClientFiveUsdcWithdrawalsAfter = await program.account.withdrawals.fetch(clientFiveUsdcWithdrawals);

    // Assertions for Withdrawals
    const strikeTokenDiff = 6 - usdcPrecision;
    const underlyingTokenDiff = 9 - nativePrecision;

    const underlyingMultiplier = new anchor.BN(10 ** underlyingTokenDiff);
    const strikeMultiplier = new anchor.BN(10 ** strikeTokenDiff);

    // Client One Assertions
    if (fundMovements1[0].underlyingAmount.isNeg()) {
      assert.equal(fetchedClientOneWsolBalanceAfter.amount.toString(), fetchedClientOneWsolBalanceBefore.amount.add(fundMovements1[0].underlyingAmount.mul(underlyingMultiplier).abs()).toString(), "Client One's wSOL balance not updated correctly");
    } else {
      if (fundMovements1[0].underlyingAmount.gt(fetchedClientOneWsolBalanceBefore.amount)) {
        assert.equal(fetchedClientOneWsolWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientOneWsolWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[0].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client One's wSOL Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientOneWsolBalanceAfter.amount.toString(), (fetchedClientOneWsolBalanceBefore.amount.sub(fundMovements1[0].underlyingAmount.mul(underlyingMultiplier))).toString(), "Client One's wSOL Balance not updated correctly");
      }
    }

    if (fundMovements1[0].strikeAmount.isNeg()) {
      assert.equal(fetchedClientOneUsdcBalanceAfter.amount.toString(), fetchedClientOneUsdcBalanceBefore.amount.add(fundMovements1[0].strikeAmount.mul(strikeMultiplier).abs()).toString(), "Client One's USDC balance not updated correctly");
    } else {
      if (fundMovements1[0].strikeAmount.gt(fetchedClientOneUsdcBalanceBefore.amount)) {
        assert.equal(fetchedClientOneUsdcWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientOneUsdcWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[0].strikeAmount.mul(strikeMultiplier)).toString(), "Client One's USDC Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientOneUsdcBalanceAfter.amount.toString(), fetchedClientOneUsdcBalanceBefore.amount.sub(fundMovements1[0].strikeAmount.mul(strikeMultiplier)).toString(), "Client One's USDC Balance not updated correctly");
      }
    }

    // Client Two Assertions

    if (fundMovements1[1].underlyingAmount.isNeg()) {
      assert.equal(fetchedClientTwoWsolBalanceAfter.amount.toString(), fetchedClientTwoWsolBalanceBefore.amount.add(fundMovements1[1].underlyingAmount.mul(underlyingMultiplier).abs()).toString(), "Client Two's wSOL balance not updated correctly");
    } else {
      if (fundMovements1[1].underlyingAmount.gt(fetchedClientTwoWsolBalanceBefore.amount)) {
        assert.equal(fetchedClientTwoWsolWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientTwoWsolWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[1].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client Two's wSOL Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientTwoWsolBalanceAfter.amount.toString(), fetchedClientTwoWsolBalanceBefore.amount.sub(fundMovements1[1].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client Two's wSOL Balance not updated correctly");
      }
    }

    if (fundMovements1[1].strikeAmount.isNeg()) {
      assert.equal(fetchedClientTwoUsdcBalanceAfter.amount.toString(), fetchedClientTwoUsdcBalanceBefore.amount.add(fundMovements1[1].strikeAmount.mul(strikeMultiplier).abs()).toString(), "Client Two's USDC balance not updated correctly");
    } else {
      if (fundMovements1[1].strikeAmount.gt(fetchedClientTwoUsdcBalanceBefore.amount)) {
        assert.equal(fetchedClientTwoUsdcWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientTwoUsdcWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[1].strikeAmount.mul(strikeMultiplier)).toString(), "Client Two's USDC Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientTwoUsdcBalanceAfter.amount.toString(), fetchedClientTwoUsdcBalanceBefore.amount.sub(fundMovements1[1].strikeAmount.mul(strikeMultiplier)).toString(), "Client Two's USDC Balance not updated correctly");
      }
    }

    // Client Three Assertions

    if (fundMovements1[2].underlyingAmount.isNeg()) {
      assert.equal(fetchedClientThreeWsolBalanceAfter.amount.toString(), fetchedClientThreeWsolBalanceBefore.amount.add(fundMovements1[2].underlyingAmount.mul(underlyingMultiplier).abs()).toString(), "Client Three's wSOL balance not updated correctly");
    } else {
      if (fundMovements1[2].underlyingAmount.gt(fetchedClientThreeWsolBalanceBefore.amount)) {
        assert.equal(fetchedClientThreeWsolWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientThreeWsolWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[2].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client Three's wSOL Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientThreeWsolBalanceAfter.amount.toString(), fetchedClientThreeWsolBalanceBefore.amount.sub(fundMovements1[0].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client Three's wSOL Balance not updated correctly");
      }
    }

    if (fundMovements1[2].strikeAmount.isNeg()) {
      assert.equal(fetchedClientThreeUsdcBalanceAfter.amount.toString(), fetchedClientThreeUsdcBalanceBefore.amount.add(fundMovements1[2].strikeAmount.mul(strikeMultiplier).abs()).toString(), "Client Three's USDC balance not updated correctly");
    } else {
      if (fundMovements1[2].strikeAmount.gt(fetchedClientThreeUsdcBalanceBefore.amount)) {
        assert.equal(fetchedClientThreeUsdcWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientThreeUsdcWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[2].strikeAmount.mul(strikeMultiplier)).toString(), "Client Three's USDC Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientThreeUsdcBalanceAfter.amount.toString(), fetchedClientThreeUsdcBalanceBefore.amount.sub(fundMovements1[2].strikeAmount.mul(strikeMultiplier)).toString(), "Client Three's USDC Balance not updated correctly");
      }
    }

    // Client Four Assertions
    if (fundMovements1[3].underlyingAmount.isNeg()) {
      assert.equal(fetchedClientFourWsolBalanceAfter.amount.toString(), fetchedClientFourWsolBalanceBefore.amount.add(fundMovements1[3].underlyingAmount.mul(underlyingMultiplier).abs()).toString(), "Client Four's wSOL balance not updated correctly");
    } else {
      if (fundMovements1[3].underlyingAmount.gt(fetchedClientFourWsolBalanceBefore.amount)) {
        assert.equal(fetchedClientFourWsolWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientFourWsolWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[3].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client Four's wSOL Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientFourWsolBalanceAfter.amount.toString(), fetchedClientFourWsolBalanceBefore.amount.sub(fundMovements1[3].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client Four's wSOL Balance not updated correctly");
      }
    }

    if (fundMovements1[3].strikeAmount.isNeg()) {
      assert.equal(fetchedClientFourUsdcBalanceAfter.amount.toString(), fetchedClientFourUsdcBalanceBefore.amount.add(fundMovements1[3].strikeAmount.mul(strikeMultiplier).abs()).toString(), "Client Four's USDC balance not updated correctly");
    } else {
      if (fundMovements1[3].strikeAmount.gt(fetchedClientFourUsdcBalanceBefore.amount)) {
        assert.equal(fetchedClientFourUsdcWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientFourUsdcWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[3].strikeAmount.mul(strikeMultiplier)).toString(), "Client Four's USDC Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientFourUsdcBalanceAfter.amount.toString(), fetchedClientFourUsdcBalanceBefore.amount.sub(fundMovements1[3].strikeAmount.mul(strikeMultiplier)).toString(), "Client Four's USDC Balance not updated correctly");
      }
    }

    // Client Five Assertions
    if (fundMovements1[4].underlyingAmount.isNeg()) {
      assert.equal(fetchedClientFiveWsolBalanceAfter.amount.toString(), fetchedClientFiveWsolBalanceBefore.amount.add(fundMovements1[4].underlyingAmount.mul(underlyingMultiplier).abs()).toString(), "Client Five's wSOL balance not updated correctly");
    } else {
      if (fundMovements1[4].underlyingAmount.gt(fetchedClientFiveWsolBalanceBefore.amount)) {
        assert.equal(fetchedClientFiveWsolWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientFiveWsolWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[4].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client Five's wSOL Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientFiveWsolBalanceAfter.amount.toString(), fetchedClientFiveWsolBalanceBefore.amount.sub(fundMovements1[4].underlyingAmount.mul(underlyingMultiplier)).toString(), "Client Five's wSOL Balance not updated correctly");
      }
    }

    if (fundMovements1[4].strikeAmount.isNeg()) {
      assert.equal(fetchedClientFiveUsdcBalanceAfter.amount.toString(), fetchedClientFiveUsdcBalanceBefore.amount.add(fundMovements1[4].strikeAmount.mul(strikeMultiplier).abs()).toString(), "Client Five's USDC balance not updated correctly");
    } else {
      if (fundMovements1[4].strikeAmount.gt(fetchedClientFiveUsdcBalanceBefore.amount)) {
        assert.equal(fetchedClientFiveUsdcWithdrawalsAfter.activeWithdrawalsAmount.toString(), fetchedClientFiveUsdcWithdrawalsBefore.activeWithdrawalsAmount.sub(fundMovements1[4].strikeAmount.mul(strikeMultiplier)).toString(), "Client Five's USDC Withdrawals not updated correctly");
      } else {
        assert.equal(fetchedClientFiveUsdcBalanceAfter.amount.toString(), fetchedClientFiveUsdcBalanceBefore.amount.sub(fundMovements1[4].strikeAmount.mul(strikeMultiplier)).toString(), "Client Five's USDC Balance not updated correctly");
      }
    }
  });

  // it("Release the first withdraw request after release lock passes", async () => {
  //   // wait for 30 seconds
  //   await new Promise(resolve => setTimeout(resolve, 1000 * 30 * 1))
  //   console.log("WAIT", await printTimestamp(provider));

  //   let clientOneUsdcBalanceBeforeRelease = await getTokenAccountBalance(provider.connection, clientOneUsdcAta.address);
  //   let fetchedClientOneUsdcWithdrawalsBeforeRelease = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);
  //   let index = new anchor.BN(0);
  //   let amountToRelease = fetchedClientOneUsdcWithdrawalsBeforeRelease.withdrawalQueue[0].amount;

  //   let releaseFundlockTx = await program.methods.releaseFundlock(index).accountsPartial({
  //     accessController: accessControllerAccount,
  //     tokenValidator: tokenValidatorAccount,
  //     fundlock: fundlockAccount,
  //     client: clientOne.publicKey,
  //     clientAta: clientOneUsdcAta.address,
  //     token: usdcMint,
  //     clientBalance: clientOneUsdcBalance,
  //     fundlockTokenVault: fundlockUsdcTokenVault,
  //     systemProgram: SystemProgram.programId,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //     whitelistedToken: whitelistedUsdcTokenAccount,
  //     withdrawals: clientOneUsdcWithdrawals
  //   }).signers([clientOne]).rpc().then(confirmTx).then(log);

  //   let fetchedClientOneUsdcWithdrawalsAfterRelease = await program.account.withdrawals.fetch(clientOneUsdcWithdrawals);

  //   let clientUpdatedBalance = +clientOneUsdcBalanceBeforeRelease + amountToRelease.toNumber();

  //   assert.equal(fetchedClientOneUsdcWithdrawalsAfterRelease.activeWithdrawalsAmount.toString(), amountToWithdrawClientOne.mul(new anchor.BN(4)).toString(), "Client active USDC withdrawals amount not updated");

  //   assert.equal(await getTokenAccountBalance(provider.connection, clientOneUsdcAta.address), clientUpdatedBalance.toString(), "Client One's USDC Balance not updated");

  //   let fundlockExpectedBalance = amountToWithdrawClientOne.mul(new anchor.BN(4)).add(amountToDepositClientTwo).add(amountToDepositClientThree).add(amountToDepositClientFour).add(amountToDepositClientFive);

  //   assert.equal(await getTokenAccountBalance(provider.connection, fundlockUsdcTokenVault), fundlockExpectedBalance.toString(), "Fundlock USDC Balance not updated");

  //   assert.equal(fetchedClientOneUsdcWithdrawalsAfterRelease.withdrawalQueue.length, 4, "Client One's USDC Withdrawals Queue not updated");

  // });

  it("Will find the fundlock collateral vault for Kamino SOL", async () => {

    fundlockSolCollateralVault = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("fundlock_collateral_vault"),
        fundlockWsolTokenVault.toBuffer(),
        KaminoSolColToken.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Fundlock Kamino Sol Collateral Token Vault:", fundlockSolCollateralVault.toString());
  });

  it("Will find the client collateral balance for Kamino SOL", async () => {

    clientOneSolCollateralBalance = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("client_collateral_balance"),
        fundlockSolCollateralVault.toBuffer(),
        clientOne.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Client One Kamino Sol Collateral Balance:", clientOneSolCollateralBalance.toString());


  });

  it("will deposit wSol into Kamino", async () => {

    let FundlockSolVaultBefore = await getTokenAccountBalance(provider.connection, fundlockWsolTokenVault);

    try {
      let depositKamino = await program.methods.depositKamino(new anchor.BN("13400000")).accountsStrict({
        accessController: accessControllerAccount,
        tokenValidator: tokenValidatorAccount,
        fundlock: fundlockAccount,
        client: clientOne.publicKey,
        token: nativeMint,
        fundlockTokenVault: fundlockWsolTokenVault,
        clientBalance: clientOneWsolBalance,
        clientAta: clientOneWsolAta.address,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        whitelistedToken: whitelistedNativeTokenAccount,
        reserve: KaminoSolState,
        lendingMarket: kaminoMainMarket,
        lendingMarketAuthority: kaminoReserve1,
        reserveCollateralToken: KaminoSolColToken,
        reserveLiquiditySupply: KaminoSolLiqResSup,
        fundlockCollateralVault: fundlockSolCollateralVault,
        kaminoProgram: kaminoLendProgramId,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY
      }).signers([clientOne]).rpc().then(confirmTx).then(log);
    } catch (error) {
      if (error instanceof anchor.web3.SendTransactionError) {
        console.error("Transaction failed with logs:", await error.getLogs(provider.connection));
      } else {
        console.error("Unexpected error:", error);
      }
    }

    assert.equal((await getTokenAccountBalance(provider.connection, fundlockWsolTokenVault)).toString(), (+FundlockSolVaultBefore - 13400000).toString(), "Fundlock wSol Vault not updated correctly");

    // TODO! Find a way to calculate the expected collateral balance in order to assert it
    console.log("Current collateral Balance", await getTokenAccountBalance(provider.connection, fundlockSolCollateralVault));

    let fetchedClientBalance = await program.account.clientBalance.fetch(clientOneWsolBalance);
    assert.equal((await getTokenAccountBalance(provider.connection, fundlockSolCollateralVault)).toString(), fetchedClientBalance.collateralAmount.toString(), "Fundlock Sol Collateral Vault not updated correctly");


  });

  it("Will redeem all from Kamino", async () => {

    let FundlockSolVaultBefore = await getTokenAccountBalance(provider.connection, fundlockWsolTokenVault);
    let fetchedClientBalanceBefore = await program.account.clientBalance.fetch(clientOneWsolBalance);


    let redeemKamino = await program.methods.redeemKamino(fetchedClientBalanceBefore.collateralAmount).accountsStrict({
      accessController: accessControllerAccount,
      tokenValidator: tokenValidatorAccount,
      fundlock: fundlockAccount,
      client: clientOne.publicKey,
      token: nativeMint,
      fundlockTokenVault: fundlockWsolTokenVault,
      clientBalance: clientOneWsolBalance,
      clientAta: clientOneWsolAta.address,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      whitelistedToken: whitelistedNativeTokenAccount,
      reserve: KaminoSolState,
      lendingMarket: kaminoMainMarket,
      lendingMarketAuthority: kaminoReserve1,
      reserveCollateralToken: KaminoSolColToken,
      reserveLiquiditySupply: KaminoSolLiqResSup,
      fundlockCollateralVault: fundlockSolCollateralVault,
      kaminoProgram: kaminoLendProgramId,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY
    }).signers([clientOne]).rpc().then(confirmTx).then(log);

  });
});
