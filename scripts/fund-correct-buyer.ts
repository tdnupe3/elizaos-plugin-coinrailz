import { CoinbaseCDPService } from '../server/services/coinbaseCDPService';
import { WALLET_REGISTRY, validateTransferTarget, validateTransferSource, requireConfirmation, printTransferSummary } from './lib/walletRegistry';

async function fundBuyer() {
  const amount = process.argv[2] || "10.00";
  const from = WALLET_REGISTRY.PLATFORM.address;
  const to = WALLET_REGISTRY.BUYER_TEST.address;

  const sourceCheck = validateTransferSource(from);
  if (!sourceCheck.valid) {
    console.error(`ABORT: ${sourceCheck.error}`);
    process.exit(1);
  }

  const targetCheck = validateTransferTarget(to);
  if (!targetCheck.valid) {
    console.error(`ABORT: ${targetCheck.error}`);
    process.exit(1);
  }

  const dryRun = process.env.CONFIRM_TRANSFER !== 'true';
  printTransferSummary({ from, to, amount, token: "USDC", chain: "base-mainnet", dryRun });

  if (dryRun) {
    console.log("DRY RUN complete. No funds transferred.");
    console.log("To execute: CONFIRM_TRANSFER=true npx tsx scripts/fund-correct-buyer.ts " + amount);
    return;
  }

  if (!requireConfirmation()) return;

  const cdp = CoinbaseCDPService.getInstance();
  await new Promise(r => setTimeout(r, 3000));

  const result = await cdp.sendUSDC({
    toAddress: to,
    amount: amount,
    chain: "base-mainnet",
  });

  console.log(`Result:`, JSON.stringify(result, null, 2));

  if (result.status === 'completed') {
    console.log(`Successfully funded! TX: ${result.txHash}`);
    console.log(`BaseScan: https://basescan.org/tx/${result.txHash}`);
  } else {
    console.log(`Transfer failed: ${result.error}`);
  }
}

fundBuyer().catch(console.error);
