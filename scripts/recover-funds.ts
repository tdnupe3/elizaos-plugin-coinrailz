import { CoinbaseCDPService } from '../server/services/coinbaseCDPService';

async function recoverFunds() {
  const cdp = CoinbaseCDPService.getInstance();
  await new Promise(r => setTimeout(r, 3000));

  const targetAddress = "0x6341B240547d520a425ea58EF91b33692b12f356";
  const buyerAddress = "0x5837A864C03912ea14a5609968F73E75B9d42a7C";
  const platformAddress = "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";

  console.log("=== WALLET INVESTIGATION ===");
  console.log(`PLATFORM_WALLET_ADDRESS env: ${process.env.PLATFORM_WALLET_ADDRESS || 'NOT SET'}`);
  console.log(`EVM_PRIVATE_KEY wallet:      ${platformAddress}`);
  console.log(`Target (wrong wallet):       ${targetAddress}`);
  console.log(`Buyer (correct wallet):      ${buyerAddress}`);
  console.log("");

  const targetBalance = await cdp.getUSDCBalance(targetAddress, 'base-mainnet');
  const platformBalance = await cdp.getUSDCBalance(platformAddress, 'base-mainnet');
  const buyerBalance = await cdp.getUSDCBalance(buyerAddress, 'base-mainnet');
  
  console.log(`Target USDC:   $${targetBalance}`);
  console.log(`Platform USDC: $${platformBalance}`);
  console.log(`Buyer USDC:    $${buyerBalance}`);
  console.log("");
  
  console.log("CONCLUSION: 0x6341... was created by cdpClient.evm.createAccount()");
  console.log("but the CDP SDK no longer recognizes it ('EVM account not found').");
  console.log("The $39.35 is locked in a CDP-managed wallet we cannot sign for.");
  console.log("");
  console.log("RECOVERY OPTIONS:");
  console.log("1. Contact Coinbase CDP support with wallet address and API key ID");
  console.log("2. Check if CDP_API_KEY_ID was changed/rotated since wallet creation");
  console.log("3. If credentials match, CDP may be able to re-associate the wallet");
}

recoverFunds().catch(console.error);
