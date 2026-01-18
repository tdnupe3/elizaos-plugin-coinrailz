# @coinrailz/iot-payments

IoT Payments SDK for device-to-device payments, metering, and credits. Built for IoT devices, DePIN networks, and machine-to-machine commerce.

## Features

- **Device Registration** - Register IoT devices with unique IDs and wallet addresses
- **Credits System** - Pre-purchase credits for pay-per-event billing
- **D2D Transfers** - Device-to-device payments with 2% + $0.02 fee
- **Metering** - Track billable events (messages, sensor readings, API calls)
- **Multi-chain** - Support for Base, Ethereum, Polygon, Arbitrum, Solana
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

## Credits Packs

| Pack | Price | Credits | Per Credit | Discount |
|------|-------|---------|------------|----------|
| Starter | $25 | 2,500 | $0.01 | - |
| Growth | $100 | 12,000 | $0.0083 | 17% |
| Enterprise | $500 | 75,000 | $0.0067 | 33% |

## Event Types & Pricing

| Event | Default Price |
|-------|---------------|
| message | $0.01 |
| data_access | $0.01 |
| unlock | $0.05 |
| stream_minute | $0.02 |
| sensor_reading | $0.01 |
| api_call | $0.01 |
| compute_second | $0.001 |
| storage_mb | $0.001 |

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

## Environment Variables

```bash
COINRAILZ_API_KEY=iot_your-api-key-here
COINRAILZ_BASE_URL=https://coinrailz.com
```

## License

MIT
