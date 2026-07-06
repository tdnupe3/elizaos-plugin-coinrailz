# Coin Railz API Reference

Complete API documentation for Coin Railz prepaid credits and API key management.

## Base URL

```
https://coinrailz.com
```

## Authentication

All API requests require authentication using an API key in the `Authorization` header:

```
Authorization: Bearer cr_live_YOUR_API_KEY_HERE
```

Get your API key at: https://coinrailz.com/api-keys

---

## Credits Endpoints

### Get Credit Balance

Retrieve your current credit balance and auto-top-up settings.

```http
GET /api/credits/balance
```

**Authentication:** Required (session or API key)

**Response:**

```json
{
  "balance": 45.50,
  "autoTopUpEnabled": false,
  "autoTopUpThreshold": 10.00,
  "preferredPaymentMethod": "stripe"
}
```

**Response Fields:**
- `balance` (number): Current credit balance in USD
- `autoTopUpEnabled` (boolean): Whether auto-top-up is enabled
- `autoTopUpThreshold` (number): Balance threshold for auto-top-up trigger
- `preferredPaymentMethod` (string): Preferred payment method (`stripe` or `crypto`)

**Example:**

```bash
curl https://coinrailz.com/api/credits/balance \
  -H "Authorization: Bearer cr_live_..." \
  -H "Content-Type: application/json"
```

---

### Get Transaction History

Retrieve your credit transaction history.

```http
GET /api/credits/transactions?limit=50
```

**Authentication:** Required

**Query Parameters:**
- `limit` (optional, number): Number of transactions to return (default: 50, max: 100)

**Response:**

```json
{
  "transactions": [
    {
      "id": "tx_abc123",
      "amount": 25.00,
      "type": "credit",
      "paymentMethod": "stripe",
      "description": "Stripe payment - $25 credits",
      "createdAt": "2025-11-17T12:00:00Z",
      "metadata": {
        "stripeSessionId": "cs_test_...",
        "stripePaymentIntent": "pi_..."
      }
    },
    {
      "id": "tx_def456",
      "amount": 0.50,
      "type": "debit",
      "paymentMethod": "api_usage",
      "description": "Service: wallet-risk (1 call)",
      "createdAt": "2025-11-17T11:30:00Z",
      "metadata": {
        "serviceId": "wallet-risk",
        "apiKeyId": "key_xyz789"
      }
    }
  ]
}
```

**Transaction Types:**
- `credit`: Funds added to account
- `debit`: Funds spent on services

**Example:**

```bash
curl "https://coinrailz.com/api/credits/transactions?limit=10" \
  -H "Authorization: Bearer cr_live_..." \
  -H "Content-Type: application/json"
```

---

### Purchase Credits with Stripe

Create a Stripe checkout session to purchase credits.

```http
POST /api/credits/purchase/stripe
```

**Authentication:** Required

**Request Body:**

```json
{
  "amount": 25
}
```

**Request Fields:**
- `amount` (number, required): Amount in USD to purchase (minimum: $10)

**Response:**

```json
{
  "sessionId": "cs_test_abc123",
  "url": "https://checkout.stripe.com/pay/cs_test_abc123"
}
```

**Response Fields:**
- `sessionId` (string): Stripe checkout session ID
- `url` (string): Stripe checkout page URL to redirect user

**Example:**

```bash
curl -X POST https://coinrailz.com/api/credits/purchase/stripe \
  -H "Authorization: Bearer cr_live_..." \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'
```

**Workflow:**
1. Create checkout session with this endpoint
2. Redirect user to `url` from response
3. Stripe handles payment
4. User redirected back to success/cancel URL
5. Credits automatically added via webhook

---

### Purchase Credits with Crypto

Add credits using USDC/USDT payment.

```http
POST /api/credits/purchase/crypto
```

**Authentication:** Required

**Request Body:**

```json
{
  "txHash": "0xabc123...",
  "token": "usdc",
  "chain": "base",
  "amount": 100
}
```

**Request Fields:**
- `txHash` (string, required): Transaction hash
- `token` (string, required): Token type (`usdc` or `usdt`)
- `chain` (string, required): Blockchain network (`base`, `ethereum`, `polygon`)
- `amount` (number, required): Amount in USD equivalent

**Response:**

```json
{
  "success": true,
  "credited": 100.00,
  "newBalance": 145.50,
  "transactionId": "tx_xyz789"
}
```

**Example:**

```bash
curl -X POST https://coinrailz.com/api/credits/purchase/crypto \
  -H "Authorization: Bearer cr_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0xabc123def456...",
    "token": "usdc",
    "chain": "base",
    "amount": 100
  }'
```

**Platform Wallet:** `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91` (Base mainnet)

---

## API Keys Endpoints

### Generate API Key

Create a new API key for programmatic access.

```http
POST /api/api-keys/generate
```

**Authentication:** Required (session only, not API key)

**Request Body:**

```json
{
  "name": "Production Server"
}
```

**Request Fields:**
- `name` (string, required): Descriptive name for the API key

**Response:**

```json
{
  "id": "key_abc123",
  "apiKey": "cr_live_xyz789abc123...",
  "name": "Production Server",
  "keyPrefix": "cr_live_xyz789",
  "status": "active",
  "rateLimit": 100,
  "createdAt": "2025-11-17T12:00:00Z"
}
```

**Important:**
- The full `apiKey` is only shown once during creation
- Save it securely - you cannot retrieve it again
- Rate limit: 100 requests per minute per key

**Example:**

```bash
curl -X POST https://coinrailz.com/api/api-keys/generate \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Server"}'
```

---

### List API Keys

Get all API keys for your account.

```http
GET /api/api-keys
```

**Authentication:** Required (session only)

**Response:**

```json
{
  "keys": [
    {
      "id": "key_abc123",
      "keyPrefix": "cr_live_xyz789",
      "name": "Production Server",
      "status": "active",
      "lastUsedAt": "2025-11-17T11:45:00Z",
      "createdAt": "2025-11-17T10:00:00Z",
      "rateLimit": 100
    }
  ]
}
```

**Key Status:**
- `active`: Key is valid and can be used
- `revoked`: Key has been disabled

**Example:**

```bash
curl https://coinrailz.com/api/api-keys \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
```

---

### Revoke API Key

Disable an API key.

```http
DELETE /api/api-keys/:keyId
```

**Authentication:** Required (session only)

**URL Parameters:**
- `keyId` (string, required): The API key ID to revoke

**Response:**

```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Example:**

```bash
curl -X DELETE https://coinrailz.com/api/api-keys/key_abc123 \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
```

**Note:** Revoked keys cannot be re-enabled. Create a new key if needed.

---

## Micropayment Services

All micropayment services use API key authentication and automatically deduct credits.

### Endpoint Format

```http
POST /api/x402/{serviceId}
Authorization: Bearer cr_live_YOUR_API_KEY
Content-Type: application/json

{
  "payload": "service-specific parameters"
}
```

### Available Services

| Service ID | Price | Description |
|-----------|-------|-------------|
| `multi-chain-balance` | $0.10 | Multi-chain wallet balance |
| `gas-price-oracle` | $0.10 | Real-time gas prices |
| `token-price` | $0.25 | Token price with 24h data |
| `contract-scan` | $0.50 | Smart contract security scan |
| `wallet-risk` | $0.50 | AML/fraud risk assessment |
| `trade-signals` | $1.00 | AI-powered trade signals |
| `token-sentiment` | $0.75 | Social sentiment analysis |
| `trending-tokens` | $0.50 | Trending token discovery |
| `whale-alerts` | $0.75 | Whale wallet monitoring |
| `dex-liquidity` | $0.50 | DEX liquidity data |
| `nft-floor-price` | $0.50 | NFT collection floor prices |
| `ens-verification` | $0.25 | ENS domain verification |
| `contract-events` | $0.50 | Smart contract event logs |

Full service documentation: https://coinrailz.com/developers

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 402 | `INSUFFICIENT_CREDITS` | Not enough credits for operation |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 400 | `INVALID_REQUEST` | Malformed request body |
| 404 | `NOT_FOUND` | Resource not found |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Rate Limits

- **API Keys:** 100 requests/minute per key
- **Session Auth:** 60 requests/minute per user
- **Service Calls:** Unlimited (limited only by credit balance)

Rate limit headers included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700000000
```

---

## SDKs

### TypeScript/JavaScript

```bash
npm install @coinrailz/sdk
```

```typescript
import { CoinRailzClient } from '@coinrailz/sdk';

const client = new CoinRailzClient({
  apiKey: process.env.COINRAILZ_API_KEY
});

const balance = await client.getBalance();
console.log(`Balance: $${balance.balance}`);
```

### Python

```bash
pip install coinrailz-sdk
```

```python
from coinrailz_client import CoinRailzClient

client = CoinRailzClient(api_key=os.getenv('COINRAILZ_API_KEY'))

balance = client.get_balance()
print(f"Balance: ${balance.balance}")
```

### ElizaOS Plugin

```bash
npm install @elizaos/plugin-coinrailz
```

See `/examples/eliza/` for ElizaOS agent integration examples.

---

## Webhooks

### Stripe Webhook

**Endpoint:** `POST /api/credits/stripe-webhook`

**Events Handled:**
- `checkout.session.completed`: Credits added automatically

**Signature Verification:** Required (see Stripe docs)

---

## Support

- Documentation: https://coinrailz.com/developers
- Issues: https://github.com/coinrailz/api/issues
- Email: support@coinrailz.com

## Changelog

**v1.0.0** (November 2025)
- Initial release
- Credits system with Stripe + USDC
- API key authentication
- 66 micropayment services
- TypeScript, Python, ElizaOS SDKs
