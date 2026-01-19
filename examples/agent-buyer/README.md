# Agent Buyer Example

A complete example showing how an AI agent can:
1. Browse the A2D catalog for IoT data products
2. Pay for data via x402 protocol
3. Retrieve purchased data

## Setup

```bash
cd examples/agent-buyer
npm install
```

## Configuration

Create a `.env` file:

```env
COINRAILZ_BASE_URL=https://coinrailz.com
AGENT_WALLET_PRIVATE_KEY=your_wallet_private_key
```

## Running the Agent

```bash
npm start
```

## What It Does

1. **Browses the A2D catalog** for available IoT data products
2. **Selects a product** to purchase (weather data, sensor readings, etc.)
3. **Initiates x402 payment** via USDC on Base chain
4. **Retrieves the data** after payment verification

## Example Output

```
🤖 AI Agent Buyer Started

📋 Browsing A2D Catalog...
   Found 15 products from 8 devices

🔍 Available Products:
   1. Real-time Weather Reading - $0.05/reading (weather-station-001)
   2. Air Quality Index - $0.10/reading (aq-sensor-sf)
   3. Traffic Flow Data - $0.25/reading (traffic-cam-101)

💰 Purchasing: Real-time Weather Reading
   Price: $0.05 USDC on Base
   
✅ Payment verified! Access token received.

📊 Data Retrieved:
   {
     "temperature": 72.4,
     "humidity": 45,
     "pressure": 1013.25,
     "timestamp": "2026-01-19T15:30:00Z"
   }
```

## x402 Payment Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 1. Agent    │────▶│ 2. GET      │────▶│ 3. Receives │
│    browses  │     │    /data/X  │     │    HTTP 402 │
│    catalog  │     │             │     │    + price  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 6. Data     │◀────│ 5. Verify   │◀────│ 4. Agent    │
│    returned │     │    payment  │     │    pays on  │
│    to agent │     │    on-chain │     │    Base     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Files

- `index.ts` - Main agent logic
- `package.json` - Dependencies
- `.env.example` - Environment template
