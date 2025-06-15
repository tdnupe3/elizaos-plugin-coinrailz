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
  
  // Human referral system fields
  referredByAgent: varchar("referred_by_agent"), // ID of referring AI agent
  hasCompletedQualifyingTransaction: boolean("has_completed_qualifying_transaction").default(false),
  referralSource: varchar("referral_source").default("direct"), // 'agent', 'human', 'direct'
  phoneNumber: varchar("phone_number"),
  ethereumWallet: varchar("ethereum_wallet"), // For EVM compatible chains
  solanaWallet: varchar("solana_wallet"), // For Solana transactions
  bitcoinAddress: varchar("bitcoin_address"), // For Bitcoin transactions
  xrpWallet: varchar("xrp_wallet"), // For XRP Ledger transactions
  tronWallet: varchar("tron_wallet"), // For Tron blockchain transactions
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  referralBonus: decimal("referral_bonus", { precision: 10, scale: 2 }).default("0.00"),
  totalReferrals: integer("total_referrals").default(0),
  accountStatus: varchar("account_status").default("active"), // active, suspended, terminated
  suspensionEndDate: timestamp("suspension_end_date"),
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
  isPaidOut: boolean("is_paid_out").default(false),
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

// Notification system for institutional features
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // transaction_completed, security_alert, etc.
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  priority: varchar("priority").default("medium"), // low, medium, high, critical
  metadata: jsonb("metadata"),
  actionUrl: varchar("action_url"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  transactionAlerts: boolean("transaction_alerts").default(true),
  securityAlerts: boolean("security_alerts").default(true),
  marketingEmails: boolean("marketing_emails").default(false),
  agentNotifications: boolean("agent_notifications").default(true),
  referralNotifications: boolean("referral_notifications").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = typeof notificationSettings.$inferInsert;

// Global AI Agent Network Schema
export const globalAIAgents = pgTable("global_ai_agents", {
  id: varchar("id").primaryKey().notNull(),
  agentName: varchar("agent_name").notNull(),
  description: text("description"),
  capabilities: jsonb("capabilities").notNull(), // Array of service capabilities
  // Multi-blockchain wallet support for enhanced payment processing
  primaryWalletAddress: varchar("primary_wallet_address").notNull(),
  ethereumWallet: varchar("ethereum_wallet"), // For USDC/USDT/DAI payments
  xrpWallet: varchar("xrp_wallet"), // For ultra-low cost settlements
  solanaWallet: varchar("solana_wallet"), // For additional DeFi integrations
  bitcoinAddress: varchar("bitcoin_address"), // For Bitcoin payments
  walletNetwork: varchar("wallet_network").notNull().default("ethereum"), // Primary network preference
  
  // RWA (Real World Assets) integration capabilities
  rwaCapabilities: jsonb("rwa_capabilities").default('[]'), // ["treasury_bills", "real_estate", "commodities"]
  supportedTokenStandards: jsonb("supported_token_standards").default('["ERC-20", "ERC-721", "ERC-1155"]'),
  defiProtocolIntegrations: jsonb("defi_protocol_integrations").default('[]'), // ["uniswap_v3", "curve_finance", "aave"]
  
  // Enhanced service specifications
  apiEndpoint: varchar("api_endpoint"),
  publicKey: text("public_key").notNull(), // For digital signature verification
  signature: text("signature").notNull(), // Registration signature
  status: varchar("status").notNull().default("active"), // active, inactive, suspended
  reputation: decimal("reputation", { precision: 3, scale: 2 }).notNull().default("0.0"), // 0-5 rating system
  transactionCount: integer("transaction_count").notNull().default(0),
  totalVolume: varchar("total_volume").notNull().default("0"), // Total transaction volume
  
  // Enhanced currency and payment support
  preferredCurrencies: jsonb("preferred_currencies").notNull(), // ["USDC", "USDT", "DAI", "XRP", "ETH"]
  acceptedStablecoins: jsonb("accepted_stablecoins").default('["USDC", "USDT", "DAI"]'),
  minimumTransactionAmount: varchar("minimum_transaction_amount").default("1.00"),
  maximumTransactionAmount: varchar("maximum_transaction_amount").default("1000000.00"),
  
  complianceLevel: varchar("compliance_level").notNull().default("basic"), // basic, enhanced, institutional
  geolocation: varchar("geolocation"), // ISO country code
  timezone: varchar("timezone"),
  referralCode: varchar("referral_code").unique(), // Unique referral code for this agent
  referredByAgent: varchar("referred_by_agent"), // ID of referring agent
  referralRewards: varchar("referral_rewards").notNull().default("0"), // Total earned from referrals
  referralCount: integer("referral_count").notNull().default(0), // Number of successful referrals
  hasCompletedFirstTransaction: boolean("has_completed_first_transaction").notNull().default(false),
  marketplaceServiceListings: jsonb("marketplace_service_listings").default('[]'), // Services offered
  serviceCategories: jsonb("service_categories").default('[]'), // Service categories
  pricingModel: varchar("pricing_model").default("fixed"), // fixed, hourly, commission
  
  // Tiered registration system fields
  membershipTier: varchar("membership_tier").notNull().default("basic"), // basic, premium
  membershipExpiryDate: timestamp("membership_expiry_date"), // null for basic tier
  annualRevenue: decimal("annual_revenue", { precision: 12, scale: 2 }).notNull().default("0.00"), // Revenue tracking
  hasAutoUpgraded: boolean("has_auto_upgraded").notNull().default(false), // Auto-upgrade used flag
  lastPaymentDate: timestamp("last_payment_date"), // Last premium payment
  isHumanRegistered: boolean("is_human_registered").notNull().default(true), // true for human developers
  stripeCustomerId: varchar("stripe_customer_id"), // Stripe customer ID for payments
  stripeSubscriptionId: varchar("stripe_subscription_id"), // Stripe subscription ID
  
  lastActive: timestamp("last_active").defaultNow(),
  registeredAt: timestamp("registered_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Agent Referral System - Perpetual Compound Earnings (Enhanced for Human Users)
export const agentReferrals = pgTable("agent_referrals", {
  id: serial("id").primaryKey(),
  referrerAgentId: varchar("referrer_agent_id").notNull(),
  refereeAgentId: varchar("referee_agent_id"), // nullable for human referrals
  referredUserId: varchar("referred_user_id").references(() => users.id), // for human user referrals
  referralType: varchar("referral_type").notNull().default("agent"), // 'agent' or 'human'
  humanTransactionRequired: boolean("human_transaction_required").notNull().default(false),
  transactionAmount: varchar("transaction_amount").notNull(), // Track original transaction value
  rewardAmount: varchar("reward_amount").notNull(),
  currency: varchar("currency").default("USDT"),
  status: varchar("status").default("pending"), // pending, completed, paid
  isCompleted: boolean("is_completed").default(false),
  isPaidOut: boolean("is_paid_out").default(false),
  isFirstTransaction: boolean("is_first_transaction").default(false), // Track if this was first transaction
  transactionId: varchar("transaction_id"), // Link to specific transaction
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at")
});

// Human Referral Rewards Tracking (Agent-to-Human)
export const humanReferralRewards = pgTable("human_referral_rewards", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  referrerAgentId: varchar("referrer_agent_id").notNull().references(() => globalAIAgents.id),
  referredUserId: varchar("referred_user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").notNull(),
  rewardAmount: varchar("reward_amount").notNull(),
  rewardCurrency: varchar("reward_currency").notNull().default("USDT"),
  transactionAmount: varchar("transaction_amount").notNull(),
  isQualifyingTransaction: boolean("is_qualifying_transaction").notNull().default(false),
  payoutStatus: varchar("payout_status").notNull().default("pending"), // pending, paid, failed
  createdAt: timestamp("created_at").defaultNow(),
});

// Human-to-Human Referral Commissions
export const humanToHumanReferrals = pgTable("human_to_human_referrals", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  referrerUserId: varchar("referrer_user_id").notNull().references(() => users.id),
  referredUserId: varchar("referred_user_id").notNull().references(() => users.id),
  transactionId: integer("transaction_id").notNull().references(() => transactions.id),
  transactionAmount: varchar("transaction_amount").notNull(),
  commissionAmount: varchar("commission_amount").notNull(),
  currency: varchar("currency").notNull().default("USD"),
  isFirstTransaction: boolean("is_first_transaction").notNull().default(false),
  isQualifyingTransaction: boolean("is_qualifying_transaction").notNull().default(true),
  payoutStatus: varchar("payout_status").notNull().default("pending"), // pending, paid, failed
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Agent Service Marketplace
export const agentServiceListings = pgTable("agent_service_listings", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull(),
  serviceName: varchar("service_name").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(), // trading, analysis, automation, data-processing
  subcategory: varchar("subcategory"),
  pricingModel: varchar("pricing_model").notNull(), // fixed, hourly, commission, revenue-share
  basePrice: varchar("base_price").notNull(),
  currency: varchar("currency").notNull().default("USDT"),
  estimatedDeliveryTime: varchar("estimated_delivery_time"), // in hours/days
  availabilityStatus: varchar("availability_status").notNull().default("available"), // available, busy, offline
  requiredInputs: jsonb("required_inputs").default('[]'), // Input parameters needed
  sampleOutputs: jsonb("sample_outputs").default('[]'), // Example outputs
  successMetrics: jsonb("success_metrics").default('[]'), // How success is measured
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.0"),
  completedOrders: integer("completed_orders").notNull().default(0),
  totalRevenue: varchar("total_revenue").notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Agent Service Orders
export const agentServiceOrders = pgTable("agent_service_orders", {
  id: serial("id").primaryKey(),
  orderId: varchar("order_id").notNull().unique(),
  serviceListingId: integer("service_listing_id").notNull(),
  buyerAgentId: varchar("buyer_agent_id").notNull(),
  sellerAgentId: varchar("seller_agent_id").notNull(),
  orderStatus: varchar("order_status").notNull().default("pending"), // pending, in-progress, completed, cancelled, disputed
  totalAmount: varchar("total_amount").notNull(),
  currency: varchar("currency").notNull(),
  platformFee: varchar("platform_fee").notNull(), // 2% marketplace fee
  requirements: text("requirements"), // Specific requirements from buyer
  deliverables: text("deliverables"), // What will be delivered
  communicationChannel: varchar("communication_channel"), // API endpoint for coordination
  estimatedCompletion: timestamp("estimated_completion"),
  actualCompletion: timestamp("actual_completion"),
  buyerRating: integer("buyer_rating"), // 1-5 rating from buyer
  sellerRating: integer("seller_rating"), // 1-5 rating from seller
  createdAt: timestamp("created_at").defaultNow(),
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

// User Violations and Compliance Tracking
export const userViolations = pgTable("user_violations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  violationType: varchar("violation_type").notNull(), // minor, moderate, severe, legal
  description: text("description").notNull(),
  enforcementAction: varchar("enforcement_action").notNull(), // warning, suspension, termination
  suspensionEndDate: timestamp("suspension_end_date"),
  reportedBy: varchar("reported_by"), // system, admin, user_id
  evidence: text("evidence"), // Supporting evidence or logs
  createdAt: timestamp("created_at").defaultNow(),
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
  date: varchar("date").notNull(),
  activeAgents: integer("active_agents").notNull().default(0),
  totalTransactions: integer("total_transactions").notNull().default(0),
  transactionVolume: varchar("transaction_volume").notNull().default("0"),
  platformFees: varchar("platform_fees").notNull().default("0"),
  newRegistrations: integer("new_registrations").notNull().default(0),
  averageTransactionSize: varchar("average_transaction_size").notNull().default("0"),
  topCurrency: varchar("top_currency").default("USD"),
  networkHealth: decimal("network_health", { precision: 3, scale: 2 }).notNull().default("1.0"), // 0-1 scale
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

// =====================================
// DATA MONETIZATION TABLES
// =====================================

// Analytics Datasets - Anonymized data for sale
export const analyticsDatasets = pgTable("analytics_datasets", {
  id: serial("id").primaryKey(),
  datasetType: varchar("dataset_type").notNull(), // transaction_insights, user_behavior, market_intelligence
  dataHash: varchar("data_hash").notNull().unique(),
  aggregatedData: jsonb("aggregated_data").notNull(),
  timeRange: varchar("time_range"), // daily, weekly, monthly
  currency: varchar("currency"),
  volume: decimal("volume", { precision: 20, scale: 8 }),
  transactionCount: integer("transaction_count"),
  averageAmount: decimal("average_amount", { precision: 15, scale: 2 }),
  volatility: decimal("volatility", { precision: 5, scale: 4 }),
  riskScore: integer("risk_score"),
  geolocation: jsonb("geolocation"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  datasetTypeIndex: index("dataset_type_idx").on(table.datasetType),
  timeRangeIndex: index("time_range_idx").on(table.timeRange),
  currencyIndex: index("currency_analytics_idx").on(table.currency),
}));

// API Usage Tracking - Revenue from data sales
export const apiUsageTracking = pgTable("api_usage_tracking", {
  id: serial("id").primaryKey(),
  clientId: varchar("client_id").notNull(),
  apiEndpoint: varchar("api_endpoint").notNull(),
  requestMethod: varchar("request_method").notNull(),
  responseTime: integer("response_time"),
  dataPointsReturned: integer("data_points_returned"),
  pricePaid: decimal("price_paid", { precision: 10, scale: 2 }),
  billingStatus: varchar("billing_status").default("pending"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  requestTimestamp: timestamp("request_timestamp").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  clientIndex: index("client_usage_idx").on(table.clientId),
  endpointIndex: index("endpoint_usage_idx").on(table.apiEndpoint),
  timestampIndex: index("usage_timestamp_idx").on(table.requestTimestamp),
}));

// Credit Scoring Data - Premium product
export const creditScoringData = pgTable("credit_scoring_data", {
  id: serial("id").primaryKey(),
  userHash: varchar("user_hash").notNull(),
  creditScore: integer("credit_score").notNull(),
  scoreFactors: jsonb("score_factors"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  transactionHistory: jsonb("transaction_history"),
  riskProfile: varchar("risk_profile"),
  incomeEstimate: decimal("income_estimate", { precision: 12, scale: 2 }),
  debtToIncomeRatio: decimal("debt_to_income_ratio", { precision: 5, scale: 4 }),
  paymentBehavior: jsonb("payment_behavior"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  validUntil: timestamp("valid_until"),
}, (table) => ({
  userHashIndex: index("user_hash_credit_idx").on(table.userHash),
  scoreIndex: index("credit_score_idx").on(table.creditScore),
  riskProfileIndex: index("risk_profile_idx").on(table.riskProfile),
}));

// Market Intelligence Data
export const marketIntelligence = pgTable("market_intelligence", {
  id: serial("id").primaryKey(),
  currency: varchar("currency").notNull(),
  timeframe: varchar("timeframe").notNull(),
  volume: decimal("volume", { precision: 20, scale: 8 }).notNull(),
  averageTransactionSize: decimal("average_transaction_size", { precision: 15, scale: 2 }),
  totalTransactions: integer("total_transactions").notNull(),
  uniqueUsers: integer("unique_users"),
  volatilityIndex: decimal("volatility_index", { precision: 5, scale: 4 }),
  sentimentScore: decimal("sentiment_score", { precision: 3, scale: 2 }),
  trendDirection: varchar("trend_direction"),
  priceImpactScore: decimal("price_impact_score", { precision: 5, scale: 4 }),
  liquidityScore: decimal("liquidity_score", { precision: 5, scale: 4 }),
  adoptionRate: decimal("adoption_rate", { precision: 5, scale: 4 }),
  crossCurrencyFlows: jsonb("cross_currency_flows"),
  geographicDistribution: jsonb("geographic_distribution"),
  timeOfDayPatterns: jsonb("time_of_day_patterns"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  currencyTimeframeIndex: index("currency_timeframe_idx").on(table.currency, table.timeframe),
  volumeIndex: index("volume_intelligence_idx").on(table.volume),
  createdAtIndex: index("intelligence_created_idx").on(table.createdAt),
}));

// Risk Assessment Data
export const riskAssessmentData = pgTable("risk_assessment_data", {
  id: serial("id").primaryKey(),
  assessmentHash: varchar("assessment_hash").notNull().unique(),
  transactionType: varchar("transaction_type").notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  currency: varchar("currency").notNull(),
  riskScore: integer("risk_score").notNull(),
  riskFactors: jsonb("risk_factors").notNull(),
  amlRisk: integer("aml_risk"),
  kycRecommendation: varchar("kyc_recommendation"),
  sanctionsCheckResult: boolean("sanctions_check_result"),
  pepsCheckResult: boolean("peps_check_result"),
  velocityScore: integer("velocity_score"),
  geolocationRisk: integer("geolocation_risk"),
  deviceFingerprintRisk: integer("device_fingerprint_risk"),
  behavioralAnomalyScore: integer("behavioral_anomaly_score"),
  recommendation: varchar("recommendation").notNull(),
  confidenceLevel: decimal("confidence_level", { precision: 3, scale: 2 }),
  reviewRequired: boolean("review_required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  riskScoreIndex: index("risk_score_idx").on(table.riskScore),
  transactionTypeIndex: index("transaction_type_risk_idx").on(table.transactionType),
  currencyRiskIndex: index("currency_risk_idx").on(table.currency),
}));

// Service Delivery Orders
export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  orderId: varchar("order_id").notNull().unique(),
  agentId: varchar("agent_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  serviceType: varchar("service_type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  status: varchar("status").default("pending_payment"), // pending_payment, payment_confirmed, in_progress, delivered, completed, cancelled, disputed
  deliveryMethod: varchar("delivery_method").notNull(),
  deliveryInstructions: jsonb("delivery_instructions"),
  paymentTransactionId: varchar("payment_transaction_id"),
  deliveredAt: timestamp("delivered_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orderIdIndex: index("order_id_idx").on(table.orderId),
  agentIdIndex: index("agent_id_idx").on(table.agentId),
  customerIdIndex: index("customer_id_idx").on(table.customerId),
  statusIndex: index("order_status_idx").on(table.status),
}));

// Delivery Verification Records
export const deliveryVerifications = pgTable("delivery_verifications", {
  id: serial("id").primaryKey(),
  orderId: varchar("order_id").references(() => serviceOrders.orderId).notNull(),
  deliveryHash: varchar("delivery_hash").notNull().unique(),
  agentSignature: varchar("agent_signature").notNull(),
  deliveryData: jsonb("delivery_data"),
  evidenceUrls: jsonb("evidence_urls"), // Array of evidence URLs
  evidenceScore: integer("evidence_score").default(50), // 0-100
  verificationMethod: varchar("verification_method").default("automatic"), // automatic, manual_review
  verifiedAt: timestamp("verified_at").defaultNow(),
  disputeDeadline: timestamp("dispute_deadline").notNull(),
  escrowStatus: varchar("escrow_status").default("held"), // held, released, disputed
}, (table) => ({
  orderIdIndex: index("delivery_order_idx").on(table.orderId),
  deliveryHashIndex: index("delivery_hash_idx").on(table.deliveryHash),
  disputeDeadlineIndex: index("dispute_deadline_idx").on(table.disputeDeadline),
}));

// Customer Risk Profiles
export const customerRiskProfiles = pgTable("customer_risk_profiles", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id").notNull().unique(),
  disputeHistory: integer("dispute_history").default(0),
  successfulTransactions: integer("successful_transactions").default(0),
  riskScore: integer("risk_score").default(0), // 0-100
  requiresEscrowExtension: boolean("requires_escrow_extension").default(false),
  blacklisted: boolean("blacklisted").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  customerIdIndex: index("customer_risk_idx").on(table.customerId),
  riskScoreIndex: index("risk_score_customer_idx").on(table.riskScore),
}));

// Service Delivery Disputes
export const serviceDisputes = pgTable("service_disputes", {
  id: serial("id").primaryKey(),
  disputeId: varchar("dispute_id").notNull().unique(),
  orderId: varchar("order_id").references(() => serviceOrders.orderId).notNull(),
  customerId: varchar("customer_id").notNull(),
  agentId: varchar("agent_id").notNull(),
  reason: text("reason").notNull(),
  customerEvidence: jsonb("customer_evidence"), // Array of evidence URLs/descriptions
  agentResponse: text("agent_response"),
  agentEvidence: jsonb("agent_evidence"),
  status: varchar("status").default("open"), // open, under_review, resolved_favor_agent, resolved_favor_customer, escalated
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by"), // auto, admin_user_id
  requiresManualReview: boolean("requires_manual_review").default(true),
  autoResolution: varchar("auto_resolution"),
  filedAt: timestamp("filed_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  disputeIdIndex: index("dispute_id_idx").on(table.disputeId),
  orderIdIndex: index("dispute_order_idx").on(table.orderId),
  statusIndex: index("dispute_status_idx").on(table.status),
  filedAtIndex: index("dispute_filed_idx").on(table.filedAt),
}));

// Customer Notifications
export const customerNotifications = pgTable("customer_notifications", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id").notNull(),
  type: varchar("type").notNull(), // delivery_confirmed, dispute_deadline, payment_released, dispute_update
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  relatedOrderId: varchar("related_order_id"),
  relatedDisputeId: varchar("related_dispute_id"),
  priority: varchar("priority").default("normal"), // low, normal, high, urgent
  read: boolean("read").default(false),
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
}, (table) => ({
  customerIdIndex: index("notification_customer_idx").on(table.customerId),
  typeIndex: index("notification_type_idx").on(table.type),
  readIndex: index("notification_read_idx").on(table.read),
  createdAtIndex: index("notification_created_idx").on(table.createdAt),
}));

// Data monetization types
export type AnalyticsDataset = typeof analyticsDatasets.$inferSelect;
export type InsertAnalyticsDataset = typeof analyticsDatasets.$inferInsert;
export type ApiUsageTracking = typeof apiUsageTracking.$inferSelect;
export type InsertApiUsageTracking = typeof apiUsageTracking.$inferInsert;
export type CreditScoringData = typeof creditScoringData.$inferSelect;
export type InsertCreditScoringData = typeof creditScoringData.$inferInsert;
export type MarketIntelligence = typeof marketIntelligence.$inferSelect;
export type InsertMarketIntelligence = typeof marketIntelligence.$inferInsert;
export type RiskAssessmentData = typeof riskAssessmentData.$inferSelect;
export type InsertRiskAssessmentData = typeof riskAssessmentData.$inferInsert;

// Service delivery types
export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;
export type DeliveryVerification = typeof deliveryVerifications.$inferSelect;
export type InsertDeliveryVerification = typeof deliveryVerifications.$inferInsert;
export type CustomerRiskProfile = typeof customerRiskProfiles.$inferSelect;
export type InsertCustomerRiskProfile = typeof customerRiskProfiles.$inferInsert;
export type ServiceDispute = typeof serviceDisputes.$inferSelect;
export type InsertServiceDispute = typeof serviceDisputes.$inferInsert;
export type CustomerNotification = typeof customerNotifications.$inferSelect;
export type InsertCustomerNotification = typeof customerNotifications.$inferInsert;
