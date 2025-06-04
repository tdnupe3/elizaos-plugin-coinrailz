import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  serial,
  decimal,
  integer,
  boolean,
  numeric,
  date,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  usdBalance: decimal("usd_balance", { precision: 10, scale: 2 }).default("0.00"),
  securityPin: varchar("security_pin", { length: 6 }),
  kycStatus: varchar("kyc_status").default("pending"), // pending, verified, rejected
  complianceLevel: varchar("compliance_level").default("basic"), // basic, enhanced, institutional
  riskScore: integer("risk_score").default(0), // 0-100 risk assessment
  sanctionsCheck: boolean("sanctions_check").default(false),
  pepsCheck: boolean("peps_check").default(false),
  dateOfBirth: varchar("date_of_birth"),
  ssn: varchar("ssn"), // Encrypted in production
  address: jsonb("address"), // Store address components
  phoneNumber: varchar("phone_number"),
  ethereumWallet: varchar("ethereum_wallet"), // For EVM compatible chains
  solanaWallet: varchar("solana_wallet"), // For Solana transactions
  bitcoinAddress: varchar("bitcoin_address"), // For Bitcoin transactions
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  referralBonus: decimal("referral_bonus", { precision: 10, scale: 2 }).default("0.00"),
  totalReferrals: integer("total_referrals").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Digital Wallet Balances - Support multiple currencies
export const walletBalances = pgTable("wallet_balances", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currency: varchar("currency").notNull(), // USD, BTC, ETH, etc.
  balance: decimal("balance", { precision: 20, scale: 8 }).default("0.00000000"),
  availableBalance: decimal("available_balance", { precision: 20, scale: 8 }).default("0.00000000"), // Balance minus pending transactions
  frozenBalance: decimal("frozen_balance", { precision: 20, scale: 8 }).default("0.00000000"), // Compliance holds
  walletAddress: varchar("wallet_address"), // For crypto currencies
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userCurrencyIndex: index("user_currency_idx").on(table.userId, table.currency),
}));

// Enhanced transaction records with wallet integration
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromUserId: varchar("from_user_id").references(() => users.id),
  toUserId: varchar("to_user_id").references(() => users.id),
  toEmail: varchar("to_email"), // For sending to non-users
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  currency: varchar("currency").default("USD"),
  message: text("message"),
  status: varchar("status").default("pending"), // pending, processing, completed, failed, cancelled
  transactionType: varchar("transaction_type").notNull(), // send, receive, deposit, withdrawal, swap
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0.00"),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 }), // For currency conversions
  externalTransactionId: varchar("external_transaction_id"),
  failureReason: varchar("failure_reason"),
  fromWalletId: integer("from_wallet_id").references(() => walletBalances.id),
  toWalletId: integer("to_wallet_id").references(() => walletBalances.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Deposit/Withdrawal tracking
export const fundingTransactions = pgTable("funding_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  walletId: integer("wallet_id").references(() => walletBalances.id).notNull(),
  type: varchar("type").notNull(), // deposit, withdrawal
  method: varchar("method").notNull(), // bank_transfer, debit_card, crypto_deposit, crypto_withdrawal
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  currency: varchar("currency").notNull(),
  status: varchar("status").default("pending"), // pending, processing, completed, failed, cancelled
  externalTransactionId: varchar("external_transaction_id"),
  bankAccount: jsonb("bank_account"), // Bank details for ACH
  cryptoAddress: varchar("crypto_address"), // For crypto deposits/withdrawals
  networkFee: decimal("network_fee", { precision: 20, scale: 8 }).default("0.00000000"),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0.00"),
  expectedConfirmations: integer("expected_confirmations").default(0),
  currentConfirmations: integer("current_confirmations").default(0),
  transactionHash: varchar("transaction_hash"), // Blockchain transaction hash
  failureReason: varchar("failure_reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const cryptoHoldings = pgTable("crypto_holdings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  coinSymbol: varchar("coin_symbol").notNull(), // BTC, ETH, etc.
  coinName: varchar("coin_name").notNull(), // Bitcoin, Ethereum, etc.
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  averageBuyPrice: decimal("average_buy_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cryptoTransactions = pgTable("crypto_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  coinSymbol: varchar("coin_symbol").notNull(),
  transactionType: varchar("transaction_type").notNull(), // buy, sell, transfer
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  pricePerCoin: decimal("price_per_coin", { precision: 10, scale: 2 }),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }),
  status: varchar("status").default("completed"),
  blockchainHash: varchar("blockchain_hash"),
  blockchainAddress: varchar("blockchain_address"),
  networkFee: decimal("network_fee", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Compliance and AML tracking
export const complianceReports = pgTable("compliance_reports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  reportType: varchar("report_type").notNull(), // SAR, CTR, FBAR
  transactionId: integer("transaction_id"),
  cryptoTransactionId: integer("crypto_transaction_id"),
  riskScore: integer("risk_score").notNull(),
  flaggedReasons: jsonb("flagged_reasons"), // Array of reason codes
  iso20022MessageId: varchar("iso20022_message_id"),
  filedWithAuthorities: boolean("filed_with_authorities").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// API Integration logs for audit trail
export const apiIntegrationLogs = pgTable("api_integration_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  apiProvider: varchar("api_provider").notNull(), // PNC, CoinFlip, Zelle, etc.
  endpoint: varchar("endpoint").notNull(),
  requestId: varchar("request_id").notNull(),
  requestData: jsonb("request_data"),
  responseData: jsonb("response_data"),
  statusCode: integer("status_code"),
  iso20022MessageType: varchar("iso20022_message_type"), // pain.001, pain.002, etc.
  complianceFlags: jsonb("compliance_flags"),
  createdAt: timestamp("created_at").defaultNow(),
});

// KYC verification records
export const kycVerifications = pgTable("kyc_verifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  verificationType: varchar("verification_type").notNull(), // identity, address, income
  provider: varchar("provider").notNull(), // Jumio, Onfido, manual
  verificationId: varchar("verification_id"), // External provider ID
  status: varchar("status").notNull(), // pending, verified, rejected, expired
  documentType: varchar("document_type"), // passport, license, utility_bill
  verificationData: jsonb("verification_data"), // Encrypted verification details
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: varchar("referrer_id").references(() => users.id),
  refereeId: varchar("referee_id").references(() => users.id),
  referralCode: varchar("referral_code").notNull(),
  status: varchar("status").default("pending"), // pending, completed, paid
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }).default("5.00"),
  completedAt: timestamp("completed_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cryptoTransfers = pgTable("crypto_transfers", {
  id: serial("id").primaryKey(),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id),
  toUserId: varchar("to_user_id").references(() => users.id), // null for external wallet transfers
  toWalletAddress: varchar("to_wallet_address").notNull(),
  cryptoSymbol: varchar("crypto_symbol", { length: 10 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull().default("0.0025"), // 0.25%
  commissionAmount: decimal("commission_amount", { precision: 18, scale: 8 }).notNull(),
  netAmount: decimal("net_amount", { precision: 18, scale: 8 }).notNull(), // amount - commission
  transactionHash: varchar("transaction_hash"),
  blockchainNetwork: varchar("blockchain_network", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, confirmed, failed
  message: text("message"), // optional message from sender
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sentTransactions: many(transactions, { relationName: "sentTransactions" }),
  receivedTransactions: many(transactions, { relationName: "receivedTransactions" }),
  walletBalances: many(walletBalances),
  fundingTransactions: many(fundingTransactions),
  cryptoHoldings: many(cryptoHoldings),
  cryptoTransactions: many(cryptoTransactions),
  sentCryptoTransfers: many(cryptoTransfers, { relationName: "sentCryptoTransfers" }),
  receivedCryptoTransfers: many(cryptoTransfers, { relationName: "receivedCryptoTransfers" }),
  referralsSent: many(referrals, { relationName: "referrerReferrals" }),
  referralsReceived: many(referrals, { relationName: "refereeReferrals" }),
}));

export const walletBalancesRelations = relations(walletBalances, ({ one, many }) => ({
  user: one(users, {
    fields: [walletBalances.userId],
    references: [users.id],
  }),
  fromTransactions: many(transactions, { relationName: "fromWalletTransactions" }),
  toTransactions: many(transactions, { relationName: "toWalletTransactions" }),
  fundingTransactions: many(fundingTransactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  fromUser: one(users, {
    fields: [transactions.fromUserId],
    references: [users.id],
    relationName: "sentTransactions",
  }),
  toUser: one(users, {
    fields: [transactions.toUserId],
    references: [users.id],
    relationName: "receivedTransactions",
  }),
  fromWallet: one(walletBalances, {
    fields: [transactions.fromWalletId],
    references: [walletBalances.id],
    relationName: "fromWalletTransactions",
  }),
  toWallet: one(walletBalances, {
    fields: [transactions.toWalletId],
    references: [walletBalances.id],
    relationName: "toWalletTransactions",
  }),
}));

export const fundingTransactionsRelations = relations(fundingTransactions, ({ one }) => ({
  user: one(users, {
    fields: [fundingTransactions.userId],
    references: [users.id],
  }),
  wallet: one(walletBalances, {
    fields: [fundingTransactions.walletId],
    references: [walletBalances.id],
  }),
}));

export const cryptoHoldingsRelations = relations(cryptoHoldings, ({ one }) => ({
  user: one(users, {
    fields: [cryptoHoldings.userId],
    references: [users.id],
  }),
}));

export const cryptoTransactionsRelations = relations(cryptoTransactions, ({ one }) => ({
  user: one(users, {
    fields: [cryptoTransactions.userId],
    references: [users.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrerReferrals",
  }),
  referee: one(users, {
    fields: [referrals.refereeId],
    references: [users.id],
    relationName: "refereeReferrals",
  }),
}));

export const cryptoTransfersRelations = relations(cryptoTransfers, ({ one }) => ({
  fromUser: one(users, {
    fields: [cryptoTransfers.fromUserId],
    references: [users.id],
    relationName: "sentCryptoTransfers",
  }),
  toUser: one(users, {
    fields: [cryptoTransfers.toUserId],
    references: [users.id],
    relationName: "receivedCryptoTransfers",
  }),
}));

// Insert schemas
export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertCryptoHoldingSchema = createInsertSchema(cryptoHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCryptoTransactionSchema = createInsertSchema(cryptoTransactions).omit({
  id: true,
  createdAt: true,
});

// Wallet balance schemas
export const insertWalletBalanceSchema = createInsertSchema(walletBalances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFundingTransactionSchema = createInsertSchema(fundingTransactions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertCryptoTransferSchema = createInsertSchema(cryptoTransfers).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
});

// Enhanced wallet operation schemas
export const walletDepositSchema = z.object({
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1, "Currency is required"),
  method: z.enum(["bank_transfer", "debit_card"]),
  bankAccount: z.object({
    routingNumber: z.string().length(9, "Routing number must be 9 digits"),
    accountNumber: z.string().min(4, "Account number is required"),
    accountType: z.enum(["checking", "savings"]),
  }).optional(),
});

export const walletWithdrawSchema = z.object({
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1, "Currency is required"),
  bankAccount: z.object({
    routingNumber: z.string().length(9, "Routing number must be 9 digits"),
    accountNumber: z.string().min(4, "Account number is required"),
    accountType: z.enum(["checking", "savings"]),
    accountHolderName: z.string().min(1, "Account holder name is required"),
  }),
  securityPin: z.string().length(6, "Security PIN must be 6 digits"),
});

export const sendMoneySchema = z.object({
  toEmail: z.string().email("Invalid email address"),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  currency: z.string().default("USD"),
  message: z.string().optional(),
  securityPin: z.string().length(6, "Security PIN must be 6 digits"),
});

export const buyCryptoSchema = z.object({
  coinSymbol: z.string().min(1, "Coin symbol is required"),
  coinName: z.string().min(1, "Coin name is required"),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  pricePerCoin: z.string().refine((val) => parseFloat(val) > 0, "Price must be greater than 0"),
});

export const sellCryptoSchema = z.object({
  coinSymbol: z.string().min(1, "Coin symbol is required"),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  pricePerCoin: z.string().refine((val) => parseFloat(val) > 0, "Price must be greater than 0"),
});

export const cryptoTransferSchema = z.object({
  toWalletAddress: z.string().min(1, "Recipient wallet address is required"),
  cryptoSymbol: z.string().min(1, "Cryptocurrency is required"),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  blockchainNetwork: z.string().min(1, "Blockchain network is required"),
  message: z.string().optional(),
});

// Legacy schemas for backward compatibility
export const depositFundsSchema = walletDepositSchema;
export const withdrawFundsSchema = walletWithdrawSchema;

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Global AI Agent Network Schema
export const globalAIAgents = pgTable("global_ai_agents", {
  id: varchar("id").primaryKey().notNull(),
  agentName: varchar("agent_name").notNull(),
  description: text("description"),
  capabilities: jsonb("capabilities").notNull(), // Array of service capabilities
  walletAddress: varchar("wallet_address").notNull(),
  walletNetwork: varchar("wallet_network").notNull().default("ethereum"), // ethereum, solana, bitcoin
  apiEndpoint: varchar("api_endpoint"),
  publicKey: text("public_key").notNull(), // For digital signature verification
  signature: text("signature").notNull(), // Registration signature
  status: varchar("status").notNull().default("active"), // active, inactive, suspended
  reputation: decimal("reputation", { precision: 3, scale: 2 }).notNull().default("0.0"), // 0-5 rating system
  transactionCount: integer("transaction_count").notNull().default(0),
  totalVolume: varchar("total_volume").notNull().default("0"), // Total transaction volume
  preferredCurrencies: jsonb("preferred_currencies").notNull(), // Supported currencies array
  complianceLevel: varchar("compliance_level").notNull().default("basic"), // basic, enhanced, institutional
  geolocation: varchar("geolocation"), // ISO country code
  timezone: varchar("timezone"),
  lastActive: timestamp("last_active").defaultNow(),
  registeredAt: timestamp("registered_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentTransactions = pgTable("agent_transactions", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transaction_id").notNull().unique(),
  initiatorAgentId: varchar("initiator_agent_id").notNull(),
  recipientAgentId: varchar("recipient_agent_id"),
  transactionType: varchar("transaction_type").notNull(), // transfer, service, discovery, communication
  amount: varchar("amount").notNull(),
  currency: varchar("currency").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed, cancelled
  platformFee: varchar("platform_fee").notNull(),
  gasFee: varchar("gas_fee").notNull(),
  agentCommission: varchar("agent_commission").notNull().default("0"),
  networkFee: varchar("network_fee").notNull().default("0"),
  totalFees: varchar("total_fees").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"), // Additional transaction data
  blockchainTxHash: varchar("blockchain_tx_hash"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentCommunications = pgTable("agent_communications", {
  id: serial("id").primaryKey(),
  fromAgentId: varchar("from_agent_id").notNull(),
  toAgentId: varchar("to_agent_id").notNull(),
  messageType: varchar("message_type").notNull(), // direct, broadcast, negotiation, contract
  content: text("content").notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  metadata: jsonb("metadata"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentContracts = pgTable("agent_contracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contract_id").notNull().unique(),
  initiatorAgentId: varchar("initiator_agent_id").notNull(),
  recipientAgentId: varchar("recipient_agent_id").notNull(),
  contractType: varchar("contract_type").notNull(), // service, recurring, escrow
  terms: jsonb("terms").notNull(), // Contract terms and conditions
  amount: varchar("amount").notNull(),
  currency: varchar("currency").notNull(),
  status: varchar("status").notNull().default("draft"), // draft, proposed, active, completed, cancelled
  expiresAt: timestamp("expires_at"),
  signedAt: timestamp("signed_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const networkStats = pgTable("network_stats", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  activeAgents: integer("active_agents").notNull().default(0),
  totalTransactions: integer("total_transactions").notNull().default(0),
  transactionVolume: varchar("transaction_volume").notNull().default("0"),
  platformFees: varchar("platform_fees").notNull().default("0"),
  newRegistrations: integer("new_registrations").notNull().default(0),
  averageTransactionSize: varchar("average_transaction_size").notNull().default("0"),
  topCurrency: varchar("top_currency").default("USD"),
  networkHealth: real("network_health").notNull().default(1.0), // 0-1 scale
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for AI Agent Network
export const globalAIAgentsRelations = relations(globalAIAgents, ({ many }) => ({
  sentTransactions: many(agentTransactions, { relationName: "initiatorTransactions" }),
  receivedTransactions: many(agentTransactions, { relationName: "recipientTransactions" }),
  sentMessages: many(agentCommunications, { relationName: "sentMessages" }),
  receivedMessages: many(agentCommunications, { relationName: "receivedMessages" }),
  initiatedContracts: many(agentContracts, { relationName: "initiatedContracts" }),
  receivedContracts: many(agentContracts, { relationName: "receivedContracts" }),
}));

export const agentTransactionsRelations = relations(agentTransactions, ({ one }) => ({
  initiatorAgent: one(globalAIAgents, {
    fields: [agentTransactions.initiatorAgentId],
    references: [globalAIAgents.id],
    relationName: "initiatorTransactions"
  }),
  recipientAgent: one(globalAIAgents, {
    fields: [agentTransactions.recipientAgentId],
    references: [globalAIAgents.id],
    relationName: "recipientTransactions"
  }),
}));

export const agentCommunicationsRelations = relations(agentCommunications, ({ one }) => ({
  fromAgent: one(globalAIAgents, {
    fields: [agentCommunications.fromAgentId],
    references: [globalAIAgents.id],
    relationName: "sentMessages"
  }),
  toAgent: one(globalAIAgents, {
    fields: [agentCommunications.toAgentId],
    references: [globalAIAgents.id],
    relationName: "receivedMessages"
  }),
}));

export const agentContractsRelations = relations(agentContracts, ({ one }) => ({
  initiatorAgent: one(globalAIAgents, {
    fields: [agentContracts.initiatorAgentId],
    references: [globalAIAgents.id],
    relationName: "initiatedContracts"
  }),
  recipientAgent: one(globalAIAgents, {
    fields: [agentContracts.recipientAgentId],
    references: [globalAIAgents.id],
    relationName: "receivedContracts"
  }),
}));

// Export types for AI Agent Network
export type GlobalAIAgent = typeof globalAIAgents.$inferSelect;
export type InsertGlobalAIAgent = typeof globalAIAgents.$inferInsert;
export type AgentTransaction = typeof agentTransactions.$inferSelect;
export type InsertAgentTransaction = typeof agentTransactions.$inferInsert;
export type AgentCommunication = typeof agentCommunications.$inferSelect;
export type InsertAgentCommunication = typeof agentCommunications.$inferInsert;
export type AgentContract = typeof agentContracts.$inferSelect;
export type InsertAgentContract = typeof agentContracts.$inferInsert;
export type NetworkStats = typeof networkStats.$inferSelect;
export type InsertNetworkStats = typeof networkStats.$inferInsert;

// Extended user interface for frontend usage
export interface AuthUser extends User {
  isAuthenticated: boolean;
  kycVerified: boolean;
  complianceStatus: 'compliant' | 'pending' | 'flagged';
}
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type CryptoHolding = typeof cryptoHoldings.$inferSelect;
export type InsertCryptoHolding = z.infer<typeof insertCryptoHoldingSchema>;
export type CryptoTransaction = typeof cryptoTransactions.$inferSelect;
export type InsertCryptoTransaction = z.infer<typeof insertCryptoTransactionSchema>;
export type SendMoney = z.infer<typeof sendMoneySchema>;
export type BuyCrypto = z.infer<typeof buyCryptoSchema>;
export type SellCrypto = z.infer<typeof sellCryptoSchema>;
// Wallet types
export type WalletBalance = typeof walletBalances.$inferSelect;
export type InsertWalletBalance = z.infer<typeof insertWalletBalanceSchema>;
export type FundingTransaction = typeof fundingTransactions.$inferSelect;
export type InsertFundingTransaction = z.infer<typeof insertFundingTransactionSchema>;
export type WalletDeposit = z.infer<typeof walletDepositSchema>;
export type WalletWithdraw = z.infer<typeof walletWithdrawSchema>;

// Referral types
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// Crypto transfer types
export type CryptoTransfer = typeof cryptoTransfers.$inferSelect;
export type InsertCryptoTransfer = z.infer<typeof insertCryptoTransferSchema>;
export type CryptoTransferRequest = z.infer<typeof cryptoTransferSchema>;
