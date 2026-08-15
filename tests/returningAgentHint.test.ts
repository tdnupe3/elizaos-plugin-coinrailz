/**
 * returning_agent_hint — integration tests
 *
 * Verifies that generate402Response injects a `returning_agent_hint` when
 * the requesting IP has ≥ 1 prior paid row in x402_interactions.
 *
 * Tests hit the live dev server (must be running on localhost:5000).
 *
 * Background:
 *   IP 74.220.48.244 is associated with wallet 0x9cc42f3d9245b867acccd630b43f906c1665b176,
 *   which made 188 paid calls (Jun–Jul 2026) and then went silent after the wallet depleted.
 *   The hint tells the agent exactly which wallet to top up and how.
 *
 * Run: npm test -- returningAgentHint.test.ts
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

// IP with confirmed paid history in the DB (188 rows, wallet 0x9cc42f3d…)
const DEPLETED_IP = '74.220.48.244';
// IP with no payment history — hint must NOT appear
const UNKNOWN_IP  = '1.2.3.4';

// Service the depleted agent was known to call
const TEST_SERVICE = '/x402/construction-progress';

/** Issue an unauthenticated POST (no X-PAYMENT header) from a given IP */
async function post402(ip: string, path: string): Promise<AxiosResponse> {
  return axios.post(`${BASE_URL}${path}`, { query: 'test' }, {
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': ip,
    },
    // Axios throws on non-2xx; tell it not to so we can inspect the 402 body
    validateStatus: () => true,
    timeout: 15_000,
  });
}

// ─── server readiness ─────────────────────────────────────────────────────────

beforeAll(async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await axios.get(`${BASE_URL}/x402/catalog`, { timeout: 3000, validateStatus: () => true });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 2_000));
    }
  }
  throw new Error(`Server at ${BASE_URL} did not become ready in time`);
}, 30_000);

// ─── tests ────────────────────────────────────────────────────────────────────

describe('returning_agent_hint — depleted wallet (74.220.48.244)', () => {
  let res: AxiosResponse;

  beforeAll(async () => {
    res = await post402(DEPLETED_IP, TEST_SERVICE);
  }, 20_000);

  test('response is a 402 Payment Required', () => {
    expect(res.status).toBe(402);
  });

  test('returning_agent_hint is present in the 402 body', () => {
    expect(res.data).toHaveProperty('returning_agent_hint');
    expect(res.data.returning_agent_hint).not.toBeNull();
  });

  test('returning_agent_hint.wallet matches the known depleted wallet (0x9cc42f3d…)', () => {
    const hint = res.data.returning_agent_hint;
    expect(typeof hint.wallet).toBe('string');
    expect(hint.wallet.toLowerCase()).toMatch(/^0x9cc42f3d/i);
  });

  test('returning_agent_hint.prior_payment_count is ≥ 1', () => {
    const hint = res.data.returning_agent_hint;
    expect(typeof hint.prior_payment_count).toBe('number');
    expect(hint.prior_payment_count).toBeGreaterThanOrEqual(1);
  });

  test('returning_agent_hint.message mentions the wallet and instructs a top-up', () => {
    const hint = res.data.returning_agent_hint;
    expect(typeof hint.message).toBe('string');
    // Must reference the wallet and the "depleted" / "fund" concept
    expect(hint.message.toLowerCase()).toMatch(/depleted|fund/);
    expect(hint.message).toContain(hint.wallet);
  });

  test('returning_agent_hint.top_up_steps is a non-empty array', () => {
    const hint = res.data.returning_agent_hint;
    expect(Array.isArray(hint.top_up_steps)).toBe(true);
    expect(hint.top_up_steps.length).toBeGreaterThan(0);
    // Steps must mention the wallet address
    const stepsText = hint.top_up_steps.join('\n');
    expect(stepsText).toContain(hint.wallet);
  });
});

describe('returning_agent_hint — unknown IP (no prior payments)', () => {
  let res: AxiosResponse;

  beforeAll(async () => {
    res = await post402(UNKNOWN_IP, TEST_SERVICE);
  }, 20_000);

  test('response is a 402 Payment Required', () => {
    expect(res.status).toBe(402);
  });

  test('returning_agent_hint is absent for an IP with no payment history', () => {
    // The hint field must be missing or null for a new/unknown IP
    const hint = res.data.returning_agent_hint;
    expect(hint == null).toBe(true);
  });
});

describe('returning_agent_hint — structure always valid on any 402', () => {
  test('402 body has x402Version, error, and trial_access regardless of hint', async () => {
    const res = await post402(UNKNOWN_IP, TEST_SERVICE);
    expect(res.data).toHaveProperty('x402Version');
    expect(res.data).toHaveProperty('error');
    expect(res.data).toHaveProperty('trial_access');
  });
});
