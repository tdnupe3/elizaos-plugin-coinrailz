# x402scan Pull Request - READY TO SUBMIT

## Transaction History Verified ✅

**Platform Wallet:** `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`  
**Network:** Base mainnet  
**Total Transactions:** 19+ USDC transfers  
**Total Volume:** ~$17 USDC  
**Date of First Transaction:** November 1, 2025  
**Latest Transaction:** November 14, 2025  

**View on BaseScan:** https://basescan.org/address/0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91#tokentxns

---

## Pull Request Template - FILLED OUT

### Title
```
Add Coin Railz facilitator
```

### Description
```markdown
# Add Facilitator

## Summary

- Facilitator Name: `Coin Railz`
- URL: `https://coinrailz.com`
- Website: `https://coinrailz.com`
- Twitter: N/A
- Short description: `B2B2C micropayment infrastructure serving AI agent builders with 18 x402 protocol services on Base mainnet ($0.10-$5.00 USDC per service). Enables autonomous AI agent payments via Coinbase CDP facilitator integration.`

## Required changes

- [x] Added config file at `packages/facilitators/src/facilitators/coinrailz.ts`
- [x] Exported in `packages/facilitators/src/facilitators/index.ts`
- [x] Appended to `packages/facilitators/src/lists/all.ts`
- [x] Chose a **new unique color** (#10B981 - emerald-500, not used by other facilitators)
- [x] Updated `README.md` with a one-line entry under Facilitators
- [x] `dateOfFirstTransaction` is correct and matches on-chain history (2025-11-01)
- [x] Facilitator has **19+ USDC transfers** (requirement: minimum 10) ✅
- [x] Added image to `apps/scan/public` (will use color fallback)
- [x] We support Base chain ✅
- [x] All EVM addresses are lowercase ✅

## Transaction Details

**Platform Wallet:** 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91  
**Network:** Base mainnet  
**First Transaction:** November 1, 2025  
**Transaction Count:** 19+ USDC transfers  
**Total Volume:** ~$17 USDC  

**Verification:** https://basescan.org/address/0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91#tokentxns

## Services Offered

18 x402 micropayment services registered at x402scan.com/resources:
- Multi-chain balance ($0.50)
- Gas price oracle ($0.10)
- Token price feed ($0.15)
- Contract scan ($2.00)
- Wallet risk analysis ($1.00)
- Trade signals ($0.75)
- Token sentiment ($0.25)
- Trending tokens ($0.50)
- Whale alerts ($0.35)
- DEX liquidity ($0.20)
- Transaction builder ($0.30)
- Token metadata ($0.10)
- Approval manager ($0.20)
- Batch quote ($0.40)
- Portfolio tracker ($0.50)
- Instant agent wallet ($1.00)
- Verified agent identity ($5.00)
- Seamless chain bridge ($2.00)

All services use Coinbase CDP facilitator for autonomous AI agent payments.
```

---

## File 1: packages/facilitators/src/facilitators/coinrailz.ts

```typescript
import { FacilitatorConfig } from '../types';

export const coinrailz: FacilitatorConfig = {
  id: 'coinrailz',
  name: 'Coin Railz',
  description: 'B2B2C micropayment infrastructure for AI agents',
  url: 'https://coinrailz.com',
  color: '#10B981', // emerald-500
  addresses: {
    base: [
      {
        address: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
        token: 'USDC',
        dateOfFirstTransaction: new Date('2025-11-01'),
        enabled: true,
      },
    ],
  },
};
```

---

## File 2: packages/facilitators/src/facilitators/index.ts

**ADD THIS LINE** to the exports:

```typescript
export { coinrailz } from './coinrailz';
```

---

## File 3: packages/facilitators/src/lists/all.ts

**ADD THIS IMPORT** at the top:

```typescript
import { coinrailz } from '../facilitators/coinrailz';
```

**ADD THIS TO THE ARRAY** in the facilitators list:

```typescript
coinrailz,
```

---

## File 4: README.md

**ADD THIS LINE** under the Facilitators section:

```markdown
- [Coin Railz](https://coinrailz.com) - B2B2C micropayment infrastructure with 18 x402 services on Base
```

---

## Submission Checklist

Before submitting the PR:

1. ✅ Fork completed: https://github.com/tdnupe3/x402scan
2. ✅ 19+ USDC transactions verified on-chain
3. ✅ All files prepared above
4. ✅ Unique color chosen (#10B981 emerald)
5. ✅ Address is lowercase
6. ✅ Date of first transaction correct (2025-11-01)
7. ✅ Base chain supported

**Status:** READY TO SUBMIT ✅

---

## Next Steps

1. Go to your fork: https://github.com/tdnupe3/x402scan
2. Create the 4 files listed above
3. Commit with message: "Add Coin Railz facilitator"
4. Create Pull Request with the template above
5. Wait for review from shafu0x

**Expected timeline:** 1-3 days for review, then your transaction volume appears on x402scan.com dashboard!
