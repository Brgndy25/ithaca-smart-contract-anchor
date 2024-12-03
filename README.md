# Ithaca Smart Contract

This project is a Solana program written using the Anchor framework. Follow the instructions below to deploy the program and configure the authority.

## Prerequisites

Before you start, make sure you have the following installed:

- Rust: Install from [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)
- Solana CLI: Install from [https://docs.solana.com/cli/install-solana-cli-tools](https://docs.solana.com/cli/install-solana-cli-tools)
- Anchor CLI: Install from [https://book.anchor-lang.com/getting_started/installation.html](https://book.anchor-lang.com/getting_started/installation.html)
- Node.js (v16 or later) and Yarn (or npm)

## Deployment Steps

### Clone the Repository

Run the following commands to clone the repository and navigate to the project directory:

```console
git clone https://github.com/Brgndy25/ithaca-smart-contract-anchor.git 
cd ithaca-smart-contract-anchor
```

### Configure the Authority and the network

To change the authority for the program, follow these steps:

1. Open the `Anchor.toml` file.
2. Modify the `[provider]` section to specify the wallet path and cluster endpoint:
   ```[provider] cluster = "devnet"``` or 
   ```"localnet"``` for localnet 
3. Update the `[programs.localnet]` or `[programs.testnet]` section in the file to match the network you want to use.

### Build the Program

Run the following command to build the program:

```console
anchor build
```

### Deploy the Program

**To deploy on devnet:**

1. Ensure your Solana CLI is configured for the devnet cluster:

```console
solana config set --url https://api.devnet.solana.com
```

2. Deploy the program to the devnet cluster:

```console
anchor deploy --provider.cluster devnet
```

**To deploy on localnet:**

1. Start a local Solana validator:

```console
solana-test-validator
```

2. Deploy the program to the localnet cluster:

```console
anchor deploy --provider.cluster localnet
```

