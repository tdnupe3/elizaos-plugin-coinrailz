/**
 * Yield Vault Keeper — automatic rebalance + fee accrual for CoinRailzYieldVault v2.
 *
 * Runs every 6 hours:
 *  1. Calls accrueFees() — mints performance-fee shares to feeRecipient for all outstanding yield.
 *  2. Checks if a better protocol is available. If so, calls rebalance().
 *
 * This turns the vault's permissionless rebalance() and accrueFees() into genuine automation,
 * fulfilling the "auto-routing" contract guarantee without relying on external Chainlink/Gelato.
 */

import { createPublicClient, createWalletClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = process.env.ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : 'https://base-rpc.publicnode.com';

const KEEPER_ABI = parseAbi([
  'function accrueFees() external',
  'function rebalance() external',
  'function getBestProtocol() external view returns (uint8 best, uint256 bestAPY)',
  'function getProtocolAPYBps(uint8 protocol) external view returns (uint256)',
  'function activeProtocol() external view returns (uint8)',
  'function nextRebalanceIn() external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  'function pendingFeeAccrual() external view returns (uint256 gainAssets, uint256 feeAssets)',
  'function activeProtocolName() external view returns (string)',
]);

const PROTOCOL_NAMES = ['Aave v3', 'Compound v3', 'Morpho Blue'];

let keeperInterval: ReturnType<typeof setInterval> | null = null;

async function runKeeperCycle(vaultAddress: string): Promise<void> {
  const rawKey = process.env.EVM_PRIVATE_KEY;
  if (!rawKey) {
    console.log('[YieldKeeper] EVM_PRIVATE_KEY not set — keeper skipped');
    return;
  }

  const key     = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(key);

  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

  const vault = { address: vaultAddress as `0x${string}`, abi: KEEPER_ABI };

  try {
    // ── 1. Read current vault state ───────────────────────────────────────────
    const [tvlRaw, protocolName, nextRebalance, pendingAccrual] = await Promise.all([
      publicClient.readContract({ ...vault, functionName: 'totalAssets' }),
      publicClient.readContract({ ...vault, functionName: 'activeProtocolName' }),
      publicClient.readContract({ ...vault, functionName: 'nextRebalanceIn' }),
      publicClient.readContract({ ...vault, functionName: 'pendingFeeAccrual' }),
    ]);

    const tvlUsdc = Number(tvlRaw) / 1e6;
    const [gainAssets, feeAssets] = pendingAccrual as [bigint, bigint];

    console.log(`[YieldKeeper] TVL: $${tvlUsdc.toFixed(4)} | Protocol: ${protocolName} | Next rebalance in: ${Number(nextRebalance)}s`);
    console.log(`[YieldKeeper] Pending accrual: $${(Number(gainAssets)/1e6).toFixed(6)} yield → $${(Number(feeAssets)/1e6).toFixed(6)} fee`);

    // ── 2. Accrue outstanding fees (even tiny amounts) ────────────────────────
    if (Number(feeAssets) > 0 && tvlUsdc > 0) {
      try {
        console.log('[YieldKeeper] Accruing fees...');
        const hash = await walletClient.writeContract({ ...vault, functionName: 'accrueFees' });
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        console.log(`[YieldKeeper] accrueFees() confirmed: ${receipt.transactionHash} (gas: ${receipt.gasUsed})`);
      } catch (err: any) {
        // Non-fatal: accrual might fail if vault is empty or reentrant
        console.warn('[YieldKeeper] accrueFees() failed:', err.message);
      }
    } else {
      console.log('[YieldKeeper] No fees to accrue yet');
    }

    // ── 3. Check if rebalance is warranted ────────────────────────────────────
    if (Number(nextRebalance) > 0) {
      console.log(`[YieldKeeper] Rebalance cooldown active (${Number(nextRebalance)}s remaining) — skipping`);
      return;
    }

    const [bestProtocolRaw, bestAPYRaw, activeProtocolRaw] = await Promise.all([
      publicClient.readContract({ ...vault, functionName: 'getBestProtocol' }),
      publicClient.readContract({ ...vault, functionName: 'getBestProtocol' }),
      publicClient.readContract({ ...vault, functionName: 'activeProtocol' }),
    ]);

    const [best, bestAPY] = bestProtocolRaw as [number, bigint];
    const activeProtocol = Number(activeProtocolRaw);
    const currentAPY = await publicClient.readContract({
      ...vault,
      functionName: 'getProtocolAPYBps',
      args: [activeProtocol],
    }) as bigint;

    const bestAPYBps   = Number(bestAPY);
    const currentAPYBps = Number(currentAPY);
    const improvement  = bestAPYBps - currentAPYBps;

    console.log(`[YieldKeeper] Current: ${PROTOCOL_NAMES[activeProtocol]} @ ${(currentAPYBps/100).toFixed(2)}%`);
    console.log(`[YieldKeeper] Best:    ${PROTOCOL_NAMES[best]} @ ${(bestAPYBps/100).toFixed(2)}% (improvement: ${(improvement/100).toFixed(2)}%)`);

    if (best === activeProtocol || improvement < 50) {
      console.log('[YieldKeeper] No significant APY improvement — staying on current protocol');
      return;
    }

    // ── 4. Execute rebalance ──────────────────────────────────────────────────
    console.log(`[YieldKeeper] Rebalancing ${PROTOCOL_NAMES[activeProtocol]} → ${PROTOCOL_NAMES[best]} (+${(improvement/100).toFixed(2)}% APY)...`);
    try {
      const hash = await walletClient.writeContract({ ...vault, functionName: 'rebalance' });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      console.log(`[YieldKeeper] rebalance() confirmed: ${receipt.transactionHash} (gas: ${receipt.gasUsed})`);
    } catch (err: any) {
      console.error('[YieldKeeper] rebalance() failed:', err.message);
    }
  } catch (err: any) {
    console.error('[YieldKeeper] Keeper cycle error:', err.message);
  }
}

/**
 * Start the keeper. Called from appMain after the vault address is known.
 * Runs immediately on start, then every 6 hours.
 */
export function startYieldVaultKeeper(): void {
  const vaultAddress = process.env.YIELD_VAULT_ADDRESS;
  if (!vaultAddress) {
    console.log('[YieldKeeper] YIELD_VAULT_ADDRESS not set — keeper not started');
    return;
  }

  const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  console.log(`[YieldKeeper] Starting keeper for vault ${vaultAddress} (interval: 6h)`);

  // Run immediately, then on schedule
  runKeeperCycle(vaultAddress).catch(err =>
    console.error('[YieldKeeper] Initial cycle error:', err.message)
  );

  if (keeperInterval) clearInterval(keeperInterval);
  keeperInterval = setInterval(() => {
    runKeeperCycle(vaultAddress).catch(err =>
      console.error('[YieldKeeper] Scheduled cycle error:', err.message)
    );
  }, INTERVAL_MS);

  console.log('[YieldKeeper] Keeper registered (6h interval)');
}

export function stopYieldVaultKeeper(): void {
  if (keeperInterval) {
    clearInterval(keeperInterval);
    keeperInterval = null;
    console.log('[YieldKeeper] Keeper stopped');
  }
}
