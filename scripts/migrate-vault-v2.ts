/**
 * Vault v2 Migration Script
 * 1. Redeem all shares from v1 vault
 * 2. Deploy v2 vault via server API
 * 3. Deposit recovered USDC into v2
 *
 * Run: npx tsx scripts/migrate-vault-v2.ts
 */

import { createPublicClient, createWalletClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const RPC_URL = 'https://base-rpc.publicnode.com';
const V1_VAULT = '0xf8f67d6422fc60114a11ada3dca297ab6a255a29' as const;
const USDC     = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const ADMIN_KEY = process.env.ADMIN_KEY;

const V1_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const rawKey = process.env.EVM_PRIVATE_KEY;
  if (!rawKey) throw new Error('EVM_PRIVATE_KEY not set');
  if (!ADMIN_KEY) throw new Error('ADMIN_KEY not set');

  const key     = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(key);
  console.log('Server wallet:', account.address);

  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

  // ── Step 1: Read v1 state ──────────────────────────────────────────────────
  console.log('\n=== Step 1: Reading v1 vault state ===');
  const [v1Shares, v1TVL, usdcBefore] = await Promise.all([
    publicClient.readContract({ address: V1_VAULT, abi: V1_ABI, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: V1_VAULT, abi: V1_ABI, functionName: 'totalAssets' }),
    publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
  ]);

  console.log('v1 shares held:', formatUnits(v1Shares, 6), 'crUSDC');
  console.log('v1 TVL:', formatUnits(v1TVL, 6), 'USDC');
  console.log('Wallet USDC before:', formatUnits(usdcBefore, 6), 'USDC');

  // ── Step 2: Redeem all shares from v1 ─────────────────────────────────────
  if (v1Shares > 0n) {
    console.log('\n=== Step 2: Redeeming all v1 shares ===');
    const redeemHash = await walletClient.writeContract({
      address: V1_VAULT,
      abi: V1_ABI,
      functionName: 'redeem',
      args: [v1Shares, account.address, account.address],
    });
    console.log('redeem() tx:', redeemHash);
    const redeemReceipt = await publicClient.waitForTransactionReceipt({ hash: redeemHash, timeout: 60_000 });
    console.log('✅ Redeemed — gas:', redeemReceipt.gasUsed.toString());
    await sleep(2000);
  } else {
    console.log('No v1 shares to redeem');
  }

  // ── Step 3: Check recovered USDC ──────────────────────────────────────────
  const usdcAfterRedeem = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  });
  console.log('\n=== Step 3: USDC after v1 redemption ===');
  console.log('Wallet USDC:', formatUnits(usdcAfterRedeem, 6), 'USDC (was:', formatUnits(usdcBefore, 6), ')');

  // ── Step 4: Deploy v2 vault ────────────────────────────────────────────────
  console.log('\n=== Step 4: Deploying v2 vault ===');

  const artifactPath = join(process.cwd(), 'contracts', 'CoinRailzYieldVault.json');
  if (!existsSync(artifactPath)) throw new Error('Compiled artifact not found. Run: node scripts/compile-vault.cjs');
  const { bytecode, abi } = JSON.parse(readFileSync(artifactPath, 'utf8'));

  const AAVE_POOL      = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' as const;
  const AAVE_AUSDC     = '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB' as const;
  const COMPOUND_COMET = '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf' as const;
  const ZERO           = '0x0000000000000000000000000000000000000000' as const;

  const deployHash = await walletClient.deployContract({
    abi,
    bytecode: bytecode as `0x${string}`,
    args: [
      USDC,             // asset
      account.address,  // feeRecipient (server wallet)
      AAVE_POOL,        // aavePool
      AAVE_AUSDC,       // aUsdc
      COMPOUND_COMET,   // compoundComet
      ZERO,             // morpho — configure post-deploy via configureMorphoMarket()
      [ZERO, ZERO, ZERO, ZERO, 0n] as [string, string, string, string, bigint], // morphoMarket
      ZERO,             // morphoIrm — configure post-deploy
      0,                // Protocol.AAVE
    ],
  });
  console.log('Deploy tx:', deployHash);
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash, timeout: 120_000 });

  if (!deployReceipt.contractAddress) {
    throw new Error('No contract address in receipt — constructor may have reverted');
  }

  const v2Address = deployReceipt.contractAddress;
  console.log('✅ v2 deployed at:', v2Address);
  console.log('   Block:', deployReceipt.blockNumber.toString());
  console.log('   Gas used:', deployReceipt.gasUsed.toString());
  await sleep(2000);

  // ── Step 5: Deposit recovered USDC into v2 ────────────────────────────────
  const depositAmount = usdcAfterRedeem > 5_000_000n ? usdcAfterRedeem - 2_000_000n : usdcAfterRedeem; // keep $2 for gas
  if (depositAmount >= 1_000_000n) {
    console.log('\n=== Step 5: Seeding v2 vault ===');
    console.log('Depositing:', formatUnits(depositAmount, 6), 'USDC');

    // Approve
    const approveHash = await walletClient.writeContract({
      address: USDC,
      abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
      functionName: 'approve',
      args: [v2Address, 2n ** 256n - 1n], // MaxUint256
    });
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60_000 });
    console.log('Approve tx:', approveHash, '(gas:', approveReceipt.gasUsed.toString() + ')');
    await sleep(2000); // beat load-balancer state lag

    // Deposit
    const depositHash = await walletClient.writeContract({
      address: v2Address as `0x${string}`,
      abi,
      functionName: 'deposit',
      args: [depositAmount, account.address],
    });
    console.log('deposit() tx:', depositHash);
    const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash, timeout: 60_000 });
    console.log('✅ Deposit confirmed — gas:', depositReceipt.gasUsed.toString());
    await sleep(2000);

    // Read final state
    const V2_ABI = parseAbi([
      'function totalAssets() view returns (uint256)',
      'function totalSupply() view returns (uint256)',
      'function pricePerShare() view returns (uint256)',
      'function activeProtocolName() view returns (string)',
      'function getAllAPYs() view returns (uint256 aaveAPYBps, uint256 compoundAPYBps, uint256 morphoAPYBps)',
    ]);

    const [tvl, supply, price, protocol, apys] = await Promise.all([
      publicClient.readContract({ address: v2Address as `0x${string}`, abi: V2_ABI, functionName: 'totalAssets' }),
      publicClient.readContract({ address: v2Address as `0x${string}`, abi: V2_ABI, functionName: 'totalSupply' }),
      publicClient.readContract({ address: v2Address as `0x${string}`, abi: V2_ABI, functionName: 'pricePerShare' }),
      publicClient.readContract({ address: v2Address as `0x${string}`, abi: V2_ABI, functionName: 'activeProtocolName' }),
      publicClient.readContract({ address: v2Address as `0x${string}`, abi: V2_ABI, functionName: 'getAllAPYs' }),
    ]);

    const [aaveAPYBps, compoundAPYBps, morphoAPYBps] = apys as [bigint, bigint, bigint];

    console.log('\n=== v2 Vault Live State ===');
    console.log('Address:  ', v2Address);
    console.log('TVL:       $' + formatUnits(tvl as bigint, 6));
    console.log('Shares:   ', formatUnits(supply as bigint, 6), 'crUSDC');
    console.log('Price/sh:  $' + formatUnits(price as bigint, 6));
    console.log('Protocol: ', protocol);
    console.log('Aave APY:  ' + (Number(aaveAPYBps) / 100).toFixed(2) + '%');
    console.log('Compound:  ' + (Number(compoundAPYBps) / 100).toFixed(2) + '%');
    console.log('Morpho:    ' + (Number(morphoAPYBps) / 100).toFixed(2) + '% (not yet configured)');
  } else {
    console.log('Deposit amount too small — skipping seed deposit');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== MIGRATION COMPLETE ===');
  console.log('OLD vault (v1):', V1_VAULT, '← still deployed, no more deposits');
  console.log('NEW vault (v2):', v2Address);
  console.log('');
  console.log('IMPORTANT: Update your .env / Replit secrets:');
  console.log('  YIELD_VAULT_ADDRESS=' + v2Address);
  console.log('');
  console.log('To enable Morpho after verifying market params, call:');
  console.log('  configureMorphoMarket(morphoBlue, marketParams, irmAddress)');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
