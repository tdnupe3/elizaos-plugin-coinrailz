/**
 * Dialect Blinks Integration Example
 * 
 * IMPORTANT: This SDK (@coinrailz/agent-payments-solana) is designed for 
 * SERVER-SIDE, API-key authenticated payments where your backend controls
 * the wallet and signs transactions.
 * 
 * Dialect Blinks work differently - the USER's wallet signs the transaction.
 * For Blinks, use Coin Railz's existing Blinks-compatible endpoints directly:
 * 
 * - Discovery: https://coinrailz.com/.well-known/solana-actions.json
 * - Intents:   https://coinrailz.com/solana-pay/intents
 * - Services:  https://coinrailz.com/solana-pay/catalog
 * 
 * This example shows:
 * 1. How to use Coin Railz's existing Blinks endpoints
 * 2. How to combine SDK with Blinks for hybrid flows
 * 
 * Learn more: https://dial.to
 */

// ============================================================
// OPTION 1: Use Coin Railz's Built-in Blinks (Recommended)
// ============================================================

/**
 * Coin Railz already provides Dialect-compatible endpoints.
 * Simply share these Blink URLs on X/Twitter:
 */
const COINRAILZ_BLINK_EXAMPLES = {
  // Main payment intents
  paymentIntents: 'https://dial.to/?action=solana-action:https://coinrailz.com/solana-pay/intents',
  
  // Service catalog
  serviceCatalog: 'https://dial.to/?action=solana-action:https://coinrailz.com/solana-pay/catalog',
  
  // Discovery endpoint (for wallets)
  discovery: 'https://coinrailz.com/.well-known/solana-actions.json'
};

console.log('=== Coin Railz Built-in Blinks ===');
console.log('Share these URLs on X/Twitter:\n');
Object.entries(COINRAILZ_BLINK_EXAMPLES).forEach(([name, url]) => {
  console.log(`${name}: ${url}\n`);
});

// ============================================================
// OPTION 2: Hybrid Flow - Blinks for Payment, SDK for Fulfillment
// ============================================================

/**
 * A common pattern is:
 * 1. User pays via Blink (wallet signs)
 * 2. Your server verifies payment
 * 3. SDK handles fulfillment (e.g., agent wallet operations)
 */

import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

async function hybridBlinkFlow() {
  // Verify API key
  const apiKey = process.env.COINRAILZ_API_KEY;
  if (!apiKey) {
    console.error('ERROR: COINRAILZ_API_KEY not set');
    console.error('Get your key at: https://coinrailz.com/dashboard/api-keys');
    process.exit(1);
  }

  const client = new CoinRailzSolana({ apiKey });

  // Step 1: User pays via Blink (this happens in their wallet)
  // Share: https://dial.to/?action=solana-action:https://coinrailz.com/solana-pay/intents?service=premium-data
  console.log('\n1. User pays via Blink in their wallet...');
  
  // Step 2: Your webhook receives payment confirmation
  const paymentSignature = '5abc123...'; // From webhook
  console.log(`2. Payment confirmed: ${paymentSignature}`);
  
  // Step 3: SDK handles fulfillment - e.g., create wallet for user's AI agent
  console.log('3. Fulfilling order via SDK...');
  
  const wallet = await client.createWallet();
  if (wallet.success) {
    console.log(`   Created agent wallet: ${wallet.wallet.address}`);
  } else {
    console.error(`   Failed: ${wallet.message}`);
  }
  
  // Step 4: Or send funds to user's agent
  const payment = await client.send({
    to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    amount: 1.00,
    currency: 'USDC',
    memo: 'Agent funding after Blink purchase'
  });
  
  if (payment.success) {
    console.log(`   Agent funded: ${payment.transactionId}`);
  } else {
    console.error(`   Failed: ${payment.message}`);
  }
}

// ============================================================
// OPTION 3: Custom Blinks with Coin Railz Backend
// ============================================================

/**
 * If you want to create your own Blinks that route to Coin Railz,
 * here's how to set up your Express.js server:
 */

// Express.js example (pseudo-code)
function setupCustomBlinksRoutes(app: any) {
  // Required: Add JSON body parser middleware
  app.use(require('express').json());
  
  // GET: Return action metadata
  app.get('/my-blink', (req: any, res: any) => {
    res.json({
      icon: 'https://yourdomain.com/icon.png',
      title: 'Pay with My App',
      description: 'Powered by Coin Railz',
      label: 'Pay',
      links: {
        actions: [
          { 
            href: '/my-blink?amount={amount}', 
            label: 'Pay',
            parameters: [{ name: 'amount', label: 'Amount (USDC)' }]
          }
        ]
      }
    });
  });

  // POST: Redirect to Coin Railz intent creation
  // NOTE: For actual Blinks, you need to build a Solana transaction
  // This example shows redirecting to Coin Railz's Blinks endpoints
  app.post('/my-blink', async (req: any, res: any) => {
    const { account } = req.body; // Payer's wallet (provided by Blinks client)
    const { amount } = req.query;

    if (!account) {
      return res.status(400).json({ 
        error: { message: 'Missing account in request body' } 
      });
    }

    // Forward to Coin Railz intent endpoint
    try {
      const response = await fetch('https://coinrailz.com/solana-pay/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount as string),
          tokenSymbol: 'USDC',
          payerWallet: account
        })
      });
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  });
}

// ============================================================
// IMPORTANT NOTES
// ============================================================

console.log('\n=== Key Differences ===');
console.log(`
SDK (@coinrailz/agent-payments-solana):
- Server-side, API-key authenticated
- Your server's wallet signs transactions
- Best for: AI agents, backend automation, agent-to-agent payments

Dialect Blinks:
- Client-side, wallet-signed
- User's wallet signs transactions  
- Best for: Social payments, tipping, user-initiated purchases

For Blinks: Use Coin Railz's built-in endpoints or build custom
transactions with @solana/web3.js.

For AI agent payments: Use this SDK.
`);

// Run the hybrid example
hybridBlinkFlow().catch(console.error);
