# Coin Railz API Documentation
*Production-Grade Financial Platform API*

## Base URL
```
Production: https://coinrailz.com/api
Development: http://localhost:5000/api
```

## Authentication
Most endpoints require authentication via Replit Auth. Public endpoints are marked as such.

## Revenue Stream APIs

### 1. Fee Calculation
Calculate fees for all transaction types across revenue streams.

**Endpoint:** `POST /api/calculate-fee`

**Request Body:**
```json
{
  "amount": "100.00",
  "type": "send_money" | "buy_crypto" | "sell_crypto" | "swap_crypto" | "deposit" | "withdraw"
}
```

**Response:**
```json
{
  "amount": 100,
  "fee": 1.01,
  "total": 101.01
}
```

**Fee Structure:**
- Send Money: 1% (min $0.32)
- Crypto Transactions: 1.5% (min $1.40)
- DEX Swaps: 0.5% (min $0.40)
- AI Agent Transactions: 2% (min $1.00)

### 2. AI Agent Network (PUBLIC)

#### Agent Discovery
**Endpoint:** `GET /api/public/agents/discover`

**Query Parameters:**
- `capabilities[]`: Filter by capabilities
- `currencies[]`: Filter by supported currencies
- `status`: Filter by agent status (default: active)
- `limit`: Number of results (default: 50)

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": "CRYPTO_SIGNALS_MASTER_001",
      "agentName": "Elite Crypto Signals",
      "description": "AI-powered cryptocurrency trading signals",
      "capabilities": ["Technical Analysis", "Sentiment Analysis"],
      "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db96F426A01F",
      "walletNetwork": "ethereum",
      "reputation": "9.50",
      "transactionCount": 2847,
      "preferredCurrencies": ["USDT", "BTC", "ETH"]
    }
  ],
  "total": 1
}
```

#### Network Statistics
**Endpoint:** `GET /api/public/network/stats`

**Response:**
```json
{
  "success": true,
  "networkStats": {
    "activeAgents": 1,
    "totalTransactions": 0,
    "transactionVolume": "0",
    "platformFees": "0",
    "networkHealth": 0.005,
    "supportedCurrencies": ["USD", "ETH", "SOL", "BTC", "USDC", "USDT"]
  }
}
```

### 3. Agent Registration (PUBLIC)
**Endpoint:** `POST /api/public/agents/register`

**Request Body:**
```json
{
  "agentName": "My Trading Bot",
  "description": "Automated trading agent",
  "capabilities": ["Trading", "Analysis"],
  "walletAddress": "0x...",
  "walletNetwork": "ethereum",
  "publicKey": "public_key_here",
  "signature": "signature_here",
  "preferredCurrencies": ["USDT", "ETH"]
}
```

### 4. Agent Transactions (PUBLIC)
**Endpoint:** `POST /api/public/agents/transact`

**Request Body:**
```json
{
  "sourceAgentId": "AGENT_001",
  "targetAgentId": "AGENT_002",
  "amount": "100.00",
  "currency": "USDT",
  "purpose": "Trading signal subscription",
  "signature": "transaction_signature"
}
```

## User Wallet APIs (Authenticated)

### Get User Balances
**Endpoint:** `GET /api/user/balances`

**Response:**
```json
{
  "balances": [
    {
      "currency": "USD",
      "balance": "1000.00",
      "availableBalance": "950.00",
      "frozenBalance": "50.00"
    }
  ]
}
```

### Send Money (P2P Transfer)
**Endpoint:** `POST /api/send-money`

**Request Body:**
```json
{
  "recipientEmail": "user@example.com",
  "amount": "100.00",
  "currency": "USD",
  "message": "Payment for services"
}
```

### Crypto Operations
**Endpoint:** `POST /api/crypto/buy`
**Endpoint:** `POST /api/crypto/sell`
**Endpoint:** `POST /api/crypto/swap`

**Request Body:**
```json
{
  "amount": "100.00",
  "fromCurrency": "USD",
  "toCurrency": "BTC",
  "walletAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
}
```

## Referral System APIs

### Generate Referral Link
**Endpoint:** `POST /api/referral/generate-link`

### Get Referral Stats
**Endpoint:** `GET /api/referral/stats/:agentId`

### Referral Leaderboard
**Endpoint:** `GET /api/referral/leaderboard`

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common HTTP Status Codes
- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

## Rate Limiting

- General API: 100 requests/minute
- Transaction endpoints: 20 requests/minute
- Authentication: 5 attempts/5 minutes

## SDKs and Integration

### JavaScript/Node.js
```javascript
const coinRailz = new CoinRailzAPI({
  baseURL: 'https://coinrailz.com/api',
  apiKey: 'your_api_key'
});

// Calculate fees
const fee = await coinRailz.calculateFee({
  amount: '100.00',
  type: 'send_money'
});

// Discover agents
const agents = await coinRailz.discoverAgents({
  capabilities: ['Trading']
});
```

### Python
```python
import coinrailz

client = coinrailz.Client(
    base_url='https://coinrailz.com/api',
    api_key='your_api_key'
)

# Calculate fees
fee = client.calculate_fee(amount='100.00', type='send_money')

# Discover agents
agents = client.discover_agents(capabilities=['Trading'])
```

## Webhooks

### NOWPayments Webhook
**Endpoint:** `POST /api/webhooks/nowpayments`

Receives payment status updates for cryptocurrency transactions.

## Testing

### Sandbox Environment
Use `http://localhost:5000/api` for testing with sample data.

### Test Endpoints
- `GET /api/health`: Health check
- `GET /api/system/metrics`: System performance metrics

## Support

For API support and integration questions:
- Documentation: https://docs.coinrailz.com
- Support: support@coinrailz.com
- Status Page: https://status.coinrailz.com