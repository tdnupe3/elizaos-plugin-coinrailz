/**
 * IoT Device Simulator Example
 * 
 * Demonstrates how to:
 * 1. Register an IoT device with Coin Railz
 * 2. Create a data product for AI agents to purchase
 * 3. Simulate sensor readings
 */

import { CoinRailzIoT } from '@coinrailz/iot-payments';

const API_KEY = process.env.COINRAILZ_API_KEY || '';
const BASE_URL = process.env.COINRAILZ_BASE_URL || 'https://coinrailz.com';
const DEVICE_ID = process.env.DEVICE_ID || `weather-station-${Date.now()}`;

async function main() {
  console.log('🌡️ IoT Device Simulator Started\n');

  if (!API_KEY) {
    console.error('❌ Error: COINRAILZ_API_KEY environment variable is required');
    console.log('\nTo get an API key:');
    console.log('1. Visit https://coinrailz.com/iot');
    console.log('2. Create an IoT account');
    console.log('3. Copy your API key');
    process.exit(1);
  }

  const client = new CoinRailzIoT({
    apiKey: API_KEY,
    baseUrl: BASE_URL
  });

  try {
    // Step 1: Check health
    const health = await client.health();
    console.log(`✅ Connected to Coin Railz IoT v${health.version}\n`);

    // Step 2: Register the device
    console.log('📦 Registering device...');
    const device = await client.registerDevice({
      deviceId: DEVICE_ID,
      deviceType: 'sensor',
      name: 'Weather Station Simulator',
      location: 'San Francisco, CA',
      capabilities: ['temperature', 'humidity', 'pressure'],
      metadata: {
        manufacturer: 'Coin Railz Demo',
        model: 'Simulator v1.0'
      }
    });
    console.log(`✅ Device registered: ${device.deviceId}\n`);

    // Step 3: Create a data product
    console.log('💰 Creating data product...');
    const product = await client.createProduct({
      deviceId: DEVICE_ID,
      productName: 'Real-time Weather Reading',
      productType: 'sensor_reading',
      description: 'Current temperature, humidity, and pressure readings',
      priceUsd: 0.05,
      unit: 'reading',
      expectedNetwork: 'base',
      tags: ['weather', 'temperature', 'humidity', 'demo']
    });
    console.log(`✅ Product created: ${product.productName} @ $${product.priceUsd}/${product.unit}`);
    console.log(`🔗 x402 Endpoint: ${product.x402Endpoint}\n`);

    // Step 4: Simulate sensor readings
    console.log('📊 Starting sensor simulation (Ctrl+C to stop)...\n');
    
    setInterval(() => {
      const reading = generateWeatherReading();
      console.log(`📊 Current Reading @ ${new Date().toISOString()}`);
      console.log(`   Temperature: ${reading.temperature.toFixed(1)}°F`);
      console.log(`   Humidity: ${reading.humidity}%`);
      console.log(`   Pressure: ${reading.pressure.toFixed(2)} hPa\n`);
    }, 5000);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function generateWeatherReading() {
  return {
    temperature: 60 + Math.random() * 30, // 60-90°F
    humidity: Math.floor(30 + Math.random() * 50), // 30-80%
    pressure: 1000 + Math.random() * 30, // 1000-1030 hPa
    timestamp: new Date().toISOString()
  };
}

main();
