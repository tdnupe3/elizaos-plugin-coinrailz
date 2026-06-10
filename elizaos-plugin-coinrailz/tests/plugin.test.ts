import { coinrailzPlugin } from '../src/index';
import { payForServiceAction } from '../src/actions/payForService';
import { solanaYieldAction } from '../src/actions/solanaYield';
import { COIN_RAILZ_SERVICES } from '../src/types';

// ── x402 plugin tests ──────────────────────────────────────────────────────

describe('CoinRailz Plugin', () => {
  it('should have correct plugin name', () => {
    expect(coinrailzPlugin.name).toBe('coinrailz');
  });

  it('should include payForService action', () => {
    expect(coinrailzPlugin.actions).toContain(payForServiceAction);
  });

  it('should include solanaYield action', () => {
    expect(coinrailzPlugin.actions).toContain(solanaYieldAction);
  });

  it('should have at least 65 x402 services defined', () => {
    expect(COIN_RAILZ_SERVICES.length).toBeGreaterThanOrEqual(65);
  });

  it('should have valid service configurations', () => {
    COIN_RAILZ_SERVICES.forEach(service => {
      expect(service.id).toBeDefined();
      expect(service.name).toBeDefined();
      expect(service.description).toBeDefined();
      expect(service.price).toBeDefined();
      expect(service.endpoint).toMatch(/^\/x402\//);
      expect(service.network).toMatch(/^base(-sepolia)?$/);
    });
  });

  it('should validate payForService action with correct service ID', async () => {
    const mockRuntime: any = {};
    const isValid = await payForServiceAction.validate(mockRuntime, {
      content: { serviceId: 'multi-chain-balance' },
    } as any);
    expect(isValid).toBe(true);
  });

  it('should reject payForService action with invalid service ID', async () => {
    const mockRuntime: any = {};
    const isValid = await payForServiceAction.validate(mockRuntime, {
      content: { serviceId: 'invalid-service-xyz' },
    } as any);
    expect(isValid).toBe(false);
  });

  it('should reject payForService action without service ID', async () => {
    const mockRuntime: any = {};
    const isValid = await payForServiceAction.validate(mockRuntime, {
      content: {},
    } as any);
    expect(isValid).toBe(false);
  });
});

// ── Solana Yield action tests ──────────────────────────────────────────────

describe('SolanaYield Action', () => {
  const mockRuntime: any = {};

  it('should have correct action name', () => {
    expect(solanaYieldAction.name).toBe('COINRAILZ_SOLANA_YIELD');
  });

  // Helper to call validate — Action.validate is typed as optional so we assert it's defined
  const yieldValidate = solanaYieldAction.validate!;

  it('should accept GET_RATES with no wallet', async () => {
    expect(await yieldValidate(mockRuntime, { content: { operation: 'GET_RATES' } } as any)).toBe(true);
  });

  it('should accept GET_MANIFEST with no wallet', async () => {
    expect(await yieldValidate(mockRuntime, { content: { operation: 'GET_MANIFEST' } } as any)).toBe(true);
  });

  it('should accept GET_STATS with no wallet', async () => {
    expect(await yieldValidate(mockRuntime, { content: { operation: 'GET_STATS' } } as any)).toBe(true);
  });

  it('should reject GET_POSITION without wallet', async () => {
    expect(await yieldValidate(mockRuntime, { content: { operation: 'GET_POSITION' } } as any)).toBe(false);
  });

  it('should accept GET_POSITION with wallet', async () => {
    expect(await yieldValidate(mockRuntime, {
      content: { operation: 'GET_POSITION', wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    } as any)).toBe(true);
  });

  it('should reject CREATE_DEPOSIT_TX without wallet', async () => {
    expect(await yieldValidate(mockRuntime, {
      content: { operation: 'CREATE_DEPOSIT_TX', amount_usdc: 10 },
    } as any)).toBe(false);
  });

  it('should reject CREATE_DEPOSIT_TX with amount below minimum', async () => {
    expect(await yieldValidate(mockRuntime, {
      content: { operation: 'CREATE_DEPOSIT_TX', wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', amount_usdc: 4 },
    } as any)).toBe(false);
  });

  it('should accept CREATE_DEPOSIT_TX with valid wallet and amount', async () => {
    expect(await yieldValidate(mockRuntime, {
      content: { operation: 'CREATE_DEPOSIT_TX', wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', amount_usdc: 10 },
    } as any)).toBe(true);
  });

  it('should reject CONFIRM_DEPOSIT without txSignature', async () => {
    expect(await yieldValidate(mockRuntime, {
      content: { operation: 'CONFIRM_DEPOSIT', wallet: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    } as any)).toBe(false);
  });

  it('should accept CONFIRM_DEPOSIT with wallet and txSignature', async () => {
    expect(await yieldValidate(mockRuntime, {
      content: {
        operation:   'CONFIRM_DEPOSIT',
        wallet:      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        txSignature: '5yHP4sEgXMFkjRMVqPgjZBwTjXHAtDEgpV9JHLdnfnXhWiVPeRfCgkJMkjfE9CJqfZqKiNEfBYm3Nkf4sU6VFQr',
      },
    } as any)).toBe(true);
  });

  it('should reject unknown operation', async () => {
    expect(await yieldValidate(mockRuntime, { content: { operation: 'INVALID_OP' } } as any)).toBe(false);
  });

  it('should reject missing operation', async () => {
    expect(await yieldValidate(mockRuntime, { content: {} } as any)).toBe(false);
  });
});
