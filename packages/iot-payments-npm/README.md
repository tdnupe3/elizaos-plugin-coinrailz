# @coinrailz/iot-payments

IoT Payments SDK for device-to-device payments, metering, and credits. Built for IoT devices, DePIN networks, and machine-to-machine commerce.

## Features

- **Device Registration** - Register IoT devices with unique IDs and wallet addresses
- **Credits System** - Pre-purchase credits for pay-per-event billing
- **D2D Transfers** - Device-to-device payments with 2% + $0.02 fee
- **Micropayment-Enabled Sensors** - Access 66+ x402 intelligence services directly from IoT devices
- **Metering** - Track billable events (messages, sensor readings, NASA data calls)
- **Multi-chain** - Native support for Base (USDC) and Solana DePIN ecosystems
- **Non-custodial** - Devices control their own wallets
- **Secure Auth** - SHA-256 hashed API keys with rotation support

## Installation

```bash
npm install @coinrailz/iot-payments
```

## Quick Start

```typescript
import { CoinRailzIoT } from '@coinrailz/iot-payments';

// Step 1: Create an account (no API key needed for initial creation)
const iot = new CoinRailzIoT({
  baseUrl: 'https://coinrailz.com'
});

const { account, apiKey } = await iot.createAccount({
  accountName: 'My Sensor Fleet'
});

// IMPORTANT: Store the apiKey securely - it cannot be retrieved again!
console.log('API Key:', apiKey);

// Step 2: Use the API key for all subsequent requests
const authenticatedClient = new CoinRailzIoT({
  apiKey: apiKey,
  baseUrl: 'https://coinrailz.com'
});

// Register a device
const { device } = await authenticatedClient.registerDevice({
  deviceId: 'sensor-001',
  accountId: account.id,
  deviceType: 'sensor'
});

// Check balance
const balance = await authenticatedClient.getBalance('sensor-001');
console.log(`Balance: ${balance.balanceFormatted}`);

// Charge for a message (1 credit = $0.01)
await authenticatedClient.chargePerMessage('sensor-001', 'temperature/readings');

// D2D transfer (minimum $0.05)
const { transfer } = await authenticatedClient.transfer({
  fromDeviceId: 'sensor-001',
  toDeviceId: 'gateway-001',
  amount: 0.50
});
console.log(`Transferred: $${transfer.netAmount} (fee: $${transfer.fee})`);
```

## API Key Security

API keys are generated when you create an account and are **only shown once**. Store them securely.

```typescript
// Create account - returns one-time API key
const { account, apiKey, apiKeyWarning } = await iot.createAccount({
  accountName: 'Production Fleet'
});
// apiKeyWarning: "Store this API key securely. It cannot be retrieved again."

// Rotate API key (invalidates the old key immediately)
const { apiKey: newApiKey } = await iot.rotateApiKey(account.id);
```

## Credits Packs (v1.1 - 2x More Credits!)

| Pack | Price | Credits | Per Credit | Discount |
|------|-------|---------|------------|----------|
| Starter | $25 | 5,000 | $0.005 | - |
| Growth | $100 | 25,000 | $0.004 | 20% |
| Enterprise | $500 | 200,000 | $0.0025 | 50% |

## Volume Pricing Tiers

High-volume users get automatic discounts based on monthly event count:

| Tier | Monthly Events | Price/Event | Savings |
|------|----------------|-------------|---------|
| Standard | 0 - 100k | $0.005 | - |
| Growth | 100k - 1M | $0.0025 | 50% |
| Scale | 1M+ | $0.001 | 80% |

## Event Types & Pricing

| Event | Default Price | Tier |
|-------|---------------|------|
| message | $0.005 | standard |
| data_access | $0.005 | standard |
| sensor_reading | $0.005 | standard |
| api_call | $0.005 | standard |
| unlock | $0.05 | premium |
| stream_minute | $0.02 | premium |
| compute_second | $0.0005 | micro |
| storage_mb | $0.0005 | micro |

## API Reference

### `createAccount(input)`
Create a new IoT account. Returns the account and a one-time API key.

### `rotateApiKey(accountId)`
Rotate the API key for an account. The old key is invalidated immediately.

### `registerDevice(input)`
Register a device to an account.

### `getBalance(deviceId)`
Check device/account balance.

### `meter(input)` / `chargePerMessage()` / `chargeForData()`
Record billable events and deduct credits.

### `transfer(input)`
Send payment from one device to another. 
- **Minimum transfer**: $0.05
- **Fee**: 2% + $0.02

### `topup(input)`
Add credits to account via Stripe.

## Transfer Fees

- **Percentage**: 2%
- **Flat Fee**: $0.02
- **Minimum Fee**: $0.02
- **Minimum Transfer**: $0.05
- **Example**: $10 transfer → $0.22 fee → $9.78 received

```typescript
import { calculateTransferFee, MIN_TRANSFER_AMOUNT } from '@coinrailz/iot-payments';

const { fee, netAmount } = calculateTransferFee(10.00);
// fee: 0.22, netAmount: 9.78

console.log(`Minimum transfer: $${MIN_TRANSFER_AMOUNT}`);
// Minimum transfer: $0.05
```

## Constants

```typescript
import { 
  CREDITS_PACKS,
  EVENT_TYPES,
  TRANSFER_FEE,
  MIN_TRANSFER_AMOUNT 
} from '@coinrailz/iot-payments';
```

## Payment Methods

Credit topups are supported via:
- **Stripe** - Credit/debit card payments
- **PayPal** - PayPal account or card

```typescript
// Stripe topup (direct charge with payment method)
await iot.topup({
  accountId: account.id,
  packId: 'growth_100',
  paymentMethod: 'stripe',
  stripePaymentMethodId: 'pm_xxx'
});

// PayPal topup (2-step flow)
// Step 1: Create order
const order = await iot.topup({
  accountId: account.id,
  packId: 'growth_100',
  paymentMethod: 'paypal'
});
// Redirect user to order.approvalUrl

// Step 2: Capture after approval
await iot.topup({
  accountId: account.id,
  packId: 'growth_100',
  paymentMethod: 'paypal',
  paypalOrderId: order.paypalOrderId
});
```

## Environment Variables

```bash
COINRAILZ_API_KEY=iot_your-api-key-here
COINRAILZ_BASE_URL=https://coinrailz.com
```

## License

MIT
