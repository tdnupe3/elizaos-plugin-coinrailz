# x402 Quick Start Guide - First Successful Payment

**Coin Railz x402 Micropayment Platform**

Get your first successful x402 payment working in under 5 minutes.

---

## TL;DR - Copy-Paste Success Script

### Step 1: Free First Call (No Payment Required!)

New agents get their **first call FREE** on our cheapest services:

```bash
# This is FREE for first-time callers! (Use POST method)
curl -X POST "https://coinrailz.com/x402/gas-price-oracle" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response (200 OK):**
```json
{
  "ethereum": { "slow": { "gwei": "1.05", "usd": "$0.067" }, "standard": { "gwei": "3.05", "usd": "$0.196" }, "fast": { "gwei": "5.05", "usd": "$0.324" } },
  "base": { "slow": { "gwei": "1.00", "usd": "$0.064" }, "standard": { "gwei": "3.00", "usd": "$0.193" }, "fast": { "gwei": "5.00", "usd": "$0.321" } },
  "polygon": { "slow": { "gwei": "21.00", "usd": "$1.348" }, "standard": { "gwei": "23.00", "usd": "$1.476" }, "fast": { "gwei": "25.00", "usd": "$1.605" } },
  "timestamp": "2025-12-05T12:00:00.000Z"
}
```

Congratulations! You just made your first successful x402 call!

> **Note:** GET requests return 402 for service discovery. Use POST for actual service calls.

---

## Step 2: Your First Paid Call

After your free call, you'll need to pay. Here's the complete flow:

### 2a. Get the 402 Challenge

```bash
curl -X POST "https://coinrailz.com/x402/gas-price-oracle" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response (402 Payment Required):**
```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "100000",
    "maxAmountRequiredUSD": "0.10",
    "payTo": "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }]
}
```

### 2b. Send USDC Payment

Send **0.10 USDC** (100,000 micro-USDC) to the `payTo` address on Base mainnet.

**USDC Contract (Base):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### 2c. Complete with Transaction Hash

```bash
# Replace YOUR_TX_HASH with your actual transaction hash
curl -X POST "https://coinrailz.com/x402/gas-price-oracle" \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: 0xYOUR_TRANSACTION_HASH_HERE" \
  -d '{}'
```

**Success Response (200 OK):**
```json
{
  "ethereum": { "slow": { "gwei": "1.05", "usd": "$0.067" }, ... },
  "base": { ... },
  "payment": { "verified": true, "txHash": "0x..." }
}
```

---

## Python Complete Example

```python
import requests
from web3 import Web3

# Configuration
COINRAILZ_BASE = "https://coinrailz.com"
USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
PLATFORM_WALLET = "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91"

def make_x402_request(endpoint: str, private_key: str = None, payload: dict = None):
    """Make an x402 request with automatic payment handling"""
    
    url = f"{COINRAILZ_BASE}{endpoint}"
    payload = payload or {}
    
    # Step 1: Try the request (might be free!) - Use POST for service calls
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    
    if response.status_code == 200:
        print("Success! (Free call or payment already verified)")
        return response.json()
    
    if response.status_code != 402:
        raise Exception(f"Unexpected status: {response.status_code}")
    
    # Step 2: Parse 402 challenge
    challenge = response.json()
    pay_to = challenge["accepts"][0]["payTo"]
    amount = int(challenge["accepts"][0]["maxAmountRequired"])
    
    print(f"Payment required: {amount / 1_000_000} USDC to {pay_to}")
    
    if not private_key:
        raise Exception("Payment required but no private key provided")
    
    # Step 3: Send USDC payment (using web3.py)
    w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
    
    usdc_abi = [{"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transfer","outputs":[{"type":"bool"}],"type":"function"}]
    usdc = w3.eth.contract(address=USDC_BASE, abi=usdc_abi)
    
    account = w3.eth.account.from_key(private_key)
    tx = usdc.functions.transfer(pay_to, amount).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 100000,
        "gasPrice": w3.eth.gas_price
    })
    
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    print(f"Payment sent! TxHash: {tx_hash.hex()}")
    
    # Step 4: Retry with payment proof - Use POST
    response = requests.post(url, json=payload, headers={
        "Content-Type": "application/json",
        "X-PAYMENT": tx_hash.hex()
    })
    
    if response.status_code == 200:
        print("Payment verified! Service delivered.")
        return response.json()
    else:
        raise Exception(f"Payment failed: {response.text}")

# Usage
result = make_x402_request("/x402/gas-price-oracle")
print(result)
```

---

## JavaScript/TypeScript Complete Example

```typescript
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const COINRAILZ_BASE = "https://coinrailz.com";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function makeX402Request(endpoint: string, privateKey?: `0x${string}`, payload: object = {}) {
  const url = `${COINRAILZ_BASE}${endpoint}`;
  
  // Step 1: Try the request - Use POST for service calls
  let response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  if (response.ok) {
    console.log("Success! (Free or already paid)");
    return response.json();
  }
  
  if (response.status !== 402) {
    throw new Error(`Unexpected status: ${response.status}`);
  }
  
  // Step 2: Parse 402 challenge
  const challenge = await response.json();
  const payTo = challenge.accepts[0].payTo;
  const amount = BigInt(challenge.accepts[0].maxAmountRequired);
  
  console.log(`Payment required: ${Number(amount) / 1_000_000} USDC`);
  
  if (!privateKey) {
    throw new Error("Payment required but no private key provided");
  }
  
  // Step 3: Send USDC payment
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http("https://mainnet.base.org")
  });
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org")
  });
  
  const hash = await walletClient.writeContract({
    address: USDC_BASE,
    abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
    functionName: "transfer",
    args: [payTo as `0x${string}`, amount]
  });
  
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Payment sent! TxHash: ${hash}`);
  
  // Step 4: Retry with payment proof - Use POST
  response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": hash
    },
    body: JSON.stringify(payload)
  });
  
  if (response.ok) {
    console.log("Payment verified! Service delivered.");
    return response.json();
  }
  
  throw new Error(`Payment failed: ${await response.text()}`);
}

// Usage
const result = await makeX402Request("/x402/gas-price-oracle");
console.log(result);
```

---

## Service Catalog

| Service | Price | First Call Free? |
|---------|-------|------------------|
| gas-price-oracle | $0.10 | Yes |
| token-metadata | $0.10 | Yes |
| trade-signals | $0.75 | No |
| wallet-risk | $0.50 | No |
| agent-create-wallet | $2.00 | No |

Full catalog: https://coinrailz.com/x402/catalog

---

## Troubleshooting

### "Payment verification failed"
- Ensure you sent USDC on **Base mainnet** (not Ethereum mainnet)
- Wait for transaction confirmation before retrying
- Check that you sent the exact amount (micro-USDC, not USD)

### "X-PAYMENT header is required"
- Your free call was already used
- Include the transaction hash in the X-PAYMENT header

### Need Help?
- Docs: https://coinrailz.com/docs
- Status: https://coinrailz.com/health
- Support: support@coinrailz.com

---

*Coin Railz - x402-native payment infrastructure for AI agents*
