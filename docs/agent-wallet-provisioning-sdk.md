# Agent Wallet Provisioning SDK

**Coin Railz x402 Micropayment Service**

Create programmatic wallets for AI agents via Coinbase CDP with full audit logging.

---

## Endpoint

```
POST https://coinrailz.com/x402/agent-create-wallet
```

## Pricing

| Service | Price | Network |
|---------|-------|---------|
| Agent Wallet Provisioning | $2.00 USDC | Base Mainnet |

## x402 Payment Flow

This is an x402-gated endpoint. The payment flow works as follows:

1. **First Request** → Returns `HTTP 402 Payment Required` with payment details
2. **Pay** → Send USDC to the specified payment address on Base chain
3. **Second Request** → Include `X-PAYMENT` header with transaction proof
4. **Response** → Wallet created and returned

---

## Quick Start

### Step 1: Get Payment Challenge

```bash
curl -X POST https://coinrailz.com/x402/agent-create-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-agent-001"
  }'
```

**Response (402 Payment Required):**
```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-mainnet",
    "maxAmountRequired": "2000000",
    "resource": "https://coinrailz.com/x402/agent-create-wallet",
    "payTo": "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
    "asset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
  }]
}
```

### Step 2: Send Payment

Send exactly **2,000,000 micro-USDC** ($2.00) to the `payTo` address on Base mainnet.

**USDC Contract (Base):** `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`

### Step 3: Complete Request with Payment Proof

The `X-PAYMENT` header contains a Base64-encoded JSON payload with your transaction hash:

```bash
# Create payment proof (transaction hash from Step 2)
PAYMENT_PROOF=$(echo -n '{"x":{"scheme":"exact","network":"base-mainnet","payload":{"txHash":"0xYOUR_TX_HASH_HERE"}}}' | base64)

curl -X POST https://coinrailz.com/x402/agent-create-wallet \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: $PAYMENT_PROOF" \
  -d '{
    "agent_id": "my-agent-001",
    "purpose": "persistent",
    "chain": "base-mainnet"
  }'
```

**Payment Proof Format:**
```json
{
  "x": {
    "scheme": "exact",
    "network": "base-mainnet", 
    "payload": {
      "txHash": "0x1234567890abcdef..."
    }
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "wallet_address": "0x1234...abcd",
  "wallet_id": "wallet-uuid-here",
  "chain": "base-mainnet",
  "custody_type": "cdp",
  "purpose": "persistent",
  "status": "active",
  "created_at": "2025-12-04T12:00:00.000Z",
  "requestId": "req-uuid"
}
```

---

## Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agent_id` | string | Yes | - | Unique identifier for your AI agent |
| `purpose` | string | No | `persistent` | `ephemeral` or `persistent` |
| `chain` | string | No | `base-mainnet` | Target blockchain |
| `labels` | string[] | No | - | Classification labels |
| `tags` | string[] | No | - | Tags for categorization |
| `metadata` | object | No | - | Custom metadata |

### Supported Chains

- `base-mainnet` (default, recommended)
- `ethereum-mainnet`
- `polygon-mainnet`
- `arbitrum-mainnet`

---

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Operation success status |
| `wallet_address` | string | The new wallet's public address |
| `wallet_id` | string | Internal wallet identifier |
| `chain` | string | Blockchain network |
| `custody_type` | string | Always `cdp` (Coinbase Developer Platform) |
| `purpose` | string | Wallet purpose type |
| `status` | string | Wallet status (`active`) |
| `created_at` | string | ISO 8601 timestamp |
| `requestId` | string | Request tracking ID |

---

## JavaScript/TypeScript Example

```typescript
import { x402Fetch } from '@coinbase/x402-fetch';
// Or use any x402-compatible client

const createAgentWallet = async (agentId: string) => {
  const response = await x402Fetch('https://coinrailz.com/x402/agent-create-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      purpose: 'persistent',
      chain: 'base-mainnet'
    }),
    // x402Fetch handles payment automatically
    payerWallet: yourWallet,
  });

  const wallet = await response.json();
  console.log('Created wallet:', wallet.wallet_address);
  return wallet;
};
```

---

## Python Example

```python
import requests
import json
import base64

def create_agent_wallet(agent_id: str, payer_private_key: str):
    endpoint = "https://coinrailz.com/x402/agent-create-wallet"
    
    # Step 1: Get payment challenge
    response = requests.post(endpoint, json={"agent_id": agent_id})
    
    if response.status_code == 402:
        challenge = response.json()
        pay_to = challenge["accepts"][0]["payTo"]
        amount = int(challenge["accepts"][0]["maxAmountRequired"])
        
        # Step 2: Send USDC payment on Base (use your preferred web3 library)
        tx_hash = send_usdc_on_base(pay_to, amount, payer_private_key)
        
        # Step 3: Create x402 payment proof
        proof = {
            "x": {
                "scheme": "exact",
                "network": "base-mainnet",
                "payload": {"txHash": tx_hash}
            }
        }
        payment_header = base64.b64encode(json.dumps(proof).encode()).decode()
        
        # Step 4: Complete with payment proof
        response = requests.post(
            endpoint,
            json={"agent_id": agent_id},
            headers={"X-PAYMENT": payment_header}
        )
    
    return response.json()
```

---

## Error Handling

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| 402 | Payment Required | Send USDC payment |
| 400 | Bad Request | Check request parameters |
| 409 | Conflict | Agent already has a wallet |
| 500 | Server Error | Retry with exponential backoff |

---

## Wallet Custody Model

All wallets are created using **Coinbase Developer Platform (CDP)** with MPC-secured custody:

- **Non-custodial design**: Coin Railz does not hold private keys
- **Coinbase MPC**: Multi-party computation secures wallet operations
- **Audit logging**: All wallet events are logged for compliance
- **No key export**: Private keys never leave Coinbase infrastructure

---

## Discovery

This service is discoverable via:

- **x402scan**: Registered at [x402scan.com](https://x402scan.com)
- **Coinbase Bazaar**: Listed in Bazaar marketplace
- **Sitemap**: `https://coinrailz.com/sitemap.xml`
- **robots.txt**: `https://coinrailz.com/robots.txt`

---

## Support

- **Documentation**: https://coinrailz.com/docs
- **Status**: https://coinrailz.com/health
- **x402 Protocol**: https://www.x402.org

---

*Coin Railz - x402-native wallet infrastructure for AI agents*
