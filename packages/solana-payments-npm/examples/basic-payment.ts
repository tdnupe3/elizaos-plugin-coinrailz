/**
 * Basic Payment Example
 * Send USDC payments using the Coin Railz Solana SDK
 * 
 * Run with: npx ts-node examples/basic-payment.ts
 */

import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

async function main() {
  // Verify API key is set
  const apiKey = process.env.COINRAILZ_API_KEY;
  if (!apiKey) {
    console.error('ERROR: COINRAILZ_API_KEY environment variable is not set');
    console.error('Get your API key at: https://coinrailz.com/dashboard/api-keys');
    console.error('Then run: export COINRAILZ_API_KEY=your-key-here');
    process.exit(1);
  }

  // Initialize the client with your API key
  const client = new CoinRailzSolana({
    apiKey
  });

  // Check service status first
  console.log('Checking service status...');
  const status = await client.status();
  
  if (!status.success) {
    const error = status as { success: false; error: string; message: string };
    console.error('Service unavailable:', error.error, '-', error.message);
    return;
  }
  
  console.log('Service is operational:', status.status);
  console.log('Features:', status.features);

  // Send a USDC payment
  console.log('\nSending USDC payment...');
  const payment = await client.send({
    to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    amount: 1.00,
    currency: 'USDC',
    memo: 'Test payment from SDK example'
  });

  if (payment.success) {
    console.log('Payment successful!');
    console.log('Transaction ID:', payment.transactionId);
    console.log('Signature:', payment.signature);
    console.log('Amount sent:', payment.amount.gross, 'USDC');
    console.log('Fee:', payment.amount.fee, 'USDC');
    console.log('Net received:', payment.amount.net, 'USDC');
    console.log('Explorer:', payment.explorerUrl);
  } else {
    // Handle ApiError - payment failed
    const error = payment as { success: false; error: string; message: string };
    console.error('Payment failed!');
    console.error('Error code:', error.error);
    console.error('Message:', error.message);
  }
}

main().catch(console.error);
