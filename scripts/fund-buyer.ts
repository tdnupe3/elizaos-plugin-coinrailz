// Direct USDC transfer from platform wallet to buyer wallet via EVM_PRIVATE_KEY
import { ethers } from "ethers";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BUYER_ADDRESS = "0x5837A864C03912ea14a5609968F73E75B9d42a7C";
const AMOUNT_USDC = 30; // $30 to cover $25.05 in tests + buffer

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)"
];

async function main() {
  const pk = process.env.EVM_PRIVATE_KEY;
  if (!pk) { console.error("EVM_PRIVATE_KEY required"); process.exit(1); }
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  
  const provider = new ethers.JsonRpcProvider(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`);
  const wallet = new ethers.Wallet(pk, provider);
  
  console.log(`Platform wallet: ${wallet.address}`);
  console.log(`Buyer wallet:    ${BUYER_ADDRESS}`);
  
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
  const balance = await usdc.balanceOf(wallet.address);
  console.log(`Platform USDC balance: ${Number(balance) / 1e6}`);
  
  if (Number(balance) / 1e6 < AMOUNT_USDC) {
    console.error(`Insufficient balance! Need $${AMOUNT_USDC}, have $${Number(balance) / 1e6}`);
    process.exit(1);
  }
  
  const amountUnits = ethers.parseUnits(AMOUNT_USDC.toString(), 6);
  console.log(`\nTransferring $${AMOUNT_USDC} USDC to buyer...`);
  
  const tx = await usdc.transfer(BUYER_ADDRESS, amountUnits);
  console.log(`TX hash: ${tx.hash}`);
  console.log("Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
  
  const newBuyerBal = await usdc.balanceOf(BUYER_ADDRESS);
  console.log(`\nBuyer new balance: ${Number(newBuyerBal) / 1e6} USDC`);
}

main().catch(e => { console.error("Failed:", e.message); process.exit(1); });
