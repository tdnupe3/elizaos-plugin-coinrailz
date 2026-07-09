/**
 * Test if Robinhood Chain accepts gasless (maxFeePerGas=0) transactions.
 * Sends a zero-value self-transfer. If mined with 0 ETH balance, chain is gasless.
 */
import { createPublicClient, createWalletClient, http, formatEther, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RH_CHAIN = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
} as const;

const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const;
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

async function main() {
  const rawKey = process.env.EVM_PRIVATE_KEY!;
  const k = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(k);

  const pub = createPublicClient({ chain: RH_CHAIN, transport: http() });
  const wal = createWalletClient({ account, chain: RH_CHAIN, transport: http() });

  const [ethBal, usdgBal, nonce, gasPrice] = await Promise.all([
    pub.getBalance({ address: account.address }),
    pub.readContract({ address: USDG, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
    pub.getTransactionCount({ address: account.address }),
    pub.getGasPrice(),
  ]);

  console.log(`\n🟡 Robinhood Chain gasless test`);
  console.log(`   Wallet: ${account.address}`);
  console.log(`   ETH: ${formatEther(ethBal)}`);
  console.log(`   USDG: ${formatUnits(usdgBal, 6)}`);
  console.log(`   Current nonce: ${nonce}`);
  console.log(`   Current gasPrice: ${Number(gasPrice)/1e9} gwei`);

  // Attempt 1: maxFeePerGas=0 (fully gasless)
  console.log('\n   Testing maxFeePerGas=0 self-transfer…');
  try {
    const hash = await wal.sendTransaction({
      to: account.address,
      value: 0n,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
      gas: 21384n,
    });
    console.log(`   ✅ Tx accepted with maxFeePerGas=0: ${hash}`);
    console.log(`   Waiting for receipt…`);
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
    console.log(`   ✅ Mined in block ${receipt.blockNumber} — CHAIN IS GASLESS!`);
    console.log(`   https://robinhoodchain.blockscout.com/tx/${hash}`);
  } catch (e: any) {
    console.log(`   ❌ maxFeePerGas=0 rejected: ${e.shortMessage ?? e.message?.split('\n')[0]}`);

    // Attempt 2: try with 1 wei gasPrice
    console.log('\n   Testing gasPrice=1 wei…');
    try {
      const hash2 = await wal.sendTransaction({
        to: account.address,
        value: 0n,
        gasPrice: 1n,
        gas: 21384n,
      });
      console.log(`   TX with gasPrice=1 accepted: ${hash2}`);
    } catch (e2: any) {
      console.log(`   ❌ gasPrice=1 also rejected: ${e2.shortMessage ?? e2.message?.split('\n')[0]}`);
    }
  }
}

main().catch(e => { console.error('\n❌', e.shortMessage ?? e.message); process.exit(1); });
