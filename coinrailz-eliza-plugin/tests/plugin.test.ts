import { coinrailzPlugin } from '../src/index';
import { payForServiceAction } from '../src/actions/payForService';
import { COIN_RAILZ_SERVICES } from '../src/types';

describe('CoinRailz Plugin', () => {
  it('should have correct plugin name', () => {
    expect(coinrailzPlugin.name).toBe('coinrailz');
  });

  it('should include payForService action', () => {
    expect(coinrailzPlugin.actions).toContain(payForServiceAction);
  });

  it('should have 18 services defined', () => {
    expect(COIN_RAILZ_SERVICES).toHaveLength(18);
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

  it('should validate action with correct service ID', async () => {
    const mockRuntime: any = {};
    const mockMessage: any = {
      content: {
        serviceId: 'multi-chain-balance'
      }
    };

    const isValid = await payForServiceAction.validate(mockRuntime, mockMessage);
    expect(isValid).toBe(true);
  });

  it('should reject action with invalid service ID', async () => {
    const mockRuntime: any = {};
    const mockMessage: any = {
      content: {
        serviceId: 'invalid-service'
      }
    };

    const isValid = await payForServiceAction.validate(mockRuntime, mockMessage);
    expect(isValid).toBe(false);
  });

  it('should reject action without service ID', async () => {
    const mockRuntime: any = {};
    const mockMessage: any = {
      content: {}
    };

    const isValid = await payForServiceAction.validate(mockRuntime, mockMessage);
    expect(isValid).toBe(false);
  });
});
