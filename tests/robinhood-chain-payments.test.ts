/**
 * Robinhood Chain (eip155:4663) payment guard tests
 *
 * Validates that:
 *  1. parseNetworkToChain correctly maps all Robinhood network identifiers
 *  2. getStablecoinsForChain('robinhood') returns the right stablecoins based on env vars —
 *     a wrong USDC address propagates into the payment filter and causes silent failures
 *  3. verifyTransactionPayment succeeds/fails correctly for eip155:4663 transactions
 *  4. The 402 response includes eip155:4663 in accepts[] only when
 *     ROBINHOOD_CHAIN_CCTP_ENABLED=true and USDC_ROBINHOOD_ADDRESS is set
 */

// ─── Mocks (hoisted by Jest above all imports) ───────────────────────────────

jest.mock('ethers', () => {
  const mockGetTransactionReceipt = jest.fn().mockResolvedValue(null);
  const mockProvider = { getTransactionReceipt: mockGetTransactionReceipt };
  const MockJsonRpcProvider = jest.fn(() => mockProvider);
  (global as any).__ethersMocks = { mockGetTransactionReceipt, mockProvider };
  return {
    ethers: { JsonRpcProvider: MockJsonRpcProvider },
  };
});

jest.mock('../server/db', () => {
  const selectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
  };
  const insertChain = {
    values: jest.fn().mockResolvedValue({ rowCount: 1 }),
  };
  const updateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue({ rowCount: 1 }),
  };
  const deleteChain = {
    where: jest.fn().mockResolvedValue({ rowCount: 1 }),
  };
  const mockDb = {
    select: jest.fn(() => selectChain),
    insert: jest.fn(() => insertChain),
    update: jest.fn(() => updateChain),
    delete: jest.fn(() => deleteChain),
    query: {
      creditsAccounts: { findFirst: jest.fn().mockResolvedValue(null) },
    },
  };
  (global as any).__dbMocks = { mockDb, selectChain, insertChain };
  return { db: mockDb };
});

jest.mock('nanoid', () => ({ nanoid: jest.fn(() => 'test-intent-id-robinhood') }));

jest.mock('../server/utils/canaryAddress', () => ({
  isCanaryPayer: jest.fn(() => false),
}));

jest.mock('../server/services/creditsService', () => ({
  creditsService: {
    getBalance: jest.fn().mockResolvedValue(0),
    deductCredits: jest.fn().mockResolvedValue({ newBalance: 0 }),
    validateApiKey: jest.fn().mockResolvedValue({ valid: false }),
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockImplementation(() => {
    throw new Error('mock: invalid token');
  }),
  sign: jest.fn(() => 'mock-jwt-token'),
  decode: jest.fn(() => null),
}));

jest.mock('@shared/schema', () => ({
  usedTransactionHashes: { name: 'used_transaction_hashes' },
  x402Payments: { name: 'x402_payments' },
  x402PaymentIntents: { name: 'x402_payment_intents' },
  creditsAccounts: { name: 'credits_accounts' },
  x402Interactions: { name: 'x402_interactions' },
  createPaymentIntentMetadata: jest.fn((tokenAddr: string, symbol: string, chainId: number) => ({
    token: symbol,
    tokenAddress: tokenAddr,
    chainId,
    pricingVersion: '2025-12-14',
  })),
}));

jest.mock('../server/utils/serviceCount', () => ({
  getCanonicalServiceCount: jest.fn(() => 60),
}));

jest.mock('../server/services/offerLinkService', () => ({
  offerLinkService: {
    recordConversion: jest.fn().mockResolvedValue({}),
    getOfferByTrackingId: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../server/utils/facilitatorHelper', () => ({
  getFacilitatorUrl: jest.fn(() => 'https://x402.org/facilitator'),
}));

jest.mock('../server/services/gptAuthResolver', () => ({
  getAuthContext: jest.fn(() => ({ mode: 'none', userId: null })),
  hasValidSession: jest.fn(() => false),
  resolveOrCreateSessionUser: jest.fn().mockResolvedValue({ userId: null }),
  refreshAndValidateAuthContext: jest.fn().mockRejectedValue(new Error('no session')),
}));

jest.mock('../server/services/x402InteractionTracker', () => ({
  x402InteractionTracker: {
    trackInteraction: jest.fn().mockResolvedValue({}),
    getMetrics: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../server/services/funnelHelper', () => ({
  emitFirstX402CallAsync: jest.fn(),
}));

jest.mock('../server/services/stripeClient', () => ({
  stripe: {
    paymentIntents: { create: jest.fn().mockResolvedValue({ id: 'pi_mock' }) },
    customers: { list: jest.fn().mockResolvedValue({ data: [] }) },
  },
}));

// ─── Imports (resolved after mocks are registered) ───────────────────────────

import {
  parseNetworkToChain,
  getStablecoinsForChain,
  verifyTransactionPayment,
} from '../server/middleware/hybridPaymentMiddleware';

// ─── Test constants ───────────────────────────────────────────────────────────

const FAKE_USDC_ROBINHOOD = '0xFa4eRobinhoodUsdc00000000000000000000001';
const PLATFORM_WALLET =
  process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const TRANSFER_EVENT_SIG =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DUMMY_TX_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';

/**
 * Build a minimal mocked ERC-20 Transfer receipt that looks like a real on-chain
 * USDC transfer on Robinhood Chain (eip155:4663).
 */
function makeTransferReceipt({
  tokenAddress = FAKE_USDC_ROBINHOOD,
  toAddress = PLATFORM_WALLET,
  amountMicroUsdc = 50_000,
  status = 1,
}: {
  tokenAddress?: string;
  toAddress?: string;
  amountMicroUsdc?: number;
  status?: number;
} = {}) {
  const pad32 = (addr: string) =>
    '0x000000000000000000000000' + addr.replace(/^0x/i, '').toLowerCase();
  const amountHex = '0x' + amountMicroUsdc.toString(16).padStart(64, '0');

  return {
    status,
    from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    to: tokenAddress,
    blockNumber: 42,
    logs: [
      {
        address: tokenAddress,
        topics: [
          TRANSFER_EVENT_SIG,
          pad32('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          pad32(toAddress),
        ],
        data: amountHex,
      },
    ],
  };
}

// ─── 1. parseNetworkToChain — Robinhood Chain identifiers ────────────────────

describe('parseNetworkToChain — Robinhood Chain identifiers', () => {
  it('maps "robinhood" to robinhood', () => {
    expect(parseNetworkToChain('robinhood')).toBe('robinhood');
  });

  it('maps "eip155:4663" (CAIP-2) to robinhood', () => {
    expect(parseNetworkToChain('eip155:4663')).toBe('robinhood');
  });

  it('maps "robinhood-mainnet" to robinhood', () => {
    expect(parseNetworkToChain('robinhood-mainnet')).toBe('robinhood');
  });

  it('is case-insensitive for "ROBINHOOD"', () => {
    expect(parseNetworkToChain('ROBINHOOD')).toBe('robinhood');
  });

  it('is case-insensitive for "EIP155:4663"', () => {
    expect(parseNetworkToChain('EIP155:4663')).toBe('robinhood');
  });

  it('returns null for an unknown chain — never silently falls back to Base', () => {
    expect(parseNetworkToChain('eip155:9999')).toBeNull();
    expect(parseNetworkToChain('unknown-chain')).toBeNull();
    expect(parseNetworkToChain('eip155:4662')).toBeNull(); // one digit off from Robinhood
  });

  it('does not confuse Robinhood with other supported chains', () => {
    expect(parseNetworkToChain('base')).toBe('base');
    expect(parseNetworkToChain('eip155:8453')).toBe('base');
    expect(parseNetworkToChain('arbitrum')).toBe('arbitrum');
    expect(parseNetworkToChain('eip155:42161')).toBe('arbitrum');
    expect(parseNetworkToChain('ethereum')).toBe('ethereum');
    expect(parseNetworkToChain('eip155:1')).toBe('ethereum');
  });

  it('returns base when network is undefined or empty (no-network default)', () => {
    expect(parseNetworkToChain(undefined)).toBe('base');
    expect(parseNetworkToChain('')).toBe('base');
  });
});

// ─── 2. getStablecoinsForChain — env-var propagation ─────────────────────────

describe('getStablecoinsForChain — Robinhood stablecoin filter', () => {
  afterEach(() => {
    delete process.env.USDC_ROBINHOOD_ADDRESS;
    delete process.env.USDT_ROBINHOOD_ADDRESS;
  });

  it('returns a USDC entry with the configured address when USDC_ROBINHOOD_ADDRESS is set', () => {
    process.env.USDC_ROBINHOOD_ADDRESS = FAKE_USDC_ROBINHOOD;

    let mod: typeof import('../server/middleware/hybridPaymentMiddleware');
    jest.isolateModules(() => {
      mod = require('../server/middleware/hybridPaymentMiddleware');
    });

    const stablecoins = mod!.getStablecoinsForChain('robinhood');
    expect(stablecoins).toHaveLength(1);
    expect(stablecoins[0]).toMatchObject({
      address: FAKE_USDC_ROBINHOOD,
      symbol: 'USDC',
      name: 'USD Coin',
    });
  });

  it('returns an empty array when neither USDC nor USDT address is set — payments will silently fail', () => {
    let mod: typeof import('../server/middleware/hybridPaymentMiddleware');
    jest.isolateModules(() => {
      mod = require('../server/middleware/hybridPaymentMiddleware');
    });

    const stablecoins = mod!.getStablecoinsForChain('robinhood');
    expect(stablecoins).toHaveLength(0);
  });

  it('propagates a wrong USDC address into the filter — proving a bad env var causes silent failure', () => {
    const WRONG_ADDRESS = '0xDeadAddress000000000000000000000000000001';
    process.env.USDC_ROBINHOOD_ADDRESS = WRONG_ADDRESS;

    let mod: typeof import('../server/middleware/hybridPaymentMiddleware');
    jest.isolateModules(() => {
      mod = require('../server/middleware/hybridPaymentMiddleware');
    });

    const stablecoins = mod!.getStablecoinsForChain('robinhood');
    expect(stablecoins).toHaveLength(1);
    // The wrong address is in the filter — any real USDC transfer will be rejected
    // because the token contract address won't match the log's address field.
    expect(stablecoins[0].address).toBe(WRONG_ADDRESS);
  });

  it('returns both USDC and USDT entries when both addresses are configured', () => {
    const FAKE_USDT = '0xFa4eRobinhoodUsdt00000000000000000000002';
    process.env.USDC_ROBINHOOD_ADDRESS = FAKE_USDC_ROBINHOOD;
    process.env.USDT_ROBINHOOD_ADDRESS = FAKE_USDT;

    let mod: typeof import('../server/middleware/hybridPaymentMiddleware');
    jest.isolateModules(() => {
      mod = require('../server/middleware/hybridPaymentMiddleware');
    });

    const stablecoins = mod!.getStablecoinsForChain('robinhood');
    expect(stablecoins).toHaveLength(2);
    expect(stablecoins.find((s) => s.symbol === 'USDC')?.address).toBe(FAKE_USDC_ROBINHOOD);
    expect(stablecoins.find((s) => s.symbol === 'USDT')?.address).toBe(FAKE_USDT);
  });

  it('does not affect other chains — Base stablecoins are always present', () => {
    let mod: typeof import('../server/middleware/hybridPaymentMiddleware');
    jest.isolateModules(() => {
      mod = require('../server/middleware/hybridPaymentMiddleware');
    });

    const baseCoins = mod!.getStablecoinsForChain('base');
    expect(baseCoins.length).toBeGreaterThanOrEqual(2);
    expect(baseCoins.some((s) => s.symbol === 'USDC')).toBe(true);
  });
});

// ─── 3. verifyTransactionPayment — eip155:4663 branch ────────────────────────

describe('verifyTransactionPayment — Robinhood Chain (eip155:4663)', () => {
  let mockGetTransactionReceipt: jest.Mock;

  beforeAll(() => {
    mockGetTransactionReceipt = (global as any).__ethersMocks.mockGetTransactionReceipt;
    // Speed up retry loop: replace setTimeout with immediate execution
    jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mockGetTransactionReceipt.mockReset();
    mockGetTransactionReceipt.mockResolvedValue(null);
    // Reset select chain to return no existing payment intents
    const { selectChain } = (global as any).__dbMocks;
    selectChain.limit.mockResolvedValue([]);
  });

  function loadFreshVerify(usdcAddress = FAKE_USDC_ROBINHOOD) {
    process.env.USDC_ROBINHOOD_ADDRESS = usdcAddress;
    let freshVerify: typeof verifyTransactionPayment;
    jest.isolateModules(() => {
      freshVerify = require('../server/middleware/hybridPaymentMiddleware').verifyTransactionPayment;
    });
    return freshVerify!;
  }

  afterEach(() => {
    delete process.env.USDC_ROBINHOOD_ADDRESS;
  });

  it('returns verified=true for a valid USDC Transfer event to PLATFORM_WALLET', async () => {
    const freshVerify = loadFreshVerify();
    mockGetTransactionReceipt.mockResolvedValueOnce(makeTransferReceipt());

    const result = await freshVerify(DUMMY_TX_HASH, 'first-call', 50_000, 'robinhood');

    expect(result.verified).toBe(true);
    expect(result.chain).toBe('robinhood');
    expect(result.paymentToken).toBe('USDC');
  });

  it('returns verified=false when the Transfer recipient is not PLATFORM_WALLET', async () => {
    const freshVerify = loadFreshVerify();
    mockGetTransactionReceipt.mockResolvedValueOnce(
      makeTransferReceipt({ toAddress: '0xBadActorAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })
    );

    const result = await freshVerify(DUMMY_TX_HASH, 'first-call', 50_000, 'robinhood');

    expect(result.verified).toBe(false);
  });

  it('returns verified=false when the token address does not match the configured USDC address', async () => {
    const freshVerify = loadFreshVerify(FAKE_USDC_ROBINHOOD);
    const WRONG_TOKEN = '0xWrongContractAddress00000000000000000001';

    mockGetTransactionReceipt.mockResolvedValueOnce(
      makeTransferReceipt({ tokenAddress: WRONG_TOKEN })
    );

    const result = await freshVerify(DUMMY_TX_HASH, 'first-call', 50_000, 'robinhood');

    // The stablecoin filter rejects the wrong token — this is the silent-failure scenario
    // prevented by this test: if USDC_ROBINHOOD_ADDRESS is wrong, real transfers fail here.
    expect(result.verified).toBe(false);
  });

  it('returns verified=false when the payment amount is below the required threshold', async () => {
    const freshVerify = loadFreshVerify();
    mockGetTransactionReceipt.mockResolvedValueOnce(
      makeTransferReceipt({ amountMicroUsdc: 100 }) // 100 micro-USDC, required is 50_000
    );

    const result = await freshVerify(DUMMY_TX_HASH, 'first-call', 50_000, 'robinhood');

    expect(result.verified).toBe(false);
  });

  it('returns verified=false after all retries when the RPC never returns a receipt', async () => {
    const freshVerify = loadFreshVerify();
    mockGetTransactionReceipt.mockResolvedValue(null); // all 10 retries return null

    const result = await freshVerify(DUMMY_TX_HASH, 'first-call', 50_000, 'robinhood');

    expect(result.verified).toBe(false);
    // The RPC was queried multiple times (up to 10)
    expect(mockGetTransactionReceipt).toHaveBeenCalledTimes(10);
  });

  it('returns verified=false when the transaction receipt status indicates failure', async () => {
    const freshVerify = loadFreshVerify();
    mockGetTransactionReceipt.mockResolvedValueOnce(
      makeTransferReceipt({ status: 0 }) // reverted tx
    );

    const result = await freshVerify(DUMMY_TX_HASH, 'first-call', 50_000, 'robinhood');

    expect(result.verified).toBe(false);
  });
});

// ─── 4. 402 response accepts[] — Robinhood Chain gate ────────────────────────

describe('402 response accepts[] — Robinhood Chain gate via paymentOrchestrator', () => {
  let origEnv: Record<string, string | undefined>;

  beforeAll(() => {
    origEnv = {
      ROBINHOOD_CHAIN_CCTP_ENABLED: process.env.ROBINHOOD_CHAIN_CCTP_ENABLED,
      USDC_ROBINHOOD_ADDRESS: process.env.USDC_ROBINHOOD_ADDRESS,
    };
    // Speed up any internal retry loops
    jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    jest.restoreAllMocks();
  });

  function buildMockReqRes(serviceName = 'arbitrage-scanner') {
    const capture = { status: 0, body: null as any };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((body: any) => {
        capture.body = body;
        capture.status = 402;
        return res;
      }),
      setHeader: jest.fn(),
      getHeader: jest.fn().mockReturnValue(undefined),
      removeHeader: jest.fn(),
      locals: {},
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
    };
    const req: any = {
      headers: { host: 'localhost:3000' },
      query: {},
      method: 'GET',
      path: `/${serviceName}`,
      originalUrl: `/x402/${serviceName}`,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      bundleSubscription: undefined,
      cookies: {},
      session: {},
    };
    return { req, res, capture };
  }

  it('includes eip155:4663 in accepts[] when ROBINHOOD_CHAIN_CCTP_ENABLED=true and address is set', async () => {
    process.env.ROBINHOOD_CHAIN_CCTP_ENABLED = 'true';
    process.env.USDC_ROBINHOOD_ADDRESS = FAKE_USDC_ROBINHOOD;

    let orchestratorMod: any;
    jest.isolateModules(() => {
      orchestratorMod = require('../server/middleware/paymentOrchestrator');
    });

    const { createPaymentOrchestrator } = orchestratorMod;
    const middleware = createPaymentOrchestrator('arbitrage-scanner', 50_000, jest.fn());

    const { req, res, capture } = buildMockReqRes('arbitrage-scanner');
    await middleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(402);
    expect(capture.body?.accepts).toBeDefined();

    const robinhoodEntry = capture.body.accepts.find(
      (a: any) => a.x402Network === 'eip155:4663'
    );
    expect(robinhoodEntry).toBeDefined();
    expect(robinhoodEntry.asset).toBe(FAKE_USDC_ROBINHOOD);
    expect(robinhoodEntry.scheme).toBe('exact');

    delete process.env.ROBINHOOD_CHAIN_CCTP_ENABLED;
    delete process.env.USDC_ROBINHOOD_ADDRESS;
  });

  it('does NOT include eip155:4663 in accepts[] when ROBINHOOD_CHAIN_CCTP_ENABLED is not set', async () => {
    delete process.env.ROBINHOOD_CHAIN_CCTP_ENABLED;
    delete process.env.USDC_ROBINHOOD_ADDRESS;

    let orchestratorMod: any;
    jest.isolateModules(() => {
      orchestratorMod = require('../server/middleware/paymentOrchestrator');
    });

    const { createPaymentOrchestrator } = orchestratorMod;
    const middleware = createPaymentOrchestrator('arbitrage-scanner', 50_000, jest.fn());

    const { req, res, capture } = buildMockReqRes('arbitrage-scanner');
    await middleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(402);

    const robinhoodEntry = capture.body?.accepts?.find(
      (a: any) => a.x402Network === 'eip155:4663'
    );
    expect(robinhoodEntry).toBeUndefined();
  });

  it('does NOT include eip155:4663 when ROBINHOOD_CHAIN_CCTP_ENABLED=true but address is missing', async () => {
    process.env.ROBINHOOD_CHAIN_CCTP_ENABLED = 'true';
    delete process.env.USDC_ROBINHOOD_ADDRESS;

    let orchestratorMod: any;
    jest.isolateModules(() => {
      orchestratorMod = require('../server/middleware/paymentOrchestrator');
    });

    const { createPaymentOrchestrator } = orchestratorMod;
    const middleware = createPaymentOrchestrator('arbitrage-scanner', 50_000, jest.fn());

    const { req, res, capture } = buildMockReqRes('arbitrage-scanner');
    await middleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(402);

    const robinhoodEntry = capture.body?.accepts?.find(
      (a: any) => a.x402Network === 'eip155:4663'
    );
    expect(robinhoodEntry).toBeUndefined();

    delete process.env.ROBINHOOD_CHAIN_CCTP_ENABLED;
  });
});
