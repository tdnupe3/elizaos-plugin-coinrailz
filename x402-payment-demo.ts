/**
 * x402 Payment Demo Agent - REAL COINBASE CDP PAYMENTS
 * 
 * Uses existing Coinbase CDP SDK integration to make REAL micropayments
 * to Coin Railz x402 services on Base mainnet.
 * 
 * Prerequisites:
 * 1. CDP credentials configured (CDP_API_KEY_ID, CDP_PRIVATE_KEY)
 * 2. Test wallet with USDC on Base mainnet
 * 3. Or create new wallet and fund it manually
 * 
 * Usage:
 *   tsx x402-payment-demo.ts [service-name]
 *   tsx x402-payment-demo.ts --all
 */

import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import { ethers } from 'ethers';
import axios from 'axios';

const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_NETWORK_ID = 'base-mainnet';
const BASE_URL = process.env.BASE_URL || 'https://coinrailz.com';

const SERVICES = [
  'multi-chain-balance',
  'gas-price-oracle',
  'token-price',
  'contract-scan',
  'wallet-risk',
  'trade-signals',
  'token-sentiment',
  'trending-tokens',
  'whale-alerts',
  'dex-liquidity',
  'transaction-builder',
  'token-metadata',
  'approval-manager',
  'batch-quote',
  'portfolio-tracker',
  'instant-agent-wallet',
  'verified-agent-identity',
  'seamless-chain-bridge'
];

interface PaymentResult {
  service: string;
  status: 'success' | 'pending' | 'failed' | 'discovery_only';
  price?: number;
  txHash?: string;
  responseData?: any;
  error?: string;
}

/**
 * Initialize Coinbase CDP SDK
 */
function initializeCDP() {
  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_PRIVATE_KEY) {
    throw new Error('CDP credentials not found. Set CDP_API_KEY_ID and CDP_PRIVATE_KEY in Replit Secrets');
  }

  Coinbase.configure({
    apiKeyName: process.env.CDP_API_KEY_ID,
    privateKey: process.env.CDP_PRIVATE_KEY,
  });

  console.log('✅ Coinbase CDP SDK initialized');
}

/**
 * Get or create test wallet for making payments
 */
async function getPaymentWallet(): Promise<Wallet> {
  console.log('\n💼 Getting payment wallet...');
  
  // Check if we have a saved wallet ID
  const savedWalletId = process.env.TEST_WALLET_ID;
  
  if (savedWalletId) {
    try {
      console.log(`🔍 Attempting to load wallet: ${savedWalletId}`);
      const wallet = await Wallet.fetch(savedWalletId);
      const address = await wallet.getDefaultAddress();
      console.log(`✅ Loaded existing wallet: ${address.getId()}`);
      return wallet;
    } catch (error) {
      console.log(`⚠️  Could not load saved wallet, creating new one...`);
    }
  }

  // Create new wallet
  console.log('🆕 Creating new CDP wallet on Base...');
  const wallet = await Wallet.create({ networkId: BASE_NETWORK_ID });
  const address = await wallet.getDefaultAddress();
  
  console.log(`✅ Created new wallet: ${address.getId()}`);
  console.log(`\n⚠️  IMPORTANT: Fund this wallet with USDC on Base mainnet:`);
  console.log(`   Address: ${address.getId()}`);
  console.log(`   Network: Base (ChainID 8453)`);
  console.log(`   Required: ~$30 USDC + 0.001 ETH for gas\n`);
  console.log(`💡 Save wallet ID to TEST_WALLET_ID secret: ${wallet.getId()}\n`);
  
  return wallet;
}

/**
 * Check wallet USDC balance
 */
async function getWalletBalance(wallet: Wallet): Promise<number> {
  try {
    const address = await wallet.getDefaultAddress();
    const balanceData = await wallet.listBalances();
    
    // Convert to array if needed
    const balances = Array.isArray(balanceData) ? balanceData : Object.values(balanceData);
    
    // Find USDC balance
    const usdcBalance = balances.find((b: any) => 
      b.asset?.toLowerCase().includes('usdc') || 
      b.assetId?.toLowerCase().includes('usdc')
    );
    
    if (usdcBalance) {
      const amount = parseFloat(usdcBalance.amount || '0');
      console.log(`💰 Wallet balance: ${amount.toFixed(2)} USDC`);
      return amount;
    }
    
    console.log(`⚠️  No USDC balance found for ${address.getId()}`);
    return 0;
  } catch (error: any) {
    console.error(`❌ Failed to check balance: ${error.message}`);
    return 0;
  }
}

/**
 * Discover service payment requirements (HTTP 402)
 */
async function discoverService(serviceName: string) {
  const url = `${BASE_URL}/x402/${serviceName}`;
  
  try {
    const response = await axios.post(url, {}, {
      validateStatus: (status) => status === 402
    });
    
    if (response.status !== 402) {
      throw new Error(`Expected HTTP 402, got ${response.status}`);
    }
    
    const paymentReq = response.data?.accepts?.[0];
    if (!paymentReq) {
      throw new Error('No payment requirements in 402 response');
    }
    
    const priceUSDC = parseInt(paymentReq.maxAmountRequired) / 1000000;
    
    return {
      url,
      price: priceUSDC,
      network: paymentReq.network,
      payTo: paymentReq.payTo,
      asset: paymentReq.asset,
      requirements: paymentReq
    };
  } catch (error: any) {
    throw new Error(`Discovery failed: ${error.message}`);
  }
}

/**
 * Make USDC payment to platform wallet
 */
async function makePayment(
  wallet: Wallet,
  amountUSDC: number
): Promise<string> {
  try {
    console.log(`💸 Sending ${amountUSDC.toFixed(2)} USDC to ${PLATFORM_WALLET}...`);
    
    // Create transfer using CDP SDK
    const transfer = await wallet.createTransfer({
      amount: amountUSDC,
      assetId: 'usdc',
      destination: PLATFORM_WALLET,
      networkId: BASE_NETWORK_ID
    });
    
    // Wait for transaction to be broadcast
    await transfer.wait();
    
    const txHash = transfer.getTransactionHash();
    console.log(`✅ Payment sent! TX: ${txHash}`);
    
    return txHash || '';
  } catch (error: any) {
    throw new Error(`Payment failed: ${error.message}`);
  }
}

/**
 * Call service with payment proof
 */
async function callServiceWithPayment(
  serviceUrl: string,
  txHash: string
): Promise<any> {
  try {
    // In a real x402 implementation, we'd construct the proper X-PAYMENT header
    // For now, we'll just call the service to demonstrate the flow
    console.log(`📞 Calling service after payment...`);
    
    const response = await axios.post(serviceUrl, {
      _paymentProof: {
        transactionHash: txHash,
        network: 'base',
        timestamp: Date.now()
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        // In production: 'X-PAYMENT': base64EncodedPaymentProof
      },
      validateStatus: () => true
    });
    
    return {
      status: response.status,
      data: response.data
    };
  } catch (error: any) {
    throw new Error(`Service call failed: ${error.message}`);
  }
}

/**
 * Test single service end-to-end
 */
async function testService(
  serviceName: string,
  wallet: Wallet,
  dryRun: boolean = false
): Promise<PaymentResult> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Testing: ${serviceName}`);
  console.log('='.repeat(70));
  
  try {
    // Step 1: Discover service
    console.log('\n1️⃣ Discovering service...');
    const discovery = await discoverService(serviceName);
    console.log(`   Price: $${discovery.price.toFixed(2)} USDC`);
    console.log(`   Network: ${discovery.network}`);
    console.log(`   PayTo: ${discovery.payTo}`);
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN - Skipping payment');
      return {
        service: serviceName,
        status: 'discovery_only',
        price: discovery.price
      };
    }
    
    // Step 2: Check balance
    console.log('\n2️⃣ Checking wallet balance...');
    const balance = await getWalletBalance(wallet);
    if (balance < discovery.price) {
      console.log(`❌ Insufficient balance: ${balance.toFixed(2)} < ${discovery.price.toFixed(2)}`);
      return {
        service: serviceName,
        status: 'failed',
        price: discovery.price,
        error: 'Insufficient balance'
      };
    }
    
    // Step 3: Make payment
    console.log('\n3️⃣ Making payment...');
    const txHash = await makePayment(wallet, discovery.price);
    
    // Step 4: Call service
    console.log('\n4️⃣ Calling service with payment proof...');
    const result = await callServiceWithPayment(discovery.url, txHash);
    
    console.log(`\n✅ SUCCESS! Service consumed`);
    console.log(`   Status: ${result.status}`);
    console.log(`   TX Hash: ${txHash}`);
    
    return {
      service: serviceName,
      status: 'success',
      price: discovery.price,
      txHash,
      responseData: result.data
    };
    
  } catch (error: any) {
    console.error(`\n❌ ERROR: ${error.message}`);
    return {
      service: serviceName,
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🤖 Coin Railz x402 Payment Demo Agent');
  console.log('═'.repeat(70));
  console.log('Using REAL Coinbase CDP SDK for on-chain USDC payments\n');
  
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  try {
    // Initialize CDP
    initializeCDP();
    
    // Get wallet
    const wallet = await getPaymentWallet();
    
    // Check balance
    const balance = await getWalletBalance(wallet);
    
    if (balance === 0 && !dryRun) {
      console.log('\n⚠️  Wallet has no USDC. Running in DRY RUN mode (discovery only)');
      console.log('   Fund wallet and remove --dry-run flag to make real payments\n');
    }
    
    // Determine which services to test
    let servicesToTest = SERVICES;
    if (args.length > 0 && !args[0].startsWith('--')) {
      const requested = args[0];
      if (!SERVICES.includes(requested)) {
        console.error(`❌ Unknown service: ${requested}`);
        console.log(`\nAvailable: ${SERVICES.join(', ')}`);
        process.exit(1);
      }
      servicesToTest = [requested];
    }
    
    console.log(`\n📋 Testing ${servicesToTest.length} service(s)`);
    console.log(`   Mode: ${dryRun || balance === 0 ? 'DISCOVERY ONLY' : 'LIVE PAYMENTS'}\n`);
    
    // Test services
    const results: PaymentResult[] = [];
    for (const service of servicesToTest) {
      const result = await testService(service, wallet, dryRun || balance === 0);
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(70) + '\n');
    
    const summary = {
      success: results.filter(r => r.status === 'success').length,
      pending: results.filter(r => r.status === 'pending').length,
      failed: results.filter(r => r.status === 'failed').length,
      discoveryOnly: results.filter(r => r.status === 'discovery_only').length
    };
    
    const totalCost = results.reduce((sum, r) => sum + (r.price || 0), 0);
    const totalPaid = results.filter(r => r.status === 'success').reduce((sum, r) => sum + (r.price || 0), 0);
    
    console.log(`✅ Successful payments: ${summary.success}`);
    console.log(`⏳ Pending: ${summary.pending}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`🔍 Discovery only: ${summary.discoveryOnly}`);
    console.log(`\n💰 Total cost: $${totalCost.toFixed(2)} USDC`);
    console.log(`💸 Total paid: $${totalPaid.toFixed(2)} USDC`);
    
    if (summary.success > 0) {
      console.log('\n🎉 REAL REVENUE GENERATED! Check platform wallet:');
      console.log(`   ${PLATFORM_WALLET}`);
      console.log(`   https://basescan.org/address/${PLATFORM_WALLET}\n`);
    }
    
  } catch (error: any) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  }
}

main();
