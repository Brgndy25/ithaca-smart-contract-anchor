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
import { AssertionError } from "chai";

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

  // Roles
  const ADMIN_ROLE: string = "DEFAULT_ADMIN_ROLE";
  const UTILITY_ACCOUNT_ROLE: string = "UTILITY_ACCOUNT_ROLE";
  const LIQUIDATOR_ROLE: string = "LIQUIDATOR_ROLE";

  let accessControllerAccount: PublicKey;
  let roleAccount: PublicKey;
  let memberAccount: PublicKey;
  let fetchedaccessControllerAccount;
  let fetchedRoleAccount;
  let fetchedMemberAccount;

  // Airdrop some SOL to pay for the fees. Confirm the airdrop before proceeding.
  it("Airdrops", async () => {
    await Promise.all(
      [admin].map(async (account) => {
        await provider.connection
          .requestAirdrop(account.publicKey, 100 * LAMPORTS_PER_SOL)
          .then(confirmTx);
      })
    );

    assert.equal(await getAccountBalance(provider.connection, admin.publicKey), 100, "Airdrop failed");
    console.log(admin.publicKey.toString());
  });

  it("Find and Fetch PDAs", async () => {

    accessControllerAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("access_controller"),
        admin.publicKey.toBuffer(),
      ],
      program.programId
    )[0];


    roleAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("role"),
        accessControllerAccount.toBuffer(),
      ],
      program.programId
    )[0];

    memberAccount = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("member"),
        roleAccount.toBuffer(),
        admin.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    console.log("Access Controller Account:", accessControllerAccount.toString());
    console.log("Role Account:", roleAccount.toString());
    console.log("Member Account:", memberAccount.toString());

  });

  it("Access Controller Is Initialized", async () => {
    const initAccessControllertx = await program.methods.initAccessController().accountsPartial({
      accessController: accessControllerAccount,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([admin]).rpc().then(confirmTx).then(log);

    console.log("Your transaction signature", initAccessControllertx);


    fetchedaccessControllerAccount = await program.account.accessController.fetch(accessControllerAccount);

    fetchedRoleAccount = await program.account.role.fetch(roleAccount);

    fetchedMemberAccount = await program.account.member.fetch(memberAccount);

    assert.equal(fetchedaccessControllerAccount.admin.toString(), admin.publicKey.toString(), "Access Controller not initialized");

    assert.equal(fetchedRoleAccount.role.toString(), ADMIN_ROLE, "Role not initialized");

    assert.equal(fetchedMemberAccount.member.toString(), admin.publicKey.toString(), "Member not initialized");

    assert.equal(fetchedRoleAccount.memberCount.toString(), "1", "Member count not as expected");

  })
});
