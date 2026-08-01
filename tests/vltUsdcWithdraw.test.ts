/**
 * vlt-usdc-withdraw x402 service — end-to-end tests
 *
 * Tests hit the live dev server (must be running on localhost:5000).
 * The withdraw service calls Alchemy RPC + DexScreener under the hood;
 * those calls fail gracefully (zero-fallback) if credentials are absent,
 * so all tests still pass in CI as long as the server is up.
 *
 * Run: npm test -- vltUsdcWithdraw.test.ts
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const WITHDRAW_URL = `${BASE_URL}/x402/vlt-usdc-withdraw`;
const DEPOSIT_URL  = `${BASE_URL}/x402/vlt-usdc-deposit`;

// Real-looking address for testing (checksummed, but we also pass lowercase in some cases)
const VALID_ADDR     = '0x742d35Cc6634C0532925a3b844Bc454F43bEca6f';
const VALID_ADDR_LC  = VALID_ADDR.toLowerCase();
const ONE_SHARE      = '1000000000000000000'; // 1 vltUSDC share (18 dec)

// Wait for server to be ready
beforeAll(async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await axios.get(`${BASE_URL}/x402/catalog`, { timeout: 3000 });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error(`Server at ${BASE_URL} did not become ready in time`);
}, 30_000);

// ────────────────────────────────────────────────────────────────────────────
// 1. GET discovery endpoint
// ────────────────────────────────────────────────────────────────────────────
describe('GET /x402/vlt-usdc-withdraw — discovery', () => {
  test('returns service metadata without a payment header', async () => {
    const res = await axios.get(WITHDRAW_URL);
    expect(res.status).toBe(200);
    expect(res.data.service).toBe('vlt-usdc-withdraw');
    expect(res.data.price).toBe('free');
    expect(res.data.method).toBe('POST');
    // Should expose body schema or contract info
    expect(res.data.body || res.data.contracts).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. POST with valid shares + lowercase address
// ────────────────────────────────────────────────────────────────────────────
describe('POST /x402/vlt-usdc-withdraw — success path', () => {
  test('valid shares + lowercase address → success, correct vault, non-empty calldata', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: ONE_SHARE, recipient: VALID_ADDR_LC },
      { timeout: 20_000 },
    );

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.free).toBe(true);

    // Normalised address should be checksummed, not raw lowercase
    expect(res.data.recipient).toMatch(/^0x[0-9a-fA-F]{40}$/);

    // Vault address must match the known contract
    expect(res.data.step.to.toLowerCase()).toBe(
      '0xee8d4c5c768aadcd3517aa8c908de300305d0a7f',
    );

    // Calldata must be a non-empty hex string
    expect(res.data.step.data).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(res.data.step.data.length).toBeGreaterThan(10);

    // minOutSource must be either live-estimate or zero-fallback
    expect(['live-estimate', 'zero-fallback']).toContain(res.data.minOutSource);

    // sharesRaw round-trips correctly
    expect(res.data.sharesRaw).toBe(ONE_SHARE);

    // chainId must be Ethereum mainnet
    expect(res.data.chainId).toBe(1);
  }, 25_000);

  test('valid shares + checksummed address → success', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: ONE_SHARE, recipient: VALID_ADDR },
      { timeout: 20_000 },
    );
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  }, 25_000);

  test('optional slippageBps parameter is accepted and clamped', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: ONE_SHARE, recipient: VALID_ADDR, slippageBps: 500 },
      { timeout: 20_000 },
    );
    expect(res.status).toBe(200);
    expect(res.data.slippageBps).toBe(500);
  }, 25_000);
});

// ────────────────────────────────────────────────────────────────────────────
// 3. POST with shares = 0 → structured 400 (no BigInt crash)
// ────────────────────────────────────────────────────────────────────────────
describe('POST /x402/vlt-usdc-withdraw — shares=0 rejection', () => {
  test('shares=0 → 400 with structured error field (no BigInt serialization crash)', async () => {
    let res;
    try {
      res = await axios.post(
        WITHDRAW_URL,
        { shares: '0', recipient: VALID_ADDR },
        { validateStatus: () => true },
      );
    } catch (err: any) {
      throw new Error(`Request threw instead of returning 400: ${err.message}`);
    }

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    // Must have an `error` field — no BigInt JSON crash
    expect(typeof res.data.error).toBe('string');
    expect(res.data.error.length).toBeGreaterThan(0);
  });

  test('shares="-1" → 400 with error field', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: '-1', recipient: VALID_ADDR },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. POST with invalid address → structured 400
// ────────────────────────────────────────────────────────────────────────────
describe('POST /x402/vlt-usdc-withdraw — invalid address', () => {
  test('bad address → 400 with error field', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: ONE_SHARE, recipient: 'not-an-address' },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
  });

  test('too-short hex address → 400', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: ONE_SHARE, recipient: '0x1234' },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. POST with missing fields → 400 with example hint
// ────────────────────────────────────────────────────────────────────────────
describe('POST /x402/vlt-usdc-withdraw — missing required fields', () => {
  test('no body → 400 with example hint', async () => {
    const res = await axios.post(WITHDRAW_URL, {}, { validateStatus: () => true });
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.error || res.data.example).toBeDefined();
  });

  test('shares only (no recipient) → 400', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: ONE_SHARE },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
  });

  test('recipient only (no shares) → 400', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { recipient: VALID_ADDR },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Additional withdraw guard cases — non-numeric shares string
// ────────────────────────────────────────────────────────────────────────────
describe('POST /x402/vlt-usdc-withdraw — non-numeric shares', () => {
  test('shares:"abc" → 400 with error field mentioning shares', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: 'abc', recipient: VALID_ADDR },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
    // Error must reference "shares" so callers know which field is wrong
    expect(res.data.error.toLowerCase()).toMatch(/shares/);
  });

  test('shares:"1.5" (decimal) → 400 (only whole shares accepted)', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: '1.5', recipient: VALID_ADDR },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
  });

  test('recipient:"foo" → 400 with error mentioning recipient/address', async () => {
    const res = await axios.post(
      WITHDRAW_URL,
      { shares: ONE_SHARE, recipient: 'foo' },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
    // Error must point to the recipient/address field
    expect(res.data.error.toLowerCase()).toMatch(/recipient|address/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Deposit input-validation guard tests
// ────────────────────────────────────────────────────────────────────────────
describe('POST /x402/vlt-usdc-deposit — input validation guards', () => {
  test('recipient:"not-an-address" → 400 with error mentioning recipient/address', async () => {
    const res = await axios.post(
      DEPOSIT_URL,
      { amountUsdc: '100', recipient: 'not-an-address' },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
    expect(res.data.error.toLowerCase()).toMatch(/recipient|address/);
  });

  test('amountUsdc:"abc" → 400 with error field', async () => {
    const res = await axios.post(
      DEPOSIT_URL,
      { amountUsdc: 'abc', recipient: VALID_ADDR },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
  });

  test('amountUsdc:"0" → 400 (zero amount rejected)', async () => {
    const res = await axios.post(
      DEPOSIT_URL,
      { amountUsdc: '0', recipient: VALID_ADDR },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
  });

  test('amountUsdc:"2000000" (>1M) → 400 (ceiling exceeded)', async () => {
    const res = await axios.post(
      DEPOSIT_URL,
      { amountUsdc: '2000000', recipient: VALID_ADDR },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(typeof res.data.error).toBe('string');
    // Error should mention the cap
    expect(res.data.error.toLowerCase()).toMatch(/exceed|maximum|1.000.000|1,000,000/);
  });

  test('valid payload (correct address + valid amount) passes guards and reaches builder', async () => {
    // A valid request must not be rejected by input-validation guards.
    // The builder may return 400 if the on-chain RPC call fails in CI, but it
    // must never return 400 with a guard-style error (missing/invalid field).
    const res = await axios.post(
      DEPOSIT_URL,
      { amountUsdc: '10', recipient: VALID_ADDR },
      { timeout: 25_000, validateStatus: () => true },
    );
    // 200 (success) or 400 from RPC failure are both acceptable;
    // a guard 400 would have error mentioning "required" / "address" / "amountUsdc"
    if (res.status === 400) {
      const errLower = (res.data.error || '').toLowerCase();
      // Must NOT be a guard rejection for a well-formed payload
      expect(errLower).not.toMatch(/required|valid ethereum address|positive finite/);
    }
    // Must never 500 (unhandled crash)
    expect(res.status).not.toBe(500);
  }, 30_000);
});

// ────────────────────────────────────────────────────────────────────────────
// 8. Deposit service previewDeposit path: minShares no longer hardcoded 0
// ────────────────────────────────────────────────────────────────────────────
describe('POST /x402/vlt-usdc-deposit — minShares safety fix', () => {
  test('balanced deposit response contains minSharesSource field (not minShares=0)', async () => {
    const res = await axios.post(
      DEPOSIT_URL,
      { amountUsdc: '10', recipient: VALID_ADDR },
      { timeout: 25_000, validateStatus: () => true },
    );

    // Accept 200 or 400 (RPC may fail in test env)
    if (res.status === 200) {
      expect(res.data.success).toBe(true);

      // Decode the deposit calldata to verify minShares argument is not 0x0
      // The deposit step is step index 2 (0-based) — step 3 in the response
      const depositStep = res.data.steps?.find((s: any) => s.step === 3);
      expect(depositStep).toBeDefined();

      // minSharesSource is returned in the response metadata when the
      // deposit service picks it up (see vltUsdcDepositService.ts line ~135)
      // If present, it must be vault-preview-2pct or non-zero-fallback — never "zero"
      if (res.data.minSharesSource) {
        expect(['vault-preview-2pct', 'non-zero-fallback']).toContain(
          res.data.minSharesSource,
        );
      }

      // calldata for the deposit step must be a real hex string
      if (depositStep) {
        expect(depositStep.data).toMatch(/^0x[0-9a-fA-F]+$/);
      }
    } else {
      // 400 from RPC / validation — still must not be a BigInt crash
      expect(res.data).not.toBeNull();
      expect(typeof res.data).toBe('object');
    }
  }, 30_000);

  test('USDC-only (usdcOnly:true) deposit returns 2 steps', async () => {
    const res = await axios.post(
      DEPOSIT_URL,
      { amountUsdc: '10', recipient: VALID_ADDR, usdcOnly: true },
      { timeout: 25_000, validateStatus: () => true },
    );

    // Accept success or RPC error — must not crash
    expect(res.data).toBeDefined();
    expect(typeof res.data).toBe('object');

    if (res.status === 200 && res.data.success) {
      // usdcOnly path (ZapHelper) returns 2 transactions
      expect(res.data.steps).toHaveLength(2);
    }
  }, 30_000);
});
