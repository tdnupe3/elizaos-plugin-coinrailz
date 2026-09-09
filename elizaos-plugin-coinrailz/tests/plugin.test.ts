import axios from 'axios';
import { coinrailzPlugin } from '../src/index';
import { payForServiceAction } from '../src/actions/payForService';
import { solanaYieldAction } from '../src/actions/solanaYield';
import { COIN_RAILZ_SERVICES } from '../src/types';
import { X402Client } from '../src/utils/x402Client';
import { PLUGIN_VERSION } from '../src/version';
import packageJson from '../package.json';
import openApiSpec from '../../public/openapi-x402-services.json';

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

  it('keeps the runtime version synchronized with package metadata', () => {
    expect(PLUGIN_VERSION).toBe(packageJson.version);
  });

  it('matches the canonical OpenAPI service catalog exactly', () => {
    const canonicalEndpoints = Object.keys(openApiSpec.paths)
      .filter(path => path.startsWith('/x402/') && !path.includes('{'))
      .sort();
    const pluginEndpoints = COIN_RAILZ_SERVICES.map(service => service.endpoint).sort();

    expect(pluginEndpoints).toEqual(canonicalEndpoints);
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

describe('X402Client service resolution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a missing service ID without making a request', async () => {
    const post = jest.spyOn(axios, 'post');
    const client = new X402Client({ apiKey: 'test-key' });

    const result = await client.callService({ payload: {}, amount: '' } as any);

    expect(result).toEqual({
      success: false,
      error: 'A valid Coin Railz serviceId is required.',
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects an unknown service ID without making a request', async () => {
    const post = jest.spyOn(axios, 'post');
    const client = new X402Client({ apiKey: 'test-key' });

    const result = await client.callService({
      serviceId: 'not-a-real-service',
      payload: {},
      amount: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown Coin Railz service: not-a-real-service');
    expect(post).not.toHaveBeenCalled();
  });

  it('uses the catalog endpoint for a valid service', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } });
    const client = new X402Client({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/',
    });

    const result = await client.callService({
      serviceId: 'multi-chain-balance',
      payload: { wallet: '0xabc' },
      amount: '',
    });

    const service = COIN_RAILZ_SERVICES.find(
      candidate => candidate.id === 'multi-chain-balance'
    );
    expect(result.success).toBe(true);
    expect(post).toHaveBeenCalledWith(
      `https://example.test${service!.endpoint}`,
      { wallet: '0xabc' },
      expect.any(Object)
    );
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
