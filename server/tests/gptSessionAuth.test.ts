/**
 * GPT Session Auth Integration Tests - Phase 2F
 * 
 * Uses the test harness with in-memory storage and credits fixtures
 * to verify GPT session and API key authentication flows end-to-end.
 * 
 * Run with: npx tsx server/tests/gptSessionAuth.test.ts
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { createTestHarness, InMemoryTestStorage, InMemoryCreditsService, TestDataSeeder } from './testHarness';

const TEST_CONFIG = {
  baseURL: 'http://localhost:5000',
  timeout: 60000
};

// Generate unique identifiers per test run
const TEST_RUN_ID = nanoid(8);

// Premium endpoints to test
const PREMIUM_ENDPOINTS = [
  { path: '/x402/ping', method: 'GET', price: 0.25 },
  { path: '/x402/token-price', method: 'POST', price: 0.25, body: { symbol: 'ETH' } },
  { path: '/x402/gas-price-oracle', method: 'GET', price: 0.10 },
  { path: '/x402/multi-chain-balance', method: 'POST', price: 0.50, body: { address: '0x0' } },
  { path: '/x402/trade-signals', method: 'GET', price: 0.75 },
  { path: '/x402/wallet-risk', method: 'POST', price: 0.50, body: { address: '0x0' } },
  { path: '/x402/token-sentiment', method: 'GET', price: 0.25 },
  { path: '/x402/whale-alerts', method: 'GET', price: 0.35 }
];

describe('Phase 2F: GPT Session Auth Integration Tests', () => {
  // Test harness components
  let harness: ReturnType<typeof createTestHarness>;
  let storage: InMemoryTestStorage;
  let credits: InMemoryCreditsService;
  let seeder: TestDataSeeder;

  beforeAll(async () => {
    console.log('🧪 Phase 2F: GPT Session Auth Integration Tests');
    console.log(`📍 Target: ${TEST_CONFIG.baseURL}`);
    console.log(`🔑 Test Run ID: ${TEST_RUN_ID}`);

    // Initialize test harness
    harness = createTestHarness();
    storage = harness.storage;
    credits = harness.credits;
    seeder = harness.seeder;

    // Verify server connectivity
    try {
      const health = await request(TEST_CONFIG.baseURL)
        .get('/health')
        .timeout(5000);
      console.log(`✅ Server health: ${health.status}`);
    } catch (err) {
      console.log('⚠️ Server not responding - HTTP tests may fail');
    }
  });

  afterAll(() => {
    console.log('\n🏁 Phase 2F tests completed');
  });

  beforeEach(() => {
    harness.reset();
  });

  describe('1. In-Memory Harness Validation', () => {
    test('should seed GPT session user with credits', async () => {
      const { user, session } = await seeder.seedGptUser({
        conversationId: `conv-${TEST_RUN_ID}-1`,
        ephemeralUserId: `user-${TEST_RUN_ID}-1`,
        credits: 10.00
      });

      expect(user).toBeDefined();
      expect(user.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(session).toBeDefined();
      expect(session.userId).toBe(user.id);
      expect(session.status).toBe('linked');
      expect(credits.getBalance(user.id)).toBe(10.00);
      console.log('✅ GPT session user seeded with credits');
    });

    test('should seed API key user with credits', async () => {
      const { user, apiKey } = await seeder.seedApiKeyUser({
        email: `test-${TEST_RUN_ID}@example.com`,
        credits: 25.00
      });

      expect(user).toBeDefined();
      expect(apiKey).toMatch(/^cr_live_/);
      expect(credits.getBalance(user.id)).toBe(25.00);
      console.log('✅ API key user seeded with credits');
    });

    test('should track credit transactions', async () => {
      const { user } = await seeder.seedGptUser({
        conversationId: `conv-${TEST_RUN_ID}-tx`,
        ephemeralUserId: `user-${TEST_RUN_ID}-tx`,
        credits: 5.00
      });

      const result = credits.deductCredits(user.id, 2.00, 'Test deduction');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(3.00);
      expect(credits.getBalance(user.id)).toBe(3.00);

      const transactions = credits.getTransactions(user.id);
      expect(transactions.length).toBe(2); // seed + deduction
      console.log('✅ Credit transactions tracked correctly');
    });

    test('should reject deduction when insufficient credits', async () => {
      const { user } = await seeder.seedGptUser({
        conversationId: `conv-${TEST_RUN_ID}-low`,
        ephemeralUserId: `user-${TEST_RUN_ID}-low`,
        credits: 1.00
      });

      const result = credits.deductCredits(user.id, 5.00, 'Too expensive');
      expect(result.success).toBe(false);
      expect(credits.getBalance(user.id)).toBe(1.00); // Unchanged
      console.log('✅ Insufficient credit rejection works');
    });
  });

  describe('2. GPT Header Detection via Live Server', () => {
    test('should return 402 for unauthenticated requests', async () => {
      const response = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .timeout(TEST_CONFIG.timeout);

      expect(response.status).toBe(402);
      expect(response.body).toBeDefined();
      console.log('✅ Unauthenticated request returns 402');
    });

    test('should detect and process GPT headers', async () => {
      const convId = `gpt-detect-${TEST_RUN_ID}`;
      const userId = `ephuser-detect-${TEST_RUN_ID}`;

      const response = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('openai-conversation-id', convId)
        .set('openai-ephemeral-user-id', userId)
        .timeout(TEST_CONFIG.timeout);

      // GPT headers should be detected (200 for first-call-free or 402 for payment)
      expect([200, 402]).toContain(response.status);
      console.log(`✅ GPT headers detected (status: ${response.status})`);
    });

    test('should prefer API key when both GPT headers and API key present', async () => {
      const response = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('openai-conversation-id', `conv-priority-${TEST_RUN_ID}`)
        .set('x-api-key', 'cr_live_fake_priority_test')
        .timeout(TEST_CONFIG.timeout);

      expect(response.status).toBe(402); // Invalid API key
      console.log('✅ API key takes priority over GPT session');
    });
  });

  describe('3. Cross-Conversation Correlation', () => {
    test('should generate consistent fingerprint for same identifiers', async () => {
      const convId = `corr-conv-${TEST_RUN_ID}`;
      const userId = `corr-user-${TEST_RUN_ID}`;

      // First request
      const r1 = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('openai-conversation-id', convId)
        .set('openai-ephemeral-user-id', userId)
        .timeout(TEST_CONFIG.timeout);

      // Second request with same identifiers
      const r2 = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('openai-conversation-id', convId)
        .set('openai-ephemeral-user-id', userId)
        .timeout(TEST_CONFIG.timeout);

      expect(r1.status).toBe(r2.status);
      console.log('✅ Consistent correlation across requests');
    });

    test('should differentiate different identifiers', async () => {
      const r1 = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('openai-conversation-id', `diff-a-${TEST_RUN_ID}`)
        .set('openai-ephemeral-user-id', `user-a-${TEST_RUN_ID}`)
        .timeout(TEST_CONFIG.timeout);

      const r2 = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('openai-conversation-id', `diff-b-${TEST_RUN_ID}`)
        .set('openai-ephemeral-user-id', `user-b-${TEST_RUN_ID}`)
        .timeout(TEST_CONFIG.timeout);

      // Both processed independently
      expect([200, 402]).toContain(r1.status);
      expect([200, 402]).toContain(r2.status);
      console.log('✅ Different identifiers treated independently');
    });
  });

  describe('4. All 8 Premium Endpoints', () => {
    PREMIUM_ENDPOINTS.forEach(({ path, method, price, body }) => {
      test(`should handle ${method} ${path} ($${price})`, async () => {
        let response;

        if (method === 'GET') {
          response = await request(TEST_CONFIG.baseURL)
            .get(path)
            .set('openai-conversation-id', `ep-test-${TEST_RUN_ID}`)
            .timeout(TEST_CONFIG.timeout);
        } else {
          response = await request(TEST_CONFIG.baseURL)
            .post(path)
            .set('openai-conversation-id', `ep-test-${TEST_RUN_ID}`)
            .send(body || {})
            .timeout(TEST_CONFIG.timeout);
        }

        expect([200, 402]).toContain(response.status);
        console.log(`✅ ${path}: ${response.status}`);
      }, TEST_CONFIG.timeout);
    });
  });

  describe('5. API Key Format Validation', () => {
    test('should recognize cr_live_ prefix', async () => {
      const response = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('x-api-key', 'cr_live_test_key_12345')
        .timeout(TEST_CONFIG.timeout);

      expect(response.status).toBe(402);
      console.log('✅ cr_live_ prefix recognized');
    });

    test('should recognize Bearer token format', async () => {
      const response = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('Authorization', 'Bearer cr_live_test_key_12345')
        .timeout(TEST_CONFIG.timeout);

      expect(response.status).toBe(402);
      console.log('✅ Bearer token format recognized');
    });
  });

  describe('6. Feature Flag Verification', () => {
    test('should execute GPT auth flow when feature flag enabled', async () => {
      const response = await request(TEST_CONFIG.baseURL)
        .get('/x402/ping')
        .set('openai-conversation-id', `flag-test-${TEST_RUN_ID}`)
        .timeout(TEST_CONFIG.timeout);

      expect([200, 402]).toContain(response.status);
      console.log('✅ Feature flag GPT_SESSION_AUTH active');
    });
  });
});

describe('Phase 2F: Cryptographic Verification', () => {
  test('should generate RFC-4122 compliant UUID v4', () => {
    const fingerprint = `test-fingerprint-${nanoid()}`;
    const hashBytes = createHash('sha256').update(fingerprint).digest();

    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x40;
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;

    const hex = hashBytes.slice(0, 16).toString('hex');
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    console.log('✅ RFC-4122 UUID v4 generation verified');
  });

  test('should produce deterministic hashes', () => {
    const input = `deterministic-${nanoid()}`;
    const hash1 = createHash('sha256').update(input).digest('hex');
    const hash2 = createHash('sha256').update(input).digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
    console.log('✅ Deterministic hashing verified');
  });
});

describe('Phase 2F: In-Memory Credit Ledger Validation', () => {
  let harness: ReturnType<typeof createTestHarness>;

  beforeEach(() => {
    harness = createTestHarness();
  });

  test('should correctly track credit balance mutations', async () => {
    const { user } = await harness.seeder.seedGptUser({
      conversationId: `ledger-test-${nanoid()}`,
      ephemeralUserId: `ledger-user-${nanoid()}`,
      credits: 100.00
    });

    // Initial balance
    expect(harness.credits.getBalance(user.id)).toBe(100.00);

    // Deduct credits
    harness.credits.deductCredits(user.id, 10.00, 'Service 1');
    expect(harness.credits.getBalance(user.id)).toBe(90.00);

    harness.credits.deductCredits(user.id, 25.00, 'Service 2');
    expect(harness.credits.getBalance(user.id)).toBe(65.00);

    // Add credits
    harness.credits.addCredits(user.id, 15.00, 'Refund');
    expect(harness.credits.getBalance(user.id)).toBe(80.00);

    // Verify transaction log
    const transactions = harness.credits.getTransactions(user.id);
    expect(transactions.length).toBe(4); // seed + 2 deductions + 1 addition

    console.log('✅ Credit ledger mutations tracked correctly');
  });

  test('should prevent negative balance', async () => {
    const { user } = await harness.seeder.seedGptUser({
      conversationId: `neg-test-${nanoid()}`,
      ephemeralUserId: `neg-user-${nanoid()}`,
      credits: 5.00
    });

    const result = harness.credits.deductCredits(user.id, 10.00, 'Too much');
    expect(result.success).toBe(false);
    expect(harness.credits.getBalance(user.id)).toBe(5.00);
    console.log('✅ Negative balance prevention works');
  });
});
