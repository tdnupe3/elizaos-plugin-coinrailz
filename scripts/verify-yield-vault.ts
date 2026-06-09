/**
 * Post-deploy verification script — reads live contract state
 *
 * Usage:
 *   npx hardhat run scripts/verify-yield-vault.ts --network base-sepolia
 *
 * Requires YIELD_VAULT_ADDRESS env var to be set.
 */

import { ethers } from "hardhat";

const VAULT_ADDRESS = process.env.YIELD_VAULT_ADDRESS;

const VAULT_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function pricePerShare() view returns (uint256)",
  "function depositFeeBps() view returns (uint256)",
  "function performanceFeeBps() view returns (uint256)",
  "function pendingFees() view returns (uint256)",
  "function activeProtocolName() view returns (string)",
  "function getAllAPYs() view returns (uint256 aaveAPYBps, uint256 compoundAPYBps, uint256 morphoAPYBps)",
  "function feeRecipient() view returns (address)",
  "function owner() view returns (address)",
  "function nextRebalanceIn() view returns (uint256)",
];

async function main() {
  if (!VAULT_ADDRESS) {
    throw new Error("Set YIELD_VAULT_ADDRESS env var first");
  }

  const vault = await ethers.getContractAt(VAULT_ABI, VAULT_ADDRESS);

  const [
    totalAssets, totalSupply, pricePerShare,
    depositFeeBps, performanceFeeBps, pendingFees,
    protocol, [aaveAPY, compoundAPY, morphoAPY],
    feeRecipient, owner, nextRebalance,
  ] = await Promise.all([
    vault.totalAssets(),
    vault.totalSupply(),
    vault.pricePerShare(),
    vault.depositFeeBps(),
    vault.performanceFeeBps(),
    vault.pendingFees(),
    vault.activeProtocolName(),
    vault.getAllAPYs(),
    vault.feeRecipient(),
    vault.owner(),
    vault.nextRebalanceIn(),
  ]);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  CoinRailz Yield Vault — Live State");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Address:         ${VAULT_ADDRESS}`);
  console.log(`  Owner:           ${owner}`);
  console.log(`  Fee Recipient:   ${feeRecipient}`);
  console.log(`\n  TVL (USDC):      $${(Number(totalAssets) / 1e6).toFixed(2)}`);
  console.log(`  Total Shares:    ${(Number(totalSupply) / 1e6).toFixed(6)} crUSDC`);
  console.log(`  Price/Share:     $${(Number(pricePerShare) / 1e6).toFixed(6)}`);
  console.log(`  Pending Fees:    $${(Number(pendingFees) / 1e6).toFixed(2)}`);
  console.log(`\n  Active Protocol: ${protocol}`);
  console.log(`  Aave APY:        ${(Number(aaveAPY) / 100).toFixed(2)}%`);
  console.log(`  Compound APY:    ${(Number(compoundAPY) / 100).toFixed(2)}%`);
  console.log(`  Morpho APY:      ${(Number(morphoAPY) / 100).toFixed(2)}%`);
  console.log(`\n  Entry Fee:       ${Number(depositFeeBps) / 100}%`);
  console.log(`  Perf Fee:        ${Number(performanceFeeBps) / 100}%`);
  console.log(`  Next Rebalance:  ${Number(nextRebalance)}s`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
