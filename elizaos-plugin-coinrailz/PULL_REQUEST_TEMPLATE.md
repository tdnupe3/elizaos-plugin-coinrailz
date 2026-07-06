# Add Coin Railz x402 Payment Plugin to ElizaOS

## Summary

This PR adds `@elizaos/plugin-coinrailz` to the ElizaOS plugin ecosystem, enabling AI agents to access 66 production-ready micropayment services on Base mainnet using the x402 protocol.

## What This Adds

### New Plugin: `@elizaos/plugin-coinrailz`
- **66 micropayment services** ($0.10-$5.00 USDC on Base)
- **x402 protocol support** - Standard HTTP 402 Payment Required
- **Auto-retry logic** - Handles payment and service retries
- **Revenue sharing** - 85% to agent builders, 15% platform fee
- **Zero backend required** - All payment infrastructure managed

### Services Included

**Trader Services:**
- Multi-chain balance queries
- Gas price oracle
- Token prices from DEX aggregators
- Contract security scanning
- Wallet risk scoring
- Trading signals
- Token sentiment analysis
- Trending tokens discovery
- Whale wallet tracking
- DEX liquidity monitoring

**Infrastructure Services:**
- Transaction builder
- Token metadata
- Approval manager
- Batch quote service
- Portfolio tracker
- Instant agent wallet creation (Circle MPC)
- Verified agent identity (ERC-8004)
- Seamless chain bridging (Circle CCTP)

## Value to ElizaOS Community

1. **Monetization for Agent Builders** - 85% revenue share on all service fees
2. **Production-Ready APIs** - All services live on Base mainnet
3. **Standard Protocol** - Uses x402 (Coinbase-backed HTTP payment standard)
4. **Low Friction** - One-line plugin installation
5. **Proven Infrastructure** - Built on Coinbase CDP and Base L2

## Testing

✅ Unit tests for all actions and providers  
✅ Validation logic tested  
✅ CI/CD pipeline configured  
✅ Integration tested with live Coin Railz services

## Documentation

- **README.md** - Complete usage guide
- **examples/** - Working code samples
- **Inline docs** - TypeScript types and JSDoc comments

## Technical Details

**Dependencies:**
- `@coinbase/x402` - Official Coinbase facilitator
- `x402-express` - x402 protocol middleware
- `axios` - HTTP client
- `viem` - Ethereum library

**Compatibility:**
- ElizaOS core >= 0.1.0
- Node.js >= 18
- Base mainnet (production)
- Base Sepolia (testing)

## Alignment with ElizaOS

This plugin follows ElizaOS plugin guidelines:
- ✅ Uses standard plugin structure
- ✅ Implements Action interface
- ✅ Includes Provider for service discovery
- ✅ No breaking changes to core
- ✅ Optional plugin (agents can choose to install)

## References

- **x402 Protocol:** https://x402.org
- **Coinbase x402 Docs:** https://docs.cdp.coinbase.com/x402
- **Coin Railz Platform:** https://coinrailz.com
- **Platform Wallet:** `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91`

## Maintainer Notes

Happy to make any adjustments or answer questions. I'm available on ElizaOS Discord (#plugins channel) for discussion.

This integration expands ElizaOS agent capabilities significantly by adding autonomous payment functionality - a key requirement for commercial AI agent deployment.

---

## Checklist

- [x] Code follows ElizaOS plugin conventions
- [x] Tests pass locally
- [x] Documentation complete
- [x] CI/CD configured
- [x] No breaking changes
- [x] Revenue model disclosed (85/15 split)
- [x] Production services verified

## Screenshots

(Would include screenshots of working example agent using Coin Railz services)
