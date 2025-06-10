
import { vi } from 'vitest';

// Mock environment variables for testing
vi.mock('../server/environment', () => ({
  getRequiredEnv: vi.fn((key: string) => {
    const mockEnv = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret',
      STRIPE_SECRET_KEY: 'sk_test_mock',
      STRIPE_PUBLIC_KEY: 'pk_test_mock'
    };
    return mockEnv[key as keyof typeof mockEnv] || 'mock-value';
  }),
  getOptionalEnv: vi.fn(() => 'mock-optional')
}));

// Mock database
vi.mock('../server/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn()
      },
      aiAgents: {
        findMany: vi.fn(),
        create: vi.fn()
      },
      transactions: {
        findMany: vi.fn(),
        create: vi.fn()
      }
    }
  }
}));

// Global test utilities
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};
