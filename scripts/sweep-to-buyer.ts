async function sweepToBuyer() {
  const { CoinbaseCDPService } = await import('../server/services/coinbaseCDPService');
  const cdp = CoinbaseCDPService.getInstance();
  
  const fromAddress = "0x6341B240547d520a425ea58EF91b33692b12f356";
  const toAddress = "0x5837A864C03912ea14a5609968F73E75B9d42a7C";
  const amount = "39.00";
  
  console.log(`Sweeping $${amount} USDC from CDP wallet ${fromAddress} to buyer ${toAddress}...`);
  
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
