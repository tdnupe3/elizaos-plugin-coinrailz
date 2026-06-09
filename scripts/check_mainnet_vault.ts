import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';

const VAULT = '0xf8f67d6422fc60114a11ada3dca297ab6a255a29' as const;
// Use a reliable public RPC (not mainnet.base.org which rate-limits parallel calls)
const client = createPublicClient({
  chain: base,
  transport: http('https://base-rpc.publicnode.com'),
});

const VABI = parseAbi([
  'function activeProtocol() view returns (uint8)',
  'function activeProtocolName() view returns (string)',
  'function getAllAPYs() view returns (uint256,uint256,uint256)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function depositFeeBps() view returns (uint256)',
  'function performanceFeeBps() view returns (uint256)',
  'function owner() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function asset() view returns (address)',
  'function pricePerShare() view returns (uint256)',
  'function getBestProtocol() view returns (uint8,uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]);

async function read(fn: string, args?: any[]) {
  try {
    return await client.readContract({ address: VAULT, abi: VABI, functionName: fn as any, args });
  } catch(e: any) { return `ERR: ${e.shortMessage || e.message?.slice(0,80)}`; }
}

async function main() {
  // Sequential to avoid rate-limiting
  const protoName = await read('activeProtocolName');
  const apys      = await read('getAllAPYs');
  const assets    = await read('totalAssets');
  const supply    = await read('totalSupply');
  const pps       = await read('pricePerShare');
  const depFee    = await read('depositFeeBps');
  const perfFee   = await read('performanceFeeBps');
  const owner     = await read('owner');
  const feeRec    = await read('feeRecipient');
  const asset     = await read('asset');
  const name      = await read('name');
  const symbol    = await read('symbol');
  const best      = await read('getBestProtocol');

  console.log('=== MAINNET VAULT STATE ===');
  console.log('Address:       ', VAULT);
  console.log('Name/Symbol:   ', name, '/', symbol);
  console.log('Active:        ', protoName);
  const a = apys as [bigint,bigint,bigint];
  console.log('APYs:          ', `Aave=${Number(a[0])/100}%  Compound=${Number(a[1])/100}%  Morpho=${Number(a[2])/100}%`);
  const b = best as [number,bigint];
  console.log('Best Protocol: ', `enum=${b[0]}  APY=${Number(b[1])/100}%`);
  console.log('TVL USDC:      ', formatUnits(assets as bigint, 6));
  console.log('Total Shares:  ', (supply as bigint).toString());
  console.log('Price/Share:   ', formatUnits(pps as bigint, 6), 'USDC');
  console.log('Deposit Fee:   ', Number(depFee as bigint)/100, '%');
  console.log('Perf Fee:      ', Number(perfFee as bigint)/100, '%');
  console.log('Asset (USDC):  ', asset);
  console.log('Owner:         ', owner);
  console.log('Fee Recipient: ', feeRec);
}

main().catch(console.error);
