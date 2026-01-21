# CDP v1 to v2 Migration Plan

## Executive Summary

**Deadline:** January 31, 2026 (10 days)
**Risk Level:** Low-Medium
**Estimated Effort:** 2-4 hours
**Blast Radius:** x402 payment flows only (2 files)

## Current State Analysis

### What Uses v1 (Needs Migration)
| File | Usage | Impact |
|------|-------|--------|
| `server/services/x402PaymentService.ts` | `Coinbase.configure()`, `Wallet.create()` | x402 payment wallet creation |

### What Already Uses v2 (Safe)
| File | Usage |
|------|-------|
| `server/services/coinbaseCDPService.ts` | Main CDP service, wallet creation, DEX |
| `server/routes/m2mOnboardingRoutes.ts` | Device wallet creation |
| `server/routes/dexRoutes.ts` | DEX trading |
| 15+ other files | Various CDP operations |

## Code Changes Required

### 1. x402PaymentService.ts - Lines to Change

**REMOVE (v1 imports and initialization):**
```typescript
// Line 17 - REMOVE
import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';

// Lines 51-82 - REMOVE initializeCoinbaseClient() method
private coinbaseClient: typeof Coinbase | null = null;
private initializeCoinbaseClient() { ... }
```

**ADD (v2 service import):**
```typescript
import { CoinbaseCDPService } from './coinbaseCDPService';
```

**REPLACE generatePaymentWallet() - Lines 318-340:**

**Before (v1):**
```typescript
private async generatePaymentWallet(network: string): Promise<string> {
  if (!this.coinbaseClient) {
    throw new Error('Coinbase client not initialized');
  }
  const wallet = await Wallet.create({ networkId: 'base-mainnet' });
  const address = await wallet.getDefaultAddress();
  return address.getId();
}
```

**After (v2):**
```typescript
private async generatePaymentWallet(network: string): Promise<string> {
  try {
    const cdpService = CoinbaseCDPService.getInstance();
    const networkId = this.mapNetworkToChain(network);
    const wallet = await cdpService.createWallet(`x402:${nanoid(8)}`, networkId);
    
    if (!wallet?.address) {
      throw new Error('Failed to create wallet via CDP v2');
    }
    
    console.log(`✅ CDP v2 wallet created: ${wallet.address}`);
    return wallet.address;
  } catch (error) {
    console.error('❌ CDP v2 wallet creation failed:', error);
    throw new Error(`Wallet creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

private mapNetworkToChain(network: string): string {
  const networkMap: Record<string, string> = {
    'base': 'base-mainnet',
    'ethereum': 'ethereum-mainnet',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arbitrum-mainnet',
  };
  return networkMap[network] || 'base-mainnet';
}
```

## API Response Compatibility

### What Stays the Same
- `X402PaymentResponse` interface - unchanged
- `createPaymentRequest()` - unchanged (uses env var, not CDP)
- `verifyPayment()` - unchanged (uses Alchemy RPC)
- `getPaymentStatus()` - unchanged
- `getAnalytics()` - unchanged
- x402Headers format - unchanged

### What Changes (Internal Only)
- `generatePaymentWallet()` now calls CoinbaseCDPService instead of v1 Wallet.create()
- No external API changes

## Database Impact

**None.** The x402Payments table stores:
- `walletAddress` (EVM address, e.g., `0x...`) - format unchanged
- Does NOT store walletId - no v1/v2 ID format concerns

## Feature Flag Approach (Not Implemented - For Reference Only)

If needed for future migrations, a feature flag could be added:

```typescript
// Example pattern (not currently implemented)
private async generatePaymentWallet(network: string): Promise<string> {
  const useV2 = process.env.X402_USE_CDP_V2 !== 'false';
  
  if (useV2) {
    // v2 path (current implementation)
    const cdpService = CoinbaseCDPService.getInstance();
    const wallet = await cdpService.createWallet(`x402-payment:${nanoid(8)}`, 'base-mainnet');
    return wallet.address;
  } else {
    // Legacy v1 path (would require keeping v1 SDK)
    const wallet = await Wallet.create({ networkId: 'base-mainnet' });
    const address = await wallet.getDefaultAddress();
    return address.getId();
  }
}
```

**Current Status:** Direct migration without feature flag (v1 SDK can be removed after verification)

## Testing Strategy

### Pre-Migration Baseline
1. Call `POST /api/x402/payment` - verify response shape
2. Call `GET /api/x402/payment/:id` - verify status retrieval
3. Call `GET /api/x402/wallet/base` - verify wallet generation works

### Post-Migration Verification
1. Same tests as baseline - responses should be identical
2. Verify logs show "CDP v2 wallet created" instead of "REAL Coinbase CDP wallet created"
3. Verify no errors in server logs

### Canary Deployment
1. Deploy to staging first
2. Create 5 test payments
3. Verify all succeed
4. Monitor for 1 hour
5. Deploy to production

## Rollback Plan

### Immediate Rollback (< 5 minutes)
Set environment variable: `X402_USE_CDP_V2=false`
Restart application

### Full Rollback (if needed)
1. Revert git commit
2. `npm install` to restore v1 SDK
3. Restart application

### Rollback Triggers
- Wallet creation failure rate > 5%
- Response format changes detected
- Any 5xx errors from x402 endpoints

## Success Criteria

- [ ] All x402 endpoints respond with identical schemas
- [ ] Wallet creation succeeds on first try
- [ ] No 4xx/5xx increase on x402 endpoints
- [ ] Logs show "CDP v2" messages
- [ ] `@coinbase/coinbase-sdk` can be removed from package.json

## Post-Migration Cleanup

After 1 week of stable operation:
1. Remove feature flag and v1 fallback code
2. Remove `@coinbase/coinbase-sdk` from package.json
3. Update test scripts to use v2

## Files Changed Summary

| File | Action |
|------|--------|
| `server/services/x402PaymentService.ts` | Migrate to v2 |
| `package.json` | Keep v1 SDK temporarily for rollback |
| `docs/CDP_V1_TO_V2_MIGRATION_PLAN.md` | This document |

## Timeline

| Day | Action |
|-----|--------|
| Day 0 | Create migration plan (this document) |
| Day 1 | Implement v2 migration with feature flag |
| Day 2 | Test in development |
| Day 3 | Deploy to production with flag enabled |
| Day 4-7 | Monitor, address issues |
| Day 8+ | Remove v1 SDK and feature flag |

---

**Document Created:** January 21, 2026
**Last Updated:** January 21, 2026
**Author:** Replit Agent
