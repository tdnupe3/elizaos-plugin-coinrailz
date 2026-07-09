/**
 * Test Robinhood Chain gasless by submitting a signed tx via eth_sendRawTransaction
 * (bypasses viem's preflight balance check that would block a 0-ETH wallet)
 */
import { createPublicClient, http, formatUnits, parseGwei, serializeTransaction, keccak256 } from 'viem';
import { privateKeyToAccount, signTransaction } from 'viem/accounts';

const RH_RPC = 'https://rpc.mainnet.chain.robinhood.com';
const USDG   = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const;
const RH_CHAIN_ID = 4663;
const ERC20_ABI = [
  { name:'balanceOf', type:'function', stateMutability:'view', inputs:[{name:'',type:'address'}], outputs:[{name:'',type:'uint256'}] },
  { name:'transfer', type:'function', stateMutability:'nonpayable', inputs:[{name:'to',type:'address'},{name:'amount',type:'uint256'}], outputs:[{name:'',type:'bool'}] },
] as const;

const RH_CHAIN = {
  id: RH_CHAIN_ID, name:'Robinhood Chain',
  nativeCurrency:{ name:'Ether', symbol:'ETH', decimals:18 },
  rpcUrls:{ default:{ http:[RH_RPC] } },
} as const;

async function rpc(method: string, params: any[] = []) {
  const res = await fetch(RH_RPC, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params })
  });
  return (await res.json() as any);
}

async function main() {
  const rawKey = process.env.EVM_PRIVATE_KEY!;
  const k = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(k);

  const pub = createPublicClient({ chain: RH_CHAIN, transport: http() });

  const [ethBal, usdgBal, gasPriceHex, nonceHex] = await Promise.all([
    pub.getBalance({ address: account.address }),
    pub.readContract({ address: USDG, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
    rpc('eth_gasPrice').then((d: any) => d.result as string),
    rpc('eth_getTransactionCount', [account.address, 'latest']).then((d: any) => d.result as string),
  ]);

  const gasPrice = BigInt(gasPriceHex);
  const nonce    = parseInt(nonceHex, 16);

  console.log(`\n🟡 Robinhood Chain raw tx test`);
  console.log(`   Address: ${account.address}`);
  console.log(`   ETH: ${ethBal} wei (${ethBal === 0n ? '0 — testing gasless' : 'has ETH'})`);
  console.log(`   USDG: ${formatUnits(usdgBal, 6)}`);
  console.log(`   gasPrice: ${Number(gasPrice)/1e9} gwei | nonce: ${nonce}`);

  // Build a simple self-transfer (zero-value) with the exact baseFee
  // Use EIP-1559 type 2 transaction
  const txRequest = {
    chainId:              RH_CHAIN_ID,
    nonce,
    maxFeePerGas:         gasPrice + parseGwei('0.001'), // baseFee + tiny priority
    maxPriorityFeePerGas: 0n,
    gas:                  21384n,
    to:                   account.address,
    value:                0n,
    data:                 '0x' as `0x${string}`,
    type:                 'eip1559' as const,
  };

  console.log(`\n   Signing raw transaction…`);
  const signedTx = await account.signTransaction(txRequest);
  console.log(`   Signed. Submitting via eth_sendRawTransaction (no preflight)…`);

  const sendResult = await rpc('eth_sendRawTransaction', [signedTx]);
  if (sendResult.error) {
    console.log(`   ❌ RPC rejected: ${JSON.stringify(sendResult.error)}`);
    console.log('\n   Chain is NOT gasless via raw tx (requires ETH balance)');
    return;
  }

  const txHash = sendResult.result as string;
  console.log(`\n   ✅ TX ACCEPTED by RPC: ${txHash}`);
  console.log(`   https://robinhoodchain.blockscout.com/tx/${txHash}`);
  console.log(`   Waiting for confirmation…`);

  // Poll for receipt
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
    if (receipt.result) {
      console.log(`   ✅ MINED! Block ${parseInt(receipt.result.blockNumber, 16)}`);
      console.log(`   Status: ${receipt.result.status === '0x1' ? 'success' : 'reverted'}`);
      console.log(`   gasUsed: ${parseInt(receipt.result.gasUsed, 16)}`);
      console.log(`\n   🎉 CHAIN IS GASLESS — transactions accepted with 0 ETH balance!`);
      return;
    }
    process.stdout.write(`   waiting… (${i*2}s)\r`);
  }
  console.log('\n   TX pending but not mined in 40s — inconclusive');
}

main().catch(e => { console.error('\n❌', e.message ?? e); process.exit(1); });
