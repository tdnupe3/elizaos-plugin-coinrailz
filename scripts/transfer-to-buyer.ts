import { CoinbaseCDPService } from "../server/services/coinbaseCDPService";

async function main() {
  const cdp = new CoinbaseCDPService();
  const buyerAddress = "0x5837A864C03912ea14a5609968F73E75B9d42a7C";
  const amount = "30.00";
  
  console.log(`Transferring $${amount} USDC from platform wallet to buyer wallet...`);
  console.log(`Buyer: ${buyerAddress}`);
  
  const result = await cdp.sendUSDC({
    toAddress: buyerAddress,
    amount: amount,
    chain: "base-mainnet",
    memo: "Fund buyer wallet for comprehensive x402 service testing"
  });
  
  console.log(`\nResult:`, JSON.stringify(result, null, 2));
  
  if (result.status === 'completed') {
    console.log(`\nTransfer complete! TX: ${result.txHash}`);
    const newBalance = await cdp.getUSDCBalance(buyerAddress, "base-mainnet");
    console.log(`Buyer balance: $${newBalance} USDC`);
  } else {
    console.log(`\nTransfer failed: ${result.error}`);
  }
}

main().catch(console.error);
