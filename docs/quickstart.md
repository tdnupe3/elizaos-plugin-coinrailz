# Coin Railz IoT Payments - Golden Path Quickstart

This guide walks you through the complete flow: **create account → register device → create product → agent buys data**.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation

```bash
npm install @coinrailz/iot-payments
```

## Step 1: Create an IoT Account

An IoT account is your organization's container for devices and credits.

```typescript
import { CoinRailzIoT } from '@coinrailz/iot-payments';

const client = new CoinRailzIoT({
  baseUrl: 'https://coinrailz.com'
});

// Create your IoT account
const { account, apiKey } = await client.createAccount({
  name: 'My Weather Station Fleet',
  email: 'admin@mycompany.com',
  webhookUrl: 'https://myapp.com/webhooks/coinrailz' // optional
});

console.log('Account ID:', account.id);
console.log('API Key:', apiKey); // SAVE THIS - shown only once!
```

**Important**: Store your API key securely. It won't be shown again.

## Step 2: Register a Device

Each IoT device (sensor, gateway, etc.) gets registered under your account.

```typescript
// Now use your API key for authenticated requests
const authedClient = new CoinRailzIoT({
  apiKey: 'iot_xxxxxxxxxxxxxxxx', // Your API key from Step 1
  baseUrl: 'https://coinrailz.com'
});

const device = await authedClient.registerDevice({
  deviceId: 'weather-station-001',
  deviceType: 'sensor',
  name: 'Downtown Weather Station',
  location: 'San Francisco, CA',
  capabilities: ['temperature', 'humidity', 'pressure'],
  metadata: {
    manufacturer: 'Acme Sensors',
    model: 'WS-3000'
  }
});

console.log('Device registered:', device.deviceId);
```

## Step 3: Create a Data Product

A data product is what AI agents can purchase. Define what data you're selling.

```typescript
const product = await authedClient.createProduct({
  deviceId: 'weather-station-001',
  productName: 'Real-time Weather Reading',
  productType: 'sensor_reading',
  description: 'Current temperature, humidity, and pressure from downtown SF',
  priceUsd: 0.05, // $0.05 per reading
  unit: 'reading',
  expectedNetwork: 'base', // Payment network (base, ethereum, polygon, arbitrum)
  tags: ['weather', 'temperature', 'humidity', 'san-francisco']
});

console.log('Product ID:', product.id);
console.log('x402 Endpoint:', product.x402Endpoint);
```

Your product is now discoverable in the A2D catalog!

## Step 4: AI Agent Discovers & Buys Data

AI agents can browse the catalog and purchase data via x402 protocol.

```typescript
// Agent-side code
const catalog = await client.browseCatalog({
  productType: 'sensor_reading',
  tags: ['weather']
});

console.log('Available products:', catalog.products);

// Agent pays via x402 and gets data access
// See examples/agent-buyer for complete implementation
```

## Step 5: Meter Billable Events (Optional)

Track usage for pay-per-use billing:

```typescript
const event = await authedClient.meterEvent({
  deviceId: 'weather-station-001',
  eventType: 'data_transmission',
  units: 1,
  metadata: { bytes: 1024 }
});

console.log('Event cost:', event.cost);
console.log('Remaining balance:', event.remainingBalance);
```

## Step 6: Top Up Credits

Add credits to your account via Stripe or PayPal:

```typescript
// Get available credit packs
const packs = await authedClient.getCreditPacks();
// Returns: $25/5,000 credits, $100/25,000 credits, $500/200,000 credits

// Create a topup session (redirects to Stripe/PayPal)
const topup = await authedClient.topupCredits({
  packId: 'starter', // $25 pack
  paymentMethod: 'stripe'
});

console.log('Checkout URL:', topup.checkoutUrl);
```

## Volume Pricing

| Monthly Events | Price per Event |
|----------------|-----------------|
| 0 - 100,000 | $0.005 |
| 100,000 - 1,000,000 | $0.0025 |
| 1,000,000+ | $0.001 |

## Complete Flow Diagram

```
┌─────────────────┐
│ 1. Create       │
│    Account      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Register     │
│    Devices      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Create Data  │
│    Products     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ 4. Products     │────▶│ AI Agents       │
│    in Catalog   │     │ Discover & Buy  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ 5. Meter Events │     │ x402 Payment    │
│    (Usage)      │     │ Verification    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ 6. Top Up       │     │ Data Delivered  │
│    Credits      │     │ to Agent        │
└─────────────────┘     └─────────────────┘
```

## Next Steps

- [Full API Reference](https://coinrailz.com/docs/iot-api)
- [Example: IoT Device Simulator](../examples/iot-device-simulator)
- [Example: Agent Buyer](../examples/agent-buyer)
- [A2D Payment Flow](https://coinrailz.com/docs/a2d)
- [Unified Credits System](https://coinrailz.com/docs/credits)

## Support

- Email: support@coinrailz.com
- Discord: [Join our community](https://discord.gg/coinrailz)
- GitHub Issues: [Report bugs](https://github.com/coinrailz/iot-payments/issues)
