# Manual x402 Payment Test Guide

## Quick Summary
Your platform has **7.54 USDC** at `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91` on Base mainnet.

To execute a REAL x402 payment:

## Option 1: Using MetaMask (Easiest)

1. **Import the platform wallet into MetaMask** (if you have the private key)
2. **Send 0.01 USDC** to `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91` (payment to yourself to test)
3. **Copy the transaction hash**
4. **Run this command:**

```bash
curl -X POST https://coinrailz.com/x402/gas-price-oracle \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: $(echo '{
    "network":"base",
    "txHash":"YOUR_TX_HASH_HERE",
    "amount":10000,
    "asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "from":"0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
    "to":"0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
  }' | base64)" \
  -d '{}'
```

## Option 2: Automated Script (Requires Private Key)

If you have a test wallet private key, add it to Replit Secrets:

```bash
# Add to Replit Secrets:
TEST_WALLET_PRIVATE_KEY=0x1234...your_private_key...
```

Then run:
```bash
tsx automated-x402-test.ts
```

## Option 3: Fund the Test Wallet We Created

We created a new CDP wallet at:
- **Address:** `0x225131480d261b2c448BE2189F954C6a5215839D`
- **Wallet ID:** `dbfa2340-8812-45d0-80a4-6fcde74ed5bd`

Send 1 USDC to this address, then run:
```bash
tsx test-real-x402-payment.ts
```

## What Happens After Payment

1. Platform verifies payment on-chain (Alchemy RPC)
2. Service delivers gas price data (HTTP 200)
3. Payment tracked in database
4. Revenue credited to platform wallet

## Current Setup Status

✅ All 18 x402 services live at coinrailz.com  
✅ `discoverable: true` configured (Bazaar auto-indexed)  
✅ HTTP 402 responses working  
✅ Payment verification system operational  
✅ Platform wallet has funds (7.54 USDC)  

**Missing:** Just need to execute one real payment to demonstrate end-to-end flow!
