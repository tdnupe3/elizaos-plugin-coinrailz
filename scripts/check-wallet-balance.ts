import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';

async function main() {
  const pk = process.env.EVM_PRIVATE_KEY;
  if (!pk) {
    console.log('EVM_PRIVATE_KEY not set');
    process.exit(0);
  }

  const key = (pk.startsWith('0x') ? pk : '0x' + pk) as `0x${string}`;
  const account = privateKeyToAccount(key);
  console.log('WALLET ADDRESS:', account.address);

  const client = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org')
  });

  const ethBal = await client.getBalance({ address: account.address });
  console.log('ETH balance:', formatEther(ethBal), 'ETH');

  const usdc = await client.readContract({
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    abi: [{
      name: 'balanceOf',
      type: 'function',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view'
    }],
    functionName: 'balanceOf',
    args: [account.address]
  }) as bigint;

  const usdcAmount = Number(usdc) / 1_000_000;
  console.log('USDC balance:', usdcAmount.toFixed(6), 'USDC');
  console.log('');
  console.log('Can pay for ai-inference ($0.05):', usdcAmount >= 0.05 ? 'YES' : 'NO - insufficient funds');
  console.log('Can pay for ping ($0.25):', usdcAmount >= 0.25 ? 'YES' : 'NO - insufficient funds');
  console.log('Can pay for gas-price-oracle ($0.05):', usdcAmount >= 0.05 ? 'YES' : 'NO - insufficient funds');
}

main().catch(console.error);
