# x402scan Service Registration - Coin Railz

## Registration URL
https://www.x402scan.com/resources/register

## Platform Details
- **Base URL**: https://coinrailz.com
- **Payment Wallet**: 0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321
- **Supported Networks**: Base (mainnet)
- **Supported Assets**: USDC, ETH, USDT
- **Facilitator Support**: All facilitators (Coinbase, x402.rs, PayAI, etc.) - we verify on-chain

## Services to Register

### 1. Multi-Chain Balance Checker
**URL**: https://coinrailz.com/x402/service/multi-chain-balance
**Price**: $0.50 USDC
**Description**: Check wallet balances across multiple chains
**Method**: POST
**Input**: 
- walletAddress (required)
- chains (optional array)
- includeTokens (optional boolean)

### 2. Gas Price Oracle
**URL**: https://coinrailz.com/x402/service/gas-price-oracle
**Price**: $0.15 USDC
**Description**: Real-time gas prices across multiple chains
**Method**: POST
**Input**:
- chains (optional array)

### 3. Token Price Feed
**URL**: https://coinrailz.com/x402/service/token-price
**Price**: $0.05 USDC
**Description**: Real-time token pricing data
**Method**: POST
**Input**:
- tokenAddress (required)
- chain (required)

### 4. Contract Security Scanner
**URL**: https://coinrailz.com/x402/service/contract-scan
**Price**: $1.00 USDC
**Description**: Smart contract security analysis
**Method**: POST
**Input**:
- contractAddress (required)
- chain (required)

### 5. Wallet Risk Scoring
**URL**: https://coinrailz.com/x402/service/wallet-risk
**Price**: $0.75 USDC
**Description**: Analyze wallet risk score and activity patterns
**Method**: POST
**Input**:
- walletAddress (required)
- chain (required)

### 6. Trading Signals
**URL**: https://coinrailz.com/x402/service/trade-signals
**Price**: $2.00 USDC
**Description**: AI-powered trading signals and market analysis
**Method**: POST
**Input**:
- token (optional, default: BTC/USDT)
- timeframe (optional: 5m, 15m, 1h, 4h, 1d)
- riskLevel (optional: low, medium, high)

### 7. Token Social Sentiment
**URL**: https://coinrailz.com/x402/service/token-sentiment
**Price**: $0.10 USDC
**Description**: Social media sentiment analysis for tokens
**Method**: POST
**Input**:
- tokenSymbol (required, e.g., BTC, ETH, PEPE)
- chain (optional, default: ethereum)

### 8. Trending Tokens Feed
**URL**: https://coinrailz.com/x402/service/trending-tokens
**Price**: $0.25 USDC
**Description**: Real-time trending tokens across chains
**Method**: POST
**Input**:
- timeframe (optional, default: 24h)
- chain (optional, default: all)
- limit (optional, max: 50)

### 9. Whale Wallet Alerts
**URL**: https://coinrailz.com/x402/service/whale-alerts
**Price**: $0.50 USDC
**Description**: Track large wallet movements and whale activity
**Method**: POST
**Input**:
- tokenAddress (required)
- chain (optional, default: ethereum)
- threshold (optional USD value, default: $100k)

### 10. DEX Liquidity Monitor
**URL**: https://coinrailz.com/x402/service/dex-liquidity
**Price**: $0.15 USDC
**Description**: Real-time DEX liquidity pool monitoring
**Method**: POST
**Input**:
- tokenAddress (required)
- chain (optional, default: ethereum)

---

## NEW B2B2C INFRASTRUCTURE SERVICES

### 11. Transaction Builder API
**URL**: https://coinrailz.com/x402/service/transaction-builder
**Price**: $0.30 USDC
**Description**: Pre-validated transaction encoding for agent-to-agent transfers. Simplifies transaction construction for trading bots and payment agents.
**Method**: POST
**Input**:
- to (required) - Recipient address
- chain (required) - Blockchain network
- tokenAddress (optional) - ERC20 token address for token transfers
- amount (optional) - Token amount for ERC20 transfers
- value (optional) - ETH value to send for native transfers
- data (optional) - Custom transaction data

### 12. Token Metadata Aggregator
**URL**: https://coinrailz.com/x402/service/token-metadata
**Price**: $0.10 USDC
**Description**: Unified token info (name, symbol, decimals, logo) across all chains. Essential building block for trading agent UIs and portfolio dashboards.
**Method**: POST
**Input**:
- tokenAddress (required) - Token contract address
- chain (required) - Blockchain network

### 13. Approval Manager API
**URL**: https://coinrailz.com/x402/service/approval-manager
**Price**: $0.20 USDC
**Description**: Token approval transaction generator with optimal gas settings. Required infrastructure for DeFi trading agents before swaps.
**Method**: POST
**Input**:
- tokenAddress (required) - Token to approve
- spender (required) - Spender address (usually DEX router)
- amount (required) - Amount to approve or 'unlimited'
- chain (required) - Blockchain network

### 14. Batch Quote Aggregator
**URL**: https://coinrailz.com/x402/service/batch-quote
**Price**: $0.40 USDC
**Description**: Multi-DEX price quotes in single call (Uniswap + 1inch + 0x Protocol). Critical infrastructure for trading bot price discovery.
**Method**: POST
**Input**:
- fromToken (required) - Input token address
- toToken (required) - Output token address
- amount (required) - Input amount
- chain (required) - Blockchain network

### 15. Portfolio Tracker API
**URL**: https://coinrailz.com/x402/service/portfolio-tracker
**Price**: $0.50 USDC
**Description**: Real-time multi-chain portfolio valuation with P&L tracking. Infrastructure for portfolio management agents and wealth tracking bots.
**Method**: POST
**Input**:
- walletAddress (required) - Wallet address to track
- chains (optional) - Chains to track (default: ethereum, base, polygon)

---

## Registration Instructions

1. Visit https://www.x402scan.com/resources/register
2. Enter each service URL above
3. x402scan will automatically validate the endpoint (returns HTTP 402 with valid schema)
4. Services will appear in x402scan Explorer and Composer within minutes
5. Monitor traffic at https://www.x402scan.com/server/<our-server-id>

## Technical Details

- **All endpoints** return proper x402Version 1 format
- **Multi-currency support**: USDC (6 decimals), ETH (18 decimals, live pricing), USDT (6 decimals)
- **Payment verification**: On-chain via Alchemy RPC (facilitator-agnostic)
- **Rate limiting**: 100 requests/hour per wallet
- **Timeout**: 15 minutes per payment
- **Response format**: Compliant with x402scan validation schema including outputSchema

## Benefits of Listing

1. **Discoverability**: Agents find us through x402scan Composer
2. **Trust**: Listed alongside Ainalyst, Canza, and other verified services
3. **Analytics**: Track transaction volume and buyers through x402scan dashboard
4. **Integration**: Agents can chain our services with others in Composer workflows

## Next Steps After Registration

1. Monitor https://www.x402scan.com/transactions for our service activity
2. Check https://www.x402scan.com/composer to see our services available
3. Track conversion rates: payment requests → completed payments
4. Optimize pricing based on actual agent usage patterns
