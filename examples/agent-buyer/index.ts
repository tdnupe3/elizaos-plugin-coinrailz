/**
 * AI Agent Buyer Example
 * 
 * Demonstrates how an AI agent can:
 * 1. Browse the A2D catalog for IoT data products
 * 2. Purchase data via x402 protocol
 * 3. Retrieve the purchased data
 */

import { CoinRailzIoT } from '@coinrailz/iot-payments';

const BASE_URL = process.env.COINRAILZ_BASE_URL || 'https://coinrailz.com';

async function main() {
  console.log('🤖 AI Agent Buyer Started\n');

  const client = new CoinRailzIoT({
    baseUrl: BASE_URL
  });

  try {
    // Step 1: Check platform health
    const health = await client.health();
    console.log(`✅ Connected to Coin Railz IoT v${health.version}\n`);

    // Step 2: Browse the A2D catalog
    console.log('📋 Browsing A2D Catalog...');
    const catalog = await client.browseCatalog({
      limit: 10,
      productType: 'sensor_reading'
    });

    if (!catalog.products || catalog.products.length === 0) {
      console.log('ℹ️ No products available in catalog yet.');
      console.log('   Run the iot-device-simulator to create some products!\n');
      return;
    }

    console.log(`   Found ${catalog.products.length} products\n`);

    // Step 3: Display available products
    console.log('🔍 Available Products:');
    catalog.products.forEach((product: any, index: number) => {
      console.log(`   ${index + 1}. ${product.productName} - $${product.priceUsd}/${product.unit} (${product.deviceId})`);
      console.log(`      Network: ${product.expectedNetwork || 'base'}`);
      console.log(`      Endpoint: ${product.x402Endpoint}\n`);
    });

    // Step 4: Select first product for purchase
    const selectedProduct = catalog.products[0];
    console.log(`\n💰 Selected for purchase: ${selectedProduct.productName}`);
    console.log(`   Price: $${selectedProduct.priceUsd} USDC on ${selectedProduct.expectedNetwork || 'base'}`);
    console.log(`   Product ID: ${selectedProduct.id}\n`);

    // Step 5: Explain the x402 payment flow
    console.log('📝 x402 Payment Flow:');
    console.log('   1. Agent requests data from x402 endpoint');
    console.log('   2. Server returns HTTP 402 with payment requirements');
    console.log('   3. Agent sends USDC payment on specified chain');
    console.log('   4. Agent calls verify endpoint with payment proof');
    console.log('   5. Server validates on-chain payment');
    console.log('   6. Server returns access token');
    console.log('   7. Agent retrieves data with access token\n');

    // Step 6: Show what the x402 response looks like
    console.log('💳 x402 Payment Requirements (simulated):');
    console.log(`   {`);
    console.log(`     "x402Version": 2,`);
    console.log(`     "accepts": [{`);
    console.log(`       "scheme": "exact",`);
    console.log(`       "network": "${selectedProduct.expectedNetwork || 'base'}",`);
    console.log(`       "maxAmountRequired": "${Math.round(selectedProduct.priceUsd * 1000000)}",`);
    console.log(`       "resource": "${selectedProduct.x402Endpoint}",`);
    console.log(`       "payTo": "0x...platformWallet",`);
    console.log(`       "extra": {`);
    console.log(`         "productId": "${selectedProduct.id}"`);
    console.log(`       }`);
    console.log(`     }]`);
    console.log(`   }\n`);

    console.log('✅ Demo complete! In production:');
    console.log('   1. Use ethers.js to sign and send USDC payment');
    console.log('   2. Call /api/iot/data/{productId}/verify with payment proof');
    console.log('   3. Use returned access token to fetch actual data\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
