# IoT Device Simulator Example

A complete example showing how to simulate an IoT device that:
1. Registers with Coin Railz
2. Creates a data product for sale
3. Serves data to paying AI agents

## Setup

```bash
cd examples/iot-device-simulator
npm install
```

## Configuration

Create a `.env` file:

```env
COINRAILZ_API_KEY=iot_your_api_key_here
COINRAILZ_BASE_URL=https://coinrailz.com
DEVICE_ID=weather-station-001
```

## Running the Simulator

```bash
npm start
```

## What It Does

1. **Registers the device** with your Coin Railz account
2. **Creates a weather data product** priced at $0.05 per reading
3. **Simulates sensor readings** (temperature, humidity, pressure)
4. **Logs when AI agents purchase data** via x402

## Example Output

```
🌡️ IoT Device Simulator Started
📦 Device registered: weather-station-001
💰 Product created: Real-time Weather Reading @ $0.05/reading
🔗 x402 Endpoint: /api/iot/data/iot_prod_abc123

📊 Current Reading:
   Temperature: 72.4°F
   Humidity: 45%
   Pressure: 1013.25 hPa

💵 Sale! Agent agent_xyz purchased 1 reading for $0.05
   Credits earned: $0.0425 (85% after platform fee)
```

## Files

- `index.ts` - Main simulator logic
- `package.json` - Dependencies
- `.env.example` - Environment template
