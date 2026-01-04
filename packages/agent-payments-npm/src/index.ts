/**
 * @coinrailz/agent-payments
 * AI Agent Payment Processing SDK
 * 
 * Non-custodial USDC payments for AI agents with bundled intelligence services.
 * 
 * @example
 * ```typescript
 * import { CoinRailz } from '@coinrailz/agent-payments';
 * 
 * const client = new CoinRailz({ apiKey: 'cr_live_...' });
 * 
 * // Send payment (1.5% + $0.01 fee)
 * const result = await client.send({
 *   to: '0x...',
 *   amount: 100
 * });
 * 
 * // Create invoice
 * const invoice = await client.createInvoice({
 *   amount: 50,
 *   description: 'AI service fee'
 * });
 * 
 * // Get activity reports
 * const report = await client.getReports({ period: 'weekly' });
 * ```
 */

export { CoinRailz } from './client';

export type {
  CoinRailzConfig,
  SendPaymentParams,
  SendPaymentResult,
  CreateInvoiceParams,
  InvoiceResult,
  ReportParams,
  ReportResult,
  TransactionRecord,
  BalanceResult,
  WalletResult,
  StatusResult,
  IntelligenceServiceResult,
  ApiError,
  ApiResponse
} from './types';

export const VERSION = '1.0.1';
