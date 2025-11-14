/**
 * Test All 18 x402 Services - Generate Real Transactions
 */

import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import axios from 'axios';

const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';
const CDP_WALLET_ID = '24ec5699-21aa-4061-ae71-fcfe183ce081';

// All 18 services with their endpoints and test payloads
const SERVICES = [
  {
    name: 'Gas Price Oracle',
    endpoint: '/x402/gas-price-oracle',
    payload: { chains: ['ethereum', 'base'] }
  },
  {
    name: 'Token Price Feed',
    endpoint: '/x402/token-price',
    payload: { tokens: ['ETH', 'USDC'] }
  },
  {
    name: 'Multi-Chain Balance',
    endpoint: '/x402/multi-chain-balance',
    payload: { 
      walletAddress: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
      chains: ['ethereum', 'base']
    }
  },
  {
    name: 'Trending Tokens Feed',
    endpoint: '/x402/trending-tokens',
    payload: {}
  },
  {
    name: 'Token Social Sentiment',
    endpoint: '/x402/token-sentiment',
    payload: { symbol: 'ETH' }
  },
  {
    name: 'DEX Liquidity Monitor',
    endpoint: '/x402/dex-liquidity',
    payload: { tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
  },
  {
    name: 'Whale Wallet Alerts',
    endpoint: '/x402/whale-alerts',
    payload: {}
  },
  {
    name: 'Trade Signals',
    endpoint: '/x402/trade-signals',
    payload: { symbol: 'ETHUSDC' }
  },
  {
    name: 'Wallet Risk Score',
    endpoint: '/x402/wallet-risk',
    payload: { walletAddress: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91' }
  },
  {
    name: 'Contract Quick Scan',
    endpoint: '/x402/contract-scan',
    payload: { contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
  },
  {
    name: 'Token Metadata',
    endpoint: '/x402/token-metadata',
    payload: { tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
  },
  {
    name: 'Transaction Builder',
    endpoint: '/x402/transaction-builder',
    payload: { 
      type: 'swap',
      from: 'ETH',
      to: 'USDC',
      amount: '1'
    }
  },
  {
    name: 'Approval Manager',
    endpoint: '/x402/approval-manager',
    payload: { 
      walletAddress: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91'
    }
  },
  {
    name: 'Batch Quote',
    endpoint: '/x402/batch-quote',
    payload: { 
      pairs: [
        { from: 'ETH', to: 'USDC', amount: '1' },
        { from: 'USDC', to: 'ETH', amount: '1000' }
      ]
    }
  },
  {
    name: 'Portfolio Tracker',
    endpoint: '/x402/portfolio-tracker',
    payload: { walletAddress: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91' }
  },
  {
    name: 'Instant Agent Wallet',
    endpoint: '/x402/instant-agent-wallet',
    payload: { agentId: 'test-agent-001' }
  },
  {
    name: 'Verified Agent Identity',
    endpoint: '/x402/verified-agent-identity',
    payload: { 
      agentName: 'Test Agent',
      agentDescription: 'Testing identity verification',
      capabilities: ['trading', 'analytics']
    }
  },
  {
    name: 'Seamless Chain Bridge',
    endpoint: '/x402/seamless-chain-bridge',
    payload: { 
      fromChain: 'ethereum',
      toChain: 'base',
      amount: '100',
      asset: 'USDC'
    }
  }
];

async function testService(wallet: Wallet, service: typeof SERVICES[0], index: number) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${index + 1}/18] Testing: ${service.name}`);
    console.log(`${'='.repeat(80)}`);

    // Step 1: Call service to get payment requirements (HTTP 402)
    console.log('📡 Calling service to get payment requirements...');
    const response = await axios.post(
      `${BASE_URL}${service.endpoint}`,
      service.payload,
      { validateStatus: (status) => status === 402 }
    );

    if (response.status !== 402) {
      console.log(`⚠️  Unexpected status: ${response.status}`);
      return null;
    }

    const paymentReq = response.data.accepts?.[0];
    if (!paymentReq) {
      console.log('❌ No payment requirements in response');
      return null;
    }

    const priceUSDC = parseInt(paymentReq.maxAmountRequired) / 1000000;
    console.log(`   ✅ Price: $${priceUSDC} USDC`);
    console.log(`   Pay To: ${paymentReq.payTo}`);

    // Step 2: Make payment
    console.log('💸 Sending payment...');
    const transfer = await wallet.createTransfer({
      amount: priceUSDC,
      assetId: 'usdc',
      destination: paymentReq.payTo,
      gasless: false
    });

    console.log(`   Transfer ID: ${transfer.getId()}`);
    console.log(`   Waiting for confirmation...`);

    await transfer.wait();
    const txHash = transfer.getTransactionHash();
    console.log(`   ✅ Payment confirmed!`);
    console.log(`   Tx Hash: ${txHash}`);

    // Step 3: Call service with payment proof
    console.log('🔐 Calling service with payment proof...');
    const address = await wallet.getDefaultAddress();
    const serviceResponse = await axios.post(
      `${BASE_URL}${service.endpoint}`,
      service.payload,
      {
        headers: {
          'X-PAYMENT': Buffer.from(JSON.stringify({
            network: 'base',
            txHash: txHash,
            amount: Math.floor(priceUSDC * 1000000),
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            from: address.getId(),
            to: paymentReq.payTo
          })).toString('base64')
        }
      }
    );

    console.log(`   ✅ Service Response: HTTP ${serviceResponse.status}`);
    console.log(`   BaseScan: https://basescan.org/tx/${txHash}`);

    return {
      service: service.name,
      success: true,
      price: priceUSDC,
      txHash: txHash
    };

  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || JSON.stringify(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    if (error?.stack) {
      console.log(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
    }
    return {
      service: service.name,
      success: false,
      error: errorMsg
    };
  }
}

async function main() {
  console.log('🚀 TESTING ALL 18 x402 SERVICES\n');

  // Initialize CDP
  Coinbase.configure({
    apiKeyName: process.env.CDP_API_KEY_ID!,
    privateKey: process.env.CDP_PRIVATE_KEY!,
  });

  // Import wallet with proper WalletData format
  console.log('💼 Importing CDP wallet...');
  const walletData = {
    walletId: '24ec5699-21aa-4061-ae71-fcfe183ce081',
    seed: 'd569cbfa8c98396dfe932b9e63e9cb80849ed1be2f6fe4e4155f0561188326df'
  };
  const wallet = await Wallet.import(walletData);
  const address = await wallet.getDefaultAddress();
  console.log(`   Wallet: ${address.getId()}`);

  // Check balance
  const balances = await wallet.listBalances();
  console.log('   Initial balance:');
  for (const [asset, balance] of Object.entries(balances)) {
    console.log(`   ${asset}: ${balance}`);
  }

  // Test all services
  const results = [];
  for (let i = 0; i < SERVICES.length; i++) {
    const result = await testService(wallet, SERVICES[i], i);
    if (result) {
      results.push(result);
    }
    
    // Small delay between tests
    if (i < SERVICES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(80)}\n`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${SERVICES.length}`);
  console.log(`❌ Failed: ${failed.length}/${SERVICES.length}`);

  if (successful.length > 0) {
    console.log('\n✅ Successful Transactions:');
    let totalSpent = 0;
    successful.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.service}: $${r.price} USDC`);
      console.log(`      https://basescan.org/tx/${r.txHash}`);
      totalSpent += r.price;
    });
    console.log(`\n💰 Total Spent: $${totalSpent.toFixed(2)} USDC`);
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Services:');
    failed.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.service}: ${r.error}`);
    });
  }

  // Final balance
  const finalBalances = await wallet.listBalances();
  console.log('\n💼 Final Balance:');
  for (const [asset, balance] of Object.entries(finalBalances)) {
    console.log(`   ${asset}: ${balance}`);
  }

  console.log('\n✅ ALL TESTS COMPLETE!');
}

main().catch(console.error);
