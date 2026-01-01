# Dialect Blinks Integration Guide

This guide explains how to integrate Coin Railz with [Dialect Blinks](https://dial.to) - shareable Solana transaction links.

## Understanding the Two Payment Models

### Model 1: SDK Payments (Server-Side)
The `@coinrailz/agent-payments-solana` SDK is designed for **server-side payments** where:
- Your server holds the API key
- Transactions are signed on your backend
- Best for: AI agents, automation, agent-to-agent payments

### Model 2: Dialect Blinks (User-Signed)
Dialect Blinks are for **user-initiated payments** where:
- The user's wallet signs the transaction
- No API key needed on frontend
- Best for: Social payments, tipping, user purchases

**These are different use cases!** Choose based on who signs the transaction.

---

## Option 1: Use Coin Railz Built-in Blinks (Recommended)

Coin Railz already provides Dialect-compatible endpoints. No coding required!

### Discovery Endpoint
```
https://coinrailz.com/.well-known/solana-actions.json
```

### Shareable Blink URLs

**Payment Intent Blink:**
```
https://dial.to/?action=solana-action:https://coinrailz.com/solana-pay/intents
```

**Service Catalog Blink:**
```
https://dial.to/?action=solana-action:https://coinrailz.com/solana-pay/catalog
```

### Test with curl

```bash
# Check discovery
curl https://coinrailz.com/.well-known/solana-actions.json

# Get available actions
curl https://coinrailz.com/solana-pay/intents

# View service catalog
curl https://coinrailz.com/solana-pay/catalog
```

---

## Option 2: Hybrid Flow (Blinks + SDK)

A powerful pattern for AI agent platforms:

1. **User pays via Blink** - Standard wallet-signed payment
2. **Your server verifies** - Webhook confirms payment
3. **SDK fulfills** - Create agent wallets, send funds, etc.

### Example Implementation

```typescript
import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';
import express from 'express';

const app = express();
app.use(express.json());

const client = new CoinRailzSolana({
  apiKey: process.env.COINRAILZ_API_KEY!
});

// Webhook: Called when user completes Blink payment
app.post('/webhooks/payment-confirmed', async (req, res) => {
  const { signature, amount, payer } = req.body;
  
  console.log(`Payment confirmed: ${signature}`);
  console.log(`From: ${payer}, Amount: $${amount} USDC`);
  
  // Fulfill order using SDK
  // Example: Create an agent wallet for the user
  const wallet = await client.createWallet();
  
  if (wallet.success) {
    console.log(`Created agent wallet: ${wallet.wallet.address}`);
    
    // Example: Fund the agent wallet
    const funding = await client.send({
      to: wallet.wallet.address,
      amount: amount * 0.9, // 90% goes to agent
      currency: 'USDC',
      memo: `Agent funding for ${payer}`
    });
    
    if (funding.success) {
      res.json({ 
        success: true, 
        agentWallet: wallet.wallet.address,
        fundingTx: funding.transactionId 
      });
    } else {
      res.status(500).json({ error: funding.message });
    }
  } else {
    res.status(500).json({ error: wallet.message });
  }
});

app.listen(3000);
```

---

## Option 3: Custom Blinks (Advanced)

If you need custom Blinks that route through your server:

### Step 1: Add actions.json

Create `/.well-known/actions.json`:

```json
{
  "rules": [
    {
      "pathPattern": "/pay/**",
      "apiPath": "/api/blinks/**"
    }
  ]
}
```

### Step 2: Implement Action Endpoints

```typescript
import express from 'express';

const app = express();

// CRITICAL: Must parse JSON body for POST requests
app.use(express.json());

// GET: Return action metadata
app.get('/api/blinks/pay', (req, res) => {
  res.json({
    icon: 'https://yourdomain.com/icon.png',
    title: 'Pay via My App',
    description: 'Powered by Coin Railz',
    label: 'Pay Now',
    links: {
      actions: [
        {
          href: '/api/blinks/pay?amount={amount}',
          label: 'Send Payment',
          parameters: [
            { name: 'amount', label: 'Amount (USDC)', required: true }
          ]
        },
        { href: '/api/blinks/pay?amount=1', label: 'Tip $1' },
        { href: '/api/blinks/pay?amount=5', label: 'Tip $5' }
      ]
    }
  });
});

// POST: Forward to Coin Railz intent endpoint
app.post('/api/blinks/pay', async (req, res) => {
  // Dialect sends the payer's wallet address in req.body.account
  const { account } = req.body;
  const amount = req.query.amount as string;

  if (!account) {
    return res.status(400).json({
      error: { message: 'Missing account in request body' }
    });
  }

  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({
      error: { message: 'Invalid amount parameter' }
    });
  }

  try {
    // Forward to Coin Railz's Blinks-compatible endpoint
    const response = await fetch('https://coinrailz.com/solana-pay/intents', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        tokenSymbol: 'USDC',
        payerWallet: account,
        serviceName: 'custom-payment'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: { message: data.message || 'Payment intent creation failed' }
      });
    }

    // Return the transaction for wallet to sign
    res.json(data);
  } catch (error: any) {
    res.status(500).json({
      error: { message: error.message || 'Internal server error' }
    });
  }
});

app.listen(3000);
```

### Step 3: Generate Shareable URLs

```typescript
function createBlinkUrl(amount: number): string {
  const actionUrl = `https://yourdomain.com/api/blinks/pay?amount=${amount}`;
  return `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
}

console.log(createBlinkUrl(5)); // $5 payment Blink
```

---

## Action Request/Response Schemas

### GET Response (ActionGetResponse)

```typescript
{
  icon: string;           // Square image URL (min 200x200px)
  title: string;          // Max 50 characters
  description: string;    // Max 200 characters  
  label: string;          // Default button text
  disabled?: boolean;     // Disable the action
  links?: {
    actions: Array<{
      href: string;       // Action URL (can include {param} placeholders)
      label: string;      // Button label
      parameters?: Array<{
        name: string;     // Parameter name
        label?: string;   // Input label
        required?: boolean;
      }>;
    }>;
  };
  error?: { message: string };
}
```

### POST Request Body

Dialect sends this to your endpoint:

```typescript
{
  account: string;  // User's Solana wallet address (Base58)
}
```

### POST Response (ActionPostResponse)

```typescript
{
  transaction: string;    // Base64 encoded, serialized Solana transaction
  message?: string;       // Optional success message
}
```

---

## Common Issues

### "account is undefined"
- Ensure you have `express.json()` middleware before your routes
- The account comes from `req.body.account`, not query params

### Blink not unfurling on X/Twitter
- Verify `.well-known/actions.json` is accessible
- Check CORS allows requests from dial.to
- Register at [dial.to/register](https://dial.to/register)

### Transaction failing
- Verify recipient address is valid
- Check amount meets minimum ($0.05)
- Ensure your Coin Railz account has credits

---

## When to Use What

| Scenario | Solution |
|----------|----------|
| AI agent sending payments | SDK (`client.send()`) |
| User tips via social media | Coin Railz built-in Blinks |
| User purchases agent service | Blinks + SDK hybrid |
| Agent-to-agent payments | SDK |
| Custom payment flow | Custom Blinks forwarding to Coin Railz |

---

## Resources

- [Dialect Documentation](https://docs.dialect.to)
- [Coin Railz Solana Docs](https://coinrailz.com/docs/sdk/solana)
- [SDK Examples](../examples/)
- [Register your Blink](https://dial.to/register)
