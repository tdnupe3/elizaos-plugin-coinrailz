/**
 * CoinRailz Yield Vault — Deployment Script
 *
 * Usage:
 *   Base Sepolia (testnet):  npx hardhat run scripts/deploy-yield-vault.ts --network base-sepolia
 *   Base Mainnet:            npx hardhat run scripts/deploy-yield-vault.ts --network base
 *
 * After deploy:
 *   1. Copy the vault address into your .env as YIELD_VAULT_ADDRESS=0x...
 *   2. Optionally verify: npx hardhat verify --network base-sepolia <address> <...constructorArgs>
 */

import { ethers, network } from "hardhat";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ── Network-specific addresses ────────────────────────────────────────────────

const ADDRESSES: Record<string, {
  usdc:          string;
  aavePool:      string;
  aUsdc:         string;
  compoundComet: string;
  morpho:        string;
  feeRecipient:  string;
}> = {
  "base-sepolia": {
    // Base Sepolia testnet — use mock/test addresses
    usdc:          "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    aavePool:      "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b", // Aave v3 Pool on Base Sepolia
    aUsdc:         "0x96e32dE4B1d6B4bA845C7E8F9F95F5cC0b66B4a4", // aUSDC on Base Sepolia (placeholder)
    compoundComet: "0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017", // Compound v3 on Base Sepolia
    morpho:        ethers.ZeroAddress, // Disable Morpho on testnet
    feeRecipient:  process.env.FEE_RECIPIENT || "",
  },
  base: {
    // Base Mainnet — production addresses
    usdc:          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    aavePool:      "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    aUsdc:         "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
    compoundComet: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
    morpho:        "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    feeRecipient:  process.env.FEE_RECIPIENT || "",
  },
};

// ── Empty Morpho market params (for disabled Morpho) ─────────────────────────

const EMPTY_MORPHO_MARKET = {
  loanToken:       ethers.ZeroAddress,
  collateralToken: ethers.ZeroAddress,
  oracle:          ethers.ZeroAddress,
  irm:             ethers.ZeroAddress,
  lltv:            0n,
};

// ── USDC/wstETH Morpho market on Base mainnet ────────────────────────────────
// Market ID: computed from these params — verify on app.morpho.org before mainnet deploy

const MORPHO_USDC_WSTETH_MARKET = {
  loanToken:       "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  collateralToken: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", // wstETH on Base
  oracle:          "0x4E65fE4DbA92790696d040ac24Aa414708F5c0AB", // placeholder — verify
  irm:             "0x46415998764C29aB2a25CbeA6254146D50D22687", // Adaptive Curve IRM on Base
  lltv:            860000000000000000n, // 86% LLTV
};

async function main() {
  const networkName = network.name;
  const addrs = ADDRESSES[networkName];

  if (!addrs) {
    throw new Error(`No addresses configured for network: ${networkName}. Add them to ADDRESSES in this script.`);
  }

  if (!addrs.feeRecipient || addrs.feeRecipient === "") {
    throw new Error(
      "FEE_RECIPIENT env var not set. This is the wallet that receives CoinRailz platform fees.\n" +
      "Set it before deploying: export FEE_RECIPIENT=0xYourWallet"
    );
  }

  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  CoinRailz Yield Vault — Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network:       ${networkName}`);
  console.log(`  Deployer:      ${deployer.address}`);
  console.log(`  Balance:       ${ethers.formatEther(balance)} ETH`);
  console.log(`  Fee Recipient: ${addrs.feeRecipient}`);
  console.log(`  USDC:          ${addrs.usdc}`);
  console.log(`  Aave Pool:     ${addrs.aavePool}`);
  console.log(`  Compound:      ${addrs.compoundComet}`);
  console.log(`  Morpho:        ${addrs.morpho === ethers.ZeroAddress ? "DISABLED" : addrs.morpho}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const morphoMarket = addrs.morpho === ethers.ZeroAddress
    ? EMPTY_MORPHO_MARKET
    : MORPHO_USDC_WSTETH_MARKET;

  // Protocol.AAVE = 0
  const INITIAL_PROTOCOL = 0;

  console.log("Deploying CoinRailzYieldVault...");
  const Factory = await ethers.getContractFactory("CoinRailzYieldVault");

  const vault = await Factory.deploy(
    addrs.usdc,
    addrs.feeRecipient,
    addrs.aavePool,
    addrs.aUsdc,
    addrs.compoundComet,
    addrs.morpho,
    morphoMarket,
    INITIAL_PROTOCOL,
    { gasLimit: 4_000_000 }
  );

  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log(`✅ CoinRailzYieldVault deployed: ${vaultAddress}`);
  console.log(`   Basescan: https://${networkName === "base" ? "" : "sepolia."}basescan.org/address/${vaultAddress}`);

  // ── Save deployment artifact ──────────────────────────────────────────────

  const deployDir = join(__dirname, "..", "deployments");
  if (!existsSync(deployDir)) mkdirSync(deployDir, { recursive: true });

  const artifact = {
    network:       networkName,
    address:       vaultAddress,
    deployer:      deployer.address,
    feeRecipient:  addrs.feeRecipient,
    deployedAt:    new Date().toISOString(),
    constructorArgs: {
      asset:          addrs.usdc,
      feeRecipient:   addrs.feeRecipient,
      aavePool:       addrs.aavePool,
      aUsdc:          addrs.aUsdc,
      compoundComet:  addrs.compoundComet,
      morpho:         addrs.morpho,
      morphoMarket,
      initialProtocol: INITIAL_PROTOCOL,
    },
  };

  const artifactPath = join(deployDir, `${networkName}-yield-vault.json`);
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\n📄 Deployment artifact saved: ${artifactPath}`);

  // ── Next steps ────────────────────────────────────────────────────────────

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Next Steps");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  1. Set env var:  YIELD_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`  2. Verify on Basescan:`);
  console.log(`     npx hardhat verify --network ${networkName} ${vaultAddress} \\`);
  console.log(`       ${addrs.usdc} ${addrs.feeRecipient} \\`);
  console.log(`       ${addrs.aavePool} ${addrs.aUsdc} \\`);
  console.log(`       ${addrs.compoundComet} ${addrs.morpho} \\`);
  console.log(`       "[${Object.values(morphoMarket).join(',')}]" ${INITIAL_PROTOCOL}`);
  console.log(`  3. Test deposit: send USDC to the vault and check /api/yield/stats`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
