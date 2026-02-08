import { CoinbaseCDPService } from '../server/services/coinbaseCDPService';
import { validateTransferTarget, requireConfirmation, printTransferSummary, lookupWallet } from './lib/walletRegistry';

async function sweepToBuyer() {
  const fromAddress = process.argv[2];
  const toAddress = process.argv[3];
  const amount = process.argv[4];

  if (!fromAddress || !toAddress || !amount) {
    console.error("Usage: npx tsx scripts/sweep-to-buyer.ts <fromAddress> <toAddress> <amount>");
    console.error("Example: CONFIRM_TRANSFER=true npx tsx scripts/sweep-to-buyer.ts 0xFROM... 0xTO... 10.00");
    process.exit(1);
  }

  const fromWallet = lookupWallet(fromAddress);
  if (!fromWallet) {
    console.error(`ABORT: Source address ${fromAddress} is not in the wallet registry.`);
    console.error("Add it to scripts/lib/walletRegistry.ts first.");
    process.exit(1);
  }

  const targetCheck = validateTransferTarget(toAddress);
  if (!targetCheck.valid) {
    console.error(`ABORT: ${targetCheck.error}`);
    process.exit(1);
  }

  const dryRun = process.env.CONFIRM_TRANSFER !== 'true';
  printTransferSummary({ from: fromAddress, to: toAddress, amount, token: "USDC", chain: "base-mainnet", dryRun });

  if (dryRun) {
    console.log("DRY RUN complete. No funds transferred.");
    console.log("To execute: CONFIRM_TRANSFER=true npx tsx scripts/sweep-to-buyer.ts " + [fromAddress, toAddress, amount].join(' '));
    return;
  }

  if (!requireConfirmation()) return;

  const cdp = CoinbaseCDPService.getInstance();
  await new Promise(r => setTimeout(r, 3000));

  const result = await cdp.sweepDepositWallet({
    depositAddress: fromAddress,
    destinationAddress: toAddress,
    token: 'USDC',
    chain: 'base-mainnet',
    amount: amount,
  });

  console.log(`Result:`, JSON.stringify(result, null, 2));

  if (result.status === 'completed') {
    console.log(`Sweep successful! TX: ${result.txHash}`);
    console.log(`BaseScan: https://basescan.org/tx/${result.txHash}`);
  } else {
    console.log(`Sweep failed: ${result.error}`);
  }
}

sweepToBuyer().catch(console.error);
