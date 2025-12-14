import { CdpClient } from '@coinbase/cdp-sdk';

async function findAllCdpWallets() {
  console.log("Searching all CDP wallets for 0xa4...\n");
  
  process.env.CDP_API_KEY_SECRET = process.env.CDP_PRIVATE_KEY;
  const cdp = new CdpClient();
  
  let pageToken = undefined as string | undefined;
  const allAddresses: string[] = [];
  const TARGET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91".toLowerCase();
  
  // Paginate through all wallets
  do {
    const result = await cdp.evm.listAccounts({ pageToken });
    const accounts = result.accounts || [];
    
    for (const account of accounts) {
      allAddresses.push(account.address);
      if (account.address?.toLowerCase() === TARGET) {
        console.log("✅ FOUND 0xa4 WALLET IN CDP!");
        return account;
      }
    }
    
    pageToken = result.nextPageToken;
  } while (pageToken);
  
  console.log(`Total CDP wallets found: ${allAddresses.length}`);
  console.log("\nAddresses:");
  allAddresses.forEach(a => console.log("  " + a));
  
  // Check if 0xa4 is among them
  const found = allAddresses.find(a => a.toLowerCase() === TARGET);
  if (found) {
    console.log("\n✅ Platform wallet 0xa4 is CDP-managed!");
  } else {
    console.log("\n❌ Platform wallet 0xa4 is NOT a CDP-managed wallet");
    console.log("\nThe 0xa4 wallet is NOT managed by CDP. It was likely created outside of the CDP SDK.");
    console.log("To use it for testing, you need to either:");
    console.log("1. Add its private key as EVM_PRIVATE_KEY secret");
    console.log("2. Or use a CDP wallet that HAS funds to send to 0xa4");
  }
  
  return null;
}

findAllCdpWallets().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
