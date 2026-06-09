/**
 * AI Agent Yield Portal — API Routes
 * GET /api/yield/rates        — live APY from all protocols on Base
 * GET /api/yield/stats        — TVL, fees, contract info
 * GET /api/yield/position/:wallet — agent's current position (post-deployment)
 * GET /api/yield/contract     — ABI + address for direct agent integration
 * GET /yield-portal.json      — machine-readable manifest for AI agents
 */

import { Router, Request, Response } from 'express';
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, encodeAbiParameters, parseAbiParameters, getAddress, getContractAddress } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const router = Router();

// ── Base Mainnet Contract Addresses ──────────────────────────────────────────

const BASE_USDC      = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const AAVE_POOL      = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' as const;
const AAVE_AUSDC     = '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB' as const;
const COMPOUND_COMET = '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf' as const; // Compound v3 cUSDCv3 on Base
const MORPHO_BLUE    = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const; // Morpho Blue singleton on Base

// CoinRailz vault — populated after testnet deployment, mainnet after launch
const VAULT_ADDRESS = process.env.YIELD_VAULT_ADDRESS || null;

// ── Viem Client ───────────────────────────────────────────────────────────────

const RPC_URL = process.env.ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : 'https://base-rpc.publicnode.com'; // publicnode handles concurrent calls without rate-limiting

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

// ── ABIs (minimal) ────────────────────────────────────────────────────────────

const AAVE_POOL_ABI = parseAbi([
  'function getReserveData(address asset) external view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)',
]);

const COMET_ABI = parseAbi([
  'function getUtilization() external view returns (uint256)',
  'function getSupplyRate(uint256 utilization) external view returns (uint64)',
  'function totalSupply() external view returns (uint256)',
]);

const AUSDC_ABI = parseAbi([
  'function totalSupply() external view returns (uint256)',
]);

const VAULT_ABI = parseAbi([
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function pricePerShare() external view returns (uint256)',
  'function getAllAPYs() external view returns (uint256 aaveAPYBps, uint256 compoundAPYBps, uint256 morphoAPYBps)',
  'function activeProtocolName() external view returns (string)',
  'function getBestProtocol() external view returns (uint8 best, uint256 bestAPY)',
  'function nextRebalanceIn() external view returns (uint256)',
  'function pendingFeeAccrual() external view returns (uint256 gainAssets, uint256 feeAssets)',
  'function depositFeeBps() external view returns (uint256)',
  'function performanceFeeBps() external view returns (uint256)',
  'function userPosition(address user) external view returns (uint256 shares, uint256 currentValue, uint256 estimatedYield)',
]);

// ── Rate Cache (60 second TTL) ────────────────────────────────────────────────

interface RateCache {
  aaveAPY:     number;
  compoundAPY: number;
  morphoAPY:   number;
  bestAPY:     number;
  bestProtocol: string;
  cachedAt:    number;
}

let rateCache: RateCache | null = null;
const CACHE_TTL_MS = 60_000;

async function fetchLiveRates(): Promise<RateCache> {
  if (rateCache && Date.now() - rateCache.cachedAt < CACHE_TTL_MS) {
    return rateCache;
  }

  // If vault is deployed, use it as single source of truth
  if (VAULT_ADDRESS) {
    try {
      const [apys, protocolName] = await Promise.all([
        client.readContract({
          address: VAULT_ADDRESS as `0x${string}`,
          abi: VAULT_ABI,
          functionName: 'getAllAPYs',
        }),
        client.readContract({
          address: VAULT_ADDRESS as `0x${string}`,
          abi: VAULT_ABI,
          functionName: 'activeProtocolName',
        }),
      ]);

      const [aaveBps, compoundBps, morphoBps] = apys as [bigint, bigint, bigint];
      const aaveAPY    = Number(aaveBps)    / 100;
      const compoundAPY = Number(compoundBps) / 100;
      const morphoAPY  = Number(morphoBps)  / 100;
      const bestAPY    = Math.max(aaveAPY, compoundAPY, morphoAPY);
      // Derive best protocol name from APYs (not from active protocol, which may lag during cooldown)
      const bestProtocol = bestAPY === morphoAPY && morphoAPY > 0 ? 'Morpho Blue'
        : bestAPY === aaveAPY ? 'Aave v3' : 'Compound v3';

      rateCache = { aaveAPY, compoundAPY, morphoAPY, bestAPY, bestProtocol, cachedAt: Date.now() };
      return rateCache;
    } catch (_) {
      // fall through to direct protocol reads
    }
  }

  // Read directly from protocol contracts (pre-deployment fallback)
  const [aaveAPY, compoundAPY] = await Promise.all([
    fetchAaveAPY(),
    fetchCompoundAPY(),
  ]);

  const morphoAPY = 0; // Morpho rate requires market ID — added post-deployment
  const rates = [
    { name: 'Aave v3',     apy: aaveAPY },
    { name: 'Compound v3', apy: compoundAPY },
    { name: 'Morpho Blue', apy: morphoAPY },
  ];
  const best = rates.reduce((a, b) => a.apy >= b.apy ? a : b);

  rateCache = {
    aaveAPY,
    compoundAPY,
    morphoAPY,
    bestAPY:     best.apy,
    bestProtocol: best.name,
    cachedAt:    Date.now(),
  };
  return rateCache;
}

async function fetchAaveAPY(): Promise<number> {
  try {
    const data = await client.readContract({
      address: AAVE_POOL,
      abi: AAVE_POOL_ABI,
      functionName: 'getReserveData',
      args: [BASE_USDC],
    }) as readonly [bigint, bigint, bigint, ...unknown[]];

    // data[2] = currentLiquidityRate in ray (1e27) = APR as decimal
    const liquidityRateRay = data[2];
    const aprDecimal = Number(liquidityRateRay) / 1e27;
    // Convert APR to APY: APY = (1 + APR/31536000)^31536000 - 1 ≈ e^APR - 1
    const apy = (Math.exp(aprDecimal) - 1) * 100;
    return Math.round(apy * 100) / 100; // 2 decimal places
  } catch {
    return 0;
  }
}

async function fetchCompoundAPY(): Promise<number> {
  try {
    const utilization = await client.readContract({
      address: COMPOUND_COMET,
      abi: COMET_ABI,
      functionName: 'getUtilization',
    }) as bigint;

    const ratePerSecond = await client.readContract({
      address: COMPOUND_COMET,
      abi: COMET_ABI,
      functionName: 'getSupplyRate',
      args: [utilization],
    }) as bigint;

    // ratePerSecond is uint64 scaled by 1e18 (100% = 1e18/sec)
    // APR = ratePerSecond / 1e18 * secondsPerYear
    const aprDecimal = (Number(ratePerSecond) / 1e18) * 31_536_000;
    const apy = (Math.exp(aprDecimal) - 1) * 100;
    return Math.round(apy * 100) / 100;
  } catch {
    return 0;
  }
}

async function fetchVaultStats() {
  if (!VAULT_ADDRESS) return null;

  try {
    const [totalAssets, totalSupply, pricePerShare, pendingAccrual, depositFeeBps, performanceFeeBps, nextRebalanceIn] =
      await Promise.all([
        client.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: VAULT_ABI, functionName: 'totalAssets' }),
        client.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: VAULT_ABI, functionName: 'totalSupply' }),
        client.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: VAULT_ABI, functionName: 'pricePerShare' }),
        client.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: VAULT_ABI, functionName: 'pendingFeeAccrual' }),
        client.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: VAULT_ABI, functionName: 'depositFeeBps' }),
        client.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: VAULT_ABI, functionName: 'performanceFeeBps' }),
        client.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: VAULT_ABI, functionName: 'nextRebalanceIn' }),
      ]);

    const [, feeAssets] = pendingAccrual as [bigint, bigint];

    return {
      tvlUsdc:           formatUnits(totalAssets as bigint, 6),
      totalSharesUsdc:   formatUnits(totalSupply as bigint, 6),
      pricePerShare:     formatUnits(pricePerShare as bigint, 6),
      pendingFeesUsdc:   formatUnits(feeAssets, 6),
      depositFeePct:     Number(depositFeeBps as bigint) / 100,
      performanceFeePct: Number(performanceFeeBps as bigint) / 100,
      nextRebalanceInSec: Number(nextRebalanceIn as bigint),
    };
  } catch {
    return null;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/yield/rates
 * Live APY from all three protocols. Cached 60s.
 * AI agents call this to see the yield landscape.
 */
router.get('/rates', async (req: Request, res: Response) => {
  try {
    const rates = await fetchLiveRates();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      rates: {
        aave: {
          protocol:    'Aave v3',
          network:     'Base',
          apyPercent:  rates.aaveAPY,
          status:      'live',
        },
        compound: {
          protocol:    'Compound v3',
          network:     'Base',
          apyPercent:  rates.compoundAPY,
          status:      'live',
        },
        morpho: {
          protocol:    'Morpho Blue',
          network:     'Base',
          apyPercent:  rates.morphoAPY,
          status:      rates.morphoAPY > 0 ? 'live' : 'integrating',
        },
      },
      currentBest: {
        protocol:   rates.bestProtocol,
        apyPercent: rates.bestAPY,
      },
      netAPY: {
        description:   'Net APY to depositor after CoinRailz 15% performance fee',
        exampleAt5Pct: `${(rates.bestAPY * 0.85).toFixed(2)}%`,
      },
      fees: {
        entryFeePct:       0.5,
        performanceFeePct: 15,
        exitFeePct:        0,
        switchFeePct:      0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch live rates', detail: err.message });
  }
});

/**
 * GET /api/yield/stats
 * Vault TVL, fee structure, contract address, rebalance status.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [rates, vaultStats] = await Promise.all([
      fetchLiveRates(),
      fetchVaultStats(),
    ]);

    res.json({
      success:     true,
      timestamp:   new Date().toISOString(),
      vault: {
        address:   VAULT_ADDRESS || 'deploying-soon',
        network:   'Base',
        asset:     'USDC',
        assetAddress: BASE_USDC,
        standard:  'ERC-4626',
        shareToken: 'crUSDC',
      },
      stats: vaultStats || {
        tvlUsdc:           '0',
        pricePerShare:     '1.000000',
        pendingFeesUsdc:   '0',
        nextRebalanceInSec: 0,
      },
      routing: {
        strategy:          'auto',
        description:       'Automatically routes to the highest-APY protocol. Rebalances once per 24h.',
        currentProtocol:   rates.bestProtocol,
        currentAPY:        rates.bestAPY,
        rebalanceInterval: '24h',
        minImprovementBps: 50,
        protocols:         ['Aave v3', 'Compound v3', 'Morpho Blue'],
      },
      fees: {
        entryFeePct:           0.5,
        performanceFeePct:     15,
        exitFeePct:            0,
        switchFeePct:          0,
        minHarvestUsd:         5,
        feeTimelockHours:      48,
        maxEntryFeePct:        2,
        maxPerformanceFeePct:  30,
      },
      security: {
        nonCustodial:        true,
        adminCanWithdrawPrincipal: false,
        emergencyExitAlways: true,
        feeChangeTimelock:   '48h',
        sourceCode:          'https://github.com/coinrailz/yield-vault',
        auditStatus:         'pending-external-audit',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats', detail: err.message });
  }
});

/**
 * GET /api/yield/position/:wallet
 * Individual agent's current position.
 */
router.get('/position/:wallet', async (req: Request, res: Response) => {
  const { wallet } = req.params;

  if (!wallet?.match(/^0x[0-9a-fA-F]{40}$/)) {
    return res.status(400).json({ success: false, error: 'Invalid wallet address' });
  }

  if (!VAULT_ADDRESS) {
    return res.json({
      success: true,
      wallet,
      position: null,
      message: 'Vault not yet deployed. Check /api/yield/stats for deployment status.',
    });
  }

  try {
    const result = await client.readContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'userPosition',
      args: [wallet as `0x${string}`],
    }) as [bigint, bigint, bigint, bigint];

    const [shares, currentValue, estimatedYield, estimatedPerformanceFee] = result;

    res.json({
      success:   true,
      wallet,
      position: {
        sharesHeld:              formatUnits(shares, 6),
        currentValueUsdc:        formatUnits(currentValue, 6),
        estimatedYieldUsdc:      formatUnits(estimatedYield, 6),
        estimatedPerformanceFee: formatUnits(estimatedPerformanceFee, 6),
        netYieldUsdc:            formatUnits(estimatedYield - estimatedPerformanceFee, 6),
        shareToken:              'crUSDC',
        vaultAddress:            VAULT_ADDRESS,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch position', detail: err.message });
  }
});

/**
 * GET /api/yield/contract
 * Full ABI and integration guide for AI agents to interact directly with the vault.
 */
router.get('/contract', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    vault: {
      address:    VAULT_ADDRESS || 'deploying-soon',
      network:    'Base',
      chainId:    8453,
      asset:      'USDC',
      assetAddress: BASE_USDC,
      standard:   'ERC-4626',
      shareToken: 'crUSDC',
    },
    howToDeposit: [
      '1. Approve the vault to spend your USDC: USDC.approve(vaultAddress, amount)',
      '2. Call vault.deposit(amount, yourWalletAddress)',
      '3. You receive crUSDC shares representing your position',
      '4. The vault auto-routes to the highest-APY protocol within 24h',
    ],
    howToWithdraw: [
      '1. Call vault.redeem(shares, yourWalletAddress, yourWalletAddress)',
      '2. Receive USDC: principal + yield - 15% performance fee on yield',
      '3. No exit fee, no minimum holding period',
    ],
    keyFunctions: {
      deposit:          'deposit(uint256 assets, address receiver) → uint256 shares',
      redeem:           'redeem(uint256 shares, address receiver, address owner) → uint256 assets',
      emergencyWithdraw:'emergencyWithdraw() — always works, cannot be blocked',
      accrueFees:       'accrueFees() — anyone can call; mints performance-fee shares to feeRecipient on any yield gain',
      rebalance:        'rebalance() — anyone can call, 24h cooldown, auto-routes to best APY',
      userPosition:     'userPosition(address) → (shares, value, yield, perfFee)',
      pricePerShare:    'pricePerShare() → current USDC value per 1 crUSDC share',
      getAllAPYs:        'getAllAPYs() → (aaveAPYBps, compoundAPYBps, morphoAPYBps)',
    },
    agentIntegrationExample: {
      language: 'javascript',
      code: `
// Auto-deposit with viem
import { createWalletClient, parseUnits } from 'viem';
const VAULT = '${VAULT_ADDRESS || '0xVAULT_ADDRESS'}';
const USDC  = '${BASE_USDC}';

// Step 1: Approve
await walletClient.writeContract({
  address: USDC,
  abi: [{ name:'approve', type:'function', inputs:[{type:'address'},{type:'uint256'}], outputs:[{type:'bool'}] }],
  functionName: 'approve',
  args: [VAULT, parseUnits('100', 6)], // $100 USDC
});

// Step 2: Deposit
const shares = await walletClient.writeContract({
  address: VAULT,
  abi: [{ name:'deposit', type:'function', inputs:[{type:'uint256'},{type:'address'}], outputs:[{type:'uint256'}] }],
  functionName: 'deposit',
  args: [parseUnits('100', 6), walletAddress],
});
      `.trim(),
    },
  });
});

/**
 * GET /yield-portal.json
 * Machine-readable manifest — AI agents discover this via .well-known/x402.json
 */
router.get('/manifest', async (req: Request, res: Response) => {
  const host = req.get('host') || 'coinrailz.com';
  const base  = `https://${host}`;

  try {
    const rates = await fetchLiveRates();

    res.json({
      name:        'CoinRailz AI Agent Yield Portal',
      description: 'Non-custodial USDC yield vault for AI agents. Auto-routes to highest APY across Aave v3, Compound v3, and Morpho Blue on Base.',
      version:     '1.0.0',
      type:        'yield-vault',
      network:     'base',
      chainId:     8453,
      asset:       { symbol: 'USDC', address: BASE_USDC, decimals: 6 },
      vault:       { address: VAULT_ADDRESS || 'deploying-soon', shareToken: 'crUSDC', standard: 'ERC-4626' },
      currentAPY:  rates.bestAPY,
      currentBest: rates.bestProtocol,
      fees: {
        entry:       '0.5%',
        performance: '15% of yield',
        exit:        '0%',
        switch:      '0%',
      },
      endpoints: {
        rates:     `${base}/api/yield/rates`,
        stats:     `${base}/api/yield/stats`,
        position:  `${base}/api/yield/position/{wallet}`,
        contract:  `${base}/api/yield/contract`,
        portal:    `${base}/yield-portal`,
      },
      security: {
        nonCustodial:           true,
        emergencyExitAlways:    true,
        adminCannotWithdrawPrincipal: true,
        feeTimelock:            '48h',
      },
      x402Compatible: true,
      agentReadable:  true,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const BASE_ADDRS: Record<string, Record<string, string>> = {
  testnet: {
    usdc:          '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    aavePool:      '0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b',
    aUsdc:         '0x96E32de4B1D6B4BA845c7e8f9F95F5cC0B66b4A4',
    compoundComet: '0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017',
    morpho:        '0x0000000000000000000000000000000000000000',
  },
  mainnet: {
    usdc:          '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    aavePool:      '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    aUsdc:         '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB',
    compoundComet: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf',
    morpho:        '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  },
};

const FEE_RECIPIENT = '0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91';

/**
 * GET /api/yield/deploy-data?network=testnet|mainnet
 * Returns fully-encoded deployment hex that MetaMask can broadcast directly.
 * All ABI encoding stays server-side — no viem in the browser.
 */
router.get('/deploy-data', (req: Request, res: Response) => {
  const network = (req.query.network as string) || 'testnet';
  const addrs = BASE_ADDRS[network];
  if (!addrs) return res.status(400).json({ success: false, error: 'Unknown network. Use testnet or mainnet.' });

  const artifactPath = join(process.cwd(), 'contracts', 'CoinRailzYieldVault.json');
  if (!existsSync(artifactPath)) {
    return res.status(404).json({ success: false, error: 'Compiled artifact not found.' });
  }

  try {
    const { bytecode, abi } = JSON.parse(readFileSync(artifactPath, 'utf8'));
    const ZERO = getAddress('0x0000000000000000000000000000000000000000');

    // toLowerCase() first so getAddress() can recompute EIP-55 checksum from scratch
    const norm = (addr: string) => getAddress(addr.toLowerCase() as `0x${string}`);
    const a = {
      usdc:    norm(addrs.usdc),
      fee:     norm(FEE_RECIPIENT),
      aave:    norm(addrs.aavePool),
      aUsdc:   norm(addrs.aUsdc),
      comp:    norm(addrs.compoundComet),
      morpho:  norm(addrs.morpho),
    };

    const constructorArgs = encodeAbiParameters(
      parseAbiParameters(
        'address,address,address,address,address,address,(address,address,address,address,uint256),uint8'
      ),
      [
        a.usdc, a.fee, a.aave, a.aUsdc, a.comp, a.morpho,
        [ZERO, ZERO, ZERO, ZERO, 0n],
        0,
      ]
    );

    const deployHex = bytecode + (constructorArgs as string).slice(2);

    const rpcUrl = network === 'mainnet'
      ? 'https://mainnet.base.org'
      : 'https://sepolia.base.org';

    res.json({
      success: true,
      deployHex,
      rpcUrl,
      network,
      feeRecipient: FEE_RECIPIENT,
      addresses: addrs,
      abi,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/yield/predict-address?from=0x...&nonce=5
 * Computes the deterministic CREATE address (keccak256(RLP([from, nonce])))
 * Used by the browser to detect a successful deployment even if MetaMask throws
 * its internal "reading 'length'" bug when processing deployment receipts.
 */
router.get('/predict-address', (req: Request, res: Response) => {
  const { from, nonce } = req.query as { from: string; nonce: string };
  if (!from?.match(/^0x[0-9a-fA-F]{40}$/)) {
    return res.status(400).json({ success: false, error: 'Invalid from address' });
  }
  const nonceNum = parseInt(nonce || '0', 10);
  if (isNaN(nonceNum) || nonceNum < 0) {
    return res.status(400).json({ success: false, error: 'Invalid nonce' });
  }
  try {
    const contractAddress = getContractAddress({
      from: from as `0x${string}`,
      nonce: BigInt(nonceNum),
    });
    res.json({ success: true, contractAddress, nonce: nonceNum });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/yield/server-wallet?network=testnet|mainnet
 * Returns the server wallet address (from EVM_PRIVATE_KEY) and its ETH balance
 * on the target network. Used by the deploy UI to show whether deployment is possible.
 */
router.get('/server-wallet', async (req: Request, res: Response) => {
  const rawKey = process.env.EVM_PRIVATE_KEY;
  if (!rawKey) {
    return res.status(500).json({ success: false, error: 'EVM_PRIVATE_KEY not configured on this server.' });
  }

  try {
    const key = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
    const account = privateKeyToAccount(key);

    const network = (req.query.network as string) || 'testnet';
    const chain   = network === 'mainnet' ? base : baseSepolia;
    const rpcUrl  = network === 'mainnet'
      ? 'https://base-rpc.publicnode.com'
      : 'https://base-sepolia-rpc.publicnode.com';

    const pubClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const balance   = await pubClient.getBalance({ address: account.address });
    const balEth    = Number(formatUnits(balance, 18));

    res.json({
      success:    true,
      address:    account.address,
      balance:    balEth.toFixed(6),
      balanceWei: balance.toString(),
      hasEnough:  balance > 1_000_000_000_000_000n, // > 0.001 ETH
      network,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/yield/server-deploy
 * Deploys CoinRailzYieldVault using the server's EVM_PRIVATE_KEY wallet.
 * No MetaMask required. Returns { success, address, txHash, deployer }.
 */
router.post('/server-deploy', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const rawKey = process.env.EVM_PRIVATE_KEY;
  if (!rawKey) {
    return res.status(500).json({ success: false, error: 'EVM_PRIVATE_KEY not configured on this server.' });
  }

  const network = (req.body?.network as string) || 'testnet';
  const addrs   = BASE_ADDRS[network];
  if (!addrs) {
    return res.status(400).json({ success: false, error: 'Unknown network. Use testnet or mainnet.' });
  }

  const artifactPath = join(process.cwd(), 'contracts', 'CoinRailzYieldVault.json');
  if (!existsSync(artifactPath)) {
    return res.status(404).json({ success: false, error: 'Compiled artifact (contracts/CoinRailzYieldVault.json) not found.' });
  }

  try {
    const { bytecode, abi } = JSON.parse(readFileSync(artifactPath, 'utf8'));

    const key     = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
    const account = privateKeyToAccount(key);

    const chain    = network === 'mainnet' ? base : baseSepolia;
    const rpcUrl   = network === 'mainnet'
      ? 'https://base-rpc.publicnode.com'
      : 'https://base-sepolia-rpc.publicnode.com';

    const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
    const pubClient    = createPublicClient({ chain, transport: http(rpcUrl) });

    // Check balance first
    const balance = await pubClient.getBalance({ address: account.address });
    if (balance < 1_000_000_000_000_000n) {
      return res.status(400).json({
        success:       false,
        error:         `Server wallet has insufficient ETH (${formatUnits(balance, 18)} ETH). Fund the address below first.`,
        serverAddress: account.address,
        faucetUrl:     network === 'testnet' ? 'https://www.alchemy.com/faucets/base-sepolia' : null,
      });
    }

    const ZERO = getAddress('0x0000000000000000000000000000000000000000');
    const norm  = (addr: string) => getAddress(addr.toLowerCase() as `0x${string}`);

    // Deploy the contract — viem properly handles CREATE transactions (no `to` field)
    const txHash = await walletClient.deployContract({
      abi,
      bytecode: bytecode as `0x${string}`,
      args: [
        norm(addrs.usdc),
        norm(FEE_RECIPIENT),
        norm(addrs.aavePool),
        norm(addrs.aUsdc),
        norm(addrs.compoundComet),
        ZERO,                          // morpho = address(0) — configure post-deploy via configureMorphoMarket()
        [ZERO, ZERO, ZERO, ZERO, 0n],  // morphoMarket = all zeros
        ZERO,                          // morphoIrm = address(0) — configure post-deploy
        0,                             // Protocol.AAVE
      ],
    });

    // Wait for receipt (up to 2 minutes)
    const receipt = await pubClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });

    if (!receipt.contractAddress) {
      return res.status(500).json({
        success: false,
        error:   'Transaction confirmed but no contract address in receipt. The constructor may have reverted.',
        txHash,
      });
    }

    // Activate immediately in this process
    process.env.YIELD_VAULT_ADDRESS = receipt.contractAddress;

    // Write a deployments record
    try {
      const { mkdirSync, writeFileSync } = await import('fs');
      const deploymentsDir = join(process.cwd(), 'deployments');
      mkdirSync(deploymentsDir, { recursive: true });
      writeFileSync(
        join(deploymentsDir, `${network}-yield-vault.json`),
        JSON.stringify({
          address:    receipt.contractAddress,
          txHash,
          deployer:   account.address,
          network,
          deployedAt: new Date().toISOString(),
        }, null, 2)
      );
    } catch { /* non-fatal */ }

    res.json({
      success:  true,
      address:  receipt.contractAddress,
      txHash,
      deployer: account.address,
      network,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Platform Integration (admin-only, server-wallet operated) ─────────────────

const EXTENDED_VAULT_ABI = parseAbi([
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function pricePerShare() view returns (uint256)',
  'function rebalance()',
  'function accrueFees()',
  'function activeProtocolName() view returns (string)',
  'function pendingFeeAccrual() view returns (uint256 gainAssets, uint256 feeAssets)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

function adminAuth(req: Request, res: Response): boolean {
  const key = req.headers['x-admin-key'] as string | undefined;
  if (!key || key !== process.env.ADMIN_KEY) {
    res.status(401).json({ success: false, error: 'Unauthorized. Provide x-admin-key header.' });
    return false;
  }
  return true;
}

function getServerWallet() {
  const rawKey = process.env.EVM_PRIVATE_KEY;
  if (!rawKey) throw new Error('EVM_PRIVATE_KEY not configured');
  const key = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(key);
  const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });
  const pubClient    = createPublicClient({ chain: base, transport: http(RPC_URL) });
  return { account, walletClient, pubClient };
}

/**
 * GET /api/yield/platform-balance
 * Returns server wallet's USDC balance and vault shares.
 */
router.get('/platform-balance', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  if (!VAULT_ADDRESS) return res.status(400).json({ success: false, error: 'Vault not deployed' });

  try {
    const { account, pubClient } = getServerWallet();
    const [usdcBal, vaultShares, totalAssets, pricePerShare, protocolName] = await Promise.all([
      pubClient.readContract({ address: BASE_USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
      pubClient.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: EXTENDED_VAULT_ABI, functionName: 'balanceOf', args: [account.address] }),
      pubClient.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: EXTENDED_VAULT_ABI, functionName: 'totalAssets' }),
      pubClient.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: EXTENDED_VAULT_ABI, functionName: 'pricePerShare' }),
      pubClient.readContract({ address: VAULT_ADDRESS as `0x${string}`, abi: EXTENDED_VAULT_ABI, functionName: 'activeProtocolName' }),
    ]);

    res.json({
      success: true,
      wallet:  account.address,
      vault:   VAULT_ADDRESS,
      balances: {
        usdcAvailable:  formatUnits(usdcBal as bigint, 6),
        vaultShares:    formatUnits(vaultShares as bigint, 6),
        vaultValueUsdc: formatUnits((vaultShares as bigint) * (pricePerShare as bigint) / 1_000_000n, 6),
      },
      vault_stats: {
        tvlUsdc:        formatUnits(totalAssets as bigint, 6),
        pricePerShare:  formatUnits(pricePerShare as bigint, 6),
        activeProtocol: protocolName,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/yield/platform-deposit
 * Server wallet deposits USDC into the vault. Used for revenue sweeps.
 * Body: { amountUsdc: "10.00" }
 */
router.post('/platform-deposit', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  if (!VAULT_ADDRESS) return res.status(400).json({ success: false, error: 'Vault not deployed' });

  const { amountUsdc } = req.body as { amountUsdc: string };
  if (!amountUsdc || isNaN(parseFloat(amountUsdc)) || parseFloat(amountUsdc) <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid amountUsdc. Provide a positive number as string, e.g. "10.00"' });
  }

  try {
    const { account, walletClient, pubClient } = getServerWallet();
    const amount = BigInt(Math.round(parseFloat(amountUsdc) * 1_000_000));
    const vault  = VAULT_ADDRESS as `0x${string}`;

    // Check USDC balance
    const usdcBal = await pubClient.readContract({ address: BASE_USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as bigint;
    if (usdcBal < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient USDC. Have: ${formatUnits(usdcBal, 6)}, Need: ${amountUsdc}`,
      });
    }

    // Approve with MaxUint256 if allowance is insufficient
    // Uses unlimited approval to avoid race conditions on load-balanced RPC nodes
    const MaxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    const allowance  = await pubClient.readContract({ address: BASE_USDC, abi: ERC20_ABI, functionName: 'allowance', args: [account.address, vault] }) as bigint;
    if (allowance < amount) {
      const approveTx = await walletClient.writeContract({ address: BASE_USDC, abi: ERC20_ABI, functionName: 'approve', args: [vault, MaxUint256] });
      await pubClient.waitForTransactionReceipt({ hash: approveTx, timeout: 60_000 });
      // Small settle delay so every RPC node in the pool indexes the approval before deposit simulation
      await new Promise(r => setTimeout(r, 2_000));
    }

    // Deposit
    const depositTx = await walletClient.writeContract({ address: vault, abi: EXTENDED_VAULT_ABI, functionName: 'deposit', args: [amount, account.address] });
    const receipt   = await pubClient.waitForTransactionReceipt({ hash: depositTx, timeout: 60_000 });

    // Read updated balances
    const [newUsdcBal, newShares] = await Promise.all([
      pubClient.readContract({ address: BASE_USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
      pubClient.readContract({ address: vault, abi: EXTENDED_VAULT_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
    ]);

    res.json({
      success:      true,
      txHash:       depositTx,
      blockNumber:  Number(receipt.blockNumber),
      deposited:    amountUsdc,
      sharesReceived: formatUnits(newShares - (allowance < amount ? 0n : 0n), 6),
      newUsdcBalance: formatUnits(newUsdcBal, 6),
      newShares:    formatUnits(newShares, 6),
      basescanUrl:  `https://basescan.org/tx/${depositTx}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.shortMessage || err.message });
  }
});

/**
 * POST /api/yield/platform-withdraw
 * Server wallet redeems vault shares for USDC.
 * Body: { shares: "9.95" }  (in crUSDC units, 6 decimals)
 */
router.post('/platform-withdraw', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  if (!VAULT_ADDRESS) return res.status(400).json({ success: false, error: 'Vault not deployed' });

  const { shares } = req.body as { shares: string };
  if (!shares || isNaN(parseFloat(shares)) || parseFloat(shares) <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid shares. Provide a positive number as string.' });
  }

  try {
    const { account, walletClient, pubClient } = getServerWallet();
    const shareAmount = BigInt(Math.round(parseFloat(shares) * 1_000_000));
    const vault = VAULT_ADDRESS as `0x${string}`;

    const currentShares = await pubClient.readContract({ address: vault, abi: EXTENDED_VAULT_ABI, functionName: 'balanceOf', args: [account.address] }) as bigint;
    if (currentShares < shareAmount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient shares. Have: ${formatUnits(currentShares, 6)}, Requested: ${shares}`,
      });
    }

    const redeemTx = await walletClient.writeContract({ address: vault, abi: EXTENDED_VAULT_ABI, functionName: 'redeem', args: [shareAmount, account.address, account.address] });
    const receipt  = await pubClient.waitForTransactionReceipt({ hash: redeemTx, timeout: 60_000 });

    const [newUsdcBal, newShares] = await Promise.all([
      pubClient.readContract({ address: BASE_USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
      pubClient.readContract({ address: vault, abi: EXTENDED_VAULT_ABI, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
    ]);

    res.json({
      success:        true,
      txHash:         redeemTx,
      blockNumber:    Number(receipt.blockNumber),
      sharesRedeemed: shares,
      newUsdcBalance: formatUnits(newUsdcBal, 6),
      newShares:      formatUnits(newShares, 6),
      basescanUrl:    `https://basescan.org/tx/${redeemTx}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.shortMessage || err.message });
  }
});

/**
 * POST /api/yield/platform-rebalance
 * Calls vault.rebalance() — auto-routes to best APY protocol.
 */
router.post('/platform-rebalance', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  if (!VAULT_ADDRESS) return res.status(400).json({ success: false, error: 'Vault not deployed' });

  try {
    const { walletClient, pubClient } = getServerWallet();
    const vault = VAULT_ADDRESS as `0x${string}`;
    const tx    = await walletClient.writeContract({ address: vault, abi: EXTENDED_VAULT_ABI, functionName: 'rebalance' });
    const rx    = await pubClient.waitForTransactionReceipt({ hash: tx, timeout: 60_000 });
    res.json({ success: true, txHash: tx, blockNumber: Number(rx.blockNumber), basescanUrl: `https://basescan.org/tx/${tx}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.shortMessage || err.message });
  }
});

/**
 * POST /api/yield/platform-harvest
 * Calls vault.harvest() — sweeps pending performance fees to feeRecipient when > $5.
 */
router.post('/platform-harvest', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  if (!VAULT_ADDRESS) return res.status(400).json({ success: false, error: 'Vault not deployed' });

  try {
    const { walletClient, pubClient } = getServerWallet();
    const vault = VAULT_ADDRESS as `0x${string}`;
    const tx    = await walletClient.writeContract({ address: vault, abi: EXTENDED_VAULT_ABI, functionName: 'accrueFees' });
    const rx    = await pubClient.waitForTransactionReceipt({ hash: tx, timeout: 60_000 });
    res.json({ success: true, txHash: tx, blockNumber: Number(rx.blockNumber), basescanUrl: `https://basescan.org/tx/${tx}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.shortMessage || err.message });
  }
});

/**
 * POST /api/yield/save-vault-address
 * Called by the browser deploy page after successful deployment.
 * Writes the vault address into the runtime environment so /api/yield/* routes
 * immediately start reading from the live contract (until next restart).
 * The user still needs to manually add YIELD_VAULT_ADDRESS to Replit Secrets
 * for it to persist across restarts — we return clear instructions.
 */
router.post('/save-vault-address', async (req: Request, res: Response) => {
  const { address, network: deployNetwork } = req.body as { address: string; network: string };

  if (!address?.match(/^0x[0-9a-fA-F]{40}$/)) {
    return res.status(400).json({ success: false, error: 'Invalid address format' });
  }

  // Activate in the current process immediately (survives until next restart)
  process.env.YIELD_VAULT_ADDRESS = address;

  // Also write a local deployments record
  try {
    const deploymentsDir = join(process.cwd(), 'deployments');
    const { mkdirSync, writeFileSync } = await import('fs');
    mkdirSync(deploymentsDir, { recursive: true });
    writeFileSync(
      join(deploymentsDir, `${deployNetwork}-yield-vault.json`),
      JSON.stringify({ address, network: deployNetwork, deployedAt: new Date().toISOString() }, null, 2)
    );
  } catch { /* non-fatal */ }

  res.json({
    success: true,
    address,
    message: `✅ Vault address saved for this session. To persist across restarts: add YIELD_VAULT_ADDRESS=${address} to Replit Secrets (lock icon in sidebar).`,
    persistInstructions: {
      step1: 'Click the lock icon (Secrets) in the left sidebar of Replit',
      step2: 'Add new secret — Key: YIELD_VAULT_ADDRESS',
      step3: `Value: ${address}`,
      step4: 'Restart the workflow — done!',
    },
  });
});

export default router;
