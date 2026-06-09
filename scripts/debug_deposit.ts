import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const RPC  = 'https://base-rpc.publicnode.com';
const key  = (process.env.EVM_PRIVATE_KEY!.startsWith('0x') ? process.env.EVM_PRIVATE_KEY! : '0x'+process.env.EVM_PRIVATE_KEY!) as `0x${string}`;
const acct = privateKeyToAccount(key);
const pub  = createPublicClient({ chain: base, transport: http(RPC) });
const wal  = createWalletClient({ account: acct, chain: base, transport: http(RPC) });

const USDC  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const VAULT = '0xf8f67d6422fc60114a11ada3dca297ab6a255a29' as const;
const AMT   = 5_000_000n; // 5 USDC

const ERC20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);
const VABI = parseAbi(['function deposit(uint256,address) returns (uint256)']);

async function main() {
  console.log('Wallet:', acct.address);
  
  const bal = await pub.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [acct.address] }) as bigint;
  const alw = await pub.readContract({ address: USDC, abi: ERC20, functionName: 'allowance', args: [acct.address, VAULT] }) as bigint;
  console.log('USDC balance:', formatUnits(bal, 6));
  console.log('Current allowance:', formatUnits(alw, 6));
  
  if (alw < AMT) {
    console.log('\nApproving vault for', formatUnits(AMT, 6), 'USDC...');
    const h = await wal.writeContract({ address: USDC, abi: ERC20, functionName: 'approve', args: [VAULT, AMT] });
    console.log('Approve tx:', h);
    const rx = await pub.waitForTransactionReceipt({ hash: h, timeout: 60_000 });
    console.log('Approve status:', rx.status, '  gasUsed:', rx.gasUsed);
    
    // Verify allowance after approve
    const newAlw = await pub.readContract({ address: USDC, abi: ERC20, functionName: 'allowance', args: [acct.address, VAULT] }) as bigint;
    console.log('New allowance:', formatUnits(newAlw, 6));
  } else {
    console.log('Allowance already sufficient');
  }
  
  console.log('\nDepositing', formatUnits(AMT, 6), 'USDC...');
  try {
    const h2 = await wal.writeContract({ address: VAULT, abi: VABI, functionName: 'deposit', args: [AMT, acct.address] });
    console.log('Deposit tx:', h2);
    const rx2 = await pub.waitForTransactionReceipt({ hash: h2, timeout: 120_000 });
    console.log('Deposit status:', rx2.status, '  gasUsed:', rx2.gasUsed);
  } catch(e: any) {
    console.log('Deposit failed:', e.shortMessage || e.message?.slice(0,300));
  }
}
main().catch(console.error);
