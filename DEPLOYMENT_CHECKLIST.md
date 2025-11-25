# Coin Railz x402 Bazaar Discovery Deployment Checklist

## Pre-Deployment Verification

### Local Testing Results (November 25, 2025)

| Test | Status | Details |
|------|--------|---------|
| Standard Services GET (31) | ✅ PASS | All return 402 with discoverable:true |
| Enterprise Services GET (3) | ✅ PASS | All return 402 with discoverable:true |
| POST Requests | ✅ PASS | All services still accept POST |
| Total Services | **34** | 31 standard + 3 enterprise |

### Changes Made

1. **x402MicroserviceRoutesV2.ts**
   - Added `generate402ResponseForGet()` helper function
   - Added GET handlers for 31 standard service endpoints
   - GET requests return proper 402 Payment Required with:
     - `x402Version: 1`
     - `discoverable: true`
     - `facilitatorUrl: "https://facilitator.x402.io"`
     - Full service metadata (price, description, schemas)

2. **x402GatedRoutes.ts**
   - Added GET handlers for 3 enterprise services
   - Same 402 response format as standard services

### Services with GET Support

**Standard Services ($0.50 - $2.00):**
- ping, multi-chain-balance, gas-price-oracle, token-price, contract-scan
- wallet-risk, trade-signals, token-sentiment, trending-tokens, whale-alerts
- dex-liquidity, transaction-builder, token-metadata, approval-manager, batch-quote
- portfolio-tracker, instant-agent-wallet, verified-agent-identity, seamless-chain-bridge
- property-valuation, lease-analysis, construction-progress
- credit-risk-score, fraud-detection, compliance-check
- trading-signal, portfolio-optimization, sentiment-analysis
- arbitrage-scanner, correlation-matrix, risk-metrics

**Enterprise Services ($50 - $1000):**
- service/smart-contract-audit ($1000)
- service/payment-processing ($50)
- service/compliance-consultation ($500)

---

## Deployment Steps

### Step 1: Verify Pre-Deployment
```bash
# Run local tests
curl -X GET http://localhost:5000/x402/ping | jq '.accepts[0].discoverable'
# Should return: true

curl -X GET http://localhost:5000/x402/service/smart-contract-audit | jq '.accepts[0].discoverable'
# Should return: true
```

### Step 2: Publish to Production
1. Click "Publish" in Replit
2. Wait for deployment to complete
3. Verify production URL: https://coinrailz.com

### Step 3: Post-Deployment Verification
```bash
# Test production GET endpoints
curl -X GET https://coinrailz.com/x402/ping | jq '{x402Version, discoverable: .accepts[0].discoverable}'

curl -X GET https://coinrailz.com/x402/gas-price-oracle | jq '{x402Version, discoverable: .accepts[0].discoverable}'

curl -X GET https://coinrailz.com/x402/service/smart-contract-audit | jq '{x402Version, discoverable: .accepts[0].discoverable}'
```

### Step 4: Verify Coinbase Bazaar Compatibility
```bash
# Check if response matches Bazaar-listed services
curl -X GET https://coinrailz.com/x402/ping | jq '.'

# Expected fields:
# - x402Version: 1
# - error: "X-PAYMENT header is required"
# - accepts[0].discoverable: true
# - facilitatorUrl: "https://facilitator.x402.io"
# - accepts[0].asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" (USDC on Base)
# - accepts[0].payTo: "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91"
```

### Step 5: Monitor Bazaar Indexing
```bash
# Check Bazaar listing (may take 24-48 hours)
curl -s "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources?limit=2000" | grep -i "coinrailz"
```

---

## Success Criteria

| Criteria | Expected | How to Verify |
|----------|----------|---------------|
| Site responds | HTTP 200 | `curl -I https://coinrailz.com` |
| Agent card accessible | JSON response | `curl https://coinrailz.com/.well-known/agent.json` |
| GET returns 402 | Status 402 | `curl -s -o /dev/null -w "%{http_code}" https://coinrailz.com/x402/ping` |
| discoverable:true | Field present | `curl https://coinrailz.com/x402/ping \| jq '.accepts[0].discoverable'` |
| POST still works | Status 402 | `curl -X POST https://coinrailz.com/x402/ping` |
| Bazaar listing | Found | Check Bazaar API after 24-48 hours |

---

## Rollback Plan

If issues occur after deployment:
1. Use Replit's checkpoint rollback
2. Re-deploy previous version
3. Contact: Check replit.md for support info

---

## Expected Timeline

| Phase | Duration |
|-------|----------|
| Deployment | 2-5 minutes |
| DNS propagation | Already done (coinrailz.com active) |
| Bazaar crawler pickup | 24-48 hours |
| Full Bazaar listing | 48-72 hours |

---

## Notes

- Coinbase Bazaar automatically indexes services using the CDP facilitator with `discoverable: true`
- No manual submission required - crawler discovers endpoints via GET requests
- All 34 services are properly configured for automatic discovery
