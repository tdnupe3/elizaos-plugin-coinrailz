import { CdpClient } from '@coinbase/cdp-sdk';
import { ethers } from 'ethers';

const USDT_BASE = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function checkCdpBalances() {
  console.log("Checking CDP wallets for USDT/USDC balances...\n");
  
  process.env.CDP_API_KEY_SECRET = process.env.CDP_PRIVATE_KEY;
  const cdp = new CdpClient();
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const usdtContract = new ethers.Contract(USDT_BASE, ERC20_ABI, provider);
  const usdcContract = new ethers.Contract(USDC_BASE, ERC20_ABI, provider);
  
  let pageToken = undefined as string | undefined;
  const walletsWithFunds: { address: string; usdt: string; usdc: string; eth: string }[] = [];
  let checked = 0;
  
  do {
    const result = await cdp.evm.listAccounts({ pageToken });
    const accounts = result.accounts || [];
    
    for (const account of accounts) {
      checked++;
      if (checked % 20 === 0) console.log(`Checked ${checked} wallets...`);
      
      try {
        const [usdtBal, usdcBal, ethBal] = await Promise.all([
          usdtContract.balanceOf(account.address),
          usdcContract.balanceOf(account.address),
          provider.getBalance(account.address)
        ]);
        
        const usdtFormatted = ethers.formatUnits(usdtBal, 6);
        const usdcFormatted = ethers.formatUnits(usdcBal, 6);
        const ethFormatted = ethers.formatEther(ethBal);
        
        if (parseFloat(usdtFormatted) > 0 || parseFloat(usdcFormatted) > 0 || parseFloat(ethFormatted) > 0.0001) {
          walletsWithFunds.push({
            address: account.address,
            usdt: usdtFormatted,
            usdc: usdcFormatted,
            eth: ethFormatted
          });
          console.log(`\n💰 FOUND WALLET WITH FUNDS:`);
          console.log(`   Address: ${account.address}`);
          console.log(`   USDT: ${usdtFormatted}`);
          console.log(`   USDC: ${usdcFormatted}`);
          console.log(`   ETH: ${ethFormatted}`);
        }
      } catch (e) {
        // Skip errors
      }
      
      // Stop after checking 50 wallets to save time
      if (checked >= 50) break;
    }
    
    if (checked >= 50) break;
    pageToken = result.nextPageToken;
  } while (pageToken);
  
  console.log(`\n\nTotal checked: ${checked}`);
  console.log(`Wallets with funds: ${walletsWithFunds.length}`);
  
  if (walletsWithFunds.length > 0) {
    console.log("\n=== WALLETS WITH FUNDS ===");
    walletsWithFunds.forEach(w => {
      console.log(`${w.address}: USDT=${w.usdt}, USDC=${w.usdc}, ETH=${w.eth}`);
    });
  }
  
  return walletsWithFunds;
}

checkCdpBalances().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
