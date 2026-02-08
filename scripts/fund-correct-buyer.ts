async function fundCorrectBuyer() {
  const { CoinbaseCDPService } = await import('../server/services/coinbaseCDPService');
  const cdp = CoinbaseCDPService.getInstance();
  const correctBuyer = "0x5837A864C03912ea14a5609968F73E75B9d42a7C";
  const amount = "14.00";
  
  console.log(`Funding correct buyer wallet ${correctBuyer} with $${amount} USDC from platform wallet...`);
  console.log(`(Platform has ~$16.68, sending $14 leaves ~$2.68 for gas)`);
  
  const result = await cdp.sendUSDC({
    toAddress: correctBuyer,
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

fundCorrectBuyer().catch(console.error);
