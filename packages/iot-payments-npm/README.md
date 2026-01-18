# @coinrailz/iot-payments

IoT Payments SDK for device-to-device payments, metering, and credits. Built for IoT devices, DePIN networks, and machine-to-machine commerce.

## Features

- **Device Registration** - Register IoT devices with unique IDs and wallet addresses
- **Credits System** - Pre-purchase credits for pay-per-event billing
- **D2D Transfers** - Device-to-device payments with 2% + $0.02 fee
- **Metering** - Track billable events (messages, sensor readings, API calls)
- **Multi-chain** - Support for Base, Ethereum, Polygon, Arbitrum, Solana
- **Non-custodial** - Devices control their own wallets

## Installation

```bash
npm install @coinrailz/iot-payments
```

## Quick Start

```typescript
import { CoinRailzIoT } from '@coinrailz/iot-payments';

const iot = new CoinRailzIoT({
  apiKey: 'your-api-key',
  baseUrl: 'https://coinrailz.com'
});

// Create an IoT account
const { account } = await iot.createAccount({
  accountName: 'My Sensor Fleet'
});

// Register a device
const { device } = await iot.registerDevice({
  deviceId: 'sensor-001',
  accountId: account.id,
  deviceType: 'sensor'
});

// Check balance
const balance = await iot.getBalance('sensor-001');
console.log(`Balance: ${balance.balanceFormatted}`);

// Charge for a message (1 credit = $0.01)
await iot.chargePerMessage('sensor-001', 'temperature/readings');

// D2D transfer
const { transfer } = await iot.transfer({
  fromDeviceId: 'sensor-001',
  toDeviceId: 'gateway-001',
  amount: 0.50
});
console.log(`Transferred: $${transfer.netAmount} (fee: $${transfer.fee})`);
```

## Credits Packs

| Pack | Price | Credits | Per Credit |
|------|-------|---------|------------|
| Starter | $25 | 2,500 | $0.01 |
| Growth | $100 | 12,000 | $0.0083 |
| Enterprise | $500 | 75,000 | $0.0067 |

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
Create a new IoT account for organizing devices.

### `registerDevice(input)`
Register a device to an account.

### `getBalance(deviceId)`
Check device/account balance.

### `meter(input)` / `chargePerMessage()` / `chargeForData()`
Record billable events and deduct credits.

### `transfer(input)`
Send payment from one device to another. Fee: 2% + $0.02.

### `topup(input)`
Add credits to account via Stripe.

## Transfer Fees

- **Percentage**: 2%
- **Flat Fee**: $0.02
- **Example**: $10 transfer → $0.22 fee → $9.78 received

```typescript
import { calculateTransferFee } from '@coinrailz/iot-payments';

const { fee, netAmount } = calculateTransferFee(10.00);
// fee: 0.22, netAmount: 9.78
```

## Environment Variables

```bash
COINRAILZ_API_KEY=your-api-key
COINRAILZ_BASE_URL=https://coinrailz.com
```

## License

MIT
