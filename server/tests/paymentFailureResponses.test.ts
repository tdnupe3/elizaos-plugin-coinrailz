/**
 * Controlled, no-chain regression check for payment failure responses.
 *
 * Run with:
 *   npx tsx server/tests/paymentFailureResponses.test.ts
 *
 * This deliberately does not create a blockchain transaction, invoke the
 * relayer, write an intent, or execute a paid service handler.
 */
import assert from 'node:assert/strict';
import {
  buildEvmInsufficientBalanceFailure,
  buildSolanaUnderpaymentFailure,
  getEvmBalanceDetails,
  parseSolanaUnderpayment,
} from '../middleware/paymentFailureResponses';

const payer = '0x1111111111111111111111111111111111111111';
const baseUrl = 'https://coinrailz.com';

const balance = getEvmBalanceDetails(0.05, 12_500n);
assert.deepEqual(balance, {
  availableBalanceUsdc: '0.0125',
  shortfallUsdc: '0.0375',
});

const evm = buildEvmInsufficientBalanceFailure({
  serviceName: 'gas-price-oracle',
  priceUsd: 0.05,
  payerWallet: payer,
  balanceDetails: balance,
  usdcContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  paymentRecipient: '0xa4bBE37f9A6Ae2dc36a607b91eB148C0ae163C91',
  publicBaseUrl: baseUrl,
  knownAgent: 'unknown',
});

assert.equal(evm.body.error.code, 'insufficient_balance');
assert.equal(evm.body.funding_required.payer_wallet, payer);
assert.equal(evm.body.funding_required.available_balance_usdc, '0.0125');
assert.equal(evm.body.funding_required.shortfall_usdc, '0.0375');
assert.equal(evm.body.funding_required.retry.endpoint, `${baseUrl}/x402/gas-price-oracle`);
assert.equal(evm.tracking.errorMessage, 'Agent wallet has insufficient USDC balance');
assert.equal(evm.tracking.walletAddress, payer);
assert.deepEqual(evm.tracking.metadata, {
  reason: 'insufficient-balance',
  network: 'base-mainnet',
  knownAgent: 'unknown',
  requiredAmount: 0.05,
  availableBalance: '0.0125',
  shortfall: '0.0375',
  payerWallet: payer,
});

assert.deepEqual(
  parseSolanaUnderpayment('Insufficient amount: 0.010000 < 0.050000'),
  { receivedAmountUsdc: '0.010000', shortfallUsdc: '0.040000' },
);
assert.equal(parseSolanaUnderpayment('RPC request timed out'), null);
assert.equal(parseSolanaUnderpayment('Insufficient amount: 0.10 < malformed'), null);

const solana = buildSolanaUnderpaymentFailure({
  serviceName: 'solana-yield-finder',
  priceUsd: 0.05,
  verifierError: 'Insufficient amount: 0.010000 < 0.050000',
  payerWallet: '9xQeWvG816bUx9EPfEZf4Fyx1a6CkVQK7pJ5xPbp2sY',
  network: 'solana-mainnet',
  tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  paymentRecipient: 'CoinRailzSolanaTreasury',
  publicBaseUrl: baseUrl,
  facilitator: 'dexter',
});

assert.ok(solana);
assert.equal(solana.body.error.code, 'insufficient_payment_amount');
assert.equal(solana.body.payment_required.received_amount_usdc, '0.010000');
assert.equal(solana.body.payment_required.shortfall_usdc, '0.040000');
assert.equal(solana.body.payment_required.payer_wallet, '9xQeWvG816bUx9EPfEZf4Fyx1a6CkVQK7pJ5xPbp2sY');
assert.equal(solana.tracking.walletAddress, '9xQeWvG816bUx9EPfEZf4Fyx1a6CkVQK7pJ5xPbp2sY');
assert.deepEqual(solana.tracking.metadata, {
  reason: 'underpayment',
  network: 'solana-mainnet',
  facilitator: 'dexter',
  received: '0.010000',
  required: '0.050000',
  payerWallet: '9xQeWvG816bUx9EPfEZf4Fyx1a6CkVQK7pJ5xPbp2sY',
});

console.log('payment failure response contract: 20 assertions passed (no chain calls or service delivery)');