# IoT Payments API Documentation

> **Version**: 1.1.0  
> **Base URL**: `https://coinrailz.com/api/iot`

---

## Overview

The Coin Railz IoT Payments API enables device owners to monetize IoT data through usage-based billing. This documentation covers Fleet Telematics and Weather/Environmental sensor data monetization.

---

## Authentication

All endpoints require authentication via API key or session:

```bash
# Using API Key
curl -H "X-API-Key: your_api_key" https://coinrailz.com/api/iot/...

# Using Session (browser)
# Session cookie is automatically included
```

---

## Quick Start: Fleet Telematics

### Step 1: Create Account

```bash
curl -X POST https://coinrailz.com/api/iot/account \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Fleet Company",
    "email": "fleet@example.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "account": {
    "id": "acc_abc123",
    "name": "My Fleet Company",
    "balance": 0
  }
}
```

### Step 2: Register Vehicle

```bash
curl -X POST https://coinrailz.com/api/iot/register \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_abc123",
    "deviceType": "vehicle",
    "name": "Truck #1",
    "metadata": {
      "vin": "1HGCM82633A004352",
      "make": "Ford",
      "model": "F-150"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "device": {
    "id": "dev_xyz789",
    "name": "Truck #1",
    "type": "vehicle",
    "status": "active"
  }
}
```

### Step 3: Meter GPS Events

```bash
curl -X POST https://coinrailz.com/api/iot/meter \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_abc123",
    "deviceId": "dev_xyz789",
    "eventType": "gps_update",
    "eventData": {
      "lat": 40.7128,
      "lng": -74.0060,
      "speed": 45,
      "heading": 90,
      "timestamp": "2026-01-20T12:00:00Z"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "event": {
    "id": "evt_001",
    "cost": 0.005,
    "balanceAfter": 99.995
  }
}
```

### Step 4: Check Balance

```bash
curl https://coinrailz.com/api/iot/balance?accountId=acc_abc123
```

**Response:**
```json
{
  "accountId": "acc_abc123",
  "balance": 99.995,
  "currency": "USD"
}
```

---

## Quick Start: Weather Sensor Data

### Step 1: Create Account

```bash
curl -X POST https://coinrailz.com/api/iot/account \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weather Station Network",
    "email": "sensors@example.com"
  }'
```

### Step 2: Register Sensor

```bash
curl -X POST https://coinrailz.com/api/iot/register \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_abc123",
    "deviceType": "weather_station",
    "name": "NYC Central Park",
    "metadata": {
      "lat": 40.7829,
      "lng": -73.9654,
      "sensors": ["temperature", "humidity", "wind", "pressure"],
      "updateFrequency": "15min"
    }
  }'
```

### Step 3: Push Sensor Readings

```bash
curl -X POST https://coinrailz.com/api/iot/meter \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_abc123",
    "deviceId": "dev_weather_001",
    "eventType": "sensor_reading",
    "eventData": {
      "temperature": 72.4,
      "humidity": 45,
      "windSpeed": 8.2,
      "windDirection": 180,
      "pressure": 1013.25,
      "timestamp": "2026-01-20T12:00:00Z"
    }
  }'
```

### Step 4: Create Data Product (A2D)

```bash
curl -X POST https://coinrailz.com/api/iot/products \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc_abc123",
    "deviceId": "dev_weather_001",
    "name": "NYC Central Park Weather Feed",
    "description": "Real-time temperature, humidity, wind from Central Park",
    "pricePerReading": 0.002,
    "dataType": "weather",
    "expectedNetwork": "base",
    "metadata": {
      "location": "Central Park, NYC",
      "updateFrequency": "15 minutes"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "product": {
    "id": "prod_weather_nyc",
    "name": "NYC Central Park Weather Feed",
    "pricePerReading": 0.002,
    "status": "active"
  }
}
```

---

## API Reference

### Account Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/iot/account` | POST | Create IoT account |
| `/api/iot/balance` | GET | Get account balance |
| `/api/iot/transactions` | GET | Get transaction history |

### Device Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/iot/register` | POST | Register device |
| `/api/iot/devices` | GET | List devices |
| `/api/iot/devices/:id` | GET | Get device details |

### Billing & Metering

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/iot/meter` | POST | Meter billable event |
| `/api/iot/topup` | POST | Top up credits (Stripe/PayPal) |
| `/api/iot/packs` | GET | Get credit pack options |

### Data Products (A2D)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/iot/products` | POST | Create data product |
| `/api/iot/products` | GET | List your products |
| `/api/iot/products/:id` | PATCH | Update product |
| `/api/iot/catalog` | GET | Browse all products |
| `/api/iot/data/:productId` | POST | Purchase data (x402) |
| `/api/iot/sales` | GET | Get sales history |

### Device-to-Device Transfers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/iot/transfer` | POST | Transfer between devices |

---

## Pricing

### Event Metering (Volume Discounts)

| Volume | Price | Discount |
|--------|-------|----------|
| Base rate | $0.005/event | — |
| 100K-1M events/mo | $0.0025/event | 50% |
| 1M+ events/mo | $0.001/event | 80% |

### Credit Packs

| Pack | Credits | Per Credit |
|------|---------|------------|
| $25 | 5,000 | $0.005 |
| $100 | 25,000 | $0.004 |
| $500 | 200,000 | $0.0025 |

### Data Product Sales

- Device owners receive 85% of sales
- Platform fee: 15%

---

## Event Types

### Fleet Telematics

```javascript
// GPS Update
{
  "eventType": "gps_update",
  "eventData": {
    "lat": 40.7128,
    "lng": -74.0060,
    "speed": 45,
    "heading": 90
  }
}

// Engine Diagnostic
{
  "eventType": "engine_diagnostic",
  "eventData": {
    "rpm": 2500,
    "fuelLevel": 0.75,
    "engineTemp": 195,
    "obd2Codes": []
  }
}

// Driver Behavior
{
  "eventType": "driver_behavior",
  "eventData": {
    "harshBraking": false,
    "harshAcceleration": false,
    "speeding": false
  }
}
```

### Weather/Environmental

```javascript
// Weather Reading
{
  "eventType": "sensor_reading",
  "eventData": {
    "temperature": 72.4,
    "humidity": 45,
    "windSpeed": 8.2,
    "windDirection": 180,
    "pressure": 1013.25
  }
}

// Air Quality
{
  "eventType": "air_quality",
  "eventData": {
    "pm25": 12.5,
    "pm10": 25.0,
    "co2": 415,
    "ozone": 0.04
  }
}

// Soil Moisture (Agtech)
{
  "eventType": "soil_reading",
  "eventData": {
    "moisture": 0.35,
    "temperature": 65,
    "ph": 6.5,
    "conductivity": 1.2
  }
}
```

---

## x402 Protocol (A2D Purchases)

AI agents can purchase data products using the x402 protocol:

```bash
# Initial request returns 402 Payment Required
curl https://coinrailz.com/api/iot/data/prod_weather_nyc

# Response:
# HTTP/1.1 402 Payment Required
# X-Payment-Required: 0.002 USDC
# X-Payment-Address: 0x...
# X-Payment-Network: base
```

After payment verification, the data is returned:

```json
{
  "success": true,
  "data": {
    "temperature": 72.4,
    "humidity": 45,
    "timestamp": "2026-01-20T12:00:00Z"
  },
  "accessToken": "eyJ..."
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad request - missing or invalid parameters |
| 401 | Unauthorized - invalid API key or session |
| 402 | Payment required - insufficient credits |
| 403 | Forbidden - not authorized for this resource |
| 404 | Not found - device or product doesn't exist |
| 429 | Rate limited - too many requests |
| 500 | Server error |

---

## SDKs

### JavaScript/Node.js

```bash
npm install @coinrailz/iot-payments
```

```javascript
import { IoTPayments } from '@coinrailz/iot-payments';

const client = new IoTPayments({ apiKey: 'your_api_key' });

// Create account
const account = await client.createAccount({ name: 'My Fleet' });

// Register device
const device = await client.registerDevice({
  accountId: account.id,
  type: 'vehicle',
  name: 'Truck #1'
});

// Meter event
await client.meterEvent({
  accountId: account.id,
  deviceId: device.id,
  eventType: 'gps_update',
  data: { lat: 40.7128, lng: -74.0060 }
});
```

---

## Support

- **Documentation**: https://coinrailz.com/developers
- **API Status**: https://status.coinrailz.com
- **Contact**: Book a call at https://calendly.com

---

*Last updated: January 20, 2026*
