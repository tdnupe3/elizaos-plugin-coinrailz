import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  decimal,
  integer,
  boolean,
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
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  referralBonus: decimal("referral_bonus", { precision: 10, scale: 2 }).default("0.00"),
  totalReferrals: integer("total_referrals").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromUserId: varchar("from_user_id").references(() => users.id),
  toUserId: varchar("to_user_id").references(() => users.id),
  toEmail: varchar("to_email"), // For sending to non-users
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("USD"),
  message: text("message"),
  status: varchar("status").default("completed"), // pending, completed, failed
  transactionType: varchar("transaction_type").notNull(), // send, receive, deposit, withdrawal
  createdAt: timestamp("created_at").defaultNow(),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sentTransactions: many(transactions, { relationName: "sentTransactions" }),
  receivedTransactions: many(transactions, { relationName: "receivedTransactions" }),
  cryptoHoldings: many(cryptoHoldings),
  cryptoTransactions: many(cryptoTransactions),
  referralsSent: many(referrals, { relationName: "referrerReferrals" }),
  referralsReceived: many(referrals, { relationName: "refereeReferrals" }),
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

export const sendMoneySchema = z.object({
  toEmail: z.string().email("Invalid email address"),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
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

export const depositFundsSchema = z.object({
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  paymentMethod: z.enum(["bank_transfer", "debit_card", "credit_card"]),
});

export const withdrawFundsSchema = z.object({
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  bankAccount: z.string().min(1, "Bank account is required"),
  securityPin: z.string().length(6, "Security PIN must be 6 digits"),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type CryptoHolding = typeof cryptoHoldings.$inferSelect;
export type InsertCryptoHolding = z.infer<typeof insertCryptoHoldingSchema>;
export type CryptoTransaction = typeof cryptoTransactions.$inferSelect;
export type InsertCryptoTransaction = z.infer<typeof insertCryptoTransactionSchema>;
export type SendMoney = z.infer<typeof sendMoneySchema>;
export type BuyCrypto = z.infer<typeof buyCryptoSchema>;
export type SellCrypto = z.infer<typeof sellCryptoSchema>;
export type DepositFunds = z.infer<typeof depositFundsSchema>;
export type WithdrawFunds = z.infer<typeof withdrawFundsSchema>;

// Referral types
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;
