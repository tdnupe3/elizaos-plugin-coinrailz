/**
 * Phase 2F Test Harness
 * 
 * Provides in-memory storage and credits fixtures for integration testing.
 * Enables deterministic testing of GPT session auth and API key flows.
 */

import { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

// Types matching shared/schema.ts
interface TestUser {
  id: string;
  email: string | null;
  gptConversationIdHash: string | null;
  gptEphemeralUserIdHash: string | null;
  gptIdHash: string | null;
  createdAt: Date;
}

interface TestGptSession {
  id: number;
  conversationIdHash: string;
  ephemeralUserIdHash: string | null;
  sessionIdHash: string | null;
  fingerprint: string;
  userId: string | null;
  status: 'active' | 'expired' | 'linked';
  createdAt: Date;
  expiresAt: Date;
}

interface TestApiKey {
  id: number;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
}

interface TestCreditBalance {
  userId: string;
  balance: number;
}

interface TestCreditTransaction {
  id: number;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  createdAt: Date;
}

// In-memory storage fixture
export class InMemoryTestStorage {
  users: Map<string, TestUser> = new Map();
  gptSessions: Map<number, TestGptSession> = new Map();
  apiKeys: Map<number, TestApiKey> = new Map();
  private sessionIdCounter = 1;
  private apiKeyIdCounter = 1;

  // User operations
  async getUser(id: string): Promise<TestUser | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<TestUser | undefined> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  async createUser(data: Partial<TestUser>): Promise<TestUser> {
    const user: TestUser = {
      id: data.id || nanoid(),
      email: data.email || null,
      gptConversationIdHash: data.gptConversationIdHash || null,
      gptEphemeralUserIdHash: data.gptEphemeralUserIdHash || null,
      gptIdHash: data.gptIdHash || null,
      createdAt: new Date()
    };
    this.users.set(user.id, user);
    return user;
  }

  // GPT Session operations
  async getGptSessionByFingerprint(fingerprint: string): Promise<TestGptSession | undefined> {
    for (const session of this.gptSessions.values()) {
      if (session.fingerprint === fingerprint) return session;
    }
    return undefined;
  }

  async createGptSession(data: Partial<TestGptSession>): Promise<TestGptSession> {
    const session: TestGptSession = {
      id: this.sessionIdCounter++,
      conversationIdHash: data.conversationIdHash || '',
      ephemeralUserIdHash: data.ephemeralUserIdHash || null,
      sessionIdHash: data.sessionIdHash || null,
      fingerprint: data.fingerprint || '',
      userId: data.userId || null,
      status: data.status || 'active',
      createdAt: new Date(),
      expiresAt: data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
    this.gptSessions.set(session.id, session);
    return session;
  }

  async linkGptSessionToUser(sessionId: number, userId: string): Promise<void> {
    const session = this.gptSessions.get(sessionId);
    if (session) {
      session.userId = userId;
      session.status = 'linked';
    }
  }

  // API Key operations
  async getApiKeyByHash(keyHash: string): Promise<TestApiKey | undefined> {
    for (const key of this.apiKeys.values()) {
      if (key.keyHash === keyHash) return key;
    }
    return undefined;
  }

  async createApiKey(userId: string, name: string): Promise<{ apiKey: TestApiKey; rawKey: string }> {
    const rawKey = `cr_live_${nanoid(32)}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey: TestApiKey = {
      id: this.apiKeyIdCounter++,
      userId,
      keyHash,
      keyPrefix: rawKey.substring(0, 15),
      name,
      isActive: true,
      createdAt: new Date()
    };
    this.apiKeys.set(apiKey.id, apiKey);
    return { apiKey, rawKey };
  }

  // Clear all data
  reset(): void {
    this.users.clear();
    this.gptSessions.clear();
    this.apiKeys.clear();
    this.sessionIdCounter = 1;
    this.apiKeyIdCounter = 1;
  }
}

// In-memory credits service fixture
export class InMemoryCreditsService {
  private balances: Map<string, number> = new Map();
  private transactions: TestCreditTransaction[] = [];
  private transactionIdCounter = 1;

  getBalance(userId: string): number {
    return this.balances.get(userId) || 0;
  }

  addCredits(userId: string, amount: number, description: string): { success: boolean; newBalance: number; transactionId: number } {
    const currentBalance = this.getBalance(userId);
    const newBalance = currentBalance + amount;
    this.balances.set(userId, newBalance);
    
    const transaction: TestCreditTransaction = {
      id: this.transactionIdCounter++,
      userId,
      amount,
      type: 'credit',
      description,
      createdAt: new Date()
    };
    this.transactions.push(transaction);
    
    return { success: true, newBalance, transactionId: transaction.id };
  }

  deductCredits(userId: string, amount: number, description: string): { success: boolean; newBalance: number; transactionId: number } {
    const currentBalance = this.getBalance(userId);
    if (currentBalance < amount) {
      return { success: false, newBalance: currentBalance, transactionId: -1 };
    }
    
    const newBalance = currentBalance - amount;
    this.balances.set(userId, newBalance);
    
    const transaction: TestCreditTransaction = {
      id: this.transactionIdCounter++,
      userId,
      amount,
      type: 'debit',
      description,
      createdAt: new Date()
    };
    this.transactions.push(transaction);
    
    return { success: true, newBalance, transactionId: transaction.id };
  }

  getTransactions(userId: string): TestCreditTransaction[] {
    return this.transactions.filter(t => t.userId === userId);
  }

  validateApiKey(apiKey: string): { valid: boolean; userId: string | null } {
    // Test API keys are always invalid unless seeded
    return { valid: false, userId: null };
  }

  reset(): void {
    this.balances.clear();
    this.transactions = [];
    this.transactionIdCounter = 1;
  }
}

// Test data seeder
export class TestDataSeeder {
  constructor(
    private storage: InMemoryTestStorage,
    private credits: InMemoryCreditsService
  ) {}

  // Seed a GPT session user with credits
  async seedGptUser(options: {
    conversationId: string;
    ephemeralUserId: string;
    credits: number;
  }): Promise<{ user: TestUser; session: TestGptSession }> {
    const conversationIdHash = createHash('sha256').update(options.conversationId).digest('hex');
    const ephemeralUserIdHash = createHash('sha256').update(options.ephemeralUserId).digest('hex');
    const fingerprint = createHash('sha256')
      .update(`${options.conversationId}:${options.ephemeralUserId}`)
      .digest('hex');
    
    // Generate RFC-4122 UUID from fingerprint
    const hashBytes = createHash('sha256').update(fingerprint).digest();
    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x40;
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;
    const hex = hashBytes.slice(0, 16).toString('hex');
    const userId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

    const user = await this.storage.createUser({
      id: userId,
      gptConversationIdHash: conversationIdHash,
      gptEphemeralUserIdHash: ephemeralUserIdHash,
      gptIdHash: fingerprint
    });

    const session = await this.storage.createGptSession({
      conversationIdHash,
      ephemeralUserIdHash,
      fingerprint,
      userId,
      status: 'linked'
    });

    if (options.credits > 0) {
      this.credits.addCredits(userId, options.credits, 'Test seeding');
    }

    return { user, session };
  }

  // Seed an API key user with credits
  async seedApiKeyUser(options: {
    email: string;
    credits: number;
  }): Promise<{ user: TestUser; apiKey: string }> {
    const user = await this.storage.createUser({
      email: options.email
    });

    const { rawKey } = await this.storage.createApiKey(user.id, 'Test API Key');

    if (options.credits > 0) {
      this.credits.addCredits(user.id, options.credits, 'Test seeding');
    }

    return { user, apiKey: rawKey };
  }
}

// Feature flag configuration for tests
export interface TestFeatureFlags {
  GPT_SESSION_AUTH: boolean;
  GPT_SESSION_AUTH_LOG_ONLY: boolean;
}

// Test harness configuration
export interface TestHarnessConfig {
  storage: InMemoryTestStorage;
  credits: InMemoryCreditsService;
  featureFlags: TestFeatureFlags;
}

// Create test harness with seeded data
export function createTestHarness(): {
  storage: InMemoryTestStorage;
  credits: InMemoryCreditsService;
  seeder: TestDataSeeder;
  reset: () => void;
} {
  const storage = new InMemoryTestStorage();
  const credits = new InMemoryCreditsService();
  const seeder = new TestDataSeeder(storage, credits);

  return {
    storage,
    credits,
    seeder,
    reset: () => {
      storage.reset();
      credits.reset();
    }
  };
}
