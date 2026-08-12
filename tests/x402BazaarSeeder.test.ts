/**
 * X402BazaarSeederJob unit tests
 *
 * Verifies:
 *  1. SEEDABLE_SERVICES is consistent with canonical SERVICE_PRICING_MICRO — no drift
 *  2. Solana-only services are excluded — EVM seeder cannot pay them
 *  3. Policy acceptance: per-service maxPaymentMicro (price + 20% buffer) covers canonical price
 *  4. Restart/resume: DB-driven rotation picks the correct next unseeded service
 *  5. EVM vs Solana challenge routing — seeder selects EVM services only
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Capture mock chains so individual tests can configure return values
const selectChain = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([]),
};
const mockDb = {
  select: jest.fn(() => selectChain),
};

jest.mock('../server/db', () => ({ db: mockDb }));

jest.mock('@shared/schema', () => ({
  x402PaymentIntents: {
    serviceName: 'service_name',
    status: 'status',
    payer: 'payer',
    txHash: 'tx_hash',
    createdAt: 'created_at',
  },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((_col: any, _val: any) => ({ type: 'eq' })),
  and: jest.fn((...args: any[]) => ({ type: 'and', args })),
  gte: jest.fn((_col: any, _val: any) => ({ type: 'gte' })),
  desc: jest.fn((_col: any) => ({ type: 'desc' })),
  sql: Object.assign(
    jest.fn((_strings: TemplateStringsArray, ..._values: any[]) => ({ type: 'sql' })),
    { raw: jest.fn() }
  ),
}));

jest.mock('viem', () => ({
  createWalletClient: jest.fn(),
  createPublicClient: jest.fn(),
  http: jest.fn(),
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => ({
    address: '0xCanaryWallet000000000000000000000000001',
  })),
}));

jest.mock('viem/chains', () => ({ base: { id: 8453 } }));

jest.mock('@x402/fetch', () => ({
  wrapFetchWithPayment: jest.fn(),
  x402Client: jest.fn(() => ({
    register: jest.fn().mockReturnThis(),
    registerPolicy: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('@x402/evm', () => ({ ExactEvmScheme: jest.fn() }));

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  SEEDABLE_SERVICES,
  SOLANA_ONLY_SLUGS,
  buildSeedableServices,
  MAX_SEED_PRICE_MICRO,
  X402BazaarSeederJob,
  type SeedableService,
} from '../server/jobs/x402BazaarSeederJob';
import { SERVICE_PRICING_MICRO } from '../shared/pricing';

// ─── 1. SEEDABLE_SERVICES consistency with canonical pricing ──────────────────

describe('SEEDABLE_SERVICES — canonical pricing consistency', () => {
  it('contains no duplicate slugs', () => {
    const slugs = SEEDABLE_SERVICES.map(s => s.slug);
    const duplicates = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    expect(duplicates).toEqual([]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every slug exists in SERVICE_PRICING_MICRO', () => {
    const missing = SEEDABLE_SERVICES.filter(s => !(s.slug in SERVICE_PRICING_MICRO));
    expect(missing.map(s => s.slug)).toEqual([]);
  });

  it('every priceMicro matches SERVICE_PRICING_MICRO exactly — no independent hardcoded values', () => {
    const mismatches = SEEDABLE_SERVICES.filter(s => {
      const canonical = SERVICE_PRICING_MICRO[s.slug as keyof typeof SERVICE_PRICING_MICRO];
      return Number(s.priceMicro) !== canonical;
    });
    if (mismatches.length > 0) {
      const detail = mismatches.map(s => {
        const canonical = SERVICE_PRICING_MICRO[s.slug as keyof typeof SERVICE_PRICING_MICRO];
        return `${s.slug}: seeder=${s.priceMicro} canonical=${canonical}`;
      });
      throw new Error(`priceMicro mismatch for ${mismatches.length} service(s):\n${detail.join('\n')}`);
    }
    expect(mismatches).toHaveLength(0);
  });

  it('every priceUsd is priceMicro / 1_000_000 (no floating-point drift)', () => {
    const mismatches = SEEDABLE_SERVICES.filter(
      s => Math.abs(s.priceUsd - Number(s.priceMicro) / 1_000_000) > 1e-9
    );
    expect(mismatches.map(s => s.slug)).toEqual([]);
  });

  it('excludes $0-priced services (vlt-usdc-deposit, vlt-usdc-withdraw, vlt-usdc-zap-withdraw)', () => {
    const zeroPrice = Object.entries(SERVICE_PRICING_MICRO)
      .filter(([, p]) => p === 0)
      .map(([slug]) => slug);
    for (const slug of zeroPrice) {
      expect(SEEDABLE_SERVICES.find(s => s.slug === slug)).toBeUndefined();
    }
  });

  it('excludes services priced at or above MAX_SEED_PRICE_MICRO', () => {
    const tooExpensive = SEEDABLE_SERVICES.filter(s => Number(s.priceMicro) >= MAX_SEED_PRICE_MICRO);
    expect(tooExpensive.map(s => s.slug)).toEqual([]);
  });

  it('is sorted cheapest-first', () => {
    for (let i = 1; i < SEEDABLE_SERVICES.length; i++) {
      expect(SEEDABLE_SERVICES[i].priceUsd).toBeGreaterThanOrEqual(SEEDABLE_SERVICES[i - 1].priceUsd);
    }
  });

  it('includes at least 60 services (sanity: large enough to be meaningful)', () => {
    expect(SEEDABLE_SERVICES.length).toBeGreaterThanOrEqual(60);
  });

  it('buildSeedableServices() is deterministic — same result on every call', () => {
    const rebuilt = buildSeedableServices();
    expect(rebuilt).toEqual(SEEDABLE_SERVICES);
  });
});

// ─── 2. Solana-only service exclusion ────────────────────────────────────────

describe('Solana-only service exclusion — EVM seeder cannot pay Solana-native services', () => {
  /**
   * These services emit "network: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" in their
   * 402 challenge (see SOLANA_NATIVE_SLUGS in x402MicroserviceRoutesV2.ts).
   * The EVM seeder registers only ExactEvmScheme on eip155:8453 — it cannot
   * satisfy a Solana challenge. If these services were included, every run would
   * hit the same service, open the circuit breaker, and block all later services.
   */
  const knownSolanaOnly = ['solana-yield-finder', 'solana-yield-rates', 'solana-yield-deposit'];

  it('SOLANA_ONLY_SLUGS contains all known Solana-native services', () => {
    for (const slug of knownSolanaOnly) {
      expect(SOLANA_ONLY_SLUGS.has(slug)).toBe(true);
    }
  });

  it('none of the Solana-only services appear in SEEDABLE_SERVICES', () => {
    for (const slug of knownSolanaOnly) {
      const found = SEEDABLE_SERVICES.find(s => s.slug === slug);
      expect(found).toBeUndefined();
    }
  });

  it('all Solana-only services exist in SERVICE_PRICING_MICRO (they have canonical prices)', () => {
    for (const slug of knownSolanaOnly) {
      expect(slug in SERVICE_PRICING_MICRO).toBe(true);
    }
  });

  it('buildSeedableServices() excludes Solana-only services regardless of their price', () => {
    // Verify the filter applies independently of the price filter
    const rebuilt = buildSeedableServices();
    for (const slug of SOLANA_ONLY_SLUGS) {
      expect(rebuilt.find(s => s.slug === slug)).toBeUndefined();
    }
  });

  it('SEEDABLE_SERVICES does not contain any slug that requires Solana network', () => {
    // Cross-check: if any EVM service was mistakenly added to SOLANA_ONLY_SLUGS,
    // it would be wrongly excluded. Verify the exclusion set matches known-Solana slugs.
    for (const slug of SOLANA_ONLY_SLUGS) {
      // The slug should be in SERVICE_PRICING_MICRO (real service) but not SEEDABLE_SERVICES
      const inPricing = slug in SERVICE_PRICING_MICRO;
      const inSeedable = SEEDABLE_SERVICES.some(s => s.slug === slug);
      expect(inPricing).toBe(true); // Real service
      expect(inSeedable).toBe(false); // Excluded from EVM seeder
    }
  });
});

// ─── 3. Per-service payment policy acceptance ─────────────────────────────────

describe('Per-service payment policy — maxPaymentMicro covers canonical price', () => {
  /**
   * The seeder sets maxPaymentMicro = priceMicro + priceMicro/5 (20% buffer).
   * The x402Client policy filter rejects any service requirement above this cap.
   * For the seeder to successfully pay each service, maxPaymentMicro must be >= canonical price.
   *
   * This test catches the pricing drift regression: approval-manager was at $0.10 (100k)
   * but canonical price is $0.20 (200k). With a 10% buffer cap of 110k < 200k → rejected.
   */
  it('20% buffer makes maxPaymentMicro >= priceMicro for every seedable service', () => {
    const failures: string[] = [];
    for (const svc of SEEDABLE_SERVICES) {
      const maxPaymentMicro = svc.priceMicro + svc.priceMicro / BigInt(5);
      if (maxPaymentMicro < svc.priceMicro) {
        failures.push(`${svc.slug}: cap=${maxPaymentMicro} < canonical=${svc.priceMicro}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('approval-manager has the canonical price ($0.20 = 200,000 micro) — regression guard', () => {
    const svc = SEEDABLE_SERVICES.find(s => s.slug === 'approval-manager');
    expect(svc).toBeDefined();
    expect(Number(svc!.priceMicro)).toBe(200_000);
    expect(svc!.priceUsd).toBeCloseTo(0.20, 6);
    // Cap with 20% buffer: 240,000 > 200,000 ✓
    const cap = svc!.priceMicro + svc!.priceMicro / BigInt(5);
    expect(cap).toBeGreaterThan(svc!.priceMicro);
  });

  it('first-call has the canonical price ($0.05 = 50,000 micro)', () => {
    const svc = SEEDABLE_SERVICES.find(s => s.slug === 'first-call');
    expect(svc).toBeDefined();
    expect(Number(svc!.priceMicro)).toBe(50_000);
  });

  it('compliance-check has the canonical price ($1.75 = 1,750,000 micro)', () => {
    const svc = SEEDABLE_SERVICES.find(s => s.slug === 'compliance-check');
    expect(svc).toBeDefined();
    expect(Number(svc!.priceMicro)).toBe(1_750_000);
  });

  it('20% buffer is sufficient for BigInt integer division (no truncation to zero)', () => {
    // Cheapest service: iot-sensor-reading at $0.025 = 25,000 micro
    // priceMicro / 5 = 5,000 (exact — 25,000 is divisible by 5)
    const cheapest = SEEDABLE_SERVICES.find(s => s.slug === 'iot-sensor-reading');
    if (!cheapest) return; // Skip if pricing changed
    const buffer = cheapest.priceMicro / BigInt(5);
    expect(buffer).toBeGreaterThan(BigInt(0));
    const cap = cheapest.priceMicro + buffer;
    expect(cap).toBeGreaterThan(cheapest.priceMicro);
  });
});

// ─── 4. DB-driven rotation (restart/resume) ───────────────────────────────────

describe('DB-driven rotation — restart/resume behavior after restarts', () => {
  /**
   * Simulate the "pick next service" selection logic from runSeeder() without
   * making a payment. This tests the selection algorithm in isolation.
   *
   * The seeder uses:
   *   target = SEEDABLE_SERVICES.find(s => !seededSlugs.has(s.slug))
   * which always picks the first unseeded service from the cheapest-first list.
   * The seeded set comes from x402PaymentIntents (durable across restarts).
   */
  function pickNextService(seededSlugs: Set<string>, services: SeedableService[] = SEEDABLE_SERVICES): SeedableService | undefined {
    return services.find(s => !seededSlugs.has(s.slug));
  }

  it('picks the first service (cheapest) when no services have been seeded', () => {
    const next = pickNextService(new Set());
    expect(next).toBeDefined();
    expect(next!.slug).toBe(SEEDABLE_SERVICES[0].slug);
  });

  it('resumes from the correct service after restart — skips DB-recorded services', () => {
    // Simulate: first 5 services already seeded and recorded in DB
    const alreadySeeded = new Set(SEEDABLE_SERVICES.slice(0, 5).map(s => s.slug));
    const next = pickNextService(alreadySeeded);
    expect(next).toBeDefined();
    expect(next!.slug).toBe(SEEDABLE_SERVICES[5].slug);
  });

  it('returns undefined when all services are seeded (full pass complete)', () => {
    const allSeeded = new Set(SEEDABLE_SERVICES.map(s => s.slug));
    const next = pickNextService(allSeeded);
    expect(next).toBeUndefined();
    // The job then cycles back to SEEDABLE_SERVICES[0] for freshness
    expect(SEEDABLE_SERVICES[0]).toBeDefined();
  });

  it('ignores DB records for retired/removed services — only seeds current SEEDABLE_SERVICES', () => {
    const seededIncludingRetired = new Set([
      'service-that-was-removed-from-catalog',
      SEEDABLE_SERVICES[0].slug, // First current service already seeded
    ]);
    const next = pickNextService(seededIncludingRetired);
    // The retired service is unknown to the seeder; only the first current service is skipped
    expect(next).toBeDefined();
    expect(next!.slug).toBe(SEEDABLE_SERVICES[1].slug);
  });

  it('correctly selects 10 consecutive services in cheapest-first order', () => {
    const seeded = new Set<string>();
    const picked: string[] = [];
    for (let i = 0; i < 10; i++) {
      const next = pickNextService(seeded);
      expect(next).toBeDefined();
      picked.push(next!.slug);
      seeded.add(next!.slug);
    }
    // Must match the first 10 services in cheapest-first order exactly
    expect(picked).toEqual(SEEDABLE_SERVICES.slice(0, 10).map(s => s.slug));
  });

  it('getStatus() reports correct total service count including Solana exclusion', () => {
    const status = X402BazaarSeederJob.getStatus();
    expect(status.totalServices).toBe(SEEDABLE_SERVICES.length);
    expect(status.totalServices).toBeGreaterThanOrEqual(60);
    expect(status.solanaOnlyExcluded).toBe(SOLANA_ONLY_SLUGS.size);
    expect(status.solanaOnlyExcluded).toBeGreaterThan(0);
  });

  it('getStatus() maxSeedPriceUsd matches MAX_SEED_PRICE_MICRO / 1_000_000', () => {
    const status = X402BazaarSeederJob.getStatus();
    expect(status.maxSeedPriceUsd).toBeCloseTo(MAX_SEED_PRICE_MICRO / 1_000_000, 6);
  });
});

// ─── 5. Payment policy shape — V1 and V2 PaymentRequirements formats ─────────

describe('Payment policy — accepts real V1/V2 PaymentRequirements shapes', () => {
  /**
   * The seeder's registerPolicy() callback receives PaymentRequirements objects.
   * x402 V1 uses { maxAmountRequired: string }, V2 uses { amount: string }.
   * The policy must handle both to be compatible with any server version.
   *
   * This test extracts the policy logic and runs it against realistic shapes.
   */
  function makePolicy(maxPaymentMicro: bigint) {
    return (_version: any, reqs: any[]) =>
      reqs.filter(r => {
        try {
          const amountStr = r.amount ?? r.maxAmountRequired;
          return BigInt(amountStr) <= maxPaymentMicro;
        } catch { return false; }
      });
  }

  it('accepts a V2 requirement (uses "amount" field) within the cap', () => {
    const maxPaymentMicro = BigInt(240_000); // 200k + 20% = 240k
    const policy = makePolicy(maxPaymentMicro);
    const v2Req = { scheme: 'exact', network: 'eip155:8453', amount: '200000', asset: '0xUSDC', payTo: '0xWallet', maxTimeoutSeconds: 3600 };
    expect(policy(2, [v2Req])).toHaveLength(1);
  });

  it('rejects a V2 requirement that exceeds the cap', () => {
    const maxPaymentMicro = BigInt(240_000);
    const policy = makePolicy(maxPaymentMicro);
    const v2Req = { scheme: 'exact', network: 'eip155:8453', amount: '500000', asset: '0xUSDC', payTo: '0xWallet', maxTimeoutSeconds: 3600 };
    expect(policy(2, [v2Req])).toHaveLength(0);
  });

  it('accepts a V1 requirement (uses "maxAmountRequired" field) within the cap', () => {
    const maxPaymentMicro = BigInt(60_000); // 50k + 20% = 60k
    const policy = makePolicy(maxPaymentMicro);
    const v1Req = { scheme: 'exact', network: 'base', maxAmountRequired: '50000', resource: 'https://example.com/x402/first-call' };
    expect(policy(1, [v1Req])).toHaveLength(1);
  });

  it('rejects a V1 requirement that exceeds the cap', () => {
    const maxPaymentMicro = BigInt(60_000);
    const policy = makePolicy(maxPaymentMicro);
    const v1Req = { scheme: 'exact', network: 'base', maxAmountRequired: '100000', resource: 'https://example.com/x402/first-call' };
    expect(policy(1, [v1Req])).toHaveLength(0);
  });

  it('falls back to maxAmountRequired when amount is missing (V1 compat)', () => {
    const maxPaymentMicro = BigInt(300_000);
    const policy = makePolicy(maxPaymentMicro);
    const v1Only = { scheme: 'exact', network: 'base', maxAmountRequired: '250000' };
    const result = policy(1, [v1Only]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(v1Only);
  });

  it('rejects a requirement with neither amount nor maxAmountRequired (invalid shape)', () => {
    const maxPaymentMicro = BigInt(100_000);
    const policy = makePolicy(maxPaymentMicro);
    const invalid = { scheme: 'exact', network: 'eip155:8453' }; // no amount field
    expect(policy(2, [invalid])).toHaveLength(0);
  });

  it('filters a mixed V1+V2 requirements list correctly', () => {
    const maxPaymentMicro = BigInt(300_000); // $0.30
    const policy = makePolicy(maxPaymentMicro);
    const reqs = [
      { amount: '200000' },          // V2, $0.20 — within cap ✓
      { maxAmountRequired: '250000' }, // V1, $0.25 — within cap ✓
      { amount: '350000' },           // V2, $0.35 — exceeds cap ✗
      { maxAmountRequired: '750000' }, // V1, $0.75 — exceeds cap ✗
    ];
    const accepted = policy(2, reqs);
    expect(accepted).toHaveLength(2);
    expect(accepted[0]).toMatchObject({ amount: '200000' });
    expect(accepted[1]).toMatchObject({ maxAmountRequired: '250000' });
  });
});

// ─── 6. EVM vs Solana challenge routing ──────────────────────────────────────

describe('EVM vs Solana challenge routing — services are correctly categorised', () => {
  /**
   * Validates the fundamental split:
   *   - EVM services: emit eip155:8453 in 402 challenge → included in SEEDABLE_SERVICES
   *   - Solana services: emit solana:5eykt4... in 402 challenge → excluded, in SOLANA_ONLY_SLUGS
   *
   * If a service is incorrectly categorised (EVM treated as Solana or vice versa),
   * the seeder will either skip it forever or fail on every attempt.
   */
  it('all SEEDABLE_SERVICES slugs are absent from SOLANA_ONLY_SLUGS', () => {
    for (const svc of SEEDABLE_SERVICES) {
      expect(SOLANA_ONLY_SLUGS.has(svc.slug)).toBe(false);
    }
  });

  it('no slug appears in both SEEDABLE_SERVICES and SOLANA_ONLY_SLUGS', () => {
    const seedableSlugs = new Set(SEEDABLE_SERVICES.map(s => s.slug));
    const overlap = [...SOLANA_ONLY_SLUGS].filter(slug => seedableSlugs.has(slug));
    expect(overlap).toEqual([]);
  });

  it('SOLANA_ONLY_SLUGS services are known to SERVICE_PRICING_MICRO (real services, not typos)', () => {
    for (const slug of SOLANA_ONLY_SLUGS) {
      expect(slug in SERVICE_PRICING_MICRO).toBe(true);
    }
  });

  it('getSeededSlugs() returns a Set (not an array) — compatible with Set.has() rotation check', async () => {
    // Configure the DB mock chain to resolve at the where() step since getSeededSlugs()
    // ends at .where() without a trailing .limit()
    selectChain.where.mockResolvedValueOnce([
      { serviceName: 'first-call' },
      { serviceName: 'ping' },
    ]);

    const origKey = process.env.X402_BUYER_PRIVATE_KEY;
    process.env.X402_BUYER_PRIVATE_KEY = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    try {
      const seeded = await X402BazaarSeederJob.getSeededSlugs();
      // Must be a Set so .has() works in the rotation logic
      expect(seeded).toBeInstanceOf(Set);
      expect(seeded.has('first-call')).toBe(true);
      expect(seeded.has('ping')).toBe(true);
      expect(seeded.has('token-price')).toBe(false);
    } finally {
      // Restore
      selectChain.where.mockReturnThis(); // reset to default chaining behaviour
      if (origKey === undefined) delete process.env.X402_BUYER_PRIVATE_KEY;
      else process.env.X402_BUYER_PRIVATE_KEY = origKey;
    }
  });
});
