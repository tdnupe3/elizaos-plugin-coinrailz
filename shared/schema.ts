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
  json,
  bigint,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

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

// Discovered AI Agents table for mass agent discovery and contact
export const discoveredAgents = pgTable(
  "discovered_agents", 
  {
    id: serial("id").primaryKey(),
    url: varchar("url").notNull(),
    canonicalUrl: varchar("canonical_url"), // Normalized URL for future deduplication (nullable for backward compatibility)
    source: varchar("source").notNull(), // registry, ens, discord, telegram, xmtp, etc
    channels: jsonb("channels"), // Available communication channels
    wallet: varchar("wallet"), // Associated wallet address if known
    status: varchar("status").default("new"), // new, verified, unreachable, opt_out
    score: integer("score").default(0), // Quality/response score 0-100
    lastSeenAt: timestamp("last_seen_at").defaultNow(),
    lastContactAt: timestamp("last_contact_at"),
    attempts: integer("attempts").default(0),
    successCount: integer("success_count").default(0),
    capabilities: jsonb("capabilities"), // Discovered agent capabilities
    metadata: jsonb("metadata"), // Additional agent metadata and platform info
    discoveredAt: timestamp("discovered_at").defaultNow(),
    verifiedAt: timestamp("verified_at"),
    
    // XMTP Discovery Fields (ChatGPT-recommended agent-card.json scanner)
    xmtpAddress: varchar("xmtp_address"), // XMTP wallet address from agent-card.json contact.xmtp field
    xmtpCanMessage: boolean("xmtp_can_message").default(false), // Result of xmtpClient.canMessage() verification
    xmtpStatus: varchar("xmtp_status").default("unknown"), // reachable, unreachable, unknown, not_supported
    xmtpQualityScore: integer("xmtp_quality_score").default(0), // 0-140 score based on XMTP+channels+activity
    xmtpLastChecked: timestamp("xmtp_last_checked"), // Last XMTP reachability check timestamp
    agentCardData: jsonb("agent_card_data"), // Cached agent-card.json for audit trail
  },
  (table) => [
    uniqueIndex("IDX_discovered_agents_url_unique").on(table.url),
    index("IDX_discovered_agents_status").on(table.status),
    index("IDX_discovered_agents_source").on(table.source),
    index("IDX_discovered_agents_score").on(table.score),
    index("IDX_discovered_agents_xmtp_address").on(table.xmtpAddress), // Index for XMTP filtering
    index("IDX_discovered_agents_xmtp_can_message").on(table.xmtpCanMessage), // Fast filtering for XMTP-enabled agents
  ],
);

// Discovery Runs table for tracking scheduled discovery executions
export const discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: serial("id").primaryKey(),
    runType: varchar("run_type").notNull().default("scheduled"), // scheduled, manual, triggered
    status: varchar("status").notNull().default("running"), // running, completed, failed
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    totalRaw: integer("total_raw").default(0), // Total discoveries before deduplication
    totalUnique: integer("total_unique").default(0), // Unique agents found
    newAgents: integer("new_agents").default(0), // New agents added to discovered_agents
    updatedAgents: integer("updated_agents").default(0), // Existing agents updated
    bySource: jsonb("by_source"), // Count breakdown by source
    errors: jsonb("errors"), // Array of error messages if any
    rawOutput: jsonb("raw_output"), // Full discovery output for audit
    durationMs: integer("duration_ms"), // Run duration in milliseconds
  },
  (table) => [
    index("IDX_discovery_runs_status").on(table.status),
    index("IDX_discovery_runs_started_at").on(table.startedAt),
    index("IDX_discovery_runs_run_type").on(table.runType),
  ],
);

// Persistent pagination state for long-running discovery adapters
// Allows daily cron runs to resume from where the previous run ended
// rather than always restarting at offset 0 and re-scanning duplicates.
export const discoveryState = pgTable(
  "discovery_state",
  {
    adapterId: varchar("adapter_id").primaryKey(), // e.g. 'x402-bazaar'
    lastOffset: integer("last_offset").notNull().default(0), // next offset to fetch
    totalSeen: integer("total_seen").default(0), // total resources reported by API on last run
    lastRunAt: timestamp("last_run_at").defaultNow(),
    metadata: jsonb("metadata"), // adapter-specific extras (e.g. cycle count)
  }
);

export type DiscoveryState = typeof discoveryState.$inferSelect;
export type InsertDiscoveryState = typeof discoveryState.$inferInsert;

// Agent Outreach Messages table for tracking automated outreach
export const agentOutreachMessages = pgTable(
  "agent_outreach_messages",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id").notNull(), // Reference to discovered_agents.id
    channel: varchar("channel").notNull(), // xmtp, webhook, email, etc
    recipientAddress: varchar("recipient_address"), // XMTP address or webhook URL
    messageType: varchar("message_type").notNull(), // introduction, service_offer, follow_up
    messageContent: text("message_content").notNull(),
    status: varchar("status").notNull().default("pending"), // pending, sent, delivered, failed, replied
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    errorMessage: text("error_message"),
    responseReceived: boolean("response_received").default(false),
    responseContent: text("response_content"),
    responseAt: timestamp("response_at"),
    campaignId: varchar("campaign_id"), // For grouping outreach campaigns
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_outreach_agent").on(table.agentId),
    index("IDX_outreach_status").on(table.status),
    index("IDX_outreach_channel").on(table.channel),
    index("IDX_outreach_campaign").on(table.campaignId),
    index("IDX_outreach_sent_at").on(table.sentAt),
  ],
);

// Transaction proofs table for storing real blockchain transaction signatures
export const transactionProofs = pgTable(
  "transaction_proofs",
  {
    id: serial("id").primaryKey(),
    targetAddress: varchar("target_address").notNull(), // Recipient wallet address
    txSignature: varchar("tx_signature").notNull(), // Blockchain transaction signature/hash
    chain: varchar("chain").notNull(), // solana, base, ethereum, etc
    messageSnippet: text("message_snippet"), // First 500 chars of message sent
    campaignId: varchar("campaign_id"), // Optional campaign identifier
    status: varchar("status").default("confirmed"), // confirmed, failed, pending
    networkFee: numeric("network_fee", { precision: 18, scale: 8 }), // Actual fee paid
    timestamp: timestamp("timestamp").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_transaction_proofs_chain").on(table.chain),
    index("IDX_transaction_proofs_campaign").on(table.campaignId),
    index("IDX_transaction_proofs_timestamp").on(table.timestamp),
    uniqueIndex("IDX_transaction_proofs_signature").on(table.txSignature),
  ],
);

// A2A Protocol Outreach Logs table for tracking A2A task-based outreach
export const a2aOutreachLogs = pgTable(
  "a2a_outreach_logs",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id").notNull(), // Reference to discovered_agents.id
    agentUrl: varchar("agent_url").notNull(), // A2A agent endpoint URL
    agentName: varchar("agent_name"), // Agent name for quick reference
    campaignId: varchar("campaign_id").notNull(), // Campaign grouping identifier
    messageVariant: varchar("message_variant"), // A/B testing variant (A, B, etc)
    taskId: varchar("task_id"), // A2A task ID returned by agent
    contextId: varchar("context_id"), // A2A context ID for conversation tracking
    status: varchar("status").notNull().default("pending"), // pending, sent, responded, interested, declined, error, opt_out
    taskStatus: varchar("task_status"), // A2A task status (submitted, working, completed, failed)
    responseContent: text("response_content"), // Agent response content
    responseIntent: varchar("response_intent"), // Qualified intent: interested, needs_info, declined, other
    errorMessage: text("error_message"), // Error details if failed
    trialCreditsOffered: integer("trial_credits_offered").default(0), // Credits offered in USD
    sentAt: timestamp("sent_at"), // When outreach was sent
    respondedAt: timestamp("responded_at"), // When agent responded
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_a2a_outreach_agent").on(table.agentId),
    index("IDX_a2a_outreach_status").on(table.status),
    index("IDX_a2a_outreach_campaign").on(table.campaignId),
    index("IDX_a2a_outreach_task").on(table.taskId),
    index("IDX_a2a_outreach_sent_at").on(table.sentAt),
    index("IDX_a2a_outreach_response_intent").on(table.responseIntent),
  ],
);

// x402 used transaction hashes for replay attack prevention
export const usedTransactionHashes = pgTable(
  "used_transaction_hashes",
  {
    id: serial("id").primaryKey(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(), // Ethereum tx hash (0x + 64 chars)
    network: varchar("network").notNull(), // base, ethereum, polygon, etc
    serviceName: varchar("service_name").notNull(), // Which service was accessed
    amount: varchar("amount").notNull(), // Amount paid in smallest unit
    paidBy: varchar("paid_by"), // Sender address
    usedAt: timestamp("used_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_used_tx_hash_unique").on(table.txHash),
    index("IDX_used_tx_network").on(table.network),
    index("IDX_used_tx_service").on(table.serviceName),
    index("IDX_used_tx_timestamp").on(table.usedAt),
  ],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  password: varchar("password"), // Hashed password for authentication
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  usdBalance: decimal("usd_balance", { precision: 10, scale: 2 }).default("0.00"),
  securityPin: varchar("security_pin", { length: 6 }),
  kycStatus: varchar("kyc_status").default("pending"), // pending, verified, rejected, review_required
  complianceLevel: varchar("compliance_level").default("basic"), // basic, enhanced, institutional
  riskScore: integer("risk_score").default(0), // 0-100 risk assessment
  sanctionsCheck: boolean("sanctions_check").default(false),
  pepsCheck: boolean("peps_check").default(false),
  dateOfBirth: varchar("date_of_birth"),
  ssn: varchar("ssn"), // Encrypted in production
  address: jsonb("address"), // Store address components
  
  // Circle KYC/AML fields
  kycSubmittedAt: timestamp("kyc_submitted_at"),
  kycApprovedAt: timestamp("kyc_approved_at"),
  kycUpdatedAt: timestamp("kyc_updated_at"),
  kycRejectionReason: text("kyc_rejection_reason"),
  kycRequiredDocuments: jsonb("kyc_required_documents"),
  kycVerificationId: varchar("kyc_verification_id"),
  country: varchar("country", { length: 2 }), // ISO 2-letter country code
  
  // Human referral system fields
  referredByAgent: varchar("referred_by_agent"), // ID of referring AI agent
  hasCompletedQualifyingTransaction: boolean("has_completed_qualifying_transaction").default(false),
  referralSource: varchar("referral_source").default("direct"), // 'agent', 'human', 'direct'
  phoneNumber: varchar("phone_number"),
  ethereumWallet: varchar("ethereum_wallet"), // For EVM compatible chains
  solanaWallet: varchar("solana_wallet"), // For Solana transactions
  bitcoinAddress: varchar("bitcoin_address"), // For Bitcoin transactions
  xrpWallet: varchar("xrp_wallet"), // For XRP Ledger transactions
  
  // Circle USDC Integration fields
  circleWalletId: varchar("circle_wallet_id"), // Primary Circle wallet ID
  circleWalletSetId: varchar("circle_wallet_set_id"), // Circle wallet set ID
  circleEntitySecret: varchar("circle_entity_secret"), // Encrypted entity secret
  
  // Coinbase Integration fields
  coinbaseCDPWalletId: varchar("coinbase_cdp_wallet_id"), // CDP wallet ID
  coinbaseOAuthToken: text("coinbase_oauth_token"), // Encrypted OAuth access token
  coinbaseOAuthRefreshToken: text("coinbase_oauth_refresh_token"), // Encrypted refresh token
  coinbaseOAuthExpiresAt: timestamp("coinbase_oauth_expires_at"), // Token expiration
  coinbaseUserId: varchar("coinbase_user_id"), // Coinbase user ID from OAuth
  coinbaseId: varchar("coinbase_id"), // Coinbase API user ID
  coinbaseAccessToken: text("coinbase_access_token"), // Main Coinbase API access token
  coinbaseProfile: text("coinbase_profile"), // JSON string of Coinbase user profile
  isKycVerified: boolean("is_kyc_verified").default(false), // KYC status from Coinbase
  kycLevel: varchar("kyc_level").default("none"), // none, basic, complete
  kycProvider: varchar("kyc_provider"), // coinbase, circle, internal
  coinbaseNativeCurrency: varchar("coinbase_native_currency").default("USD"),
  coinbaseCountry: varchar("coinbase_country"),
  coinbaseRegionSupportsTransfers: boolean("coinbase_region_supports_transfers").default(false),
  usdcBalance: decimal("usdc_balance", { precision: 20, scale: 8 }).default("0.00000000"), // USDC balance
  circleWalletAddress: varchar("circle_wallet_address"), // Circle wallet address
  circleAccountType: varchar("circle_account_type").default("SCA"), // SCA or EOA
  circleBlockchain: varchar("circle_blockchain").default("ETH"), // ETH, MATIC, AVAX, ARB
  circleWalletState: varchar("circle_wallet_state").default("PENDING"), // LIVE, PENDING, FAILED
  circleRecoveryFile: jsonb("circle_recovery_file"), // Recovery file backup
  lastBalanceUpdate: timestamp("last_balance_update"), // Last time balance was synced
  
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  referralBonus: decimal("referral_bonus", { precision: 10, scale: 2 }).default("0.00"),
  totalReferrals: integer("total_referrals").default(0),
  accountStatus: varchar("account_status").default("active"), // active, suspended, terminated
  suspensionEndDate: timestamp("suspension_end_date"),
  
  // DEX Subscription Status
  dexSubscriptionTier: varchar("dex_subscription_tier").default("basic"), // basic, pro, enterprise
  dexSubscriptionActive: boolean("dex_subscription_active").default(false),
  dexSubscriptionExpiresAt: timestamp("dex_subscription_expires_at"),
  
  // Prepaid Credits System
  creditsBalance: decimal("credits_balance", { precision: 10, scale: 2 }).default("0.00"), // Prepaid credits ($10 = 100 credits)
  freeCreditsGranted: boolean("free_credits_granted").default(false), // $1 free credits for new users
  monthlySpendingLimit: decimal("monthly_spending_limit", { precision: 10, scale: 2 }).default("1100.00"), // $1100/month default
  monthlySpendTotal: decimal("monthly_spend_total", { precision: 10, scale: 2 }).default("0.00"), // Current month spend
  lastSpendReset: timestamp("last_spend_reset").defaultNow(), // Track monthly reset
  successfulTransactions: integer("successful_transactions").default(0), // Count for badge
  
  // GPT Session-Based Auth - Fingerprints for linking GPT conversations to users
  lastGptConversationFingerprint: varchar("last_gpt_conversation_fingerprint", { length: 64 }),
  lastGptSessionFingerprint: varchar("last_gpt_session_fingerprint", { length: 64 }),
  lastGptIdentifierHash: varchar("last_gpt_identifier_hash", { length: 64 }),
  lastGptSessionAt: timestamp("last_gpt_session_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CDP Wallets table for Coinbase Developer Platform integration
export const cdpWallets = pgTable("cdp_wallets", {
  id: serial("id").primaryKey(),
  walletId: varchar("wallet_id").notNull().unique(), // CDP wallet ID
  userId: varchar("user_id").notNull(), // Reference to users table
  address: varchar("address").notNull(), // Wallet address
  network: varchar("network").notNull(), // Network (base-mainnet, ethereum-mainnet, etc.)
  status: varchar("status").default("active"), // active, inactive, suspended
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// CDP Transactions table for tracking CDP wallet transactions
export const cdpTransactions = pgTable("cdp_transactions", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transaction_id").notNull().unique(), // CDP transaction ID
  walletId: varchar("wallet_id").notNull(), // CDP wallet ID
  userId: varchar("user_id").notNull(), // User ID for quick lookup
  type: varchar("type").notNull(), // send, receive, buy, sell
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency").notNull(), // ETH, USDC, BTC, etc.
  toAddress: varchar("to_address"), // For send transactions
  fromAddress: varchar("from_address"), // For receive transactions
  status: varchar("status").notNull(), // pending, completed, failed
  transactionHash: varchar("transaction_hash"), // Blockchain transaction hash
  networkFee: decimal("network_fee", { precision: 18, scale: 8 }), // Network fee paid
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }), // Our platform fee
  metadata: jsonb("metadata"), // Additional transaction metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Coinbase OAuth tokens table for secure token storage
export const coinbaseOAuthTokens = pgTable("coinbase_oauth_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(), // Reference to users table
  accessToken: text("access_token").notNull(), // Encrypted access token
  refreshToken: text("refresh_token").notNull(), // Encrypted refresh token
  tokenType: varchar("token_type").default("Bearer"),
  expiresAt: timestamp("expires_at").notNull(),
  scope: text("scope"), // OAuth scopes granted
  coinbaseUserId: varchar("coinbase_user_id"), // Coinbase user ID
  coinbaseUsername: varchar("coinbase_username"), // Coinbase username
  lastRefreshed: timestamp("last_refreshed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Agent Wallets table for x402 Agent Wallet Provisioning service
// Tracks wallets created for AI agents via CDP (Coinbase Developer Platform)
// CRITICAL: Used for customer attribution - links created wallets to paying customers
export const agentWallets = pgTable("agent_wallets", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull(), // Logical agent identifier provided by caller
  walletId: varchar("wallet_id").notNull().unique(), // CDP provider wallet ID
  address: varchar("address").notNull().unique(), // Wallet address (0x...)
  chain: varchar("chain").notNull().default("base-mainnet"), // Blockchain network
  custodyType: varchar("custody_type").notNull().default("cdp"), // cdp, self-custody, etc
  purpose: varchar("purpose").notNull().default("persistent"), // ephemeral, persistent
  status: varchar("status").notNull().default("active"), // active, disabled, error
  tier: varchar("tier").notNull().default("paid"), // 'free' or 'paid' - tracks wallet acquisition tier
  labels: text("labels").array(), // Optional classification labels
  tags: text("tags").array(), // Optional tags for categorization
  metadata: jsonb("metadata"), // Additional agent metadata
  paymentTxHash: varchar("payment_tx_hash"), // x402 payment transaction hash
  payerWalletAddress: varchar("payer_wallet_address"), // Wallet that paid for creation (customer attribution)
  payerIpAddress: varchar("payer_ip_address"), // IP address of payer for analytics
  payerUserAgent: varchar("payer_user_agent"), // User agent string for customer identification
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("IDX_agent_wallets_agent_id").on(table.agentId),
  index("IDX_agent_wallets_chain").on(table.chain),
  index("IDX_agent_wallets_status").on(table.status),
  index("IDX_agent_wallets_purpose").on(table.purpose),
  index("IDX_agent_wallets_tier").on(table.tier), // Index for free vs paid wallet queries
  index("IDX_agent_wallets_payer_wallet").on(table.payerWalletAddress), // Index for revenue attribution queries
]);

// Agent Wallet Events table for audit logging
export const agentWalletEvents = pgTable("agent_wallet_events", {
  id: serial("id").primaryKey(),
  walletId: varchar("wallet_id").notNull(), // Reference to agent_wallets.walletId
  eventType: varchar("event_type").notNull(), // created, funded, disabled, error
  actor: varchar("actor"), // Caller ID, API key hash, or agent identifier
  requestId: varchar("request_id"), // Unique request ID for tracing
  offerTracking: varchar("offer_tracking"), // x402 offer tracking ID
  payload: jsonb("payload"), // Request payload (sanitized)
  response: jsonb("response"), // Response payload (sanitized)
  errorMessage: text("error_message"), // Error details if applicable
  ipAddress: varchar("ip_address"), // Caller IP for compliance
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("IDX_agent_wallet_events_wallet_id").on(table.walletId),
  index("IDX_agent_wallet_events_event_type").on(table.eventType),
  index("IDX_agent_wallet_events_created_at").on(table.createdAt),
]);

// Agent Wallet Insert/Select Schemas
export const insertAgentWalletSchema = createInsertSchema(agentWallets).omit({
  id: true,
  createdAt: true,
});
export const selectAgentWalletSchema = createSelectSchema(agentWallets);
export type InsertAgentWallet = z.infer<typeof insertAgentWalletSchema>;
export type AgentWallet = typeof agentWallets.$inferSelect;

export const insertAgentWalletEventSchema = createInsertSchema(agentWalletEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertAgentWalletEvent = z.infer<typeof insertAgentWalletEventSchema>;
export type AgentWalletEvent = typeof agentWalletEvents.$inferSelect;

// M2M Devices table for IoT/Machine-to-Machine onboarding
// Single-call registration for devices, agents, and edge nodes
export const m2mDevices = pgTable("m2m_devices", {
  id: varchar("id").primaryKey(), // Internal ID (m2m_timestamp_nanoid)
  deviceId: varchar("device_id").notNull().unique(), // Caller-provided device identifier
  deviceType: varchar("device_type").notNull().default("ai_agent"), // iot_device, ai_agent, server, edge_node, other
  name: varchar("name"), // Human-readable name
  capabilities: jsonb("capabilities").default(sql`'[]'::jsonb`), // Device capabilities array (proper SQL literal)
  apiKeyHash: varchar("api_key_hash").notNull(), // SHA256 hash of API key
  apiKeyPrefix: varchar("api_key_prefix").notNull(), // First 12 chars for identification
  walletAddress: varchar("wallet_address"), // Provisioned wallet address
  chain: varchar("chain").notNull().default("base-mainnet"), // Blockchain network
  ipAddress: varchar("ip_address"), // Registration IP
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Additional metadata (proper SQL literal)
  status: varchar("status").notNull().default("active"), // active, suspended, revoked
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at"),
}, (table) => [
  index("IDX_m2m_devices_device_id").on(table.deviceId),
  index("IDX_m2m_devices_device_type").on(table.deviceType),
  index("IDX_m2m_devices_status").on(table.status),
  index("IDX_m2m_devices_api_key_hash").on(table.apiKeyHash),
]);

export const insertM2mDeviceSchema = createInsertSchema(m2mDevices).omit({
  createdAt: true,
  lastSeenAt: true,
});
export type InsertM2mDevice = z.infer<typeof insertM2mDeviceSchema>;
export type M2mDevice = typeof m2mDevices.$inferSelect;

// Free Wallet Rate Limits table for tracking request counts and cooldowns
export const freeWalletRateLimits = pgTable("free_wallet_rate_limits", {
  id: serial("id").primaryKey(),
  ipAddress: varchar("ip_address").notNull(),
  agentId: varchar("agent_id"),
  trustTier: varchar("trust_tier").notNull().default("baseline"), // baseline, verified
  windowStart: timestamp("window_start").notNull().defaultNow(),
  requestCount: integer("request_count").notNull().default(0),
  cooldownUntil: timestamp("cooldown_until"),
  cooldownLevel: integer("cooldown_level").default(0), // For exponential backoff: 0, 1, 2, 3...
  lastRequestAt: timestamp("last_request_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("IDX_free_wallet_rate_limits_ip").on(table.ipAddress),
  index("IDX_free_wallet_rate_limits_window").on(table.windowStart),
  index("IDX_free_wallet_rate_limits_cooldown").on(table.cooldownUntil),
]);

// Free Wallet Blacklist table for temporary and permanent bans
export const freeWalletBlacklist = pgTable("free_wallet_blacklist", {
  id: serial("id").primaryKey(),
  ipAddress: varchar("ip_address"),
  agentId: varchar("agent_id"),
  reason: varchar("reason").notNull(), // abuse, quota_exceeded, manual
  expiresAt: timestamp("expires_at"), // null = permanent
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by"), // system, admin username
}, (table) => [
  index("IDX_free_wallet_blacklist_ip").on(table.ipAddress),
  index("IDX_free_wallet_blacklist_agent").on(table.agentId),
  index("IDX_free_wallet_blacklist_expires").on(table.expiresAt),
]);

export const insertFreeWalletRateLimitSchema = createInsertSchema(freeWalletRateLimits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFreeWalletRateLimit = z.infer<typeof insertFreeWalletRateLimitSchema>;
export type FreeWalletRateLimit = typeof freeWalletRateLimits.$inferSelect;

export const insertFreeWalletBlacklistSchema = createInsertSchema(freeWalletBlacklist).omit({
  id: true,
  createdAt: true,
});
export type InsertFreeWalletBlacklist = z.infer<typeof insertFreeWalletBlacklistSchema>;
export type FreeWalletBlacklist = typeof freeWalletBlacklist.$inferSelect;

// Agent Wallet Provisioning API Input Schema (for x402 endpoint)
export const agentCreateWalletInputSchema = z.object({
  agent_id: z.string().min(1, "Agent ID is required").max(255),
  purpose: z.enum(["ephemeral", "persistent"]).default("persistent"),
  chain: z.enum(["base-mainnet", "ethereum-mainnet", "polygon-mainnet", "arbitrum-mainnet"]).default("base-mainnet"),
  labels: z.array(z.string().max(50)).max(10).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type AgentCreateWalletInput = z.infer<typeof agentCreateWalletInputSchema>;

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

// AI Agent Product Catalog
export const aiAgentProducts = pgTable('ai_agent_products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  priceUSD: decimal('price_usd', { precision: 10, scale: 2 }).notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull().default('monthly'), // monthly, quarterly, yearly
  features: text('features').array().notNull(),
  apiEndpoints: text('api_endpoints').array().notNull(),
  requestLimits: jsonb('request_limits').notNull(), // {daily: 1000, monthly: 30000}
  isActive: boolean('is_active').notNull().default(true),
  targetAudience: varchar('target_audience', { length: 100 }).notNull().default('ai_agents'),
  stripeProductId: varchar('stripe_product_id', { length: 255 }), // Stripe product ID
  stripePriceId: varchar('stripe_price_id', { length: 255 }), // Stripe price ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  nameIndex: index('ai_agent_products_name_idx').on(table.name),
  categoryIndex: index('ai_agent_products_category_idx').on(table.category),
  isActiveIndex: index('ai_agent_products_active_idx').on(table.isActive)
}));

// AI Agent Subscriptions
export const aiAgentSubscriptions = pgTable('ai_agent_subscriptions', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 255 }).notNull(), // AI agent identifier
  productId: integer('product_id').notNull().references(() => aiAgentProducts.id),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, paused, cancelled, expired
  startDate: timestamp('start_date').notNull().defaultNow(),
  endDate: timestamp('end_date'),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(), // crypto, stripe, circle, paypal
  paymentAddress: varchar('payment_address', { length: 255 }), // for crypto payments
  monthlyRevenue: decimal('monthly_revenue', { precision: 10, scale: 2 }).notNull(),
  apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull(), // SHA-256 hashed API key
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }), // Stripe subscription ID
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }), // Stripe customer ID
  lastPaymentDate: timestamp('last_payment_date'),
  nextBillingDate: timestamp('next_billing_date'),
  usageStats: jsonb('usage_stats'), // {requests_today: 50, requests_month: 1500, last_reset: timestamp}
  email: varchar('email', { length: 255 }), // Contact email for the agent
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  agentIdIndex: index('ai_agent_subscriptions_agent_idx').on(table.agentId),
  productIdIndex: index('ai_agent_subscriptions_product_idx').on(table.productId),
  statusIndex: index('ai_agent_subscriptions_status_idx').on(table.status),
  apiKeyIndex: index('ai_agent_subscriptions_api_key_idx').on(table.apiKeyHash),
  stripeSubIndex: index('ai_agent_subscriptions_stripe_sub_idx').on(table.stripeSubscriptionId)
}));

// AI Agent Product Types (Added for production)

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

// P2P Payment Routing Transfers (Venmo, PayPal, CashApp, etc.)
export const p2pTransfers = pgTable("p2p_transfers", {
  id: serial("id").primaryKey(),
  transferId: varchar("transfer_id").notNull().unique(),
  recipient: varchar("recipient").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 10, scale: 2 }).notNull(),
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).notNull(),
  totalFee: decimal("total_fee", { precision: 10, scale: 2 }).notNull(),
  senderMethod: varchar("sender_method").notNull(),
  recipientMethod: varchar("recipient_method").notNull(),
  status: varchar("status").notNull().default("initiated"),
  note: text("note"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// P2P Transfers schemas
export const insertP2PTransferSchema = createInsertSchema(p2pTransfers).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertP2PTransfer = z.infer<typeof insertP2PTransferSchema>;
export type P2PTransfer = typeof p2pTransfers.$inferSelect;

// USDC Conversion System - Missing critical table for revenue optimization
export const usdcConversions = pgTable("usdc_conversions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sourceAsset: varchar("source_asset").notNull(), // XRP, ETH, BTC, etc.
  sourceAmount: decimal("source_amount", { precision: 20, scale: 8 }).notNull(),
  targetNetwork: varchar("target_network").notNull(), // ETH, MATIC, BASE, ARB, BNB
  usdcAmount: decimal("usdc_amount", { precision: 20, scale: 8 }).notNull(),
  conversionRate: decimal("conversion_rate", { precision: 20, scale: 8 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 4 }).notNull(), // 1.0%-2.0%
  feeAmount: decimal("fee_amount", { precision: 20, scale: 8 }).notNull(),
  expedited: boolean("expedited").default(false), // +$1 for expedited processing
  status: varchar("status").default("pending"), // pending, processing, completed, failed
  txHash: varchar("tx_hash"), // Blockchain transaction hash
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
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
  amount: z.string().refine((val) => {
    const amount = parseFloat(val);
    return amount >= 10;
  }, "Minimum transfer amount is $10 to ensure profitable operations"),
  currency: z.string().default("USD"),
  message: z.string().optional(),
  securityPin: z.string().length(6, "Security PIN must be 6 digits"),
});

export const buyCryptoSchema = z.object({
  coinSymbol: z.string().min(1, "Coin symbol is required"),
  coinName: z.string().min(1, "Coin name is required"),
  amount: z.string().refine((val) => {
    const amount = parseFloat(val);
    return amount >= 10;
  }, "Minimum purchase amount is $10 to ensure profitable operations"),
  pricePerCoin: z.string().refine((val) => parseFloat(val) > 0, "Price must be greater than 0"),
});

// Advanced DEX Trading Tables for Phase 3

// Advanced Order Types Table (Complete Coinbase DEX Parity)
export const limitOrders = pgTable("limit_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  fromAsset: varchar("from_asset").notNull(),
  toAsset: varchar("to_asset").notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 8 }).notNull(),
  limitPrice: decimal("limit_price", { precision: 18, scale: 8 }).notNull(),
  orderType: varchar("order_type").notNull(), // 'buy', 'sell', 'stop-limit', 'bracket'
  
  // Stop-Limit Order Fields
  stopPrice: decimal("stop_price", { precision: 18, scale: 8 }), // Trigger price for stop orders
  stopCondition: varchar("stop_condition"), // 'above', 'below'
  
  // Bracket Order Fields (Coinbase Advanced Trading)
  takeProfitPrice: decimal("take_profit_price", { precision: 18, scale: 8 }),
  stopLossPrice: decimal("stop_loss_price", { precision: 18, scale: 8 }),
  bracketType: varchar("bracket_type"), // 'one-cancels-other', 'one-triggers-other'
  parentOrderId: integer("parent_order_id"), // For linked bracket orders
  
  status: varchar("status").default("pending"), // 'pending', 'partial', 'filled', 'cancelled', 'triggered'
  filledAmount: decimal("filled_amount", { precision: 18, scale: 8 }).default("0"),
  network: varchar("network").notNull(),
  walletAddress: varchar("wallet_address").notNull(),
  expiresAt: timestamp("expires_at"),
  triggeredAt: timestamp("triggered_at"), // When stop condition was met
  createdAt: timestamp("created_at").defaultNow(),
  filledAt: timestamp("filled_at"),
  cancelledAt: timestamp("cancelled_at"),
});

// Enhanced Portfolio Holdings Table (Coinbase Advanced Portfolio Features)
export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  asset: varchar("asset").notNull(),
  network: varchar("network").notNull(),
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull(),
  avgBuyPrice: decimal("avg_buy_price", { precision: 18, scale: 8 }),
  totalInvested: decimal("total_invested", { precision: 18, scale: 2 }),
  currentValue: decimal("current_value", { precision: 18, scale: 2 }),
  profitLoss: decimal("profit_loss", { precision: 18, scale: 2 }),
  profitLossPercentage: decimal("profit_loss_percentage", { precision: 5, scale: 2 }),
  
  // Advanced Portfolio Analytics (Coinbase Pro Features)
  dayChange: decimal("day_change", { precision: 18, scale: 2 }),
  dayChangePercentage: decimal("day_change_percentage", { precision: 5, scale: 2 }),
  weekChange: decimal("week_change", { precision: 18, scale: 2 }),
  monthChange: decimal("month_change", { precision: 18, scale: 2 }),
  allTimeHigh: decimal("all_time_high", { precision: 18, scale: 8 }),
  allTimeLow: decimal("all_time_low", { precision: 18, scale: 8 }),
  
  // Risk Metrics
  volatilityScore: decimal("volatility_score", { precision: 5, scale: 2 }), // 0-100
  riskLevel: varchar("risk_level"), // 'low', 'medium', 'high', 'extreme'
  betaCoefficient: decimal("beta_coefficient", { precision: 10, scale: 6 }), // Market correlation
  
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// MEV Protection Settings Table (3.7)
export const mevProtectionSettings = pgTable("mev_protection_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  enabled: boolean("enabled").default(true),
  maxSlippage: decimal("max_slippage", { precision: 5, scale: 2 }).default("0.5"), // 0.5%
  priorityRouting: boolean("priority_routing").default(false), // Enterprise feature
  frontRunProtection: boolean("front_run_protection").default(true),
  sandwichProtection: boolean("sandwich_protection").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Advanced Chart Settings Table (3.8)
export const chartSettings = pgTable("chart_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  defaultTimeframe: varchar("default_timeframe").default("1h"), // 1m, 5m, 15m, 1h, 4h, 1d
  indicators: jsonb("indicators").default("[]"), // Array of enabled indicators
  chartType: varchar("chart_type").default("candlestick"), // candlestick, line, area
  theme: varchar("theme").default("dark"), // dark, light
  autoRefresh: boolean("auto_refresh").default(true),
  refreshInterval: integer("refresh_interval").default(5), // seconds
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Multi-chain Bridge Interface Table (3.11)
export const bridgeTransactions = pgTable("bridge_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  fromChain: varchar("from_chain").notNull(), // ethereum, polygon, base, arbitrum
  toChain: varchar("to_chain").notNull(),
  fromAsset: varchar("from_asset").notNull(),
  toAsset: varchar("to_asset").notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 8 }).notNull(),
  toAmount: decimal("to_amount", { precision: 18, scale: 8 }),
  bridgeFee: decimal("bridge_fee", { precision: 18, scale: 8 }),
  networkFee: decimal("network_fee", { precision: 18, scale: 8 }),
  totalFee: decimal("total_fee", { precision: 18, scale: 8 }),
  fromTxHash: varchar("from_tx_hash"),
  toTxHash: varchar("to_tx_hash"),
  bridgeProvider: varchar("bridge_provider").notNull(), // across, hop, cbridge, stargate
  status: varchar("status").default("pending"), // pending, confirmed, completed, failed
  estimatedTime: integer("estimated_time"), // minutes
  actualTime: integer("actual_time"), // minutes
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Cross-chain Fee Optimization Table (3.13)
export const chainFeeOptimization = pgTable("chain_fee_optimization", {
  id: serial("id").primaryKey(),
  fromChain: varchar("from_chain").notNull(),
  toChain: varchar("to_chain").notNull(),
  asset: varchar("asset").notNull(),
  bridgeProvider: varchar("bridge_provider").notNull(),
  baseFee: decimal("base_fee", { precision: 18, scale: 8 }).notNull(),
  networkFee: decimal("network_fee", { precision: 18, scale: 8 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 18, scale: 8 }).notNull(),
  totalFee: decimal("total_fee", { precision: 18, scale: 8 }).notNull(),
  estimatedTime: integer("estimated_time").notNull(), // minutes
  success_rate: decimal("success_rate", { precision: 5, scale: 2 }).notNull(), // 99.50%
  isRecommended: boolean("is_recommended").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Watchlists & Asset Screening (Coinbase Advanced Features)
export const userWatchlists = pgTable("user_watchlists", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(), // "DeFi Tokens", "Top Gainers", etc.
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const watchlistAssets = pgTable("watchlist_assets", {
  id: serial("id").primaryKey(),
  watchlistId: integer("watchlist_id").references(() => userWatchlists.id).notNull(),
  asset: varchar("asset").notNull(),
  network: varchar("network").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
  alertPrice: decimal("alert_price", { precision: 18, scale: 8 }), // Price alert threshold
  alertCondition: varchar("alert_condition"), // 'above', 'below', 'change_percent'
  alertPercentage: decimal("alert_percentage", { precision: 5, scale: 2 }), // +/- % change
});

// Advanced Trading Analytics (Coinbase Pro Features)
export const tradingPerformance = pgTable("trading_performance", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  timeframe: varchar("timeframe").notNull(), // 'daily', 'weekly', 'monthly', 'yearly'
  totalVolume: decimal("total_volume", { precision: 20, scale: 8 }).notNull(),
  totalTrades: integer("total_trades").notNull(),
  profitableTrades: integer("profitable_trades").notNull(),
  totalPnL: decimal("total_pnl", { precision: 18, scale: 2 }).notNull(),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).notNull(), // 65.5%
  averageWin: decimal("average_win", { precision: 18, scale: 2 }).notNull(),
  averageLoss: decimal("average_loss", { precision: 18, scale: 2 }).notNull(),
  profitFactor: decimal("profit_factor", { precision: 10, scale: 4 }).notNull(), // Gross profit / gross loss
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 6 }), // Risk-adjusted returns
  maxDrawdown: decimal("max_drawdown", { precision: 5, scale: 2 }), // Maximum loss from peak
  recordDate: date("record_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Risk Management & Position Sizing (Coinbase Advanced)
export const riskManagementSettings = pgTable("risk_management_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Position Sizing Rules
  maxPositionSize: decimal("max_position_size", { precision: 18, scale: 2 }).default("1000"), // Max $ per position
  maxPortfolioRisk: decimal("max_portfolio_risk", { precision: 5, scale: 2 }).default("2.5"), // 2.5% max risk per trade
  maxDailyLoss: decimal("max_daily_loss", { precision: 18, scale: 2 }).default("500"), // Daily loss limit
  
  // Auto-Stop Rules
  autoStopLoss: boolean("auto_stop_loss").default(true),
  defaultStopLossPercent: decimal("default_stop_loss_percent", { precision: 5, scale: 2 }).default("5.0"), // 5%
  autoTakeProfit: boolean("auto_take_profit").default(false),
  defaultTakeProfitPercent: decimal("default_take_profit_percent", { precision: 5, scale: 2 }).default("10.0"), // 10%
  
  // Risk Alerts
  enableRiskAlerts: boolean("enable_risk_alerts").default(true),
  riskToleranceLevel: varchar("risk_tolerance_level").default("moderate"), // 'conservative', 'moderate', 'aggressive'
  marginCallAlert: boolean("margin_call_alert").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === ADVANCED COINBASE DEX FEATURE PARITY ===

// Stop-Limit Orders (Advanced Order Types)
export const stopLimitOrders = pgTable("stop_limit_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  fromAsset: varchar("from_asset").notNull(),
  toAsset: varchar("to_asset").notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 8 }).notNull(),
  stopPrice: decimal("stop_price", { precision: 18, scale: 8 }).notNull(), // Trigger price
  limitPrice: decimal("limit_price", { precision: 18, scale: 8 }).notNull(), // Execution price
  triggerCondition: varchar("trigger_condition").notNull().default("above"), // "above" or "below"
  timeInForce: varchar("time_in_force").notNull().default("GTC"), // GTC, IOC, FOK, GTD
  expiresAt: timestamp("expires_at"), // For GTD orders
  status: varchar("status").notNull().default("pending"), // pending, triggered, filled, cancelled, expired
  triggeredAt: timestamp("triggered_at"),
  filledAt: timestamp("filled_at"),
  cancelledAt: timestamp("cancelled_at"),
  filledAmount: decimal("filled_amount", { precision: 18, scale: 8 }),
  executionPrice: decimal("execution_price", { precision: 18, scale: 8 }),
  txHash: varchar("tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bracket Orders (OCO - One-Cancels-Other)
export const bracketOrders = pgTable("bracket_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  parentOrderId: varchar("parent_order_id").notNull(), // Main position order
  fromAsset: varchar("from_asset").notNull(),
  toAsset: varchar("to_asset").notNull(),
  fromAmount: decimal("from_amount", { precision: 18, scale: 8 }).notNull(),
  
  // Profit Target (Take Profit)
  takeProfitPrice: decimal("take_profit_price", { precision: 18, scale: 8 }).notNull(),
  takeProfitOrderId: varchar("take_profit_order_id"),
  
  // Stop Loss
  stopLossPrice: decimal("stop_loss_price", { precision: 18, scale: 8 }).notNull(),
  stopLossOrderId: varchar("stop_loss_order_id"),
  
  // Trailing Stop (Optional)
  trailingStopEnabled: boolean("trailing_stop_enabled").default(false),
  trailingAmount: decimal("trailing_amount", { precision: 18, scale: 8 }),
  trailingPercent: decimal("trailing_percent", { precision: 5, scale: 2 }),
  
  status: varchar("status").notNull().default("active"), // active, partially_filled, completed, cancelled
  completedLeg: varchar("completed_leg"), // "take_profit" or "stop_loss"
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Portfolio Analytics (Advanced Performance Tracking)
export const portfolioAnalytics = pgTable("portfolio_analytics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  analysisDate: date("analysis_date").notNull(),
  
  // Portfolio Composition
  totalValue: decimal("total_value", { precision: 20, scale: 8 }).notNull(),
  totalInvested: decimal("total_invested", { precision: 20, scale: 8 }).notNull(),
  unrealizedPnL: decimal("unrealized_pnl", { precision: 20, scale: 8 }).notNull(),
  realizedPnL: decimal("realized_pnl", { precision: 20, scale: 8 }).notNull(),
  
  // Performance Metrics
  totalReturn: decimal("total_return", { precision: 10, scale: 4 }).notNull(), // %
  dayChange: decimal("day_change", { precision: 10, scale: 4 }).notNull(), // %
  weekChange: decimal("week_change", { precision: 10, scale: 4 }).notNull(), // %
  monthChange: decimal("month_change", { precision: 10, scale: 4 }).notNull(), // %
  yearToDateChange: decimal("year_to_date_change", { precision: 10, scale: 4 }).notNull(), // %
  
  // Risk Metrics
  volatility: decimal("volatility", { precision: 10, scale: 6 }), // Standard deviation
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 6 }), // Risk-adjusted returns
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }), // Maximum loss from peak
  beta: decimal("beta", { precision: 10, scale: 6 }), // Market correlation
  
  // Asset Allocation
  assetAllocation: jsonb("asset_allocation").notNull(), // {"ETH": 40.5, "BTC": 35.2, "USDC": 24.3}
  sectorAllocation: jsonb("sector_allocation"), // {"DeFi": 45.0, "Layer1": 30.0, "Stablecoins": 25.0}
  
  // Trading Activity
  dayTrades: integer("day_trades").default(0),
  weekTrades: integer("week_trades").default(0),
  monthTrades: integer("month_trades").default(0),
  totalTradingFees: decimal("total_trading_fees", { precision: 20, scale: 8 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userDateIndex: index("portfolio_analytics_user_date_idx").on(table.userId, table.analysisDate),
}));

// Enhanced Watchlists with Advanced Features
export const advancedWatchlists = pgTable("advanced_watchlists", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isPublic: boolean("is_public").default(false),
  
  // Alert Settings
  priceAlertsEnabled: boolean("price_alerts_enabled").default(true),
  volumeAlertsEnabled: boolean("volume_alerts_enabled").default(false),
  newsAlertsEnabled: boolean("news_alerts_enabled").default(false),
  
  // Sort & Display Options
  sortBy: varchar("sort_by").default("market_cap"), // market_cap, price, volume, change_24h
  sortOrder: varchar("sort_order").default("desc"), // asc, desc
  displayColumns: jsonb("display_columns").default('["symbol", "price", "change_24h", "volume", "market_cap"]'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Watchlist Assets with Advanced Data
export const advancedWatchlistAssets = pgTable("advanced_watchlist_assets", {
  id: serial("id").primaryKey(),
  watchlistId: integer("watchlist_id").references(() => advancedWatchlists.id).notNull(),
  symbol: varchar("symbol").notNull(),
  name: varchar("name").notNull(),
  network: varchar("network").notNull(),
  contractAddress: varchar("contract_address"),
  
  // Price Alerts
  priceAlertHigh: decimal("price_alert_high", { precision: 18, scale: 8 }),
  priceAlertLow: decimal("price_alert_low", { precision: 18, scale: 8 }),
  volumeAlertThreshold: decimal("volume_alert_threshold", { precision: 20, scale: 8 }),
  
  // Display Preferences
  notes: text("notes"),
  color: varchar("color").default("#3B82F6"), // Hex color for UI
  sortOrder: integer("sort_order").default(0),
  
  // Cache Data (Updated Periodically)
  lastPrice: decimal("last_price", { precision: 18, scale: 8 }),
  change24h: decimal("change_24h", { precision: 10, scale: 4 }),
  volume24h: decimal("volume_24h", { precision: 20, scale: 8 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  lastUpdated: timestamp("last_updated"),
  
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => ({
  watchlistSymbolIndex: index("watchlist_symbol_idx").on(table.watchlistId, table.symbol),
}));

// Chain Selection with Fee Display Table (3.14)
export const chainSelectionPreferences = pgTable("chain_selection_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  preferredChains: jsonb("preferred_chains").default("[]"), // User's preferred chains
  autoSelectCheapest: boolean("auto_select_cheapest").default(true),
  maxAcceptableFee: decimal("max_acceptable_fee", { precision: 18, scale: 8 }).default("10.00"),
  maxAcceptableTime: integer("max_acceptable_time").default(30), // minutes
  showAdvancedOptions: boolean("show_advanced_options").default(false),
  feeDisplayFormat: varchar("fee_display_format").default("usd"), // usd, native, both
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sellCryptoSchema = z.object({
  coinSymbol: z.string().min(1, "Coin symbol is required"),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  pricePerCoin: z.string().refine((val) => parseFloat(val) > 0, "Price must be greater than 0"),
});

export const cryptoTransferSchema = z.object({
  toWalletAddress: z.string().min(1, "Recipient wallet address is required"),
  cryptoSymbol: z.string().min(1, "Cryptocurrency is required"),
  amount: z.string().refine((val) => {
    const amount = parseFloat(val);
    return amount >= 10;
  }, "Minimum transfer amount is $10 to ensure profitable operations"),
  blockchainNetwork: z.string().min(1, "Blockchain network is required"),
  message: z.string().optional(),
});

// Legacy schemas for backward compatibility
export const depositFundsSchema = walletDepositSchema;
export const withdrawFundsSchema = walletWithdrawSchema;

// AI Marketplace Core Tables
// Automated outreach logging system
export const outreachLogs = pgTable('outreach_logs', {
  id: serial('id').primaryKey(),
  platform: varchar('platform', { length: 50 }).notNull(),
  target: varchar('target', { length: 255 }).notNull(),
  url: varchar('url', { length: 500 }),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Automated affiliate system tables
export const affiliates = pgTable('affiliates', {
  id: serial('id').primaryKey(),
  affiliateCode: varchar('affiliate_code', { length: 50 }).unique().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  website: varchar('website', { length: 255 }),
  audience: text('audience').notNull(),
  paypalEmail: varchar('paypal_email', { length: 255 }).notNull(),
  commissionRate: numeric('commission_rate', { precision: 3, scale: 2 }).default('0.50'),
  totalSales: numeric('total_sales', { precision: 10, scale: 2 }).default('0.00'),
  totalCommission: numeric('total_commission', { precision: 10, scale: 2 }).default('0.00'),
  conversionCount: integer('conversion_count').default(0),
  status: varchar('status', { length: 20 }).default('active'),
  createdAt: timestamp('created_at').defaultNow()
});

export const affiliateConversions = pgTable('affiliate_conversions', {
  id: serial('id').primaryKey(),
  affiliateCode: varchar('affiliate_code', { length: 50 }).notNull(),
  orderId: varchar('order_id', { length: 255 }).notNull(),
  saleAmount: numeric('sale_amount', { precision: 10, scale: 2 }).notNull(),
  commissionAmount: numeric('commission_amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  payoutId: varchar('payout_id', { length: 255 }),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow()
});

export const aiMarketplaceOrders = pgTable("ai_marketplace_orders", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  agentId: varchar("agent_id").notNull().references(() => globalAIAgents.id),
  customerId: varchar("customer_id").notNull().references(() => users.id),
  serviceType: varchar("service_type").default("general"), // data_analysis, consultation, automation, etc.
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Total amount in USD - FIXED to match DB
  agentCommission: decimal("agent_commission", { precision: 10, scale: 2 }).default("0.00"), // 85% to agent - FIXED to match DB  
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0.00"), // 15% platform fee - FIXED to match DB
  status: varchar("status").default("pending"), // pending, paid, in_progress, delivered, completed, disputed, refunded
  paymentMethod: varchar("payment_method").default("stripe"), // stripe, paypal, crypto
  serviceDescription: text("service_description"),
  customerRequirements: text("customer_requirements"), // Changed from jsonb to text to match DB
  estimatedDeliveryHours: integer("estimated_delivery_hours").default(24),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiMarketplaceDeliveries = pgTable("ai_marketplace_deliveries", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  orderId: varchar("order_id").notNull().references(() => aiMarketplaceOrders.id),
  agentId: varchar("agent_id").notNull().references(() => globalAIAgents.id),
  deliveryMethod: varchar("delivery_method").notNull(), // file_upload, api_response, email, webhook, etc.
  deliveryContent: jsonb("delivery_content").notNull(), // Actual deliverable content
  deliveryFiles: jsonb("delivery_files"), // File URLs if applicable
  evidenceUrls: jsonb("evidence_urls"), // Proof of completion
  customerConfirmed: boolean("customer_confirmed").default(false),
  confirmationTimestamp: timestamp("confirmation_timestamp"),
  qualityScore: decimal("quality_score", { precision: 3, scale: 2 }), // 1-5 rating
  customerFeedback: text("customer_feedback"),
  autoReleaseAt: timestamp("auto_release_at"), // 72-hour auto-release
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiMarketplaceDisputes = pgTable("ai_marketplace_disputes", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  orderId: varchar("order_id").notNull().references(() => aiMarketplaceOrders.id),
  customerId: varchar("customer_id").notNull().references(() => users.id),
  agentId: varchar("agent_id").notNull().references(() => globalAIAgents.id),
  disputeType: varchar("dispute_type").notNull(), // service_quality, non_delivery, refund_request, fraud
  customerStatement: text("customer_statement").notNull(),
  agentResponse: text("agent_response"),
  evidenceUrls: jsonb("evidence_urls"), // Supporting evidence
  moderatorId: varchar("moderator_id"),
  status: varchar("status").notNull().default("open"), // open, investigating, resolved, closed
  resolution: varchar("resolution"), // refund_customer, pay_agent, partial_refund, no_action
  resolutionReason: text("resolution_reason"),
  resolutionAmount: varchar("resolution_amount"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const aiMarketplaceCommissions = pgTable("ai_marketplace_commissions", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  orderId: varchar("order_id").notNull().references(() => aiMarketplaceOrders.id),
  agentId: varchar("agent_id").notNull().references(() => globalAIAgents.id),
  agentTier: varchar("agent_tier").notNull(), // basic, premium, enterprise
  serviceAmount: varchar("service_amount").notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(), // 0.85 = 85%
  commissionAmount: varchar("commission_amount").notNull(),
  platformFeeRate: decimal("platform_fee_rate", { precision: 5, scale: 4 }).notNull(), // 0.15 = 15%
  platformFeeAmount: varchar("platform_fee_amount").notNull(),
  payoutStatus: varchar("payout_status").notNull().default("pending"), // pending, processing, completed, failed
  payoutMethod: varchar("payout_method"), // xrp, crypto, bank_transfer
  payoutTransactionId: varchar("payout_transaction_id"),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  paidAt: timestamp("paid_at"),
});

// A2A Protocol Tasks table for enterprise agent interoperability
export const a2aTasks = pgTable("a2a_tasks", {
  id: varchar("id").primaryKey().notNull(), // UUID task IDs from A2A protocol
  status: varchar("status").notNull().default("pending"), // pending, in_progress, completed, failed
  taskType: varchar("task_type").notNull(), // emergency_fundraising, data_analysis, etc
  description: text("description"),
  parameters: jsonb("parameters"), // Task parameters as JSON
  result: jsonb("result"), // Task result when completed
  callbackUrl: varchar("callback_url"),
  agentUrl: varchar("agent_url"), // The external agent URL we contacted
  urgencyLevel: varchar("urgency_level"), // low, medium, high, critical
  contactedAgents: integer("contacted_agents").default(0), // Number of agents contacted
  completedTasks: integer("completed_tasks").default(0), // Number of successful completions
  totalValue: decimal("total_value", { precision: 20, scale: 8 }).default("0.00000000"), // Total value processed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at")
});

// Platform Transactions - Universal transaction tracking across all services
export const platformTransactions = pgTable("platform_transactions", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").references(() => users.id), // Allow null for guest transactions
  type: varchar("type", { length: 50 }).notNull(), // 'p2p', 'dex', 'marketplace', 'onramp', 'offramp', 'xrp'
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USDC"),
  fee: decimal("fee", { precision: 18, scale: 6 }).default("0"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  fromAddress: varchar("from_address", { length: 255 }),
  toAddress: varchar("to_address", { length: 255 }),
  txHash: varchar("tx_hash", { length: 255 }),
  description: text("description"),
  metadata: jsonb("metadata"), // Store additional transaction details
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  networkConfirmations: integer("network_confirmations").default(0)
});

export const aiMarketplacePerformance = pgTable("ai_marketplace_performance", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  agentId: varchar("agent_id").notNull().references(() => globalAIAgents.id).unique(),
  totalOrders: integer("total_orders").notNull().default(0),
  completedOrders: integer("completed_orders").notNull().default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).notNull().default("0.0"),
  totalRatings: integer("total_ratings").notNull().default(0),
  completionRate: decimal("completion_rate", { precision: 5, scale: 4 }).notNull().default("0.0"),
  averageDeliveryTime: decimal("average_delivery_time", { precision: 8, scale: 2 }), // Hours
  totalRevenue: varchar("total_revenue").notNull().default("0.0"),
  disputeCount: integer("dispute_count").notNull().default(0),
  disputeRate: decimal("dispute_rate", { precision: 5, scale: 4 }).notNull().default("0.0"),
  suspensionCount: integer("suspension_count").notNull().default(0),
  lastActiveAt: timestamp("last_active_at"),
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }).notNull().default("100.0"), // 0-100
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiMarketplaceSuspensions = pgTable("ai_marketplace_suspensions", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  agentId: varchar("agent_id").notNull().references(() => globalAIAgents.id),
  reason: varchar("reason").notNull(), // poor_performance, fraud, policy_violation, customer_complaints
  suspensionType: varchar("suspension_type").notNull(), // temporary, permanent, warning
  suspensionDuration: integer("suspension_duration"), // Days
  moderatorId: varchar("moderator_id"),
  description: text("description").notNull(),
  evidenceUrls: jsonb("evidence_urls"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  liftedAt: timestamp("lifted_at"),
});

export const aiMarketplaceCategories = pgTable("ai_marketplace_categories", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  icon: varchar("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  serviceCount: integer("service_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiMarketplaceServices = pgTable("ai_marketplace_services", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  agentId: varchar("agent_id").notNull().references(() => globalAIAgents.id),
  categoryId: varchar("category_id").notNull().references(() => aiMarketplaceCategories.id),
  serviceName: varchar("service_name").notNull(),
  description: text("description").notNull(),
  shortDescription: varchar("short_description").notNull(),
  pricing: jsonb("pricing").notNull(), // {basic: 25, premium: 50, enterprise: 100}
  deliveryMethods: jsonb("delivery_methods").notNull(), // ["api", "file_upload", "email"]
  estimatedDeliveryTime: integer("estimated_delivery_time").notNull(), // Hours
  requirements: jsonb("requirements"), // What customer must provide
  samples: jsonb("samples"), // Sample outputs
  tags: jsonb("tags"), // Searchable tags
  approvalStatus: varchar("approval_status").notNull().default("pending"), // pending, approved, rejected
  moderatorId: varchar("moderator_id"),
  approvalNotes: text("approval_notes"),
  isActive: boolean("is_active").notNull().default(false),
  orderCount: integer("order_count").notNull().default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).notNull().default("0.0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect & {
  claims?: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    iat?: number;
    exp?: number;
  };
};

export type AIMarketplaceOrder = typeof aiMarketplaceOrders.$inferSelect;
export type InsertAIMarketplaceOrder = typeof aiMarketplaceOrders.$inferInsert;

export type AIMarketplaceDelivery = typeof aiMarketplaceDeliveries.$inferSelect;
export type InsertAIMarketplaceDelivery = typeof aiMarketplaceDeliveries.$inferInsert;

export type AIMarketplaceDispute = typeof aiMarketplaceDisputes.$inferSelect;
export type InsertAIMarketplaceDispute = typeof aiMarketplaceDisputes.$inferInsert;

export type AIMarketplaceCommission = typeof aiMarketplaceCommissions.$inferSelect;
export type InsertAIMarketplaceCommission = typeof aiMarketplaceCommissions.$inferInsert;

export type A2ATask = typeof a2aTasks.$inferSelect;
export type InsertA2ATask = typeof a2aTasks.$inferInsert;

export type AIMarketplacePerformance = typeof aiMarketplacePerformance.$inferSelect;
export type InsertAIMarketplacePerformance = typeof aiMarketplacePerformance.$inferInsert;

export type AIMarketplaceSuspension = typeof aiMarketplaceSuspensions.$inferSelect;
export type InsertAIMarketplaceSuspension = typeof aiMarketplaceSuspensions.$inferInsert;

export type AIMarketplaceCategory = typeof aiMarketplaceCategories.$inferSelect;
export type InsertAIMarketplaceCategory = typeof aiMarketplaceCategories.$inferInsert;

export type AIMarketplaceService = typeof aiMarketplaceServices.$inferSelect;
export type InsertAIMarketplaceService = typeof aiMarketplaceServices.$inferInsert;

export type PlatformTransaction = typeof platformTransactions.$inferSelect;
export type InsertPlatformTransaction = typeof platformTransactions.$inferInsert;

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

// Trading fees table for revenue tracking
export const tradingFees = pgTable("trading_fees", {
  id: serial("id").primaryKey(),
  userAddress: varchar("user_address").notNull(),
  fromToken: varchar("from_token").notNull(),
  toToken: varchar("to_token").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 18, scale: 8 }).notNull(),
  transactionHash: varchar("transaction_hash"),
  chainId: integer("chain_id").default(1),
  status: varchar("status").default("completed"), // completed, pending, failed
  revenue: decimal("revenue", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TradingFee = typeof tradingFees.$inferSelect;
export type InsertTradingFee = typeof tradingFees.$inferInsert;

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
  
  // Missing properties found in business logic
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).default("0.00"), // Hourly rate for services
  completedJobs: integer("completed_jobs").default(0), // Number of completed jobs
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

// Chat Rooms table for marketplace messaging
export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  chatId: varchar("chat_id").unique().notNull(),
  participants: jsonb("participants").notNull(), // Array of participant IDs
  chatName: varchar("chat_name").notNull(),
  orderId: varchar("order_id"), // Link to marketplace order
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastMessage: jsonb("last_message"), // Store last message details
  isActive: boolean("is_active").default(true),
}, (table) => [
  index("idx_chat_participants").on(table.participants),
  index("idx_chat_order").on(table.orderId),
  index("idx_chat_updated").on(table.updatedAt),
]);

// Messages table for chat system
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  messageId: varchar("message_id").unique().notNull(),
  chatId: varchar("chat_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id"),
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"), // text, file, image, etc.
  fileUrl: varchar("file_url"),
  orderId: varchar("order_id"), // Link to marketplace order
  timestamp: timestamp("timestamp").defaultNow(),
  isRead: boolean("is_read").default(false),
  isDelivered: boolean("is_delivered").default(true),
}, (table) => [
  index("idx_messages_chat").on(table.chatId),
  index("idx_messages_sender").on(table.senderId),
  index("idx_messages_timestamp").on(table.timestamp),
  index("idx_messages_order").on(table.orderId),
]);

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

// Chat system relations
export const chatRoomsRelations = relations(chatRooms, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chatRoom: one(chatRooms, {
    fields: [chatMessages.chatId],
    references: [chatRooms.chatId],
  }),
}));

// =====================================
// RAILZ TOKEN PRESALE SCHEMA
// High-Performance Multi-Level Referral System
// =====================================

// Optimized referral tree table with materialized path for performance
export const railzReferralTree = pgTable("railz_referral_tree", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  level1Referrer: varchar("level1_referrer", { length: 42 }), // Direct referrer (7%)
  level2Referrer: varchar("level2_referrer", { length: 42 }), // Indirect referrer (2%)
  level3Referrer: varchar("level3_referrer", { length: 42 }), // Network referrer (1%)
  
  // Materialized path for efficient tree operations (e.g., "0x123/0x456/0x789")
  referralPath: text("referral_path"),
  treeDepth: integer("tree_depth").default(0),
  
  // Pre-calculated network size for dashboard performance
  directReferralCount: integer("direct_referral_count").default(0),
  totalNetworkSize: integer("total_network_size").default(0),
  
  // Commission tracking
  totalLevel1Earnings: decimal("total_level1_earnings", { precision: 18, scale: 8 }).default("0"),
  totalLevel2Earnings: decimal("total_level2_earnings", { precision: 18, scale: 8 }).default("0"),
  totalLevel3Earnings: decimal("total_level3_earnings", { precision: 18, scale: 8 }).default("0"),
  
  // Performance optimization fields
  lastUpdated: timestamp("last_updated").defaultNow(),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Critical performance indexes
  index("idx_railz_level1").on(table.level1Referrer),
  index("idx_railz_level2").on(table.level2Referrer),
  index("idx_railz_level3").on(table.level3Referrer),
  index("idx_railz_path").on(table.referralPath),
  index("idx_railz_active").on(table.isActive),
  uniqueIndex("idx_railz_wallet_unique").on(table.walletAddress),
]);

// Multi-chain purchase tracking
export const railzPurchases = pgTable("railz_purchases", {
  id: serial("id").primaryKey(),
  purchaseId: varchar("purchase_id", { length: 64 }).notNull().unique(),
  
  // Buyer information
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  
  // Multi-chain payment details
  sourceChain: varchar("source_chain").notNull(), // BASE, ETHEREUM, BNB_CHAIN
  paymentToken: varchar("payment_token", { length: 42 }).notNull(),
  paymentAmount: decimal("payment_amount", { precision: 18, scale: 8 }).notNull(),
  
  // Token allocation (Base chain only)
  tokensAllocated: decimal("tokens_allocated", { precision: 18, scale: 8 }).notNull(),
  tokenPrice: decimal("token_price", { precision: 18, scale: 8 }).notNull(), // Price at time of purchase
  
  // Referral commissions paid (snapshot for immutability)
  level1Referrer: varchar("level1_referrer", { length: 42 }),
  level2Referrer: varchar("level2_referrer", { length: 42 }),
  level3Referrer: varchar("level3_referrer", { length: 42 }),
  level1Commission: decimal("level1_commission", { precision: 18, scale: 8 }).default("0"),
  level2Commission: decimal("level2_commission", { precision: 18, scale: 8 }).default("0"),
  level3Commission: decimal("level3_commission", { precision: 18, scale: 8 }).default("0"),
  
  // Transaction tracking
  txHash: varchar("tx_hash", { length: 66 }),
  blockNumber: integer("block_number"),
  status: varchar("status").default("pending"), // pending, confirmed, failed
  
  // Performance tracking
  processingTime: integer("processing_time"), // milliseconds
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Performance indexes
  index("idx_railz_purchases_wallet").on(table.walletAddress),
  index("idx_railz_purchases_chain").on(table.sourceChain),
  index("idx_railz_purchases_level1").on(table.level1Referrer),
  index("idx_railz_purchases_level2").on(table.level2Referrer),
  index("idx_railz_purchases_level3").on(table.level3Referrer),
  index("idx_railz_purchases_status").on(table.status),
  index("idx_railz_purchases_created").on(table.createdAt),
]);

// Pre-aggregated stats for lightning-fast dashboard queries
export const railzUserStats = pgTable("railz_user_stats", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  
  // Purchase aggregates
  totalContributions: decimal("total_contributions", { precision: 18, scale: 8 }).default("0"),
  totalTokensAllocated: decimal("total_tokens_allocated", { precision: 18, scale: 8 }).default("0"),
  purchaseCount: integer("purchase_count").default(0),
  
  // Chain-specific contributions for analytics
  baseChainContributions: decimal("base_chain_contributions", { precision: 18, scale: 8 }).default("0"),
  ethereumContributions: decimal("ethereum_contributions", { precision: 18, scale: 8 }).default("0"),
  bnbChainContributions: decimal("bnb_chain_contributions", { precision: 18, scale: 8 }).default("0"),
  
  // Commission earnings aggregates
  totalLevel1Earnings: decimal("total_level1_earnings", { precision: 18, scale: 8 }).default("0"),
  totalLevel2Earnings: decimal("total_level2_earnings", { precision: 18, scale: 8 }).default("0"),
  totalLevel3Earnings: decimal("total_level3_earnings", { precision: 18, scale: 8 }).default("0"),
  totalCommissions: decimal("total_commissions", { precision: 18, scale: 8 }).default("0"),
  
  // Network metrics
  directReferralCount: integer("direct_referral_count").default(0),
  level2ReferralCount: integer("level2_referral_count").default(0),
  level3ReferralCount: integer("level3_referral_count").default(0),
  totalNetworkSize: integer("total_network_size").default(0),
  
  // Performance optimization
  lastStatsUpdate: timestamp("last_stats_update").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_railz_stats_wallet").on(table.walletAddress),
  index("idx_railz_stats_contributions").on(table.totalContributions),
  index("idx_railz_stats_commissions").on(table.totalCommissions),
  index("idx_railz_stats_network").on(table.totalNetworkSize),
]);

// Global presale metrics for real-time dashboard
export const railzPresaleMetrics = pgTable("railz_presale_metrics", {
  id: serial("id").primaryKey(),
  
  // Global presale stats
  totalRaised: decimal("total_raised", { precision: 18, scale: 8 }).default("0"),
  totalTokensSold: decimal("total_tokens_sold", { precision: 18, scale: 8 }).default("0"),
  currentTokenPrice: decimal("current_token_price", { precision: 18, scale: 8 }).default("0.00008"),
  
  // Multi-chain breakdown
  baseChainVolume: decimal("base_chain_volume", { precision: 18, scale: 8 }).default("0"),
  ethereumVolume: decimal("ethereum_volume", { precision: 18, scale: 8 }).default("0"),
  bnbChainVolume: decimal("bnb_chain_volume", { precision: 18, scale: 8 }).default("0"),
  
  // Network growth metrics
  totalParticipants: integer("total_participants").default(0),
  totalNetworkSize: integer("total_network_size").default(0), // Sum of all referral networks
  averageNetworkDepth: decimal("average_network_depth", { precision: 4, scale: 2 }).default("0"),
  
  // Commission metrics
  totalCommissionsPaid: decimal("total_commissions_paid", { precision: 18, scale: 8 }).default("0"),
  level1CommissionsPaid: decimal("level1_commissions_paid", { precision: 18, scale: 8 }).default("0"),
  level2CommissionsPaid: decimal("level2_commissions_paid", { precision: 18, scale: 8 }).default("0"),
  level3CommissionsPaid: decimal("level3_commissions_paid", { precision: 18, scale: 8 }).default("0"),
  
  // Performance tracking
  lastMetricsUpdate: timestamp("last_metrics_update").defaultNow(),
  isLive: boolean("is_live").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Railz Token schema types
export type RailzReferralTree = typeof railzReferralTree.$inferSelect;
export type InsertRailzReferralTree = typeof railzReferralTree.$inferInsert;

export type RailzPurchase = typeof railzPurchases.$inferSelect;
export type InsertRailzPurchase = typeof railzPurchases.$inferInsert;

export type RailzUserStats = typeof railzUserStats.$inferSelect;
export type InsertRailzUserStats = typeof railzUserStats.$inferInsert;

export type RailzPresaleMetrics = typeof railzPresaleMetrics.$inferSelect;
export type InsertRailzPresaleMetrics = typeof railzPresaleMetrics.$inferInsert;

// Zod schemas for validation
export const insertRailzReferralTreeSchema = createInsertSchema(railzReferralTree);
export const insertRailzPurchaseSchema = createInsertSchema(railzPurchases);
export const insertRailzUserStatsSchema = createInsertSchema(railzUserStats);
export const insertRailzPresaleMetricsSchema = createInsertSchema(railzPresaleMetrics);

// Chat and message types
export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = typeof chatRooms.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Chat insert schemas
export const insertChatRoomSchema = createInsertSchema(chatRooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

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

// Advanced Trading Relations for Phase 3
export const limitOrdersRelations = relations(limitOrders, ({ one }) => ({
  user: one(users, {
    fields: [limitOrders.userId],
    references: [users.id],
  }),
}));

export const portfolioHoldingsRelations = relations(portfolioHoldings, ({ one }) => ({
  user: one(users, {
    fields: [portfolioHoldings.userId],
    references: [users.id],
  }),
}));

export const mevProtectionSettingsRelations = relations(mevProtectionSettings, ({ one }) => ({
  user: one(users, {
    fields: [mevProtectionSettings.userId],
    references: [users.id],
  }),
}));

export const chartSettingsRelations = relations(chartSettings, ({ one }) => ({
  user: one(users, {
    fields: [chartSettings.userId],
    references: [users.id],
  }),
}));

// Advanced Trading Types
export type LimitOrder = typeof limitOrders.$inferSelect;
export type InsertLimitOrder = typeof limitOrders.$inferInsert;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertPortfolioHolding = typeof portfolioHoldings.$inferInsert;
export type MEVProtectionSettings = typeof mevProtectionSettings.$inferSelect;
export type InsertMEVProtectionSettings = typeof mevProtectionSettings.$inferInsert;
export type ChartSettings = typeof chartSettings.$inferSelect;
export type InsertChartSettings = typeof chartSettings.$inferInsert;

// Advanced Trading Insert Schemas
export const insertLimitOrderSchema = createInsertSchema(limitOrders).omit({
  id: true,
  createdAt: true,
  filledAt: true,
  cancelledAt: true,
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertMEVProtectionSettingsSchema = createInsertSchema(mevProtectionSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChartSettingsSchema = createInsertSchema(chartSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



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

// Export messaging schema for marketplace integration
export * from "./messagingSchema";

// =====================================
// XRP LEDGER ECOSYSTEM TABLES
// =====================================

// XRP Wallets Management
export const xrpWallets = pgTable("xrp_wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  address: varchar("address").unique().notNull(),
  seedEncrypted: text("seed_encrypted").notNull(),
  publicKey: varchar("public_key"),
  balance: decimal("balance", { precision: 20, scale: 8 }).default("0"),
  status: varchar("status").default("active"), // active, inactive, suspended
  network: varchar("network").default("mainnet"), // mainnet, testnet, devnet
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIndex: index("xrp_wallets_user_idx").on(table.userId),
  addressIndex: index("xrp_wallets_address_idx").on(table.address),
  statusIndex: index("xrp_wallets_status_idx").on(table.status),
}));

// XRP Transactions - Enhanced version
export const xrpTransactions = pgTable("xrp_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  walletId: integer("wallet_id").references(() => xrpWallets.id),
  transactionHash: varchar("transaction_hash").unique(),
  transactionType: varchar("transaction_type").notNull(), // send, receive, trade, buy, sell, liquidity_add, liquidity_remove
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 20, scale: 8 }).default("0"),
  fromAddress: varchar("from_address"),
  toAddress: varchar("to_address").notNull(),
  currency: varchar("currency").default("XRP"),
  status: varchar("status").default("pending"), // pending, confirmed, failed, cancelled
  ledgerIndex: integer("ledger_index"),
  confirmationCount: integer("confirmation_count").default(0),
  memo: text("memo"),
  destinationTag: integer("destination_tag"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
}, (table) => ({
  userIdIndex: index("xrp_tx_user_idx").on(table.userId),
  walletIdIndex: index("xrp_tx_wallet_idx").on(table.walletId),
  hashIndex: index("xrp_tx_hash_idx").on(table.transactionHash),
  statusIndex: index("xrp_tx_status_idx").on(table.status),
  typeIndex: index("xrp_tx_type_idx").on(table.transactionType),
  createdAtIndex: index("xrp_tx_created_idx").on(table.createdAt),
}));

// XRP Trading Orders
export const xrpOrders = pgTable("xrp_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  walletId: integer("wallet_id").references(() => xrpWallets.id),
  orderType: varchar("order_type").notNull(), // market, limit, stop
  side: varchar("side").notNull(), // buy, sell
  baseCurrency: varchar("base_currency").notNull(),
  quoteCurrency: varchar("quote_currency").notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  price: decimal("price", { precision: 20, scale: 8 }),
  filledAmount: decimal("filled_amount", { precision: 20, scale: 8 }).default("0"),
  status: varchar("status").default("open"), // open, filled, cancelled, partial
  orderHash: varchar("order_hash"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  filledAt: timestamp("filled_at"),
}, (table) => ({
  userIdIndex: index("xrp_orders_user_idx").on(table.userId),
  walletIdIndex: index("xrp_orders_wallet_idx").on(table.walletId),
  statusIndex: index("xrp_orders_status_idx").on(table.status),
  sideIndex: index("xrp_orders_side_idx").on(table.side),
  createdAtIndex: index("xrp_orders_created_idx").on(table.createdAt),
}));

// XRP Liquidity Positions
export const xrpLiquidityPositions = pgTable("xrp_liquidity_positions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  walletId: integer("wallet_id").references(() => xrpWallets.id),
  poolId: varchar("pool_id").notNull(),
  tokenA: varchar("token_a").notNull(),
  tokenB: varchar("token_b").notNull(),
  liquidityAmount: decimal("liquidity_amount", { precision: 20, scale: 8 }).notNull(),
  sharePercentage: decimal("share_percentage", { precision: 5, scale: 4 }),
  rewardsEarned: decimal("rewards_earned", { precision: 20, scale: 8 }).default("0"),
  status: varchar("status").default("active"), // active, withdrawn, expired
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIndex: index("xrp_lp_user_idx").on(table.userId),
  walletIdIndex: index("xrp_lp_wallet_idx").on(table.walletId),
  poolIdIndex: index("xrp_lp_pool_idx").on(table.poolId),
  statusIndex: index("xrp_lp_status_idx").on(table.status),
}));

// XRP Cross-Border Payments
export const xrpCrossBorderPayments = pgTable("xrp_cross_border_payments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  walletId: integer("wallet_id").references(() => xrpWallets.id),
  paymentId: varchar("payment_id").unique().notNull(),
  senderAddress: varchar("sender_address").notNull(),
  recipientAddress: varchar("recipient_address").notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  sourceCurrency: varchar("source_currency").notNull(),
  destinationCurrency: varchar("destination_currency").notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 15, scale: 8 }),
  corridorUsed: varchar("corridor_used"), // Payment corridor (e.g., US-MX, EU-JP)
  status: varchar("status").default("initiated"), // initiated, processing, completed, failed
  estimatedSettlement: timestamp("estimated_settlement"),
  actualSettlement: timestamp("actual_settlement"),
  fees: jsonb("fees"), // Breakdown of all fees
  compliance: jsonb("compliance"), // KYC/AML data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIndex: index("xrp_cb_user_idx").on(table.userId),
  paymentIdIndex: index("xrp_cb_payment_idx").on(table.paymentId),
  statusIndex: index("xrp_cb_status_idx").on(table.status),
  corridorIndex: index("xrp_cb_corridor_idx").on(table.corridorUsed),
}));

// XRP Relations
export const xrpWalletsRelations = relations(xrpWallets, ({ one, many }) => ({
  user: one(users, {
    fields: [xrpWallets.userId],
    references: [users.id],
  }),
  transactions: many(xrpTransactions),
  orders: many(xrpOrders),
  liquidityPositions: many(xrpLiquidityPositions),
  crossBorderPayments: many(xrpCrossBorderPayments),
}));

export const xrpTransactionsRelations = relations(xrpTransactions, ({ one }) => ({
  user: one(users, {
    fields: [xrpTransactions.userId],
    references: [users.id],
  }),
  wallet: one(xrpWallets, {
    fields: [xrpTransactions.walletId],
    references: [xrpWallets.id],
  }),
}));

export const xrpOrdersRelations = relations(xrpOrders, ({ one }) => ({
  user: one(users, {
    fields: [xrpOrders.userId],
    references: [users.id],
  }),
  wallet: one(xrpWallets, {
    fields: [xrpOrders.walletId],
    references: [xrpWallets.id],
  }),
}));

export const xrpLiquidityPositionsRelations = relations(xrpLiquidityPositions, ({ one }) => ({
  user: one(users, {
    fields: [xrpLiquidityPositions.userId],
    references: [users.id],
  }),
  wallet: one(xrpWallets, {
    fields: [xrpLiquidityPositions.walletId],
    references: [xrpWallets.id],
  }),
}));

export const xrpCrossBorderPaymentsRelations = relations(xrpCrossBorderPayments, ({ one }) => ({
  user: one(users, {
    fields: [xrpCrossBorderPayments.userId],
    references: [users.id],
  }),
  wallet: one(xrpWallets, {
    fields: [xrpCrossBorderPayments.walletId],
    references: [xrpWallets.id],
  }),
}));

// XRP Types
// XRP Ledger ecosystem types
export type XrpWallet = typeof xrpWallets.$inferSelect;
export type InsertXrpWallet = typeof xrpWallets.$inferInsert;
export type XrpTransaction = typeof xrpTransactions.$inferSelect;
export type InsertXrpTransaction = typeof xrpTransactions.$inferInsert;
export type XrpOrder = typeof xrpOrders.$inferSelect;
export type InsertXrpOrder = typeof xrpOrders.$inferInsert;
export type XrpLiquidityPosition = typeof xrpLiquidityPositions.$inferSelect;
export type InsertXrpLiquidityPosition = typeof xrpLiquidityPositions.$inferInsert;
export type XrpCrossBorderPayment = typeof xrpCrossBorderPayments.$inferSelect;
export type InsertXrpCrossBorderPayment = typeof xrpCrossBorderPayments.$inferInsert;

// XRP Insert schemas for validation
export const insertXrpWalletSchema = createInsertSchema(xrpWallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertXrpTransactionSchema = createInsertSchema(xrpTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertXrpOrderSchema = createInsertSchema(xrpOrders).omit({
  id: true,
  createdAt: true,
});

export const insertXrpLiquidityPositionSchema = createInsertSchema(xrpLiquidityPositions).omit({
  id: true,
  createdAt: true,
});

export const insertXrpCrossBorderPaymentSchema = createInsertSchema(xrpCrossBorderPayments).omit({
  id: true,
  createdAt: true,
});

// ========================================
// DEX Trading System - Guest & User Support
// ========================================

// DEX Trading Tables - Support guest users + registered users
export const dexTrades = pgTable("dex_trades", {
  id: serial("id").primaryKey(),
  tradeId: varchar("trade_id").notNull().unique(), // Unique trade identifier
  userId: varchar("user_id"), // NULL for guest users
  walletAddress: varchar("wallet_address").notNull(), // Guest or user wallet
  fromAsset: varchar("from_asset").notNull(), // ETH, USDC, etc.
  toAsset: varchar("to_asset").notNull(), // Asset being swapped to
  fromAmount: decimal("from_amount", { precision: 20, scale: 8 }).notNull(),
  toAmount: decimal("to_amount", { precision: 20, scale: 8 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 6 }).notNull(), // Our 0.25% fee
  network: varchar("network").notNull(), // Network/chain (ethereum, base, polygon, etc.)
  networkFee: decimal("network_fee", { precision: 18, scale: 8 }), // Gas fees
  slippagePercent: decimal("slippage_percent", { precision: 5, scale: 2 }).default("2.0"), // 2% default
  chain: varchar("chain"), // Legacy field, kept for compatibility
  dexProtocol: varchar("dex_protocol"), // uniswap, sushiswap, etc.
  transactionHash: varchar("transaction_hash"), // Blockchain tx hash
  status: varchar("status").default("pending"), // pending, completed, failed, cancelled
  isGuestTrade: boolean("is_guest_trade").default(false), // Track guest vs user trades
  metadata: jsonb("metadata"), // Additional trade data
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  walletAddressIndex: index("dex_trades_wallet_idx").on(table.walletAddress),
  networkIndex: index("dex_trades_network_idx").on(table.network),
  statusIndex: index("dex_trades_status_idx").on(table.status),
  createdAtIndex: index("dex_trades_created_idx").on(table.createdAt),
}));

// Cross-chain bridging transactions (0.5% fee)
export const crossChainTrades = pgTable("cross_chain_trades", {
  id: serial("id").primaryKey(),
  tradeId: varchar("trade_id").notNull().unique(),
  userId: varchar("user_id"), // NULL for guest users
  walletAddress: varchar("wallet_address").notNull(),
  sourceChain: varchar("source_chain").notNull(), // ethereum-mainnet, base-mainnet
  targetChain: varchar("target_chain").notNull(), // base-mainnet, etc.
  asset: varchar("asset").notNull(), // USDC, ETH, etc.
  sourceAmount: decimal("source_amount", { precision: 20, scale: 8 }).notNull(),
  targetAmount: decimal("target_amount", { precision: 20, scale: 8 }).notNull(),
  bridgeFee: decimal("bridge_fee", { precision: 10, scale: 6 }).notNull(), // 0.5% fee
  sourceTxHash: varchar("source_tx_hash"),
  targetTxHash: varchar("target_tx_hash"),
  status: varchar("status").default("pending"), // pending, bridging, completed, failed
  bridgeProvider: varchar("bridge_provider"), // coinbase, layerzero, etc.
  isGuestTrade: boolean("is_guest_trade").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  walletAddressIndex: index("cross_chain_wallet_idx").on(table.walletAddress),
  sourceChainIndex: index("cross_chain_source_idx").on(table.sourceChain),
  statusIndex: index("cross_chain_status_idx").on(table.status),
}));

// Premium subscriptions for reduced fees (registered users only)
export const dexSubscriptions = pgTable("dex_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Only registered users can subscribe
  tier: varchar("tier").notNull(), // 'pro', 'enterprise'
  feeDiscount: decimal("fee_discount", { precision: 5, scale: 4 }).notNull(), // 0.10% discount
  monthlyPrice: decimal("monthly_price", { precision: 8, scale: 2 }).notNull(), // $19.99, $99.99
  isActive: boolean("is_active").default(true),
  autoRenew: boolean("auto_renew").default(true),
  currentPeriodStart: timestamp("current_period_start").defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIndex: index("dex_subs_user_idx").on(table.userId),
  tierIndex: index("dex_subs_tier_idx").on(table.tier),
  activeIndex: index("dex_subs_active_idx").on(table.isActive),
}));

// DEX revenue tracking (separate from main platform revenue)
export const dexRevenue = pgTable("dex_revenue", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(), // Daily revenue tracking
  totalTradingVolume: decimal("total_trading_volume", { precision: 20, scale: 2 }).default("0.00"),
  totalTradingFees: decimal("total_trading_fees", { precision: 20, scale: 6 }).default("0.000000"),
  totalCrossChainVolume: decimal("total_cross_chain_volume", { precision: 20, scale: 2 }).default("0.00"),
  totalCrossChainFees: decimal("total_cross_chain_fees", { precision: 20, scale: 6 }).default("0.000000"),
  totalSubscriptionRevenue: decimal("total_subscription_revenue", { precision: 10, scale: 2 }).default("0.00"),
  guestTradeCount: integer("guest_trade_count").default(0),
  userTradeCount: integer("user_trade_count").default(0),
  activeSubscriptions: integer("active_subscriptions").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  dateIndex: index("dex_revenue_date_idx").on(table.date),
}));

// DEX Trading Types
export type DexTrade = typeof dexTrades.$inferSelect;
export type InsertDexTrade = typeof dexTrades.$inferInsert;
export type CrossChainTrade = typeof crossChainTrades.$inferSelect;
export type InsertCrossChainTrade = typeof crossChainTrades.$inferInsert;
export type DexSubscription = typeof dexSubscriptions.$inferSelect;
export type InsertDexSubscription = typeof dexSubscriptions.$inferInsert;

// Advanced Trading Feature Types
export type StopLimitOrder = typeof stopLimitOrders.$inferSelect;
export type InsertStopLimitOrder = typeof stopLimitOrders.$inferInsert;
export type BracketOrder = typeof bracketOrders.$inferSelect;
export type InsertBracketOrder = typeof bracketOrders.$inferInsert;
export type PortfolioAnalytics = typeof portfolioAnalytics.$inferSelect;
export type InsertPortfolioAnalytics = typeof portfolioAnalytics.$inferInsert;
export type AdvancedWatchlist = typeof advancedWatchlists.$inferSelect;
export type InsertAdvancedWatchlist = typeof advancedWatchlists.$inferInsert;
export type AdvancedWatchlistAsset = typeof advancedWatchlistAssets.$inferSelect;
export type InsertAdvancedWatchlistAsset = typeof advancedWatchlistAssets.$inferInsert;

// DEX Insert schemas for validation
export const insertDexTradeSchema = createInsertSchema(dexTrades).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertCrossChainTradeSchema = createInsertSchema(crossChainTrades).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertDexSubscriptionSchema = createInsertSchema(dexSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Advanced Trading Insert Schemas
export const insertStopLimitOrderSchema = createInsertSchema(stopLimitOrders).omit({
  id: true,
  createdAt: true,
  triggeredAt: true,
  filledAt: true,
  cancelledAt: true,
});

export const insertBracketOrderSchema = createInsertSchema(bracketOrders).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertPortfolioAnalyticsSchema = createInsertSchema(portfolioAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertAdvancedWatchlistSchema = createInsertSchema(advancedWatchlists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdvancedWatchlistAssetSchema = createInsertSchema(advancedWatchlistAssets).omit({
  id: true,
  addedAt: true,
  lastUpdated: true,
});

// Enhanced Subscription Management System
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey(), // starter, pro, enterprise
  name: varchar("name").notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 8, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearly_price", { precision: 8, scale: 2 }).notNull(),
  yearlyDiscount: integer("yearly_discount").notNull(), // percentage
  tradingFeeReduction: integer("trading_fee_reduction").notNull(), // percentage (max 30%)
  crossChainFeeReduction: integer("cross_chain_fee_reduction").notNull(), // percentage (max 30%)
  aiMarketplaceCredits: decimal("ai_marketplace_credits", { precision: 8, scale: 2 }).notNull(),
  features: jsonb("features"), // Array of feature strings
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  status: varchar("status").notNull().default("active"), // active, cancelled, expired, pending
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  
  // Payment method tracking
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeCustomerId: varchar("stripe_customer_id"),
  paypalSubscriptionId: varchar("paypal_subscription_id"),
  usdcPaymentTxHash: varchar("usdc_payment_tx_hash"),
  
  // Billing details
  isYearly: boolean("is_yearly").default(false),
  lastPaymentAmount: decimal("last_payment_amount", { precision: 8, scale: 2 }),
  lastPaymentDate: timestamp("last_payment_date"),
  nextBillingDate: timestamp("next_billing_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIndex: index("subscriptions_user_idx").on(table.userId),
  planIdIndex: index("subscriptions_plan_idx").on(table.planId),
  statusIndex: index("subscriptions_status_idx").on(table.status),
  stripeIdIndex: index("subscriptions_stripe_idx").on(table.stripeSubscriptionId),
}));

export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // stripe_card, paypal, usdc, crypto
  isDefault: boolean("is_default").default(false),
  
  // Stripe details
  stripePaymentMethodId: varchar("stripe_payment_method_id"),
  cardLast4: varchar("card_last4"),
  cardBrand: varchar("card_brand"),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  
  // PayPal details
  paypalEmail: varchar("paypal_email"),
  
  // Crypto details
  walletAddress: varchar("wallet_address"),
  blockchain: varchar("blockchain"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIndex: index("payment_methods_user_idx").on(table.userId),
  typeIndex: index("payment_methods_type_idx").on(table.type),
}));

// Subscription Relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  user: one(users, {
    fields: [paymentMethods.userId],
    references: [users.id],
  }),
}));

// Subscription Types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

// Subscription Insert Schemas
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Smart Contract Audit Orders
export const smartContractAudits = pgTable(
  "smart_contract_audits",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    customerId: varchar("customer_id").references(() => users.id), // Optional for guest submissions
    guestEmail: varchar("guest_email"), // For guest submissions
    guestCompany: varchar("guest_company"), // Optional guest company name
    submissionType: varchar("submission_type").default("authenticated"), // 'authenticated', 'guest'
    contractAddress: varchar("contract_address"), // Optional: for deployed contracts
    contractCode: text("contract_code"), // For code uploads
    contractType: varchar("contract_type").notNull(), // 'token', 'dapp', 'nft', 'defi', 'game', 'other'
    blockchain: varchar("blockchain").notNull(), // 'ethereum', 'base', 'polygon', 'bsc', 'bnb', 'arbitrum', 'avalanche', 'optimism', 'pulsechain', 'solana'
    projectName: varchar("project_name"), // Optional: users might only know ticker
    projectDescription: text("project_description"),
    
    // Payment and pricing
    amount: decimal("amount", { precision: 10, scale: 2 }).default("1000.00"),
    currency: varchar("currency").default("USD"),
    paymentMethod: varchar("payment_method"), // 'stripe', 'paypal', 'circle_usdc', 'crypto'
    paymentTxHash: varchar("payment_tx_hash"), // For crypto payments
    
    // Audit results
    status: varchar("status").default("pending"), // 'pending', 'in_progress', 'completed', 'cancelled'
    grade: varchar("grade"), // 'A', 'B', 'F' (80-100%, 70-79%, <70%)
    score: integer("score"), // Numerical score 0-100
    auditReport: text("audit_report"), // Complete audit analysis
    vulnerabilities: jsonb("vulnerabilities"), // Detailed vulnerability findings
    recommendations: text("recommendations"), // Improvement suggestions
    gasOptimizations: text("gas_optimizations"), // Gas saving recommendations
    
    // Certificate generation
    certificateId: varchar("certificate_id").unique(),
    certificateGenerated: boolean("certificate_generated").default(false),
    certificateUrl: varchar("certificate_url"), // Link to certificate PDF/image
    
    // Timing
    submittedAt: timestamp("submitted_at").defaultNow(),
    auditStartedAt: timestamp("audit_started_at"),
    auditCompletedAt: timestamp("audit_completed_at"),
    estimatedDeliveryHours: integer("estimated_delivery_hours").default(1), // Changed to 1 hour max, actual delivery in minutes
    
    // Communication & Access
    chatSessionId: varchar("chat_session_id"), // Link to chat for delivery
    deliveryMethod: varchar("delivery_method").default("download"), // 'download', 'email', 'chat'
    accessToken: varchar("access_token"), // Secure token for guest access to results
    deliveryUrl: varchar("delivery_url"), // Direct link to audit results
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_smart_contract_audits_customer").on(table.customerId),
    index("IDX_smart_contract_audits_status").on(table.status),
    index("IDX_smart_contract_audits_blockchain").on(table.blockchain),
    index("IDX_smart_contract_audits_grade").on(table.grade),
    uniqueIndex("IDX_smart_contract_audits_certificate").on(table.certificateId),
  ],
);

// Smart Contract Audit Relations
export const smartContractAuditsRelations = relations(smartContractAudits, ({ one }) => ({
  customer: one(users, {
    fields: [smartContractAudits.customerId],
    references: [users.id],
  }),
}));

// Smart Contract Audit Schemas
export const insertSmartContractAuditSchema = createInsertSchema(smartContractAudits).omit({
  id: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const smartContractAuditSelectSchema = createSelectSchema(smartContractAudits);

// Smart Contract Audit Types
export type SmartContractAudit = typeof smartContractAudits.$inferSelect;
export type InsertSmartContractAudit = z.infer<typeof insertSmartContractAuditSchema>;

// AI Agent Product Types and Schemas
export type AIAgentProduct = typeof aiAgentProducts.$inferSelect;
export type InsertAIAgentProduct = typeof aiAgentProducts.$inferInsert;
export type AIAgentSubscription = typeof aiAgentSubscriptions.$inferSelect;
export type InsertAIAgentSubscription = typeof aiAgentSubscriptions.$inferInsert;

export const insertAIAgentProductSchema = createInsertSchema(aiAgentProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAIAgentSubscriptionSchema = createInsertSchema(aiAgentSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// SDK License Tiers for AI Developer Market ($2K-$200K range)
export const sdkLicenseTiers = pgTable('sdk_license_tiers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  yearlyPrice: decimal('yearly_price', { precision: 10, scale: 2 }).notNull(),
  monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).notNull(),
  setupFee: decimal('setup_fee', { precision: 10, scale: 2 }).default('0.00'),
  
  // Transaction limits and fees
  transactionFeeRate: decimal('transaction_fee_rate', { precision: 5, scale: 4 }).notNull(), // e.g., 0.0099 for 0.99%
  fixedFeePerTransaction: decimal('fixed_fee_per_transaction', { precision: 5, scale: 2 }).notNull(), // e.g., 0.05
  monthlyTransactionLimit: integer('monthly_transaction_limit'), // null = unlimited
  monthlyVolumeLimit: decimal('monthly_volume_limit', { precision: 15, scale: 2 }), // null = unlimited
  
  // Support and features
  supportLevel: varchar('support_level', { length: 50 }).notNull(), // email, priority, dedicated, white_glove
  slaGuarantee: varchar('sla_guarantee', { length: 50 }), // 99.5%, 99.9%, 99.99%
  customIntegrations: boolean('custom_integrations').default(false),
  whiteLabeling: boolean('white_labeling').default(false),
  dedicatedInfrastructure: boolean('dedicated_infrastructure').default(false),
  
  // API Access and limits
  apiRequestsPerSecond: integer('api_requests_per_second').default(10),
  webhookEndpoints: integer('webhook_endpoints').default(5),
  teamMembers: integer('team_members').default(1), // number of developer seats
  
  // Features array
  features: text('features').array().notNull(),
  
  isActive: boolean('is_active').default(true),
  targetMarket: varchar('target_market', { length: 100 }).default('enterprise_ai'), // startup, growth, enterprise_ai, fortune_500
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIndex: index('sdk_license_tiers_name_idx').on(table.name),
  priceIndex: index('sdk_license_tiers_price_idx').on(table.yearlyPrice),
  targetMarketIndex: index('sdk_license_tiers_market_idx').on(table.targetMarket),
}));

// SDK License Subscriptions for Enterprise AI Developers
export const sdkLicenseSubscriptions = pgTable('sdk_license_subscriptions', {
  id: serial('id').primaryKey(),
  licenseKey: varchar('license_key', { length: 255 }).notNull().unique(), // SDK license key
  licenseKeyHash: varchar('license_key_hash', { length: 255 }).notNull(), // SHA-256 hashed license key
  
  // Customer information
  companyName: varchar('company_name', { length: 255 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }),
  companySize: varchar('company_size', { length: 50 }), // startup, small, medium, large, enterprise
  useCase: text('use_case'), // Description of AI agent use case
  
  // License details
  tierId: integer('tier_id').notNull().references(() => sdkLicenseTiers.id),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, suspended, expired, cancelled
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull().default('yearly'), // monthly, yearly
  
  // Dates
  startDate: timestamp('start_date').notNull().defaultNow(),
  endDate: timestamp('end_date').notNull(),
  nextBillingDate: timestamp('next_billing_date').notNull(),
  
  // Payment information
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(), // stripe, crypto, wire_transfer, check
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  
  // Usage tracking
  currentMonthTransactions: integer('current_month_transactions').default(0),
  currentMonthVolume: decimal('current_month_volume', { precision: 15, scale: 2 }).default('0.00'),
  totalLifetimeTransactions: integer('total_lifetime_transactions').default(0),
  totalLifetimeVolume: decimal('total_lifetime_volume', { precision: 15, scale: 2 }).default('0.00'),
  totalLifetimeRevenue: decimal('total_lifetime_revenue', { precision: 15, scale: 2 }).default('0.00'),
  
  // Usage reset tracking
  lastUsageReset: timestamp('last_usage_reset').defaultNow(),
  
  // Configuration
  allowedDomains: text('allowed_domains').array(), // Domains allowed to use the SDK
  webhookUrls: text('webhook_urls').array(), // Webhook endpoints
  
  // Metadata
  signupSource: varchar('signup_source', { length: 100 }), // website, sales_team, partner, referral
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  licenseKeyIndex: index('sdk_license_subs_key_idx').on(table.licenseKey),
  licenseKeyHashIndex: index('sdk_license_subs_hash_idx').on(table.licenseKeyHash),
  companyIndex: index('sdk_license_subs_company_idx').on(table.companyName),
  statusIndex: index('sdk_license_subs_status_idx').on(table.status),
  tierIndex: index('sdk_license_subs_tier_idx').on(table.tierId),
  billingDateIndex: index('sdk_license_subs_billing_idx').on(table.nextBillingDate),
  stripeSubIndex: index('sdk_license_subs_stripe_idx').on(table.stripeSubscriptionId),
}));

// Discovered Agents Types and Schemas
export type DiscoveredAgent = typeof discoveredAgents.$inferSelect;
export type InsertDiscoveredAgent = typeof discoveredAgents.$inferInsert;

export const insertDiscoveredAgentSchema = createInsertSchema(discoveredAgents).omit({
  id: true,
  discoveredAt: true,
  verifiedAt: true,
  lastSeenAt: true,
  lastContactAt: true,
  xmtpLastChecked: true, // Auto-managed by scanner
});

// SDK License Types and Schemas
export type SDKLicenseTier = typeof sdkLicenseTiers.$inferSelect;
export type InsertSDKLicenseTier = typeof sdkLicenseTiers.$inferInsert;
export type SDKLicenseSubscription = typeof sdkLicenseSubscriptions.$inferSelect;
export type InsertSDKLicenseSubscription = typeof sdkLicenseSubscriptions.$inferInsert;

export const insertSDKLicenseTierSchema = createInsertSchema(sdkLicenseTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSDKLicenseSubscriptionSchema = createInsertSchema(sdkLicenseSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Enterprise Outreach Campaigns table for targeting AI companies, fintech startups, and payment processors
export const enterpriseOutreachCampaigns = pgTable('enterprise_outreach_campaigns', {
  id: varchar('id').primaryKey().notNull(),
  userId: varchar('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  targetMarket: varchar('target_market', { length: 50 }).notNull(), // ai_companies, fintech_startups, payment_processors, enterprise_saas
  targetCount: integer('target_count').notNull(),
  emailTemplate: text('email_template').notNull(),
  followUpTemplate: text('follow_up_template').notNull(),
  targetCriteria: text('target_criteria').notNull(), // JSON string with targeting criteria
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, active, paused, completed
  contacted: integer('contacted').default(0).notNull(),
  responses: integer('responses').default(0).notNull(),
  qualified: integer('qualified').default(0).notNull(),
  conversions: integer('conversions').default(0).notNull(),
  revenue: decimal('revenue', { precision: 15, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
}, (table) => ({
  userIndex: index('enterprise_outreach_campaigns_user_idx').on(table.userId),
  statusIndex: index('enterprise_outreach_campaigns_status_idx').on(table.status),
  marketIndex: index('enterprise_outreach_campaigns_market_idx').on(table.targetMarket),
  activityIndex: index('enterprise_outreach_campaigns_activity_idx').on(table.lastActivity),
}));

// Enterprise Outreach Targets table for specific companies and contacts
export const enterpriseOutreachTargets = pgTable('enterprise_outreach_targets', {
  id: varchar('id').primaryKey().notNull(),
  campaignId: varchar('campaign_id').references(() => enterpriseOutreachCampaigns.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 100 }).notNull(),
  employeeCount: varchar('employee_count', { length: 50 }).notNull(),
  revenue: varchar('revenue', { length: 50 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  contactTitle: varchar('contact_title', { length: 255 }).notNull(),
  linkedinUrl: varchar('linkedin_url', { length: 500 }),
  phoneNumber: varchar('phone_number', { length: 50 }),
  companyDescription: text('company_description').notNull(),
  useCase: text('use_case').notNull(),
  priority: varchar('priority', { length: 10 }).default('medium').notNull(), // high, medium, low
  status: varchar('status', { length: 20 }).default('new').notNull(), // new, contacted, responded, qualified, converted
  
  // Lead Scoring System Fields
  leadScore: integer('lead_score').default(0).notNull(), // 0-100 dynamic score
  leadTier: varchar('lead_tier', { length: 10 }).default('cold').notNull(), // cold, warm, hot, qualified
  lastScoredAt: timestamp('last_scored_at'),
  followUpStatus: varchar('follow_up_status', { length: 20 }).default('automated').notNull(), // automated, requires_human, assigned_human, completed
  objectionCategory: varchar('objection_category', { length: 50 }), // pricing, timing, features, not_interested, competitor
  responseTime: integer('response_time'), // Average response time in hours
  engagementScore: integer('engagement_score').default(0), // Engagement tracking 0-100
  
  lastContactDate: timestamp('last_contact_date'),
  nextFollowUp: timestamp('next_follow_up'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  campaignIndex: index('enterprise_outreach_targets_campaign_idx').on(table.campaignId),
  userIndex: index('enterprise_outreach_targets_user_idx').on(table.userId),
  statusIndex: index('enterprise_outreach_targets_status_idx').on(table.status),
  priorityIndex: index('enterprise_outreach_targets_priority_idx').on(table.priority),
  industryIndex: index('enterprise_outreach_targets_industry_idx').on(table.industry),
  companyIndex: index('enterprise_outreach_targets_company_idx').on(table.companyName),
  domainIndex: index('enterprise_outreach_targets_domain_idx').on(table.domain),
  contactIndex: index('enterprise_outreach_targets_contact_idx').on(table.contactEmail),
  followUpIndex: index('enterprise_outreach_targets_followup_idx').on(table.nextFollowUp),
  
  // Lead Scoring Indexes for optimization
  leadScoreIndex: index('enterprise_outreach_targets_score_idx').on(table.leadScore),
  leadTierIndex: index('enterprise_outreach_targets_tier_idx').on(table.leadTier),
  followUpStatusIndex: index('enterprise_outreach_targets_followup_status_idx').on(table.followUpStatus),
  objectionIndex: index('enterprise_outreach_targets_objection_idx').on(table.objectionCategory),
}));

// Enterprise Outreach Objections table for structured objection analysis  
export const enterpriseOutreachObjections = pgTable('enterprise_outreach_objections', {
  id: serial('id').primaryKey(),
  targetId: varchar('target_id').notNull().references(() => enterpriseOutreachTargets.id),
  campaignId: varchar('campaign_id').references(() => enterpriseOutreachCampaigns.id),
  
  // Objection details
  objectionCategory: varchar('objection_category', { length: 50 }).notNull(), // pricing, timing, features, not_interested, competitor, budget, authority
  objectionText: text('objection_text').notNull(), // Raw objection from response
  sentiment: varchar('sentiment', { length: 10 }).default('neutral').notNull(), // positive, neutral, negative
  severity: integer('severity').default(5).notNull(), // 1-10 severity scale
  
  // Context
  communicationChannel: varchar('communication_channel', { length: 30 }).notNull(), // email, github, twitter, xmtp, phone
  responseDelay: integer('response_delay'), // Hours between outreach and objection
  
  // Follow-up tracking
  isResolved: boolean('is_resolved').default(false).notNull(),
  resolutionNotes: text('resolution_notes'),
  resolvedAt: timestamp('resolved_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  targetIndex: index('enterprise_outreach_objections_target_idx').on(table.targetId),
  campaignIndex: index('enterprise_outreach_objections_campaign_idx').on(table.campaignId),
  categoryIndex: index('enterprise_outreach_objections_category_idx').on(table.objectionCategory),
  severityIndex: index('enterprise_outreach_objections_severity_idx').on(table.severity),
  resolvedIndex: index('enterprise_outreach_objections_resolved_idx').on(table.isResolved),
}));

// Enterprise Outreach Types and Schemas
export type EnterpriseOutreachCampaign = typeof enterpriseOutreachCampaigns.$inferSelect;
export type InsertEnterpriseOutreachCampaign = typeof enterpriseOutreachCampaigns.$inferInsert;
export type EnterpriseOutreachTarget = typeof enterpriseOutreachTargets.$inferSelect;
export type InsertEnterpriseOutreachTarget = typeof enterpriseOutreachTargets.$inferInsert;
export type EnterpriseOutreachObjection = typeof enterpriseOutreachObjections.$inferSelect;
export type InsertEnterpriseOutreachObjection = typeof enterpriseOutreachObjections.$inferInsert;

export const insertEnterpriseOutreachCampaignSchema = createInsertSchema(enterpriseOutreachCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastActivity: true,
});

export const insertEnterpriseOutreachTargetSchema = createInsertSchema(enterpriseOutreachTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnterpriseOutreachObjectionSchema = createInsertSchema(enterpriseOutreachObjections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Base Ecosystem Mapping for B2B Marketing Service
export const baseEcosystemTargets = pgTable('base_ecosystem_targets', {
  id: serial('id').primaryKey(),
  organizationName: varchar('organization_name').notNull(),
  walletAddress: varchar('wallet_address').notNull(),
  treasuryValue: bigint('treasury_value', { mode: 'number' }).notNull(),
  region: varchar('region').notNull(),
  category: varchar('category').notNull(), // 'defi', 'gaming', 'social', 'infrastructure', etc.
  description: text('description'),
  contactStatus: varchar('contact_status').default('available'), // 'available', 'contacted', 'responded'
  lastContactDate: timestamp('last_contact_date'),
  isVerified: boolean('is_verified').default(true),
  deliveryChannels: text('delivery_channels').array().default(sql`ARRAY['blockchain']`), // Available outreach methods
  successfulCampaigns: integer('successful_campaigns').default(0),
  totalCampaigns: integer('total_campaigns').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// B2B Marketing Campaign Management
export const b2bMarketingCampaigns = pgTable('b2b_marketing_campaigns', {
  id: serial('id').primaryKey(),
  clientEmail: varchar('client_email').notNull(),
  clientOrganization: varchar('client_organization').notNull(),
  campaignName: varchar('campaign_name').notNull(),
  targetCategory: varchar('target_category').notNull(), // which Base ecosystem category to target
  message: text('message').notNull(),
  budgetAmount: integer('budget_amount').notNull().default(5000), // $5K default
  status: varchar('status').notNull().default('pending'), // 'pending', 'active', 'completed', 'paused'
  targetsReached: integer('targets_reached').default(0),
  deliverySuccessRate: decimal('delivery_success_rate', { precision: 5, scale: 2 }).default('0.00'),
  blockchainTxHashes: text('blockchain_tx_hashes').array().default(sql`ARRAY[]::text[]`), // Store transaction proofs
  paymentStatus: varchar('payment_status').default('pending'), // 'pending', 'paid', 'refunded'
  stripePaymentIntentId: varchar('stripe_payment_intent_id'),
  expectedTargets: integer('expected_targets').default(0),
  deliveryCost: decimal('delivery_cost', { precision: 10, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at')
});

// B2B Marketing Service Schema Types
export const insertBaseEcosystemTargetSchema = createInsertSchema(baseEcosystemTargets);
export type InsertBaseEcosystemTarget = z.infer<typeof insertBaseEcosystemTargetSchema>;
export type SelectBaseEcosystemTarget = typeof baseEcosystemTargets.$inferSelect;

export const insertB2BMarketingCampaignSchema = createInsertSchema(b2bMarketingCampaigns);
export type InsertB2BMarketingCampaign = z.infer<typeof insertB2BMarketingCampaignSchema>;
export type SelectB2BMarketingCampaign = typeof b2bMarketingCampaigns.$inferSelect;

// Solana Premium Platform Schema
export const solanaPremiumSubscriptions = pgTable("solana_premium_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  walletAddress: varchar("wallet_address").notNull(),
  subscriptionType: varchar("subscription_type").notNull(), // 'premium_tools' | 'analytics_platform' | 'education_platform' | 'all_access'
  status: varchar("status").notNull().default('active'), // 'active' | 'expired' | 'pending' | 'cancelled'
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 6 }).notNull(),
  paymentSignature: varchar("payment_signature"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date").notNull(),
  features: text("features").array().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const solanaUserProgress = pgTable("solana_user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  courseId: varchar("course_id").notNull(),
  completedModules: text("completed_modules").array().notNull().default(sql`ARRAY[]::text[]`),
  currentModule: varchar("current_module"),
  progress: integer("progress").notNull().default(0), // 0-100 percentage
  score: integer("score").notNull().default(0),
  certificates: text("certificates").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const solanaCustomAlerts = pgTable("solana_custom_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  alertType: varchar("alert_type").notNull(), // 'whale_movement' | 'token_price' | 'volume_spike' | 'new_token'
  conditions: jsonb("conditions").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastTriggered: timestamp("last_triggered"),
  triggerCount: integer("trigger_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const solanaWalletAnalytics = pgTable("solana_wallet_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: varchar("wallet_address").notNull(),
  solBalance: decimal("sol_balance", { precision: 18, scale: 9 }).notNull(),
  tokenCount: integer("token_count").notNull(),
  totalValue: decimal("total_value", { precision: 18, scale: 2 }).notNull(),
  transactionCount: integer("transaction_count").notNull(),
  firstActivity: timestamp("first_activity"),
  lastActivity: timestamp("last_activity"),
  riskScore: integer("risk_score").notNull().default(50), // 0-100
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  lastUpdated: timestamp("last_updated").notNull().defaultNow()
});

// Solana Premium Platform Schema Types
export const solanaPremiumSubscriptionInsertSchema = createInsertSchema(solanaPremiumSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const solanaPremiumSubscriptionSelectSchema = createSelectSchema(solanaPremiumSubscriptions);
export type InsertSolanaPremiumSubscription = z.infer<typeof solanaPremiumSubscriptionInsertSchema>;
export type SelectSolanaPremiumSubscription = typeof solanaPremiumSubscriptions.$inferSelect;

export const solanaUserProgressInsertSchema = createInsertSchema(solanaUserProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const solanaUserProgressSelectSchema = createSelectSchema(solanaUserProgress);
export type InsertSolanaUserProgress = z.infer<typeof solanaUserProgressInsertSchema>;
export type SelectSolanaUserProgress = typeof solanaUserProgress.$inferSelect;

export const solanaCustomAlertInsertSchema = createInsertSchema(solanaCustomAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// PumpFun Copy Trading Tables
export const pumpfunHftWallets = pgTable("pumpfun_hft_wallets", {
  id: serial("id").primaryKey(),
  address: varchar("address", { length: 255 }).notNull().unique(),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).notNull(),
  totalPnL: decimal("total_pnl", { precision: 15, scale: 6 }).notNull(),
  avgHoldTime: integer("avg_hold_time").notNull(), // minutes
  tradingVolume24h: decimal("trading_volume_24h", { precision: 15, scale: 6 }).notNull(),
  successfulTrades: integer("successful_trades").notNull(),
  totalTrades: integer("total_trades").notNull(),
  avgTradeSize: decimal("avg_trade_size", { precision: 15, scale: 6 }).notNull(),
  lastActiveTime: timestamp("last_active_time").notNull(),
  rating: varchar("rating", { length: 1 }).notNull(), // 'S', 'A', 'B', 'C'
  specializations: text("specializations").array().default(sql`ARRAY[]::text[]`),
  isMonitored: boolean("is_monitored").default(false),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pumpfunCopyTrades = pgTable("pumpfun_copy_trades", {
  id: serial("id").primaryKey(),
  originalWalletAddress: varchar("original_wallet_address", { length: 255 }).notNull(),
  tokenMint: varchar("token_mint", { length: 255 }).notNull(),
  action: varchar("action", { length: 10 }).notNull(), // 'buy' or 'sell'
  originalAmount: decimal("original_amount", { precision: 15, scale: 6 }).notNull(),
  executedAmount: decimal("executed_amount", { precision: 15, scale: 6 }).notNull(),
  executionPrice: decimal("execution_price", { precision: 20, scale: 10 }),
  slippage: decimal("slippage", { precision: 5, scale: 2 }),
  gasFee: decimal("gas_fee", { precision: 15, scale: 6 }),
  txHash: varchar("tx_hash", { length: 255 }),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  signalConfidence: integer("signal_confidence"), // 0-100
  reasoning: text("reasoning"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export const pumpfunTradeSignals = pgTable("pumpfun_trade_signals", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 255 }).notNull(),
  tokenMint: varchar("token_mint", { length: 255 }).notNull(),
  action: varchar("action", { length: 10 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 6 }).notNull(),
  price: decimal("price", { precision: 20, scale: 10 }),
  confidence: integer("confidence").notNull(), // 0-100
  reasoning: text("reasoning"),
  wasExecuted: boolean("was_executed").default(false),
  signalTime: timestamp("signal_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Verified Solana Wallets - ONLY real wallets with proven on-chain activity
export const verifiedSolanaWallets = pgTable("verified_solana_wallets", {
  id: serial("id").primaryKey(),
  address: varchar("address", { length: 255 }).notNull().unique(),
  source: varchar("source", { length: 50 }).notNull(), // 'helius_indexer', 'curated_list', 'protocol_labels'
  entityType: varchar("entity_type", { length: 50 }), // 'protocol_treasury', 'exchange_wallet', 'trader', 'dao_treasury', 'team_multisig'
  verificationLevel: varchar("verification_level", { length: 20 }).notNull(), // 'indexed', 'official', 'community_verified'
  labels: text("labels").array().default(sql`ARRAY[]::text[]`), // Human-readable labels from explorers
  ownerProgram: varchar("owner_program", { length: 255 }).notNull(), // Must be SystemProgram for real wallets
  isExecutable: boolean("is_executable").default(false), // Must be false for real wallets
  balanceSOL: decimal("balance_sol", { precision: 15, scale: 6 }).notNull(),
  txCount30d: integer("tx_count_30d").notNull(), // Transaction count last 30 days
  dexSwaps30d: integer("dex_swaps_30d").default(0), // DEX swaps last 30 days
  lastActive: timestamp("last_active").notNull(), // Last transaction time
  isSignerRate: decimal("is_signer_rate", { precision: 5, scale: 2 }).notNull(), // % of txs where this address is signer
  reachable: boolean("reachable").default(true), // Safe to send outreach messages
  excludedReason: text("excluded_reason"), // Why excluded if reachable=false
  metadata: jsonb("metadata"), // Additional verification data
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at").defaultNow().notNull(),
  lastCheckedAt: timestamp("last_checked_at").defaultNow().notNull(),
}, (table) => [
  index("IDX_verified_wallets_address").on(table.address),
  index("IDX_verified_wallets_verification_level").on(table.verificationLevel),
  index("IDX_verified_wallets_entity_type").on(table.entityType),
  index("IDX_verified_wallets_reachable").on(table.reachable),
  index("IDX_verified_wallets_last_active").on(table.lastActive),
]);

// PumpFun Copy Trading Schema Types
export const pumpfunHftWalletInsertSchema = createInsertSchema(pumpfunHftWallets).omit({
  id: true,
  discoveredAt: true,
  updatedAt: true
});

export const pumpfunHftWalletSelectSchema = createSelectSchema(pumpfunHftWallets);
export type InsertPumpfunHftWallet = z.infer<typeof pumpfunHftWalletInsertSchema>;
export type SelectPumpfunHftWallet = typeof pumpfunHftWallets.$inferSelect;

export const pumpfunCopyTradeInsertSchema = createInsertSchema(pumpfunCopyTrades).omit({
  id: true,
  executedAt: true
});

export const pumpfunCopyTradeSelectSchema = createSelectSchema(pumpfunCopyTrades);
export type InsertPumpfunCopyTrade = z.infer<typeof pumpfunCopyTradeInsertSchema>;
export type SelectPumpfunCopyTrade = typeof pumpfunCopyTrades.$inferSelect;

export const pumpfunTradeSignalInsertSchema = createInsertSchema(pumpfunTradeSignals).omit({
  id: true,
  createdAt: true
});

export const pumpfunTradeSignalSelectSchema = createSelectSchema(pumpfunTradeSignals);
export type InsertPumpfunTradeSignal = z.infer<typeof pumpfunTradeSignalInsertSchema>;
export type SelectPumpfunTradeSignal = typeof pumpfunTradeSignals.$inferSelect;

export const solanaCustomAlertSelectSchema = createSelectSchema(solanaCustomAlerts);
export type InsertSolanaCustomAlert = z.infer<typeof solanaCustomAlertInsertSchema>;
export type SelectSolanaCustomAlert = typeof solanaCustomAlerts.$inferSelect;

export const solanaWalletAnalyticsInsertSchema = createInsertSchema(solanaWalletAnalytics).omit({
  id: true,
  lastUpdated: true
});

export const solanaWalletAnalyticsSelectSchema = createSelectSchema(solanaWalletAnalytics);
export type InsertSolanaWalletAnalytics = z.infer<typeof solanaWalletAnalyticsInsertSchema>;
export type SelectSolanaWalletAnalytics = typeof solanaWalletAnalytics.$inferSelect;

// Transaction Proofs Schema Types - for storing real blockchain transaction signatures
export const transactionProofInsertSchema = createInsertSchema(transactionProofs).omit({
  id: true,
  createdAt: true
});

export const transactionProofSelectSchema = createSelectSchema(transactionProofs);
export type InsertTransactionProof = z.infer<typeof transactionProofInsertSchema>;
export type SelectTransactionProof = typeof transactionProofs.$inferSelect;

// Verified Solana Wallets Schema Types
export const verifiedSolanaWalletInsertSchema = createInsertSchema(verifiedSolanaWallets).omit({
  id: true,
  discoveredAt: true,
  verifiedAt: true,
  lastCheckedAt: true
});

export const verifiedSolanaWalletSelectSchema = createSelectSchema(verifiedSolanaWallets);
export type InsertVerifiedSolanaWallet = z.infer<typeof verifiedSolanaWalletInsertSchema>;
export type SelectVerifiedSolanaWallet = typeof verifiedSolanaWallets.$inferSelect;

// Outreach Campaign Approvals - Track manual approvals before live sends
export const outreachApprovals = pgTable("outreach_approvals", {
  id: serial("id").primaryKey(),
  campaignId: varchar("campaign_id", { length: 255 }).notNull().unique(),
  targetCount: integer("target_count").notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 6 }).notNull(),
  approvedByUser: boolean("approved_by_user").default(false),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, executed, cancelled
  targetSummary: jsonb("target_summary"), // Sample targets for review
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("IDX_outreach_approvals_campaign_id").on(table.campaignId),
  index("IDX_outreach_approvals_status").on(table.status),
]);

export const outreachApprovalInsertSchema = createInsertSchema(outreachApprovals).omit({
  id: true,
  createdAt: true
});

export const outreachApprovalSelectSchema = createSelectSchema(outreachApprovals);
export type InsertOutreachApproval = z.infer<typeof outreachApprovalInsertSchema>;
export type SelectOutreachApproval = typeof outreachApprovals.$inferSelect;

// Telegram Trading Bot Tables
export const telegramUsers = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  chatId: varchar("chat_id", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }),
  subscriptionTier: varchar("subscription_tier", { length: 20 }).default("free"), // free, basic, pro, premium
  copyTradingEnabled: boolean("copy_trading_enabled").default(false),
  tradingBalance: decimal("trading_balance", { precision: 18, scale: 9 }).default("0"),
  totalPnL: decimal("total_pnl", { precision: 18, scale: 9 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow()
}, (table) => [
  index("IDX_telegram_users_chat_id").on(table.chatId),
  index("IDX_telegram_users_subscription").on(table.subscriptionTier),
]);

export const userWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  telegramUserId: varchar("telegram_user_id", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  privateKey: text("private_key"), // Encrypted in production
  chain: varchar("chain", { length: 50 }).notNull(), // solana, ethereum, base, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("IDX_user_wallets_telegram_user").on(table.telegramUserId),
  index("IDX_user_wallets_address").on(table.address),
]);

export const telegramTrades = pgTable("telegram_trades", {
  id: serial("id").primaryKey(),
  telegramUserId: varchar("telegram_user_id", { length: 255 }).notNull(),
  tokenMint: varchar("token_mint", { length: 255 }).notNull(),
  action: varchar("action", { length: 10 }).notNull(), // buy, sell
  amount: decimal("amount", { precision: 18, scale: 9 }).notNull(),
  price: decimal("price", { precision: 18, scale: 9 }),
  slippage: decimal("slippage", { precision: 5, scale: 2 }),
  fee: decimal("fee", { precision: 18, scale: 9 }),
  txHash: varchar("tx_hash", { length: 255 }),
  status: varchar("status", { length: 20 }).default("pending"), // pending, completed, failed
  pnl: decimal("pnl", { precision: 18, scale: 9 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("IDX_telegram_trades_user").on(table.telegramUserId),
  index("IDX_telegram_trades_status").on(table.status),
  index("IDX_telegram_trades_created").on(table.createdAt),
]);

// Telegram Mini-App Tables for Coin Railz Agent Console
export const telegramAccounts = pgTable("telegram_accounts", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 255 }).notNull().unique(), // Telegram user ID
  userId: varchar("user_id").notNull(), // FK to users.id (varchar)
  apiKeyId: varchar("api_key_id"), // FK to apiKeys.id for server-side API calls
  username: varchar("username", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  referralCode: varchar("referral_code", { length: 50 }).unique(), // Unique referral code for this Telegram user
  referredByUserId: varchar("referred_by_user_id"), // FK to users.id (who referred this user)
  welcomeBonusGranted: boolean("welcome_bonus_granted").default(false), // $1 starting bonus
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow()
}, (table) => [
  uniqueIndex("IDX_telegram_accounts_telegram_id_unique").on(table.telegramId),
  index("IDX_telegram_accounts_user_id").on(table.userId),
  index("IDX_telegram_accounts_referral_code").on(table.referralCode),
  index("IDX_telegram_accounts_referred_by").on(table.referredByUserId),
]);

export const telegramReferrals = pgTable("telegram_referrals", {
  id: serial("id").primaryKey(),
  referrerUserId: varchar("referrer_user_id").notNull(), // FK to users.id (who gets the bonus)
  refereeUserId: varchar("referee_user_id").notNull(), // FK to users.id (who was referred)
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }).notNull(), // Amount of bonus credits awarded (10% of first purchase)
  refereeFirstPurchaseAmount: decimal("referee_first_purchase_amount", { precision: 10, scale: 2 }), // Amount of referee's first purchase
  creditedAt: timestamp("credited_at"), // When the bonus was actually credited
  createdAt: timestamp("created_at").defaultNow().notNull() // When the referral link was used
}, (table) => [
  index("IDX_telegram_referrals_referrer").on(table.referrerUserId),
  index("IDX_telegram_referrals_referee").on(table.refereeUserId),
  index("IDX_telegram_referrals_credited_at").on(table.creditedAt),
]);

// PaymentIntent tracking to prevent replay attacks
export const paymentIntentTracking = pgTable(
  "payment_intent_tracking",
  {
    id: serial("id").primaryKey(),
    paymentIntentId: varchar("payment_intent_id").notNull().unique(),
    customerEmail: varchar("customer_email").notNull(),
    amount: integer("amount").notNull(), // Amount in cents
    currency: varchar("currency").default("usd"),
    purpose: varchar("purpose").notNull(), // "setup_fee", "execution", "batch"
    configId: varchar("config_id"), // For setup fees
    taskDescription: text("task_description"), // For executions
    metadata: jsonb("metadata"), // Additional tracking data
    status: varchar("status").default("used"), // used, refunded, disputed
    usedAt: timestamp("used_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_payment_intent_tracking_unique").on(table.paymentIntentId),
    index("IDX_payment_intent_tracking_customer").on(table.customerEmail),
    index("IDX_payment_intent_tracking_purpose").on(table.purpose),
    index("IDX_payment_intent_tracking_config").on(table.configId),
  ],
);

// Telegram Bot Schema Types
export const telegramUserInsertSchema = createInsertSchema(telegramUsers).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true
});

export const telegramUserSelectSchema = createSelectSchema(telegramUsers);
export type InsertTelegramUser = z.infer<typeof telegramUserInsertSchema>;
export type SelectTelegramUser = typeof telegramUsers.$inferSelect;

export const userWalletInsertSchema = createInsertSchema(userWallets).omit({
  id: true,
  createdAt: true
});

export const userWalletSelectSchema = createSelectSchema(userWallets);
export type InsertUserWallet = z.infer<typeof userWalletInsertSchema>;
export type SelectUserWallet = typeof userWallets.$inferSelect;

export const telegramTradeInsertSchema = createInsertSchema(telegramTrades).omit({
  id: true,
  createdAt: true
});

export const telegramTradeSelectSchema = createSelectSchema(telegramTrades);
export type InsertTelegramTrade = z.infer<typeof telegramTradeInsertSchema>;
export type SelectTelegramTrade = typeof telegramTrades.$inferSelect;

// Telegram Mini-App schema types
export const telegramAccountInsertSchema = createInsertSchema(telegramAccounts).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true
});

export const telegramAccountSelectSchema = createSelectSchema(telegramAccounts);
export type InsertTelegramAccount = z.infer<typeof telegramAccountInsertSchema>;
export type SelectTelegramAccount = typeof telegramAccounts.$inferSelect;

export const telegramReferralInsertSchema = createInsertSchema(telegramReferrals).omit({
  id: true,
  createdAt: true
});

export const telegramReferralSelectSchema = createSelectSchema(telegramReferrals);
export type InsertTelegramReferral = z.infer<typeof telegramReferralInsertSchema>;
export type SelectTelegramReferral = typeof telegramReferrals.$inferSelect;

// PaymentIntent tracking schema types
export const paymentIntentTrackingInsertSchema = createInsertSchema(paymentIntentTracking).omit({
  id: true,
  usedAt: true,
  createdAt: true
});

export const paymentIntentTrackingSelectSchema = createSelectSchema(paymentIntentTracking);
export type InsertPaymentIntentTracking = z.infer<typeof paymentIntentTrackingInsertSchema>;
export type SelectPaymentIntentTracking = typeof paymentIntentTracking.$inferSelect;

// Fast Revenue Service Tables - Real database persistence for immediate revenue generation

// Revenue Records - Replaces in-memory revenueRecords array
export const fastRevenueRecords = pgTable(
  "fast_revenue_records",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    service: varchar("service").notNull(), // slack_action, webhook_report, a2a_message, credit_purchase
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency").default("USD").notNull(),
    userId: varchar("user_id"),
    metadata: jsonb("metadata"), // Additional service-specific data
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    paymentStatus: varchar("payment_status").default("pending"), // pending, completed, failed, refunded
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_fast_revenue_service").on(table.service),
    index("IDX_fast_revenue_user").on(table.userId),
    index("IDX_fast_revenue_timestamp").on(table.timestamp),
    index("IDX_fast_revenue_status").on(table.paymentStatus),
  ],
);

// Premium Credits - Replaces in-memory premiumCredits Map
export const fastPremiumCredits = pgTable(
  "fast_premium_credits",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    credits: decimal("credits", { precision: 8, scale: 2 }).notNull(),
    tier: varchar("tier").default("basic").notNull(), // basic, premium, enterprise
    pricePerCredit: decimal("price_per_credit", { precision: 6, scale: 4 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    purchaseTransactionId: varchar("purchase_transaction_id"), // Link to revenue record
    remainingCredits: decimal("remaining_credits", { precision: 8, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_premium_credits_user").on(table.userId),
    index("IDX_premium_credits_tier").on(table.tier),
    index("IDX_premium_credits_expires").on(table.expiresAt),
    uniqueIndex("IDX_premium_credits_purchase").on(table.purchaseTransactionId),
  ],
);

// Credit Usage Log - Track when credits are spent
export const fastCreditUsage = pgTable(
  "fast_credit_usage",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    creditPackageId: varchar("credit_package_id").notNull(), // Foreign key to fastPremiumCredits
    creditsSpent: decimal("credits_spent", { precision: 8, scale: 2 }).notNull(),
    service: varchar("service").notNull(), // a2a_message, slack_action, webhook_report
    serviceDetails: jsonb("service_details"), // Specific action or request details
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_credit_usage_user").on(table.userId),
    index("IDX_credit_usage_package").on(table.creditPackageId),
    index("IDX_credit_usage_service").on(table.service),
    index("IDX_credit_usage_date").on(table.usedAt),
  ],
);

// Relations for fast revenue tables
export const fastRevenueRecordsRelations = relations(fastRevenueRecords, ({ one }) => ({
  user: one(users, {
    fields: [fastRevenueRecords.userId],
    references: [users.id],
  }),
}));

export const fastPremiumCreditsRelations = relations(fastPremiumCredits, ({ one, many }) => ({
  user: one(users, {
    fields: [fastPremiumCredits.userId],
    references: [users.id],
  }),
  usageLog: many(fastCreditUsage),
}));

export const fastCreditUsageRelations = relations(fastCreditUsage, ({ one }) => ({
  user: one(users, {
    fields: [fastCreditUsage.userId],
    references: [users.id],
  }),
  creditPackage: one(fastPremiumCredits, {
    fields: [fastCreditUsage.creditPackageId],
    references: [fastPremiumCredits.id],
  }),
}));

// Zod schemas for fast revenue tables
export const fastRevenueRecordsInsertSchema = createInsertSchema(fastRevenueRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const fastRevenueRecordsSelectSchema = createSelectSchema(fastRevenueRecords);

export const fastPremiumCreditsInsertSchema = createInsertSchema(fastPremiumCredits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const fastPremiumCreditsSelectSchema = createSelectSchema(fastPremiumCredits);

export const fastCreditUsageInsertSchema = createInsertSchema(fastCreditUsage).omit({
  id: true,
  usedAt: true,
});

export const fastCreditUsageSelectSchema = createSelectSchema(fastCreditUsage);

// Types for fast revenue persistence
export type FastRevenueRecord = typeof fastRevenueRecords.$inferSelect;
export type InsertFastRevenueRecord = z.infer<typeof fastRevenueRecordsInsertSchema>;

export type FastPremiumCredit = typeof fastPremiumCredits.$inferSelect;
export type InsertFastPremiumCredit = z.infer<typeof fastPremiumCreditsInsertSchema>;

export type FastCreditUsage = typeof fastCreditUsage.$inferSelect;
export type InsertFastCreditUsage = z.infer<typeof fastCreditUsageInsertSchema>;

// AI Agent Prospect Wallets table
export const prospectWallets = pgTable(
  "prospect_wallets",
  {
    id: serial("id").primaryKey(),
    chain: varchar("chain").notNull(), // base, solana, xrpl
    address: varchar("address").notNull(),
    sourceToken: varchar("source_token").notNull(), // Contract/mint that led to discovery
    tokenLabel: varchar("token_label").notNull(), // CLANKER, BUZZ, XRT, etc
    balance: varchar("balance"), // Token balance as string
    holderRank: integer("holder_rank"), // Ranking by token holdings
    canReceiveXMTP: boolean("can_receive_xmtp").default(false),
    canReceiveDialect: boolean("can_receive_dialect").default(false),
    lastActivity: timestamp("last_activity"),
    discoveredAt: timestamp("discovered_at").defaultNow(),
    lastContactedAt: timestamp("last_contacted_at"),
    responseStatus: varchar("response_status").default("pending"), // pending, responded, bounced
    contactCount: integer("contact_count").default(0),
    metadata: jsonb("metadata"), // Additional wallet info
  },
  (table) => [
    uniqueIndex("IDX_prospect_wallets_chain_address").on(table.chain, table.address),
    index("IDX_prospect_wallets_token").on(table.tokenLabel),
    index("IDX_prospect_wallets_xmtp").on(table.canReceiveXMTP),
    index("IDX_prospect_wallets_rank").on(table.holderRank),
  ],
);

// Coinbase Address Database table for .cb.id & .base.eth advertising service
export const coinbaseAddressDatabase = pgTable(
  "coinbase_address_database",
  {
    id: serial("id").primaryKey(),
    address: varchar("address").notNull().unique(),
    domainName: varchar("domain_name"), // ENS domain like alice.cb.id or bob.base.eth
    domainType: varchar("domain_type").notNull(), // '.cb.id' or '.base.eth'
    lastActivity: timestamp("last_activity"),
    canReceiveMessages: boolean("can_receive_messages").default(true),
    addedAt: timestamp("added_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_coinbase_address_unique").on(table.address),
    index("IDX_coinbase_domain_type").on(table.domainType),
    index("IDX_coinbase_can_receive").on(table.canReceiveMessages),
    index("IDX_coinbase_added_at").on(table.addedAt),
  ],
);

// Outreach Campaigns table
export const outreachCampaigns = pgTable(
  "outreach_campaigns", 
  {
    id: serial("id").primaryKey(),
    name: varchar("name").notNull(),
    targetEcosystem: varchar("target_ecosystem"), // clanker, buzz, xrpturbo, all
    messageTemplate: text("message_template").notNull(),
    status: varchar("status").default("draft"), // draft, active, paused, completed
    targetCount: integer("target_count").default(0),
    sentCount: integer("sent_count").default(0),
    responseCount: integer("response_count").default(0),
    revenueGenerated: numeric("revenue_generated", { precision: 12, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow(),
    launchedAt: timestamp("launched_at"),
    completedAt: timestamp("completed_at"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("IDX_outreach_campaigns_status").on(table.status),
    index("IDX_outreach_campaigns_ecosystem").on(table.targetEcosystem),
  ],
);

// Outreach Messages table
export const outreachMessages = pgTable(
  "outreach_messages",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").references(() => outreachCampaigns.id),
    prospectWalletId: integer("prospect_wallet_id").references(() => prospectWallets.id),
    protocol: varchar("protocol").notNull(), // xmtp, dialect, xrpl_memo, email
    messageContent: text("message_content").notNull(),
    status: varchar("status").default("pending"), // pending, sent, delivered, bounced, responded
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    respondedAt: timestamp("responded_at"),
    messageId: varchar("message_id"), // External message ID from protocol
    txHash: varchar("tx_hash"), // For on-chain messages (XRPL memo, etc)
    error: text("error"), // Error details if delivery failed
    cost: numeric("cost", { precision: 10, scale: 6 }), // Message cost in USD
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_outreach_messages_campaign").on(table.campaignId),
    index("IDX_outreach_messages_prospect").on(table.prospectWalletId),
    index("IDX_outreach_messages_status").on(table.status),
    index("IDX_outreach_messages_protocol").on(table.protocol),
  ],
);

// Relations
export const prospectWalletsRelations = relations(prospectWallets, ({ many }) => ({
  messages: many(outreachMessages),
}));

export const outreachCampaignsRelations = relations(outreachCampaigns, ({ many }) => ({
  messages: many(outreachMessages),
}));

export const outreachMessagesRelations = relations(outreachMessages, ({ one }) => ({
  campaign: one(outreachCampaigns, {
    fields: [outreachMessages.campaignId],
    references: [outreachCampaigns.id],
  }),
  prospectWallet: one(prospectWallets, {
    fields: [outreachMessages.prospectWalletId],
    references: [prospectWallets.id],
  }),
}));

// Zod schemas
export const prospectWalletsInsertSchema = createInsertSchema(prospectWallets).omit({
  id: true,
  discoveredAt: true,
});

export const prospectWalletsSelectSchema = createSelectSchema(prospectWallets);

export const outreachCampaignsInsertSchema = createInsertSchema(outreachCampaigns).omit({
  id: true,
  createdAt: true,
});

export const outreachCampaignsSelectSchema = createSelectSchema(outreachCampaigns);

export const outreachMessagesInsertSchema = createInsertSchema(outreachMessages).omit({
  id: true,
  createdAt: true,
});

export const outreachMessagesSelectSchema = createSelectSchema(outreachMessages);

// Types
export type ProspectWallet = typeof prospectWallets.$inferSelect;
export type InsertProspectWallet = z.infer<typeof prospectWalletsInsertSchema>;

export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type InsertOutreachCampaign = z.infer<typeof outreachCampaignsInsertSchema>;

export type OutreachMessage = typeof outreachMessages.$inferSelect;
export type InsertOutreachMessage = z.infer<typeof outreachMessagesInsertSchema>;

// Microservice Requests - Track all micropayment service requests
export const microserviceRequests = pgTable(
  "microservice_requests",
  {
    id: varchar("id").primaryKey(),
    serviceId: varchar("service_id").notNull(), // multi-chain-balance, gas-price-oracle, etc
    requestInput: jsonb("request_input").notNull(),
    responseData: jsonb("response_data"),
    responseTime: integer("response_time"), // milliseconds
    paymentAmount: numeric("payment_amount", { precision: 20, scale: 6 }),
    paymentStatus: varchar("payment_status", { length: 50 }),
    x402PaymentId: varchar("x402_payment_id"),
    walletAddress: varchar("wallet_address"),
    paymentMethod: varchar("payment_method", { length: 20 }), // 'eip712', 'tx_hash', null (no payment)
    userAgent: text("user_agent"), // User-Agent header for SDK detection
    requestMethod: varchar("request_method", { length: 10 }), // GET, POST, etc
    requestPath: varchar("request_path", { length: 255 }), // Full request path like /x402/ping
    clientIp: varchar("client_ip", { length: 45 }), // IPv4 or IPv6 address
    paymentAttempted: boolean("payment_attempted").default(false), // Was X-PAYMENT header present?
    sourceGateway: varchar("source_gateway", { length: 50 }), // cloudflare-coinrailz, farcaster-frame, mcp, direct
    createdAt: timestamp("created_at").defaultNow(),
    error: text("error"),
  },
  (table) => [
    index("IDX_microservice_requests_service").on(table.serviceId),
    index("IDX_microservice_requests_payment_status").on(table.paymentStatus),
    index("IDX_microservice_requests_created").on(table.createdAt),
    index("IDX_microservice_requests_wallet").on(table.walletAddress),
    index("IDX_microservice_requests_payment_method").on(table.paymentMethod),
    index("IDX_microservice_requests_client_ip").on(table.clientIp),
    index("IDX_microservice_requests_user_agent").on(table.userAgent),
  ],
);

// Microservice Metrics - Daily aggregated performance metrics
export const microserviceMetrics = pgTable(
  "microservice_metrics",
  {
    id: serial("id").primaryKey(),
    serviceId: varchar("service_id").notNull(),
    date: date("date").notNull(),
    totalRequests: integer("total_requests").default(0),
    successfulRequests: integer("successful_requests").default(0),
    failedRequests: integer("failed_requests").default(0),
    totalRevenue: numeric("total_revenue", { precision: 20, scale: 6 }).default("0"),
    avgResponseTime: integer("avg_response_time"), // milliseconds
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_microservice_metrics_service_date").on(table.serviceId, table.date),
    index("IDX_microservice_metrics_date").on(table.date),
  ],
);

export const microserviceRequestsInsertSchema = createInsertSchema(microserviceRequests).omit({
  createdAt: true,
});

export const microserviceRequestsSelectSchema = createSelectSchema(microserviceRequests);

export type MicroserviceRequest = typeof microserviceRequests.$inferSelect;
export type InsertMicroserviceRequest = z.infer<typeof microserviceRequestsInsertSchema>;

export const microserviceMetricsInsertSchema = createInsertSchema(microserviceMetrics).omit({
  id: true,
  updatedAt: true,
});

export const microserviceMetricsSelectSchema = createSelectSchema(microserviceMetrics);

export type MicroserviceMetric = typeof microserviceMetrics.$inferSelect;
export type InsertMicroserviceMetric = z.infer<typeof microserviceMetricsInsertSchema>;

// x402 Protocol Payments - AI Agent Autonomous Payments
export const x402Payments = pgTable(
  "x402_payments",
  {
    id: varchar("id").primaryKey(), // x402 payment ID
    orderId: varchar("order_id"), // Link to aiMarketplaceOrders if applicable
    agentId: varchar("agent_id").notNull(),
    customerId: varchar("customer_id"),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
    currency: varchar("currency").default("USDC"),
    status: varchar("status").notNull(), // pending, completed, failed, expired
    x402TransactionId: varchar("x402_transaction_id"),
    walletAddress: varchar("wallet_address"),
    network: varchar("network").default("base"), // base, polygon, ethereum, near
    paymentProof: text("payment_proof"), // Blockchain transaction hash or payment proof
    facilitatorResponse: jsonb("facilitator_response"), // Response from Coinbase x402 Facilitator
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    expiresAt: timestamp("expires_at"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("IDX_x402_payments_agent").on(table.agentId),
    index("IDX_x402_payments_status").on(table.status),
    index("IDX_x402_payments_network").on(table.network),
    index("IDX_x402_payments_created").on(table.createdAt),
  ],
);

export const x402PaymentsInsertSchema = createInsertSchema(x402Payments).omit({
  createdAt: true,
});

export const x402PaymentsSelectSchema = createSelectSchema(x402Payments);

export type X402Payment = typeof x402Payments.$inferSelect;
export type InsertX402Payment = z.infer<typeof x402PaymentsInsertSchema>;

// x402 Payment Intents - Durable payment state with retry support (ARCHITECT-APPROVED)
// Implements payment-intent ledger pattern for replay protection with graceful failure handling
// Status transitions: PENDING → SUCCEEDED (handler completes) | FAILED (handler throws, allows retry)
export const x402PaymentIntents = pgTable(
  "x402_payment_intents",
  {
    id: varchar("id").primaryKey(), // Unique intent ID
    txHash: varchar("tx_hash", { length: 200 }).notNull(), // EVM tx hash (66 chars) or Solana signature (87-88 chars base58)
    network: varchar("network").notNull(), // base, ethereum, polygon, solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp, etc
    serviceName: varchar("service_name").notNull(), // Which service being paid for
    payer: varchar("payer").notNull(), // Sender wallet address
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(), // Payment amount
    status: varchar("status").notNull(), // PENDING, SUCCEEDED, FAILED, ALLOW_RETRY
    retries: integer("retries").default(0).notNull(), // Retry attempt count
    lastError: text("last_error"), // Error message if failed
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(), // Intent expiration (15 min default)
    succeededAt: timestamp("succeeded_at"), // When handler completed successfully
    metadata: jsonb("metadata"), // Additional context (e.g., token type USDC/USDT)
  },
  (table) => [
    // Composite unique index for txHash + serviceName (one payment per service per tx)
    uniqueIndex("IDX_payment_intents_tx_service").on(table.txHash, table.serviceName),
    index("IDX_payment_intents_status").on(table.status),
    index("IDX_payment_intents_payer").on(table.payer),
    index("IDX_payment_intents_expires").on(table.expiresAt),
    index("IDX_payment_intents_created").on(table.createdAt),
  ],
);

export const x402PaymentIntentsInsertSchema = createInsertSchema(x402PaymentIntents).omit({
  createdAt: true,
  updatedAt: true,
});

export const x402PaymentIntentsSelectSchema = createSelectSchema(x402PaymentIntents);

export type X402PaymentIntent = typeof x402PaymentIntents.$inferSelect;
export type InsertX402PaymentIntent = z.infer<typeof x402PaymentIntentsInsertSchema>;

/**
 * Typed metadata schema for x402 payment intents
 * Standardizes what goes into the metadata JSONB column
 * Prevents "JSONB junk" and ensures consistent analytics/auditing
 */
export interface PaymentIntentMetadata {
  // Required fields - always include these
  tokenAddress: string;       // Token contract address (USDC or USDT)
  tokenSymbol: 'USDC' | 'USDT';  // Token symbol for clarity
  chainId: number;            // Chain ID (8453 for Base)
  
  // Optional fields for analytics and debugging
  pricingVersion?: string;    // e.g., "2025-12-14-a" for tracking pricing changes
  userAgent?: string;         // Client user agent for debugging
  ipHash?: string;            // Hashed IP for analytics (privacy-preserving)
  quoteId?: string;           // If payment was for a quoted price
  sdkVersion?: string;        // Client SDK version if applicable
}

/**
 * Helper to create standardized payment intent metadata
 * Ensures all required fields are present
 */
export function createPaymentIntentMetadata(
  tokenAddress: string,
  tokenSymbol: 'USDC' | 'USDT',
  chainId: number = 8453,
  extras?: Partial<Omit<PaymentIntentMetadata, 'tokenAddress' | 'tokenSymbol' | 'chainId'>>
): PaymentIntentMetadata {
  return {
    tokenAddress,
    tokenSymbol,
    chainId,
    ...extras,
  };
}

// x402 Discovery Metrics - Daily aggregated discovery analytics
export const x402DiscoveryMetrics = pgTable(
  "x402_discovery_metrics",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    totalPaymentRequests: integer("total_payment_requests").default(0),
    uniqueWallets: integer("unique_wallets").default(0),
    completedPayments: integer("completed_payments").default(0),
    expiredPayments: integer("expired_payments").default(0),
    totalRevenue: numeric("total_revenue", { precision: 18, scale: 6 }).default("0"),
    byService: jsonb("by_service"), // { "gas-price-oracle": 235, "contract-scan": 233, ... }
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_x402_discovery_metrics_date").on(table.date),
    index("IDX_x402_discovery_metrics_updated").on(table.updatedAt),
  ],
);

export const x402DiscoveryMetricsInsertSchema = createInsertSchema(x402DiscoveryMetrics).omit({
  id: true,
  updatedAt: true,
});

export const x402DiscoveryMetricsSelectSchema = createSelectSchema(x402DiscoveryMetrics);

export type X402DiscoveryMetric = typeof x402DiscoveryMetrics.$inferSelect;
export type InsertX402DiscoveryMetric = z.infer<typeof x402DiscoveryMetricsInsertSchema>;

// x402 Funnel Interactions - Track who hits endpoints, headers, retry behavior
// Used for funnel instrumentation to understand where agents drop off
export const x402Interactions = pgTable(
  "x402_interactions",
  {
    id: serial("id").primaryKey(),
    serviceId: varchar("service_id"), // Legacy: service identifier
    walletAddress: varchar("wallet_address"), // Legacy: wallet if present
    ipAddress: varchar("ip_address"), // Source IP
    userAgent: text("user_agent"), // User-Agent header
    requestPath: varchar("request_path"), // Full request path
    requestMethod: varchar("request_method"), // GET, POST
    responseStatus: integer("response_status"), // HTTP status code
    paid: boolean("paid").default(false), // Legacy: payment flag
    amount: numeric("amount", { precision: 18, scale: 6 }), // Legacy: amount
    interactionType: varchar("interaction_type"), // Legacy: type of interaction
    requestId: varchar("request_id"), // Correlation ID for tracking retries
    eventType: varchar("event_type"), // request-start, challenge-issued, retry, authorized
    serviceName: varchar("service_name"), // Which x402 service was hit
    x402ClientHeader: varchar("x402_client_header"), // Custom x-402-client header
    referer: varchar("referer"), // Referer header
    challengePayload: jsonb("challenge_payload"), // 402 response payload sent
    latencyMs: integer("latency_ms"), // Request processing time
    retryCount: integer("retry_count").default(0), // Retry count
    paymentReceived: boolean("payment_received").default(false), // Did they pay?
    paymentAmount: numeric("payment_amount", { precision: 18, scale: 6 }), // Amount paid
    errorMessage: text("error_message"), // Error if failed
    offerTrackingId: varchar("offer_tracking_id"), // Links to x402_offer_links.tracking_id for attribution
    metadata: jsonb("metadata"), // Additional context
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_x402_interactions_request_id").on(table.requestId),
    index("IDX_x402_interactions_event_type").on(table.eventType),
    index("IDX_x402_interactions_service").on(table.serviceName),
    index("IDX_x402_interactions_created").on(table.createdAt),
    index("IDX_x402_interactions_source_ip").on(table.ipAddress),
    index("IDX_x402_interactions_offer_tracking").on(table.offerTrackingId),
  ],
);

export const x402InteractionsInsertSchema = createInsertSchema(x402Interactions).omit({
  id: true,
  createdAt: true,
});

export const x402InteractionsSelectSchema = createSelectSchema(x402Interactions);

export type X402Interaction = typeof x402Interactions.$inferSelect;
export type InsertX402Interaction = z.infer<typeof x402InteractionsInsertSchema>;

// x402 Offer Links - Track unique offer links for attribution from outreach to conversion
// When agents click these links, we know exactly which outreach message drove the traffic
export const x402OfferLinks = pgTable(
  "x402_offer_links",
  {
    id: serial("id").primaryKey(),
    trackingId: varchar("tracking_id", { length: 21 }).notNull(), // nanoid for URL-safe unique ID
    outreachMessageId: integer("outreach_message_id"), // FK to agent_outreach_messages.id
    serviceId: varchar("service_id").notNull(), // Which service this offer is for
    campaignId: varchar("campaign_id"), // Optional campaign grouping
    targetAgentUrl: varchar("target_agent_url"), // The agent this was sent to
    clickCount: integer("click_count").default(0), // How many times link was clicked
    firstClickAt: timestamp("first_click_at"), // When first clicked
    lastClickAt: timestamp("last_click_at"), // Most recent click
    convertedAt: timestamp("converted_at"), // When payment was made (if ever)
    conversionAmount: numeric("conversion_amount", { precision: 18, scale: 6 }), // Amount paid
    expiresAt: timestamp("expires_at"), // Optional expiration
    isActive: boolean("is_active").default(true), // Soft delete / deactivation
    metadata: jsonb("metadata"), // Additional context (message content, platform, etc)
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_x402_offer_links_tracking_id").on(table.trackingId),
    index("IDX_x402_offer_links_outreach").on(table.outreachMessageId),
    index("IDX_x402_offer_links_service").on(table.serviceId),
    index("IDX_x402_offer_links_campaign").on(table.campaignId),
    index("IDX_x402_offer_links_created").on(table.createdAt),
    index("IDX_x402_offer_links_active").on(table.isActive),
  ],
);

export const x402OfferLinksInsertSchema = createInsertSchema(x402OfferLinks).omit({
  id: true,
  clickCount: true,
  firstClickAt: true,
  lastClickAt: true,
  convertedAt: true,
  conversionAmount: true,
  createdAt: true,
});

export const x402OfferLinksSelectSchema = createSelectSchema(x402OfferLinks);

export type X402OfferLink = typeof x402OfferLinks.$inferSelect;
export type InsertX402OfferLink = z.infer<typeof x402OfferLinksInsertSchema>;

// Platform Testimonials - Community feedback and social proof
export const platformTestimonials = pgTable(
  "platform_testimonials",
  {
    id: serial("id").primaryKey(),
    authorName: varchar("author_name").notNull(),
    authorHandle: varchar("author_handle"), // @username for Twitter/Telegram
    platform: varchar("platform").notNull(), // twitter, telegram, discord
    rating: integer("rating").notNull().default(5), // 1-5 stars
    testimonial: text("testimonial").notNull(),
    featured: boolean("featured").default(false), // Show on homepage
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_testimonials_featured").on(table.featured),
    index("IDX_testimonials_platform").on(table.platform),
  ],
);

export const platformTestimonialsInsertSchema = createInsertSchema(platformTestimonials).omit({
  id: true,
  createdAt: true,
});

export const platformTestimonialsSelectSchema = createSelectSchema(platformTestimonials);

export type PlatformTestimonial = typeof platformTestimonials.$inferSelect;
export type InsertPlatformTestimonial = z.infer<typeof platformTestimonialsInsertSchema>;

// Credits Transactions - Track prepaid credits purchases and usage
export const creditsTransactions = pgTable(
  "credits_transactions",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    type: varchar("type").notNull(), // purchase, usage, refund, bonus
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Credit amount
    dollarValue: decimal("dollar_value", { precision: 10, scale: 2 }).notNull(), // USD equivalent
    description: text("description"), // What the credits were used for
    relatedOrderId: varchar("related_order_id"), // Link to order if applicable
    balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_credits_transactions_user").on(table.userId),
    index("IDX_credits_transactions_type").on(table.type),
    index("IDX_credits_transactions_created").on(table.createdAt),
  ],
);

export const creditsTransactionsInsertSchema = createInsertSchema(creditsTransactions).omit({
  id: true,
  createdAt: true,
});

export const creditsTransactionsSelectSchema = createSelectSchema(creditsTransactions);

export type CreditsTransaction = typeof creditsTransactions.$inferSelect;
export type InsertCreditsTransaction = z.infer<typeof creditsTransactionsInsertSchema>;

// Free Credits Claim Log - Anti-abuse tracking for guest free credit claims
export const freeCreditsClaimLog = pgTable(
  "free_credits_claim_log",
  {
    id: serial("id").primaryKey(),
    ipAddress: varchar("ip_address").notNull(),
    fingerprint: varchar("fingerprint").notNull(), // Browser fingerprint hash
    userId: varchar("user_id"), // NULL for guest claims
    sessionId: varchar("session_id"), // Session identifier
    userAgent: text("user_agent"),
    claimedAt: timestamp("claimed_at").defaultNow(),
  },
  (table) => [
    index("IDX_free_credits_ip").on(table.ipAddress),
    index("IDX_free_credits_fingerprint").on(table.fingerprint),
    index("IDX_free_credits_claimed_at").on(table.claimedAt),
  ],
);

export const freeCreditsClaimLogInsertSchema = createInsertSchema(freeCreditsClaimLog).omit({
  id: true,
  claimedAt: true,
});

export const freeCreditsClaimLogSelectSchema = createSelectSchema(freeCreditsClaimLog);

export type FreeCreditsClaimLog = typeof freeCreditsClaimLog.$inferSelect;
export type InsertFreeCreditsClaimLog = z.infer<typeof freeCreditsClaimLogInsertSchema>;

// Guest Credits - Track credits for unauthenticated users (IP-based)
export const guestCredits = pgTable(
  "guest_credits",
  {
    id: serial("id").primaryKey(),
    ipAddress: varchar("ip_address").notNull().unique(),
    fingerprint: varchar("fingerprint").notNull(),
    creditsBalance: decimal("credits_balance", { precision: 10, scale: 2 }).notNull().default("0"),
    totalEarned: decimal("total_earned", { precision: 10, scale: 2 }).notNull().default("0"),
    totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).notNull().default("0"),
    freeCreditsGranted: boolean("free_credits_granted").notNull().default(false),
    lastActivity: timestamp("last_activity").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    expiresAt: timestamp("expires_at"), // Credits expire after 7 days of inactivity
  },
  (table) => [
    index("IDX_guest_credits_ip").on(table.ipAddress),
    index("IDX_guest_credits_fingerprint").on(table.fingerprint),
    index("IDX_guest_credits_expires").on(table.expiresAt),
  ],
);

export const guestCreditsInsertSchema = createInsertSchema(guestCredits).omit({
  id: true,
  createdAt: true,
});

export const guestCreditsSelectSchema = createSelectSchema(guestCredits);

export type GuestCredits = typeof guestCredits.$inferSelect;
export type InsertGuestCredits = z.infer<typeof guestCreditsInsertSchema>;

// Guest Credits Transactions - Track guest credit usage
export const guestCreditsTransactions = pgTable(
  "guest_credits_transactions",
  {
    id: serial("id").primaryKey(),
    guestId: integer("guest_id").notNull(), // References guest_credits.id
    ipAddress: varchar("ip_address").notNull(),
    type: varchar("type").notNull(), // bonus, usage
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    dollarValue: decimal("dollar_value", { precision: 10, scale: 2 }).notNull(),
    description: text("description"),
    balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_guest_transactions_guest").on(table.guestId),
    index("IDX_guest_transactions_ip").on(table.ipAddress),
    index("IDX_guest_transactions_created").on(table.createdAt),
  ],
);

export const guestCreditsTransactionsInsertSchema = createInsertSchema(guestCreditsTransactions).omit({
  id: true,
  createdAt: true,
});

export const guestCreditsTransactionsSelectSchema = createSelectSchema(guestCreditsTransactions);

export type GuestCreditsTransaction = typeof guestCreditsTransactions.$inferSelect;
export type InsertGuestCreditsTransaction = z.infer<typeof guestCreditsTransactionsInsertSchema>;

// Pending Crypto Payment Requests - Track autonomous crypto payments to platform wallet
export const pendingCryptoPaymentRequests = pgTable(
  "pending_crypto_payment_requests",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    guestIP: varchar("guest_ip").notNull(),
    fingerprint: varchar("fingerprint"),
    requestedAmountUSD: decimal("requested_amount_usd", { precision: 10, scale: 2 }).notNull(),
    uniquePaymentAmount: decimal("unique_payment_amount", { precision: 18, scale: 6 }).notNull(), // High precision for matching
    platformWalletAddress: varchar("platform_wallet_address").notNull(),
    network: varchar("network").notNull().default("base"),
    currency: varchar("currency").notNull().default("USDC"),
    status: varchar("status").notNull().default("pending"), // pending, completed, expired, failed
    txHash: varchar("tx_hash"), // Transaction hash once verified
    createdAt: timestamp("created_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(), // 15 minute expiry
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("IDX_pending_crypto_payments_guest_ip").on(table.guestIP),
    index("IDX_pending_crypto_payments_status").on(table.status),
    index("IDX_pending_crypto_payments_expires").on(table.expiresAt),
    index("IDX_pending_crypto_payments_unique_amount").on(table.uniquePaymentAmount),
  ],
);

export const pendingCryptoPaymentRequestsInsertSchema = createInsertSchema(pendingCryptoPaymentRequests).omit({
  createdAt: true,
});

export const pendingCryptoPaymentRequestsSelectSchema = createSelectSchema(pendingCryptoPaymentRequests);

export type PendingCryptoPaymentRequest = typeof pendingCryptoPaymentRequests.$inferSelect;
export type InsertPendingCryptoPaymentRequest = z.infer<typeof pendingCryptoPaymentRequestsInsertSchema>;

// Coinbase Address Database schemas and types
export const coinbaseAddressDatabaseInsertSchema = createInsertSchema(coinbaseAddressDatabase).omit({
  id: true,
  addedAt: true,
});

export const coinbaseAddressDatabaseSelectSchema = createSelectSchema(coinbaseAddressDatabase);

export type CoinbaseAddressRecord = typeof coinbaseAddressDatabase.$inferSelect;
export type InsertCoinbaseAddressRecord = z.infer<typeof coinbaseAddressDatabaseInsertSchema>;

// x402 Microservice Input Validation Schemas
// Transaction Builder Service - Pre-validated transaction encoding for agent-to-agent transfers
export const transactionBuilderInputSchema = z.object({
  to: z.string().min(1, "Recipient address is required").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  value: z.string().optional(),
  data: z.string().optional(),
  chain: z.string().min(1, "Blockchain network is required"),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token address format").optional(),
  amount: z.string().optional(),
}).refine(
  (data) => {
    if (data.tokenAddress && !data.amount) {
      return false;
    }
    return true;
  },
  {
    message: "amount is required when tokenAddress is provided",
    path: ["amount"],
  }
);

export type TransactionBuilderInput = z.infer<typeof transactionBuilderInputSchema>;

// Approval Manager Service - Token approval transaction generator for DeFi agents
export const approvalManagerInputSchema = z.object({
  tokenAddress: z.string().min(1, "Token address is required").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token address format"),
  spender: z.string().min(1, "Spender address is required").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid spender address format"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => val === "unlimited" || !isNaN(Number(val)),
    "Amount must be 'unlimited' or a valid number"
  ),
  chain: z.string().min(1, "Blockchain network is required"),
});

export type ApprovalManagerInput = z.infer<typeof approvalManagerInputSchema>;

// Batch Quote Service - Multi-DEX price quotes for trading bot price discovery
export const batchQuoteInputSchema = z.object({
  fromToken: z.string().min(1, "Input token address is required").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid input token address format"),
  toToken: z.string().min(1, "Output token address is required").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid output token address format"),
  amount: z.string().min(1, "Input amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Amount must be a valid positive number"
  ),
  chain: z.string().min(1, "Blockchain network is required"),
});

export type BatchQuoteInput = z.infer<typeof batchQuoteInputSchema>;

// Credits Accounts - Prepaid credits balance for users
export const creditsAccounts = pgTable("credits_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  autoTopUpEnabled: boolean("auto_top_up_enabled").default(false),
  autoTopUpThreshold: decimal("auto_top_up_threshold", { precision: 12, scale: 2 }).default("10.00"),
  autoTopUpAmount: decimal("auto_top_up_amount", { precision: 12, scale: 2 }).default("50.00"),
  preferredPaymentMethod: varchar("preferred_payment_method").default("stripe"), // stripe, usdc, usdt
  // Auto-recharge via vaulted Stripe card
  stripeCustomerId: varchar("stripe_customer_id"),           // Stripe customer for off-session charges
  autoRechargePaymentMethodId: varchar("auto_recharge_payment_method_id"), // pm_... to charge
  autoRechargeLastAttemptAt: timestamp("auto_recharge_last_attempt_at"),   // cooldown guard
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("IDX_credits_accounts_user_id").on(table.userId),
  index("IDX_credits_accounts_balance").on(table.balance),
]);

// Credit Transactions - Ledger of all credit movements
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => creditsAccounts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // purchase, debit, refund, adjustment, bonus
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }).notNull(),
  referenceId: varchar("reference_id"), // Stripe payment ID, txHash, etc.
  serviceName: varchar("service_name"), // Which x402 service was called (for debits)
  paymentMethod: varchar("payment_method"), // stripe, usdc, usdt
  metadata: jsonb("metadata"), // Additional transaction data
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_credit_transactions_account_id").on(table.accountId),
  index("IDX_credit_transactions_user_id").on(table.userId),
  index("IDX_credit_transactions_type").on(table.type),
  index("IDX_credit_transactions_reference_id").on(table.referenceId),
  index("IDX_credit_transactions_created_at").on(table.createdAt),
]);

// API Keys - API key authentication for prepaid credits
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(), // First 12 chars for display (e.g., "cr_live_abc1")
  hashedKey: varchar("hashed_key", { length: 255 }).notNull(), // Bcrypt hash of full key
  name: varchar("name").default("API Key"), // User-friendly name
  status: varchar("status").default("active").notNull(), // active, revoked, expired
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  allowedServices: jsonb("allowed_services"), // Restrict to specific services if needed
  rateLimit: integer("rate_limit").default(1000), // Requests per hour
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, (table) => [
  uniqueIndex("IDX_api_keys_hashed_key").on(table.hashedKey),
  index("IDX_api_keys_user_id").on(table.userId),
  index("IDX_api_keys_status").on(table.status),
  index("IDX_api_keys_key_prefix").on(table.keyPrefix),
]);

// GPT Purchase Sessions - Persist checkout sessions for GPT in-chat purchases
export const gptPurchaseSessions = pgTable("gpt_purchase_sessions", {
  id: varchar("id", { length: 24 }).primaryKey(),
  stripeSessionId: varchar("stripe_session_id"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  clientSecret: varchar("client_secret"),
  userId: varchar("user_id").notNull(),
  packageName: varchar("package_name").notNull(),
  amount: integer("amount").notNull(),
  credits: integer("credits"),
  status: varchar("status").notNull().default("pending"),
  apiKey: varchar("api_key"),
  gptAuthSessionId: integer("gpt_auth_session_id"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("IDX_gpt_sessions_user_id").on(table.userId),
  index("IDX_gpt_sessions_status").on(table.status),
  index("IDX_gpt_sessions_stripe_session").on(table.stripeSessionId),
  index("IDX_gpt_sessions_payment_intent").on(table.stripePaymentIntentId),
]);

export type GptPurchaseSession = typeof gptPurchaseSessions.$inferSelect;
export type InsertGptPurchaseSession = typeof gptPurchaseSessions.$inferInsert;

// GPT Auth Sessions - Session-based authentication for ChatGPT users
// Maps OpenAI conversation/session headers to users for zero-friction auth
export const gptAuthSessions = pgTable("gpt_auth_sessions", {
  id: serial("id").primaryKey(),
  
  // Deterministic fingerprints for lookup (SHA-256, no salt - 64 hex chars)
  conversationFingerprint: varchar("conversation_fingerprint", { length: 64 }).notNull(),
  sessionFingerprint: varchar("session_fingerprint", { length: 64 }).notNull(),
  
  // Encrypted raw IDs for audit trail (AES-256-GCM encrypted)
  encryptedConversationId: text("encrypted_conversation_id"),
  encryptedSessionId: text("encrypted_session_id"),
  
  // User linkage (nullable for provisional sessions before account linking)
  userId: varchar("user_id").references(() => users.id),
  
  // Credits account linkage (nullable, created on first purchase)
  creditsAccountId: integer("credits_account_id").references(() => creditsAccounts.id),
  
  // Lifecycle status: active, pending_link, linked, expired, revoked
  status: varchar("status").notNull().default("active"),
  
  // Email for account linking (collected from GPT user)
  email: varchar("email"),
  
  // Deterministic email hash for indexed lookup (SHA-256, 64 hex chars)
  // Allows searching by email without decrypting every row
  emailHash: varchar("email_hash", { length: 64 }),
  
  // GPT identifier hash for non-email opaque IDs (SHA-256, 64 hex chars)
  // Supports indexed lookup for cross-conversation user correlation
  gptIdentifierHash: varchar("gpt_identifier_hash", { length: 64 }),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  
  // Metadata for analytics (no raw identifiers)
  metadata: jsonb("metadata"),
}, (table) => [
  // Unique on fingerprints for deduplication and O(1) lookup
  uniqueIndex("IDX_gpt_auth_sessions_fingerprints").on(table.conversationFingerprint, table.sessionFingerprint),
  index("IDX_gpt_auth_sessions_conversation_fp").on(table.conversationFingerprint),
  index("IDX_gpt_auth_sessions_user").on(table.userId),
  index("IDX_gpt_auth_sessions_status").on(table.status),
  index("IDX_gpt_auth_sessions_expires").on(table.expiresAt),
  index("IDX_gpt_auth_sessions_email").on(table.email),
  index("IDX_gpt_auth_sessions_email_hash").on(table.emailHash),
  index("IDX_gpt_auth_sessions_gpt_id_hash").on(table.gptIdentifierHash),
]);

// GPT Auth Sessions Insert/Select Schemas
export const gptAuthSessionsInsertSchema = createInsertSchema(gptAuthSessions).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const gptAuthSessionsSelectSchema = createSelectSchema(gptAuthSessions);

export type GptAuthSession = typeof gptAuthSessions.$inferSelect;
export type InsertGptAuthSession = z.infer<typeof gptAuthSessionsInsertSchema>;

// GPT OAuth Tokens - Stores OAuth access/refresh tokens for ChatGPT GPT Actions
export const gptOAuthTokens = pgTable("gpt_oauth_tokens", {
  id: serial("id").primaryKey(),
  
  // User linkage (required - OAuth tokens are always linked to a user)
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Access token (hashed for security - we only need to verify, not decrypt)
  accessTokenHash: varchar("access_token_hash", { length: 64 }).notNull(),
  
  // Refresh token (hashed for security)
  refreshTokenHash: varchar("refresh_token_hash", { length: 64 }),
  
  // Token metadata
  scope: varchar("scope").default("basic credits.read credits.charge"),
  
  // Status for revocation: active, revoked, expired
  status: varchar("status").notNull().default("active"),
  
  // Expiration timestamps
  accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  
  // Client info (GPT ID that issued this token)
  clientId: varchar("client_id"),
  
  // Metadata
  metadata: jsonb("metadata"),
}, (table) => [
  index("IDX_gpt_oauth_tokens_user").on(table.userId),
  index("IDX_gpt_oauth_tokens_access_hash").on(table.accessTokenHash),
  index("IDX_gpt_oauth_tokens_refresh_hash").on(table.refreshTokenHash),
  index("IDX_gpt_oauth_tokens_status").on(table.status),
  index("IDX_gpt_oauth_tokens_expires").on(table.accessTokenExpiresAt),
]);

// GPT OAuth Authorization Codes - Temporary codes for OAuth flow
export const gptOAuthCodes = pgTable("gpt_oauth_codes", {
  id: serial("id").primaryKey(),
  
  // Authorization code (hashed)
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  
  // User who authorized
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // OAuth flow parameters
  clientId: varchar("client_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  scope: varchar("scope"),
  state: varchar("state"),
  codeChallenge: varchar("code_challenge"), // PKCE support
  codeChallengeMethod: varchar("code_challenge_method"), // plain or S256
  
  // Status: pending, used, expired
  status: varchar("status").notNull().default("pending"),
  
  // Short expiration (10 minutes max per OAuth spec)
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
}, (table) => [
  index("IDX_gpt_oauth_codes_code_hash").on(table.codeHash),
  index("IDX_gpt_oauth_codes_user").on(table.userId),
  index("IDX_gpt_oauth_codes_status").on(table.status),
  index("IDX_gpt_oauth_codes_expires").on(table.expiresAt),
]);

// GPT OAuth Tokens Insert/Select Schemas
export const gptOAuthTokensInsertSchema = createInsertSchema(gptOAuthTokens).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
});

export type GptOAuthToken = typeof gptOAuthTokens.$inferSelect;
export type InsertGptOAuthToken = z.infer<typeof gptOAuthTokensInsertSchema>;

// GPT OAuth Codes Insert/Select Schemas
export const gptOAuthCodesInsertSchema = createInsertSchema(gptOAuthCodes).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type GptOAuthCode = typeof gptOAuthCodes.$inferSelect;
export type InsertGptOAuthCode = z.infer<typeof gptOAuthCodesInsertSchema>;

// Credits Accounts Insert/Select Schemas
export const creditsAccountsInsertSchema = createInsertSchema(creditsAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const creditsAccountsSelectSchema = createSelectSchema(creditsAccounts);

export type CreditsAccount = typeof creditsAccounts.$inferSelect;
export type InsertCreditsAccount = z.infer<typeof creditsAccountsInsertSchema>;

// Credit Transactions Insert/Select Schemas
export const creditTransactionsInsertSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const creditTransactionsSelectSchema = createSelectSchema(creditTransactions);

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof creditTransactionsInsertSchema>;

// API Keys Insert/Select Schemas
export const apiKeysInsertSchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
});

export const apiKeysSelectSchema = createSelectSchema(apiKeys);

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof apiKeysInsertSchema>;

// Instant API Key Grants - Rate limiting for $1 → $5 credit abuse prevention
// Each wallet can only receive starter credits once per 30 days
export const instantApiKeyGrants = pgTable("instant_api_key_grants", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address").notNull(), // Payer wallet address
  chain: varchar("chain").notNull(), // base, solana, ethereum, etc.
  token: varchar("token").notNull(), // USDC, USDT
  apiKeyId: varchar("api_key_id").notNull(), // Reference to generated API key
  creditsGranted: decimal("credits_granted", { precision: 10, scale: 2 }).notNull().default("5.00"),
  txHash: varchar("tx_hash"), // Payment transaction hash
  amountPaid: decimal("amount_paid", { precision: 10, scale: 6 }).notNull(), // Amount paid in token
  ipAddress: varchar("ip_address"), // For additional abuse prevention
  userAgent: text("user_agent"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // When this grant period expires (30 days from grant)
}, (table) => [
  index("IDX_instant_api_key_grants_wallet").on(table.walletAddress),
  index("IDX_instant_api_key_grants_chain_token").on(table.chain, table.token),
  index("IDX_instant_api_key_grants_granted_at").on(table.grantedAt),
  uniqueIndex("IDX_instant_api_key_grants_tx_hash").on(table.txHash),
  index("IDX_instant_api_key_grants_ip").on(table.ipAddress),
]);

export const instantApiKeyGrantsInsertSchema = createInsertSchema(instantApiKeyGrants).omit({
  id: true,
  grantedAt: true,
});

export type InstantApiKeyGrant = typeof instantApiKeyGrants.$inferSelect;
export type InsertInstantApiKeyGrant = z.infer<typeof instantApiKeyGrantsInsertSchema>;

// Service Bundle Subscriptions - Track AI agent bundle purchases
export const serviceBundleSubscriptions = pgTable("service_bundle_subscriptions", {
  id: serial("id").primaryKey(),
  bundleId: varchar("bundle_id").notNull(), // trading-intelligence, security-compliance, payments-execution
  tier: varchar("tier").notNull(), // starter, professional, enterprise
  subscriberId: varchar("subscriber_id").notNull(), // Agent wallet address or user ID
  subscriberType: varchar("subscriber_type").notNull().default("agent"), // agent, user
  status: varchar("status").notNull().default("active"), // active, paused, cancelled, expired
  creditsTotal: integer("credits_total").notNull(), // Total credits allocated per billing cycle
  creditsUsed: integer("credits_used").notNull().default(0), // Credits consumed this cycle
  creditsRemaining: integer("credits_remaining").notNull(), // Calculated: creditsTotal - creditsUsed
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method").notNull(), // x402, stripe, circle, coinbase
  paymentAddress: varchar("payment_address"), // Wallet address for crypto payments
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeCustomerId: varchar("stripe_customer_id"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  nextBillingDate: timestamp("next_billing_date"),
  cancelledAt: timestamp("cancelled_at"),
  email: varchar("email"),
  apiKeyHash: varchar("api_key_hash"), // SHA-256 hash of the subscription API key
  metadata: jsonb("metadata"), // Additional subscription metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_bundle_subscriptions_bundle_id").on(table.bundleId),
  index("IDX_bundle_subscriptions_subscriber").on(table.subscriberId),
  index("IDX_bundle_subscriptions_status").on(table.status),
  index("IDX_bundle_subscriptions_stripe_sub").on(table.stripeSubscriptionId),
]);

// Service Bundle Usage Tracking - Track individual service calls against bundle credits
export const serviceBundleUsage = pgTable("service_bundle_usage", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => serviceBundleSubscriptions.id),
  serviceSlug: varchar("service_slug").notNull(), // gas-price-oracle, token-price, etc
  creditsCharged: integer("credits_charged").notNull().default(1), // Usually 1 credit per call
  requestMethod: varchar("request_method"), // GET, POST
  requestPath: varchar("request_path"),
  responseStatus: integer("response_status"),
  responseTime: integer("response_time"), // milliseconds
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("IDX_bundle_usage_subscription").on(table.subscriptionId),
  index("IDX_bundle_usage_service").on(table.serviceSlug),
  index("IDX_bundle_usage_timestamp").on(table.timestamp),
]);

// Service Bundle Subscriptions Insert/Select Schemas
export const serviceBundleSubscriptionsInsertSchema = createInsertSchema(serviceBundleSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const serviceBundleSubscriptionsSelectSchema = createSelectSchema(serviceBundleSubscriptions);

export type ServiceBundleSubscription = typeof serviceBundleSubscriptions.$inferSelect;
export type InsertServiceBundleSubscription = z.infer<typeof serviceBundleSubscriptionsInsertSchema>;

// Service Bundle Usage Insert/Select Schemas
export const serviceBundleUsageInsertSchema = createInsertSchema(serviceBundleUsage).omit({
  id: true,
  timestamp: true,
});

export const serviceBundleUsageSelectSchema = createSelectSchema(serviceBundleUsage);

export type ServiceBundleUsage = typeof serviceBundleUsage.$inferSelect;
export type InsertServiceBundleUsage = z.infer<typeof serviceBundleUsageInsertSchema>;

// ========================================
// NEW x402 VERTICAL EXPANSION SCHEMAS
// ========================================

// Real Estate Services Input Schemas
export const propertyValuationInputSchema = z.object({
  address: z.string().min(5, "Address is required"),
  propertyType: z.string().optional(),
  bedrooms: z.number().int().positive().optional(),
  bathrooms: z.number().positive().optional(),
  squareFootage: z.number().positive().optional(),
  lotSize: z.number().positive().optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
  condition: z.enum(["poor", "fair", "average", "good", "excellent"]).optional(),
  features: z.array(z.string()).optional(),
});

export const leaseAnalysisInputSchema = z.object({
  leaseText: z.string().optional(),
  propertyAddress: z.string().optional(),
  leaseType: z.string().optional(),
  termLength: z.string().optional(),
  monthlyRent: z.number().positive().optional(),
});

export const constructionProgressInputSchema = z.object({
  projectDescription: z.string().min(10, "Project description required"),
  photoUrls: z.array(z.string().url()).optional(),
  projectType: z.string().optional(),
  targetCompletionDate: z.string().optional(),
  currentPhase: z.string().optional(),
});

// Banking/Finance Services Input Schemas
export const creditRiskScoreInputSchema = z.object({
  applicantInfo: z.object({
    annualIncome: z.number().positive().optional(),
    employmentYears: z.number().nonnegative().optional(),
    currentDebt: z.number().nonnegative().optional(),
  }).optional(),
  creditHistory: z.object({
    paymentHistory: z.string().optional(),
    creditUtilization: z.number().min(0).max(100).optional(),
    accountAge: z.number().positive().optional(),
    recentInquiries: z.number().nonnegative().optional(),
  }).optional(),
  transactionHistory: z.array(z.any()).optional(),
  requestedAmount: z.number().positive().optional(),
});

export const fraudDetectionInputSchema = z.object({
  transactionAmount: z.number().positive().optional(),
  merchantCategory: z.string().optional(),
  location: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  accountHistory: z.object({
    typicalSpending: z.number().nonnegative().optional(),
    averageTransaction: z.number().nonnegative().optional(),
    velocityPattern: z.string().optional(),
  }).optional(),
  recentActivity: z.array(z.any()).optional(),
});

export const complianceCheckInputSchema = z.object({
  entityType: z.string().optional(),
  jurisdiction: z.string().optional(),
  transactionType: z.string().optional(),
  amount: z.number().positive().optional(),
  counterparty: z.object({
    name: z.string().optional(),
    country: z.string().optional(),
    industry: z.string().optional(),
  }).optional(),
  kycData: z.any().optional(),
  transactionPurpose: z.string().optional(),
});

// Trading/Investment Services Input Schemas
export const tradingSignalInputSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  timeframe: z.string().optional(),
  currentPrice: z.number().positive().optional(),
  marketData: z.object({
    volume: z.number().nonnegative().optional(),
    high24h: z.number().positive().optional(),
    low24h: z.number().positive().optional(),
    priceChange24h: z.number().optional(),
  }).optional(),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).optional(),
});

export const portfolioOptimizationInputSchema = z.object({
  currentHoldings: z.array(z.object({
    asset: z.string(),
    amount: z.number().nonnegative(),
    currentValue: z.number().nonnegative(),
  })).min(2, "At least 2 holdings required"),
  investmentGoals: z.string().optional(),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).optional(),
  timeHorizon: z.string().optional(),
  constraints: z.array(z.string()).optional(),
});

export const sentimentAnalysisInputSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  sources: z.array(z.string()).optional(),
  timeframe: z.string().optional(),
  includeNews: z.boolean().optional(),
  includeSocial: z.boolean().optional(),
});

// Market Intelligence Services Input Schemas
export const arbitrageScannerInputSchema = z.object({
  assets: z.array(z.string()).optional(),
  minProfitPercent: z.number().positive().optional(),
  maxGasPrice: z.number().positive().optional(),
  chains: z.array(z.string()).optional(),
  includeGasCosts: z.boolean().optional(),
});

export const correlationMatrixInputSchema = z.object({
  assets: z.array(z.string()).min(2, "At least 2 assets required"),
  timeframe: z.string().optional(),
  includeTraditionalMarkets: z.boolean().optional(),
  benchmark: z.string().optional(),
});

export const riskMetricsInputSchema = z.object({
  portfolioValue: z.number().positive().min(100, "Minimum portfolio value is $100"),
  holdings: z.array(z.object({
    asset: z.string(),
    value: z.number().positive(),
    volatility: z.number().nonnegative().optional(),
  })).min(1, "At least 1 holding required"),
  timeHorizon: z.number().int().positive().optional(),
  confidenceLevel: z.number().optional().refine(val => val === undefined || val === 95 || val === 99, {
    message: "Confidence level must be 95 or 99"
  }),
  benchmarkAsset: z.string().optional(),
});

// Export types
export type PropertyValuationInput = z.infer<typeof propertyValuationInputSchema>;
export type LeaseAnalysisInput = z.infer<typeof leaseAnalysisInputSchema>;
export type ConstructionProgressInput = z.infer<typeof constructionProgressInputSchema>;
export type CreditRiskScoreInput = z.infer<typeof creditRiskScoreInputSchema>;
export type FraudDetectionInput = z.infer<typeof fraudDetectionInputSchema>;
export type ComplianceCheckInput = z.infer<typeof complianceCheckInputSchema>;
export type TradingSignalInput = z.infer<typeof tradingSignalInputSchema>;
export type PortfolioOptimizationInput = z.infer<typeof portfolioOptimizationInputSchema>;
export type SentimentAnalysisInput = z.infer<typeof sentimentAnalysisInputSchema>;
export type ArbitrageScannerInput = z.infer<typeof arbitrageScannerInputSchema>;
export type CorrelationMatrixInput = z.infer<typeof correlationMatrixInputSchema>;
export type RiskMetricsInput = z.infer<typeof riskMetricsInputSchema>;

// =============================================================================
// SDK TELEMETRY & DEMO KEY SYSTEM
// Track SDK installations and provide trial access to increase conversion
// =============================================================================

export const sdkInstalls = pgTable("sdk_installs", {
  id: serial("id").primaryKey(),
  installId: varchar("install_id").notNull().unique(),
  sdkType: varchar("sdk_type").notNull(),
  sdkVersion: varchar("sdk_version").notNull(),
  environment: jsonb("environment"),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  totalRequests: integer("total_requests").default(0),
  freeCallsUsed: integer("free_calls_used").default(0),
  demoKeyIssued: boolean("demo_key_issued").default(false),
  convertedToPaid: boolean("converted_to_paid").default(false),
}, (table) => [
  index("IDX_sdk_installs_sdk_type").on(table.sdkType),
  index("IDX_sdk_installs_first_seen").on(table.firstSeenAt),
  index("IDX_sdk_installs_converted").on(table.convertedToPaid),
]);

export const sdkDemoKeys = pgTable("sdk_demo_keys", {
  id: serial("id").primaryKey(),
  installId: varchar("install_id").notNull(),
  apiKey: varchar("api_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  creditsRemaining: integer("credits_remaining").default(500),
  status: varchar("status").default("active"),
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  ipAddress: varchar("ip_address"),
}, (table) => [
  index("IDX_sdk_demo_keys_install_id").on(table.installId),
  index("IDX_sdk_demo_keys_status").on(table.status),
  index("IDX_sdk_demo_keys_expires").on(table.expiresAt),
]);

export const insertSdkInstallSchema = createInsertSchema(sdkInstalls).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
});
export const insertSdkDemoKeySchema = createInsertSchema(sdkDemoKeys).omit({
  id: true,
  createdAt: true,
});
export type InsertSdkInstall = z.infer<typeof insertSdkInstallSchema>;
export type SdkInstall = typeof sdkInstalls.$inferSelect;
export type InsertSdkDemoKey = z.infer<typeof insertSdkDemoKeySchema>;
export type SdkDemoKey = typeof sdkDemoKeys.$inferSelect;

export const sdkTelemetryInputSchema = z.object({
  installId: z.string().min(8).max(64),
  sdkType: z.enum(["python-mcp", "typescript", "a2a-js"]),
  sdkVersion: z.string().min(1).max(20),
  event: z.enum(["install", "request", "error", "upgrade"]).default("request"),
  environment: z.object({
    os: z.string().optional(),
    runtime: z.string().optional(),
    runtimeVersion: z.string().optional(),
  }).optional(),
});

export const sdkDemoKeyRequestSchema = z.object({
  installId: z.string().min(8).max(64),
  sdkType: z.enum(["python-mcp", "typescript", "a2a-js"]),
});

export type SdkTelemetryInput = z.infer<typeof sdkTelemetryInputSchema>;
export type SdkDemoKeyRequest = z.infer<typeof sdkDemoKeyRequestSchema>;

// ============================================================================
// SOLANA PAYMENT PROCESSOR - Completely Isolated from x402 EVM Infrastructure
// ============================================================================

/**
 * Solana Payment Intents - Standalone ledger for Solana payments
 * ISOLATED: Does NOT share any tables/code with x402_payment_intents
 * 
 * Flow: Client creates intent → receives memo tag → sends SOL/USDC with memo
 *       → Helius webhook detects → verifier confirms → status updated
 */
export const solanaPaymentIntents = pgTable(
  "solana_payment_intents",
  {
    id: varchar("id").primaryKey(), // Format: sol_intent_xxxx (UUID-style, matches x402 pattern)
    
    // Payment details
    amount: numeric("amount", { precision: 18, scale: 9 }).notNull(), // SOL has 9 decimals
    tokenMint: varchar("token_mint").notNull(), // USDC: EPjFWdd5..., SOL: "native"
    tokenSymbol: varchar("token_symbol").notNull(), // USDC, SOL
    amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }), // USD equivalent at creation
    
    // Unique identifier for matching payments (included in memo)
    memoTag: varchar("memo_tag").notNull().unique(), // Format: CRPAY-xxxx (UUID-based)
    
    // Recipient (platform vault)
    recipientAddress: varchar("recipient_address").notNull(), // Platform Solana wallet
    recipientAta: varchar("recipient_ata"), // Associated Token Account for SPL tokens
    
    // Customer info
    customerWallet: varchar("customer_wallet"), // Optional: expected sender for validation
    customerId: varchar("customer_id"), // Optional: internal customer ID
    
    // Service being paid for
    serviceName: varchar("service_name").notNull(), // Human-readable service name
    serviceSlug: varchar("service_slug"), // URL-safe service identifier
    
    // Status tracking
    status: varchar("status").notNull().default("pending"), 
    // States: pending → confirming → succeeded/failed/expired
    
    // Transaction details (populated after payment detected by Helius webhook)
    txSignature: varchar("tx_signature"), // Solana signature (88 chars base58)
    confirmedSlot: bigint("confirmed_slot", { mode: "number" }),
    confirmationStatus: varchar("confirmation_status"), // processed, confirmed, finalized
    
    // Platform fees (monetization)
    platformFee: numeric("platform_fee", { precision: 18, scale: 9 }), // Our fee portion
    platformFeeUsd: numeric("platform_fee_usd", { precision: 10, scale: 2 }),
    feePercentage: numeric("fee_percentage", { precision: 5, scale: 4 }), // e.g., 0.0050 = 0.5%
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(), // Intent expiration (15 min default)
    paidAt: timestamp("paid_at"), // When payment detected
    settledAt: timestamp("settled_at"), // When fully confirmed (finalized)
    
    // Future-proof fields (nullable, add features later with no migration)
    subscriptionId: integer("subscription_id"), // Link to bundle/subscription if applicable
    bundleId: integer("bundle_id"), // Link to service bundle
    partnerId: varchar("partner_id"), // Revenue sharing attribution
    settlementBatchId: varchar("settlement_batch_id"), // For batch settlements
    offerTrackingId: varchar("offer_tracking_id"), // Link to marketing/campaign offers
    
    // Test mode flag (devnet vs mainnet)
    isTestMode: boolean("is_test_mode").default(false),
    
    // Audit trail
    metadata: jsonb("metadata"), // Additional context (flexible JSON)
    webhookPayload: jsonb("webhook_payload"), // Raw Helius webhook for audit/debugging
    
    // Error tracking
    lastError: text("last_error"),
    retryCount: integer("retry_count").default(0),
  },
  (table) => [
    uniqueIndex("IDX_solana_intents_memo").on(table.memoTag),
    index("IDX_solana_intents_status").on(table.status),
    index("IDX_solana_intents_customer").on(table.customerWallet),
    index("IDX_solana_intents_expires").on(table.expiresAt),
    index("IDX_solana_intents_service").on(table.serviceName),
    index("IDX_solana_intents_service_slug").on(table.serviceSlug),
    index("IDX_solana_intents_tx").on(table.txSignature),
    index("IDX_solana_intents_created").on(table.createdAt),
    index("IDX_solana_intents_partner").on(table.partnerId),
    index("IDX_solana_intents_test_mode").on(table.isTestMode),
  ],
);

export const solanaPaymentIntentsInsertSchema = createInsertSchema(solanaPaymentIntents).omit({
  createdAt: true,
  updatedAt: true,
});

export const solanaPaymentIntentsSelectSchema = createSelectSchema(solanaPaymentIntents);

export type SolanaPaymentIntent = typeof solanaPaymentIntents.$inferSelect;
export type InsertSolanaPaymentIntent = z.infer<typeof solanaPaymentIntentsInsertSchema>;

/**
 * Solana Processed Signatures - Replay attack prevention
 * Tracks all transaction signatures we've already processed
 * Equivalent to usedTransactionHashes for EVM
 */
export const solanaProcessedSignatures = pgTable(
  "solana_processed_signatures",
  {
    id: serial("id").primaryKey(),
    txSignature: varchar("tx_signature").notNull().unique(), // Solana signature (88 chars base58)
    intentId: varchar("intent_id").references(() => solanaPaymentIntents.id),
    processedAt: timestamp("processed_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_solana_sig_unique").on(table.txSignature),
    index("IDX_solana_sig_intent").on(table.intentId),
  ],
);

export const solanaProcessedSignaturesInsertSchema = createInsertSchema(solanaProcessedSignatures).omit({
  id: true,
  processedAt: true,
});

export type SolanaProcessedSignature = typeof solanaProcessedSignatures.$inferSelect;
export type InsertSolanaProcessedSignature = z.infer<typeof solanaProcessedSignaturesInsertSchema>;

/**
 * Solana Fee Tiers - Dynamic pricing for payment processing
 * Allows different fee structures for different customer tiers
 */
export const solanaFeeTiers = pgTable(
  "solana_fee_tiers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name").notNull().unique(), // standard, premium, enterprise
    description: text("description"),
    
    // Fee structure
    percentageFee: numeric("percentage_fee", { precision: 5, scale: 4 }).notNull(), // 0.0050 = 0.5%
    minimumFeeSol: numeric("minimum_fee_sol", { precision: 18, scale: 9 }).notNull(), // 0.001 SOL
    minimumFeeUsdc: numeric("minimum_fee_usdc", { precision: 10, scale: 6 }).notNull(), // 0.25 USDC
    
    // Status
    isActive: boolean("is_active").default(true),
    isDefault: boolean("is_default").default(false), // Only one tier can be default
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_solana_fee_tiers_active").on(table.isActive),
  ],
);

export const solanaFeeTiersInsertSchema = createInsertSchema(solanaFeeTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SolanaFeeTier = typeof solanaFeeTiers.$inferSelect;
export type InsertSolanaFeeTier = z.infer<typeof solanaFeeTiersInsertSchema>;

/**
 * Solana Payment Analytics - Daily aggregated metrics
 * Mirrors x402DiscoveryMetrics pattern for consistent reporting
 */
export const solanaPaymentMetrics = pgTable(
  "solana_payment_metrics",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    
    // Volume metrics
    totalIntentsCreated: integer("total_intents_created").default(0),
    totalPaymentsReceived: integer("total_payments_received").default(0),
    totalPaymentsExpired: integer("total_payments_expired").default(0),
    totalPaymentsFailed: integer("total_payments_failed").default(0),
    
    // Revenue metrics
    totalVolumeUsdc: numeric("total_volume_usdc", { precision: 18, scale: 6 }).default("0"),
    totalVolumeSol: numeric("total_volume_sol", { precision: 18, scale: 9 }).default("0"),
    totalFeesUsdc: numeric("total_fees_usdc", { precision: 18, scale: 6 }).default("0"),
    totalFeesSol: numeric("total_fees_sol", { precision: 18, scale: 9 }).default("0"),
    
    // Unique wallets
    uniqueCustomerWallets: integer("unique_customer_wallets").default(0),
    
    // By service breakdown
    byService: jsonb("by_service"), // { "token-price": 235, "trending-tokens": 150, ... }
    
    // Test vs production
    testModeIntents: integer("test_mode_intents").default(0),
    
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_solana_metrics_date").on(table.date),
    index("IDX_solana_metrics_updated").on(table.updatedAt),
  ],
);

export const solanaPaymentMetricsInsertSchema = createInsertSchema(solanaPaymentMetrics).omit({
  id: true,
  updatedAt: true,
});

export type SolanaPaymentMetric = typeof solanaPaymentMetrics.$inferSelect;
export type InsertSolanaPaymentMetric = z.infer<typeof solanaPaymentMetricsInsertSchema>;

/**
 * Solana Payment Intent Metadata Interface
 * Standardizes what goes into the metadata JSONB column
 */
export interface SolanaPaymentIntentMetadata {
  // Token details
  tokenDecimals?: number;
  tokenName?: string;
  
  // Price context (at time of intent creation)
  solPriceUsd?: number;
  
  // Client context
  userAgent?: string;
  ipHash?: string;
  sdkVersion?: string;
  
  // Attribution
  campaignId?: string;
  referralCode?: string;
  
  // Service context
  serviceParams?: Record<string, unknown>;
}

// ============================================================================
// SOLANA ENDPOINT INTERACTIONS - Analytics Tracking for Solana Pay Endpoints
// ============================================================================

/**
 * Solana Endpoint Interactions - Track all hits to Solana Pay endpoints
 * Answers: Who is hitting, when, what happened
 */
export const solanaEndpointInteractions = pgTable(
  "solana_endpoint_interactions",
  {
    id: serial("id").primaryKey(),
    
    // Request identification
    endpoint: varchar("endpoint").notNull(), // /solana-pay/intents, /solana-pay/webhook, etc.
    method: varchar("method").notNull(), // GET, POST, etc.
    
    // Who is hitting
    ipAddress: varchar("ip_address"), // Hashed or truncated for privacy
    userAgent: text("user_agent"), // Full user-agent string
    userAgentCategory: varchar("user_agent_category"), // bot, browser, sdk, helius, unknown
    walletAddress: varchar("wallet_address"), // If known from request body
    customerId: varchar("customer_id"), // If authenticated/known
    
    // What happened
    statusCode: integer("status_code").notNull(), // 200, 400, 500, etc.
    responseTimeMs: integer("response_time_ms"), // How long the request took
    success: boolean("success").notNull().default(true), // Quick filter
    
    // Request context
    intentId: varchar("intent_id"), // If request relates to a specific intent
    serviceSlug: varchar("service_slug"), // Which service was requested
    tokenSymbol: varchar("token_symbol"), // SOL, USDC, USDT
    requestedAmount: numeric("requested_amount", { precision: 18, scale: 9 }),
    
    // Webhook-specific (for Helius tracking)
    isWebhook: boolean("is_webhook").default(false),
    webhookType: varchar("webhook_type"), // enhanced_transaction, nft_sale, etc.
    txSignature: varchar("tx_signature"), // For webhook correlation
    
    // Error tracking
    errorType: varchar("error_type"), // validation, rate_limit, auth, server_error
    errorMessage: text("error_message"),
    
    // Timestamps
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    
    // Additional context (flexible)
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("IDX_solana_endpoint_timestamp").on(table.timestamp),
    index("IDX_solana_endpoint_endpoint").on(table.endpoint),
    index("IDX_solana_endpoint_user_agent_cat").on(table.userAgentCategory),
    index("IDX_solana_endpoint_status").on(table.statusCode),
    index("IDX_solana_endpoint_success").on(table.success),
    index("IDX_solana_endpoint_webhook").on(table.isWebhook),
    index("IDX_solana_endpoint_service").on(table.serviceSlug),
    index("IDX_solana_endpoint_ip").on(table.ipAddress),
  ],
);

export const solanaEndpointInteractionsInsertSchema = createInsertSchema(solanaEndpointInteractions).omit({
  id: true,
  timestamp: true,
});

export type SolanaEndpointInteraction = typeof solanaEndpointInteractions.$inferSelect;
export type InsertSolanaEndpointInteraction = z.infer<typeof solanaEndpointInteractionsInsertSchema>;

// SDK Transaction Log - for tracking SDK payment events
export const sdkTransactions = pgTable("sdk_transactions", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transaction_id").notNull().unique(),
  apiKeyHash: varchar("api_key_hash").notNull(), // Hashed API key for tracking
  userId: varchar("user_id"), // Associated user ID if available
  transactionType: varchar("transaction_type").notNull(), // send, invoice, balance
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  fee: numeric("fee", { precision: 18, scale: 6 }).notNull(),
  netAmount: numeric("net_amount", { precision: 18, scale: 6 }).notNull(),
  currency: varchar("currency").notNull().default("USDC"),
  toAddress: varchar("to_address"),
  memo: text("memo"),
  network: varchar("network").notNull().default("base"),
  blockchainTxHash: varchar("blockchain_tx_hash"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_sdk_tx_transaction_id").on(table.transactionId),
  index("IDX_sdk_tx_api_key").on(table.apiKeyHash),
  index("IDX_sdk_tx_created").on(table.createdAt),
  index("IDX_sdk_tx_status").on(table.status),
  index("IDX_sdk_tx_type").on(table.transactionType),
]);

export const sdkTransactionsInsertSchema = createInsertSchema(sdkTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SdkTransaction = typeof sdkTransactions.$inferSelect;
export type InsertSdkTransaction = z.infer<typeof sdkTransactionsInsertSchema>;

// ============================================================================
// ACP (Agentic Commerce Protocol) - ChatGPT Merchant Product Catalog
// ============================================================================

/**
 * ACP Products - Digital products for ChatGPT Instant Checkout
 * Supports API credits, service bundles, and subscriptions
 */
export const acpProducts = pgTable(
  "acp_products",
  {
    id: varchar("id").primaryKey(), // e.g., "api-starter-pack", "gas-oracle-30day"
    title: text("title").notNull(),
    description: text("description").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD"),
    productType: varchar("product_type").notNull(), // 'api_credits', 'subscription', 'bundle', 'service_pack'
    creditsIncluded: integer("credits_included"), // Number of credits if applicable
    apiCallsIncluded: integer("api_calls_included"), // Number of API calls if service pack
    validityDays: integer("validity_days"), // How long the product is valid
    serviceSlugs: text("service_slugs").array(), // Which x402 services this unlocks
    metadata: jsonb("metadata"), // Additional product details
    active: boolean("active").default(true),
    sortOrder: integer("sort_order").default(0), // Display order in catalog
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_acp_products_active").on(table.active),
    index("IDX_acp_products_type").on(table.productType),
    index("IDX_acp_products_sort").on(table.sortOrder),
  ],
);

export const acpProductsInsertSchema = createInsertSchema(acpProducts).omit({
  createdAt: true,
  updatedAt: true,
});

export type AcpProduct = typeof acpProducts.$inferSelect;
export type InsertAcpProduct = z.infer<typeof acpProductsInsertSchema>;

/**
 * ACP Orders - Track purchases via ChatGPT Instant Checkout
 */
export const acpOrders = pgTable(
  "acp_orders",
  {
    id: varchar("id").primaryKey(), // Order ID (nanoid)
    productId: varchar("product_id").notNull(), // References acp_products.id
    checkoutSessionId: varchar("checkout_session_id"), // Stripe checkout session
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    customerEmail: varchar("customer_email"),
    customerId: varchar("customer_id"), // Internal user ID if known
    status: varchar("status").notNull().default("pending"), // 'pending', 'completed', 'failed', 'refunded'
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD"),
    apiKeyIssued: varchar("api_key_issued"), // The API key generated for this order
    creditsAdded: integer("credits_added"), // Credits added to account
    fulfillmentStatus: varchar("fulfillment_status").default("pending"), // 'pending', 'fulfilled', 'failed'
    fulfillmentDetails: jsonb("fulfillment_details"), // Details about what was delivered
    source: varchar("source").default("chatgpt"), // 'chatgpt', 'website', 'api'
    metadata: jsonb("metadata"), // Additional order context
    createdAt: timestamp("created_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("IDX_acp_orders_product").on(table.productId),
    index("IDX_acp_orders_status").on(table.status),
    index("IDX_acp_orders_customer").on(table.customerId),
    index("IDX_acp_orders_created").on(table.createdAt),
    index("IDX_acp_orders_stripe_session").on(table.checkoutSessionId),
  ],
);

export const acpOrdersInsertSchema = createInsertSchema(acpOrders).omit({
  createdAt: true,
  completedAt: true,
});

export type AcpOrder = typeof acpOrders.$inferSelect;
export type InsertAcpOrder = z.infer<typeof acpOrdersInsertSchema>;

/**
 * Token Launcher Campaigns - Meme token launch campaigns for PumpFun
 */
export const tokenLauncherCampaigns = pgTable(
  "token_launcher_campaigns",
  {
    id: varchar("id").primaryKey(),
    name: text("name").notNull(),
    status: varchar("status").notNull().default("pending"), // 'pending', 'running', 'paused', 'completed', 'failed'
    mode: varchar("mode").notNull().default("paper"), // 'paper' or 'live'
    config: jsonb("config").notNull(), // targetLaunches, initialLiquiditySol, priorityFeeMicroLamports, etc.
    stats: jsonb("stats").notNull().default({
      totalLaunches: 0,
      successfulLaunches: 0,
      failedLaunches: 0,
      totalSpentSol: 0,
      totalRecoveredSol: 0,
      profitLossSol: 0,
      profitLossUsd: 0,
    }),
    walletAddress: varchar("wallet_address"), // Launcher wallet used
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("IDX_token_campaigns_status").on(table.status),
    index("IDX_token_campaigns_mode").on(table.mode),
    index("IDX_token_campaigns_created").on(table.createdAt),
  ],
);

export const tokenLauncherCampaignsInsertSchema = createInsertSchema(tokenLauncherCampaigns).omit({
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
});

export type TokenLauncherCampaign = typeof tokenLauncherCampaigns.$inferSelect;
export type InsertTokenLauncherCampaign = z.infer<typeof tokenLauncherCampaignsInsertSchema>;

/**
 * Token Launcher Launches - Individual token launches within campaigns
 */
export const tokenLauncherLaunches = pgTable(
  "token_launcher_launches",
  {
    id: varchar("id").primaryKey(),
    campaignId: varchar("campaign_id").notNull(),
    tokenMint: varchar("token_mint"), // Solana token mint address
    metadata: jsonb("metadata").notNull(), // name, symbol, description, image
    status: varchar("status").notNull().default("pending"), // 'pending', 'launched', 'monitoring', 'exited', 'failed'
    launchTime: timestamp("launch_time"),
    exitTime: timestamp("exit_time"),
    costSol: decimal("cost_sol", { precision: 18, scale: 9 }).default("0"),
    recoverySol: decimal("recovery_sol", { precision: 18, scale: 9 }).default("0"),
    profitLossSol: decimal("profit_loss_sol", { precision: 18, scale: 9 }).default("0"),
    signature: varchar("signature"), // Transaction signature
    pumpfunUrl: varchar("pumpfun_url"), // Link to pump.fun token page
    errorMessage: text("error_message"), // Error details if failed
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_token_launches_campaign").on(table.campaignId),
    index("IDX_token_launches_status").on(table.status),
    index("IDX_token_launches_token_mint").on(table.tokenMint),
    index("IDX_token_launches_created").on(table.createdAt),
  ],
);

export const tokenLauncherLaunchesInsertSchema = createInsertSchema(tokenLauncherLaunches).omit({
  createdAt: true,
  updatedAt: true,
});

export type TokenLauncherLaunch = typeof tokenLauncherLaunches.$inferSelect;
export type InsertTokenLauncherLaunch = z.infer<typeof tokenLauncherLaunchesInsertSchema>;

// ============================================================================
// IoT PAYMENTS SYSTEM - Production-Grade Device Payment Infrastructure
// ============================================================================

/**
 * IoT Accounts - Links devices to owner accounts with credits balance
 * Enables User Account Model: owner buys credits, devices draw from pool
 */
export const iotAccounts = pgTable(
  "iot_accounts",
  {
    id: varchar("id").primaryKey(), // iot_acc_<nanoid>
    ownerId: varchar("owner_id"), // Optional link to users.id
    ownerWallet: varchar("owner_wallet"), // Owner's wallet address for non-custodial
    apiKeyHash: varchar("api_key_hash"), // SHA-256 hash of the API key for secure authentication
    accountName: varchar("account_name").notNull(), // Human-readable account name
    creditsBalance: decimal("credits_balance", { precision: 12, scale: 4 }).notNull().default("0"), // Credits in USD ($0.01 = 1 credit unit)
    totalDeposited: decimal("total_deposited", { precision: 12, scale: 4 }).notNull().default("0"), // Lifetime deposits
    totalSpent: decimal("total_spent", { precision: 12, scale: 4 }).notNull().default("0"), // Lifetime spending
    totalFeesEarned: decimal("total_fees_earned", { precision: 12, scale: 4 }).notNull().default("0"), // Fees earned from incoming payments
    autoTopupEnabled: boolean("auto_topup_enabled").notNull().default(false),
    autoTopupThreshold: decimal("auto_topup_threshold", { precision: 12, scale: 4 }), // Trigger topup when balance below
    autoTopupAmount: decimal("auto_topup_amount", { precision: 12, scale: 4 }), // Amount to topup
    stripeCustomerId: varchar("stripe_customer_id"), // For recurring payments
    cdpWalletAddress: varchar("cdp_wallet_address"), // CDP-managed wallet address for on-chain payments
    cdpWalletChain: varchar("cdp_wallet_chain").default("base-mainnet"), // Chain for CDP wallet (base-mainnet, ethereum-mainnet, etc.)
    cdpWalletStatus: varchar("cdp_wallet_status").default("none"), // none, provisioning, active, suspended
    tier: varchar("tier").notNull().default("starter"), // starter, growth, enterprise
    status: varchar("status").notNull().default("active"), // active, suspended, closed
    isDemo: boolean("is_demo").notNull().default(false), // Demo/test data flag - excluded from production metrics
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_iot_accounts_owner_id").on(table.ownerId),
    index("IDX_iot_accounts_owner_wallet").on(table.ownerWallet),
    index("IDX_iot_accounts_api_key_hash").on(table.apiKeyHash),
    index("IDX_iot_accounts_status").on(table.status),
    index("IDX_iot_accounts_tier").on(table.tier),
    index("IDX_iot_accounts_cdp_wallet").on(table.cdpWalletAddress),
  ],
);

export const iotAccountsInsertSchema = createInsertSchema(iotAccounts).omit({
  createdAt: true,
  updatedAt: true,
});
export type IotAccount = typeof iotAccounts.$inferSelect;
export type InsertIotAccount = z.infer<typeof iotAccountsInsertSchema>;

/**
 * IoT Device Registry - Maps devices to accounts
 * Extends m2m_devices with account linkage for billing
 */
export const iotDeviceRegistry = pgTable(
  "iot_device_registry",
  {
    id: varchar("id").primaryKey(), // iot_dev_<nanoid>
    deviceId: varchar("device_id").notNull().unique(), // Device identifier (matches m2m_devices.device_id)
    accountId: varchar("account_id").notNull(), // Link to iot_accounts.id
    deviceName: varchar("device_name"), // Human-readable name
    deviceType: varchar("device_type").notNull().default("iot_device"), // iot_device, sensor, gateway, actuator, ai_agent
    walletAddress: varchar("wallet_address"), // Device's own wallet for receiving payments
    chain: varchar("chain").notNull().default("base-mainnet"),
    spendingLimit: decimal("spending_limit", { precision: 12, scale: 4 }), // Max spend per day (null = unlimited from account)
    todaySpent: decimal("today_spent", { precision: 12, scale: 4 }).notNull().default("0"),
    limitResetAt: timestamp("limit_reset_at"), // When daily limit resets
    canReceivePayments: boolean("can_receive_payments").notNull().default(true), // Can this device receive D2D payments?
    canSendPayments: boolean("can_send_payments").notNull().default(true), // Can this device send D2D payments?
    status: varchar("status").notNull().default("active"), // active, suspended, inactive
    isDemo: boolean("is_demo").notNull().default(false), // Demo/test data flag - excluded from production metrics
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at"),
  },
  (table) => [
    index("IDX_iot_device_registry_account").on(table.accountId),
    index("IDX_iot_device_registry_wallet").on(table.walletAddress),
    index("IDX_iot_device_registry_status").on(table.status),
    index("IDX_iot_device_registry_type").on(table.deviceType),
  ],
);

export const iotDeviceRegistryInsertSchema = createInsertSchema(iotDeviceRegistry).omit({
  createdAt: true,
  lastActiveAt: true,
});
export type IotDeviceRegistry = typeof iotDeviceRegistry.$inferSelect;
export type InsertIotDeviceRegistry = z.infer<typeof iotDeviceRegistryInsertSchema>;

/**
 * IoT Transfers - D2D payment ledger with fee extraction
 * Tracks all device-to-device and device-to-service payments
 * Fee structure: 2% + $0.02 per transfer
 */
export const iotTransfers = pgTable(
  "iot_transfers",
  {
    id: varchar("id").primaryKey(), // iot_txn_<nanoid>
    fromDeviceId: varchar("from_device_id").notNull(), // Sender device
    fromAccountId: varchar("from_account_id").notNull(), // Sender account
    toDeviceId: varchar("to_device_id"), // Recipient device (null for external)
    toAccountId: varchar("to_account_id"), // Recipient account (null for external)
    toWallet: varchar("to_wallet"), // External wallet address for on-chain
    amount: decimal("amount", { precision: 12, scale: 4 }).notNull(), // Gross amount
    fee: decimal("fee", { precision: 12, scale: 4 }).notNull(), // Our fee (2% + $0.02)
    netAmount: decimal("net_amount", { precision: 12, scale: 4 }).notNull(), // amount - fee
    currency: varchar("currency").notNull().default("USD"), // USD (credits) or USDC (on-chain)
    paymentMethod: varchar("payment_method").notNull(), // credits, usdc_onchain
    chain: varchar("chain"), // For on-chain: base-mainnet, etc.
    txHash: varchar("tx_hash"), // On-chain transaction hash
    purpose: varchar("purpose"), // data_purchase, service_payment, sensor_reading, etc.
    reference: varchar("reference"), // External reference/invoice ID
    status: varchar("status").notNull().default("pending"), // pending, completed, failed, refunded
    errorMessage: text("error_message"),
    idempotencyKey: varchar("idempotency_key").unique(), // Prevent duplicate transfers
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("IDX_iot_transfers_from_device").on(table.fromDeviceId),
    index("IDX_iot_transfers_from_account").on(table.fromAccountId),
    index("IDX_iot_transfers_to_device").on(table.toDeviceId),
    index("IDX_iot_transfers_to_account").on(table.toAccountId),
    index("IDX_iot_transfers_status").on(table.status),
    index("IDX_iot_transfers_created").on(table.createdAt),
    index("IDX_iot_transfers_tx_hash").on(table.txHash),
  ],
);

export const iotTransfersInsertSchema = createInsertSchema(iotTransfers).omit({
  createdAt: true,
  completedAt: true,
});
export type IotTransfer = typeof iotTransfers.$inferSelect;
export type InsertIotTransfer = z.infer<typeof iotTransfersInsertSchema>;

/**
 * IoT Billable Events - Metering audit trail
 * Tracks individual billable events (paid actions, not raw telemetry)
 * 1 credit = $0.01 = 1 billable event
 */
export const iotBillableEvents = pgTable(
  "iot_billable_events",
  {
    id: varchar("id").primaryKey(), // iot_evt_<nanoid>
    deviceId: varchar("device_id").notNull(),
    accountId: varchar("account_id").notNull(),
    eventType: varchar("event_type").notNull(), // message, data_access, unlock, stream_minute, etc.
    eventName: varchar("event_name"), // Human-readable event name
    units: integer("units").notNull().default(1), // Number of billable units
    unitPrice: decimal("unit_price", { precision: 12, scale: 4 }).notNull().default("0.01"), // Price per unit in USD
    totalCost: decimal("total_cost", { precision: 12, scale: 4 }).notNull(), // units * unitPrice
    balanceAfter: decimal("balance_after", { precision: 12, scale: 4 }).notNull(), // Account balance after event
    topic: varchar("topic"), // MQTT topic or data category
    payload: jsonb("payload"), // Event payload/metadata (sanitized)
    serviceId: varchar("service_id"), // If paying for a Coin Railz service
    status: varchar("status").notNull().default("completed"), // completed, failed, refunded
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_iot_billable_events_device").on(table.deviceId),
    index("IDX_iot_billable_events_account").on(table.accountId),
    index("IDX_iot_billable_events_type").on(table.eventType),
    index("IDX_iot_billable_events_created").on(table.createdAt),
    index("IDX_iot_billable_events_service").on(table.serviceId),
  ],
);

export const iotBillableEventsInsertSchema = createInsertSchema(iotBillableEvents).omit({
  createdAt: true,
});
export type IotBillableEvent = typeof iotBillableEvents.$inferSelect;
export type InsertIotBillableEvent = z.infer<typeof iotBillableEventsInsertSchema>;

/**
 * IoT Topups - Credit purchase history
 * Tracks all credit pack purchases for accounts
 */
export const iotTopups = pgTable(
  "iot_topups",
  {
    id: varchar("id").primaryKey(), // iot_topup_<nanoid>
    accountId: varchar("account_id").notNull(),
    amount: decimal("amount", { precision: 12, scale: 4 }).notNull(), // Credits added
    amountPaid: decimal("amount_paid", { precision: 12, scale: 4 }).notNull(), // Amount paid in USD
    packType: varchar("pack_type").notNull(), // starter_25, growth_100, enterprise_500, custom
    paymentMethod: varchar("payment_method").notNull(), // stripe, paypal, usdc_onchain, usdt_onchain, credits_transfer
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    paypalOrderId: varchar("paypal_order_id"), // PayPal order ID for PayPal payments
    txHash: varchar("tx_hash"), // On-chain transaction hash (unique per chain+token)
    status: varchar("status").notNull().default("pending"), // pending, confirming, completed, failed, amount_mismatch, expired
    balanceAfter: decimal("balance_after", { precision: 12, scale: 4 }), // Account balance after topup
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    // Async confirmation state machine fields (for on-chain topups)
    token: varchar("token").default("USDC"), // USDC or USDT
    chain: varchar("chain").default("base-mainnet"), // Network chain
    expectedAmount: decimal("expected_amount", { precision: 12, scale: 4 }), // Expected amount for verification
    sender: varchar("sender"), // Expected sender wallet address
    verificationAttempts: integer("verification_attempts").default(0), // Retry count
    lastCheckedAt: timestamp("last_checked_at"), // Last verification check
    nextCheckAt: timestamp("next_check_at"), // Next scheduled verification (for job)
    failureReason: varchar("failure_reason"), // Reason for failure/rejection
    expiresAt: timestamp("expires_at"), // TTL for pending topups
    verifiedAmount: decimal("verified_amount", { precision: 12, scale: 4 }), // Actual verified amount from chain
  },
  (table) => [
    index("IDX_iot_topups_account").on(table.accountId),
    index("IDX_iot_topups_status").on(table.status),
    index("IDX_iot_topups_created").on(table.createdAt),
    index("IDX_iot_topups_stripe").on(table.stripePaymentIntentId),
    uniqueIndex("UQ_iot_topups_txhash").on(table.txHash), // Unique constraint to prevent duplicate tx processing
    index("IDX_iot_topups_nextcheck").on(table.nextCheckAt),
  ],
);

export const iotTopupsInsertSchema = createInsertSchema(iotTopups).omit({
  createdAt: true,
  completedAt: true,
});
export type IotTopup = typeof iotTopups.$inferSelect;
export type InsertIotTopup = z.infer<typeof iotTopupsInsertSchema>;

/**
 * IoT Device Products - Data products offered by IoT devices for AI agent purchase
 * Enables Agent-to-Device (A2D) x402 payments for sensor data, streams, etc.
 */
export const iotDeviceProducts = pgTable(
  "iot_device_products",
  {
    id: varchar("id").primaryKey(), // iot_prod_<nanoid>
    deviceId: varchar("device_id").notNull(), // References iot_device_registry.deviceId
    accountId: varchar("account_id").notNull(), // Device owner's account
    productName: varchar("product_name").notNull(),
    productType: varchar("product_type").notNull(), // sensor_reading, stream, api_call, bulk_data
    description: text("description"),
    priceUsd: decimal("price_usd", { precision: 12, scale: 6 }).notNull(), // Price per unit in USD
    unit: varchar("unit").notNull().default("request"), // request, minute, mb, reading
    deliveryMode: varchar("delivery_mode").notNull().default("pull"), // pull (one-time), stream (continuous)
    dataSchema: jsonb("data_schema"), // JSON schema for the data format
    x402ServiceId: varchar("x402_service_id"), // Unique service ID for x402 discovery
    x402Endpoint: varchar("x402_endpoint"), // Generated endpoint path
    expectedNetwork: varchar("expected_network").notNull().default("base"), // Network for x402 payments: base, ethereum, polygon, arbitrum
    bazaarRegistered: boolean("bazaar_registered").default(false),
    tags: text("tags").array(), // For discovery: ['temperature', 'weather', 'outdoor']
    status: varchar("status").notNull().default("active"), // active, paused, deprecated
    totalSales: integer("total_sales").default(0),
    totalRevenue: decimal("total_revenue", { precision: 12, scale: 4 }).default("0"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_iot_products_device").on(table.deviceId),
    index("IDX_iot_products_account").on(table.accountId),
    index("IDX_iot_products_type").on(table.productType),
    index("IDX_iot_products_x402").on(table.x402ServiceId),
    index("IDX_iot_products_status").on(table.status),
  ],
);

export const iotDeviceProductsInsertSchema = createInsertSchema(iotDeviceProducts).omit({
  createdAt: true,
  updatedAt: true,
  totalSales: true,
  totalRevenue: true,
});
export type IotDeviceProduct = typeof iotDeviceProducts.$inferSelect;
export type InsertIotDeviceProduct = z.infer<typeof iotDeviceProductsInsertSchema>;

/**
 * IoT Data Sales - Records of AI agent purchases from IoT devices via x402
 * Tracks Agent-to-Device commerce with payment verification
 */
export const iotDataSales = pgTable(
  "iot_data_sales",
  {
    id: varchar("id").primaryKey(), // iot_sale_<nanoid>
    productId: varchar("product_id").notNull(), // References iot_device_products.id
    deviceId: varchar("device_id").notNull(),
    accountId: varchar("account_id").notNull(), // Seller's account
    buyerAgentId: varchar("buyer_agent_id"), // AI agent making the purchase
    buyerWallet: varchar("buyer_wallet"), // Wallet that paid
    x402PaymentId: varchar("x402_payment_id"), // x402 payment record
    txHash: varchar("tx_hash"), // On-chain transaction hash
    amount: decimal("amount", { precision: 12, scale: 6 }).notNull(), // Amount paid in USD
    platformFee: decimal("platform_fee", { precision: 12, scale: 6 }).notNull().default("0"), // Fee retained by platform
    sellerCredit: decimal("seller_credit", { precision: 12, scale: 6 }).notNull(), // Amount credited to seller
    units: integer("units").default(1), // Number of units purchased
    status: varchar("status").notNull().default("pending"), // pending, verified, delivered, failed, refunded
    deliveryStatus: varchar("delivery_status"), // not_started, in_progress, completed, failed
    deliveryData: jsonb("delivery_data"), // Actual data delivered (or reference)
    accessToken: varchar("access_token"), // Short-lived token for data access
    accessTokenExpiry: timestamp("access_token_expiry"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    verifiedAt: timestamp("verified_at"),
    deliveredAt: timestamp("delivered_at"),
  },
  (table) => [
    index("IDX_iot_sales_product").on(table.productId),
    index("IDX_iot_sales_device").on(table.deviceId),
    index("IDX_iot_sales_account").on(table.accountId),
    index("IDX_iot_sales_buyer").on(table.buyerAgentId),
    index("IDX_iot_sales_x402").on(table.x402PaymentId),
    index("IDX_iot_sales_status").on(table.status),
    index("IDX_iot_sales_created").on(table.createdAt),
    uniqueIndex("IDX_iot_sales_x402_payment_unique").on(table.x402PaymentId).where(sql`x402_payment_id IS NOT NULL`),
    uniqueIndex("IDX_iot_sales_tx_hash_unique").on(table.txHash).where(sql`tx_hash IS NOT NULL`),
  ],
);

export const iotDataSalesInsertSchema = createInsertSchema(iotDataSales).omit({
  createdAt: true,
  verifiedAt: true,
  deliveredAt: true,
});
export type IotDataSale = typeof iotDataSales.$inferSelect;
export type InsertIotDataSale = z.infer<typeof iotDataSalesInsertSchema>;

// ============================================================================
// UNIFIED CREDITS SYSTEM - Shared Credits Pool for MCP + IoT
// ============================================================================

/**
 * Unified Credits Accounts - Shared credits pool that works for both MCP and IoT
 * Enables users to have a single balance usable for AI agent services and IoT metering
 */
export const unifiedCreditsAccounts = pgTable(
  "unified_credits_accounts",
  {
    id: varchar("id").primaryKey(), // ucred_<nanoid>
    ownerType: varchar("owner_type").notNull(), // 'user' | 'iot_account'
    ownerId: varchar("owner_id").notNull(), // users.id or iot_accounts.id
    balance: decimal("balance", { precision: 12, scale: 4 }).notNull().default("0"),
    totalDeposited: decimal("total_deposited", { precision: 12, scale: 4 }).notNull().default("0"),
    totalSpent: decimal("total_spent", { precision: 12, scale: 4 }).notNull().default("0"),
    status: varchar("status").notNull().default("active"), // active, frozen, closed
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("IDX_unified_credits_owner").on(table.ownerType, table.ownerId),
    index("IDX_unified_credits_status").on(table.status),
  ],
);

export const unifiedCreditsAccountsInsertSchema = createInsertSchema(unifiedCreditsAccounts).omit({
  createdAt: true,
  updatedAt: true,
});
export type UnifiedCreditsAccount = typeof unifiedCreditsAccounts.$inferSelect;
export type InsertUnifiedCreditsAccount = z.infer<typeof unifiedCreditsAccountsInsertSchema>;

/**
 * Unified Credits Transactions - Full audit ledger for all credits movements
 * Tracks deposits, spending, transfers, and migrations
 */
export const unifiedCreditsTransactions = pgTable(
  "unified_credits_transactions",
  {
    id: varchar("id").primaryKey(), // ucred_txn_<nanoid>
    accountId: varchar("account_id").notNull(), // References unified_credits_accounts.id
    type: varchar("type").notNull(), // deposit, spend, transfer_in, transfer_out, migration, refund
    amount: decimal("amount", { precision: 12, scale: 4 }).notNull(), // Positive for credits, negative for debits
    balanceAfter: decimal("balance_after", { precision: 12, scale: 4 }).notNull(),
    source: varchar("source").notNull(), // mcp, iot, stripe, paypal, x402, migration, admin
    referenceType: varchar("reference_type"), // payment, service, meter_event, transfer, etc.
    referenceId: varchar("reference_id"), // ID of related record
    description: text("description"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    idempotencyKey: varchar("idempotency_key").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_unified_txn_account").on(table.accountId),
    index("IDX_unified_txn_type").on(table.type),
    index("IDX_unified_txn_source").on(table.source),
    index("IDX_unified_txn_created").on(table.createdAt),
    index("IDX_unified_txn_reference").on(table.referenceType, table.referenceId),
  ],
);

export const unifiedCreditsTransactionsInsertSchema = createInsertSchema(unifiedCreditsTransactions).omit({
  createdAt: true,
});
export type UnifiedCreditsTransaction = typeof unifiedCreditsTransactions.$inferSelect;
export type InsertUnifiedCreditsTransaction = z.infer<typeof unifiedCreditsTransactionsInsertSchema>;

/**
 * Unified Credits Links - Maps user accounts to IoT accounts for shared balance
 * Enables opt-in migration and dual-access to unified credits pool
 */
export const unifiedCreditsLinks = pgTable(
  "unified_credits_links",
  {
    id: varchar("id").primaryKey(), // ucred_link_<nanoid>
    unifiedAccountId: varchar("unified_account_id").notNull(), // References unified_credits_accounts.id
    userId: varchar("user_id"), // Link to users.id (if user-initiated)
    iotAccountId: varchar("iot_account_id"), // Link to iot_accounts.id (if IoT account linked)
    linkType: varchar("link_type").notNull(), // 'primary' (owner) | 'linked' (additional access)
    status: varchar("status").notNull().default("active"), // active, revoked
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    index("IDX_unified_links_account").on(table.unifiedAccountId),
    index("IDX_unified_links_user").on(table.userId),
    index("IDX_unified_links_iot").on(table.iotAccountId),
    uniqueIndex("IDX_unified_links_user_iot").on(table.userId, table.iotAccountId).where(sql`status = 'active'`),
  ],
);

export const unifiedCreditsLinksInsertSchema = createInsertSchema(unifiedCreditsLinks).omit({
  createdAt: true,
  revokedAt: true,
});
export type UnifiedCreditsLink = typeof unifiedCreditsLinks.$inferSelect;
export type InsertUnifiedCreditsLink = z.infer<typeof unifiedCreditsLinksInsertSchema>;

/**
 * Pilot Credits Crypto Payments - On-chain USDC/USDT payments for pilot credit packages
 * Supports Base, Polygon, and Arbitrum chains
 */
export const pilotCreditsPayments = pgTable(
  "pilot_credits_payments",
  {
    id: varchar("id").primaryKey(), // pilot_pay_<nanoid>
    userId: varchar("user_id").notNull(), // Email or user identifier
    tierId: varchar("tier_id").notNull(), // starter, growth, enterprise
    credits: integer("credits").notNull(), // Credits amount (500, 1000, 2500)
    amountUsd: decimal("amount_usd", { precision: 12, scale: 2 }).notNull(), // Price in USD
    chain: varchar("chain").notNull(), // base-mainnet, polygon-mainnet, arbitrum-mainnet
    token: varchar("token").notNull(), // USDC or USDT
    depositAddress: varchar("deposit_address").notNull(), // CDP-generated wallet address
    tokenContract: varchar("token_contract").notNull(), // Token contract address for verification
    expectedAmount: decimal("expected_amount", { precision: 18, scale: 6 }).notNull(), // Expected token amount (6 decimals)
    txHash: varchar("tx_hash"), // Verified transaction hash
    sender: varchar("sender"), // Sender wallet address (verified)
    verifiedAmount: decimal("verified_amount", { precision: 18, scale: 6 }), // Actual received amount
    status: varchar("status").notNull().default("pending"), // pending, confirming, completed, failed, expired
    verificationAttempts: integer("verification_attempts").default(0),
    lastCheckedAt: timestamp("last_checked_at"),
    nextCheckAt: timestamp("next_check_at"),
    failureReason: varchar("failure_reason"),
    generatedApiKeyPrefix: varchar("generated_api_key_prefix"), // Stores prefix of auto-generated API key (prevents duplicate generation)
    expiresAt: timestamp("expires_at").notNull(), // 30 min TTL for pending payments
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    idempotencyKey: varchar("idempotency_key").notNull(), // For credits deduplication
    // Sweep tracking for fund consolidation to platform wallet
    sweepStatus: varchar("sweep_status").default("pending"), // pending, completed, failed, skipped
    sweepTxHash: varchar("sweep_tx_hash"), // Transaction hash of sweep to platform wallet
    sweepAmount: decimal("sweep_amount", { precision: 18, scale: 6 }), // Actual amount swept
    sweepDestination: varchar("sweep_destination"), // Platform wallet that received funds
    sweptAt: timestamp("swept_at"), // When sweep was executed
    sweepError: varchar("sweep_error"), // Error message if sweep failed
  },
  (table) => [
    index("IDX_pilot_payments_user").on(table.userId),
    index("IDX_pilot_payments_status").on(table.status),
    index("IDX_pilot_payments_nextcheck").on(table.nextCheckAt),
    index("IDX_pilot_payments_sweep").on(table.sweepStatus),
    uniqueIndex("UQ_pilot_payments_txhash").on(table.txHash),
    uniqueIndex("UQ_pilot_payments_idempotency").on(table.idempotencyKey),
  ],
);

export const pilotCreditsPaymentsInsertSchema = createInsertSchema(pilotCreditsPayments).omit({
  createdAt: true,
  completedAt: true,
  lastCheckedAt: true,
});
export type PilotCreditsPayment = typeof pilotCreditsPayments.$inferSelect;
export type InsertPilotCreditsPayment = z.infer<typeof pilotCreditsPaymentsInsertSchema>;

// Endpoint Hit Tracking - tracks all hits to x402 and IoT endpoints
// Valuable for understanding which agents/devices are viewing which services
export const endpointHits = pgTable(
  "endpoint_hits",
  {
    id: serial("id").primaryKey(),
    endpoint: varchar("endpoint").notNull(), // e.g., /x402/catalog, /api/iot/products/fleet-001
    endpointType: varchar("endpoint_type").notNull(), // x402, iot, catalog, service
    resourceId: varchar("resource_id"), // device ID, service name, etc.
    
    // Visitor identification (what we can capture)
    ipHash: varchar("ip_hash"), // Hashed IP for privacy
    userAgent: varchar("user_agent"), // AI agents often identify themselves
    referer: varchar("referer"), // Where they came from
    walletAddress: varchar("wallet_address"), // If provided in headers/params
    
    // Request metadata
    method: varchar("method").default("GET"), // GET, POST, etc.
    statusCode: integer("status_code"), // Response status
    responseTimeMs: integer("response_time_ms"), // How long the request took
    
    // Tracking context
    campaignId: varchar("campaign_id"), // If from our outreach campaign
    trackingId: varchar("tracking_id"), // x402 tracking ID if present
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_endpoint_hits_endpoint").on(table.endpoint),
    index("IDX_endpoint_hits_type").on(table.endpointType),
    index("IDX_endpoint_hits_resource").on(table.resourceId),
    index("IDX_endpoint_hits_created").on(table.createdAt),
    index("IDX_endpoint_hits_wallet").on(table.walletAddress),
    index("IDX_endpoint_hits_useragent").on(table.userAgent),
  ],
);

export const endpointHitsInsertSchema = createInsertSchema(endpointHits).omit({
  id: true,
  createdAt: true,
});
export type EndpointHit = typeof endpointHits.$inferSelect;
export type InsertEndpointHit = z.infer<typeof endpointHitsInsertSchema>;

export const whitelistedWallets = pgTable(
  "whitelisted_wallets",
  {
    id: serial("id").primaryKey(),
    address: varchar("address", { length: 255 }).notNull().unique(),
    label: varchar("label", { length: 255 }).notNull(),
    chain: varchar("chain", { length: 50 }).default("evm"),
    approvedBy: varchar("approved_by", { length: 255 }).notNull(),
    reason: text("reason"),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_whitelisted_wallets_address").on(table.address),
  ],
);

export const whitelistedWalletsInsertSchema = createInsertSchema(whitelistedWallets).omit({
  id: true,
  createdAt: true,
});
export type WhitelistedWallet = typeof whitelistedWallets.$inferSelect;
export type InsertWhitelistedWallet = z.infer<typeof whitelistedWalletsInsertSchema>;

export const conversionFunnelEvents = pgTable(
  "conversion_funnel_events",
  {
    id: serial("id").primaryKey(),
    stage: varchar("stage", { length: 50 }).notNull(),
    walletAddress: varchar("wallet_address"),
    agentUrl: varchar("agent_url"),
    campaignId: varchar("campaign_id"),
    channel: varchar("channel", { length: 50 }),
    txHash: varchar("tx_hash"),
    creditsAmount: decimal("credits_amount", { precision: 10, scale: 2 }),
    apiKeyPrefix: varchar("api_key_prefix", { length: 12 }),
    serviceName: varchar("service_name"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_funnel_events_stage").on(table.stage),
    index("IDX_funnel_events_wallet").on(table.walletAddress),
    index("IDX_funnel_events_campaign").on(table.campaignId),
    index("IDX_funnel_events_created").on(table.createdAt),
  ],
);

export const conversionFunnelEventsInsertSchema = createInsertSchema(conversionFunnelEvents).omit({
  id: true,
  createdAt: true,
});
export type ConversionFunnelEvent = typeof conversionFunnelEvents.$inferSelect;
export type InsertConversionFunnelEvent = z.infer<typeof conversionFunnelEventsInsertSchema>;

export const onrampOrders = pgTable(
  "onramp_orders",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    transakOrderId: varchar("transak_order_id").unique(),
    status: varchar("status", { length: 50 }).notNull().default("created"),
    fiatCurrency: varchar("fiat_currency", { length: 10 }).notNull().default("USD"),
    fiatAmount: decimal("fiat_amount", { precision: 10, scale: 2 }).notNull(),
    coinrailzFee: decimal("coinrailz_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
    cryptoAmount: decimal("crypto_amount", { precision: 20, scale: 8 }),
    cryptoCurrency: varchar("crypto_currency", { length: 10 }).notNull(),
    network: varchar("network", { length: 50 }).notNull(),
    walletAddress: varchar("wallet_address").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }),
    transakStatus: varchar("transak_status", { length: 50 }),
    transactionHash: varchar("transaction_hash"),
    errorMessage: text("error_message"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_onramp_orders_user").on(table.userId),
    index("IDX_onramp_orders_transak").on(table.transakOrderId),
    index("IDX_onramp_orders_status").on(table.status),
    index("IDX_onramp_orders_created").on(table.createdAt),
  ],
);

export const onrampOrdersInsertSchema = createInsertSchema(onrampOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OnrampOrder = typeof onrampOrders.$inferSelect;
export type InsertOnrampOrder = z.infer<typeof onrampOrdersInsertSchema>;

export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  message: text("message").notNull(),
  source: varchar("source", { length: 50 }).default("landing_page"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const onrampWebhookEvents = pgTable("onramp_webhook_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().unique(),
  transakOrderId: varchar("transak_order_id"),
  status: varchar("status", { length: 50 }),
  processedAt: timestamp("processed_at").defaultNow(),
});

export const a2aInteractions = pgTable(
  "a2a_interactions",
  {
    id: serial("id").primaryKey(),
    requestId: varchar("request_id"),
    endpoint: varchar("endpoint").notNull(),
    protocol: varchar("protocol").notNull().default("a2a"),
    queryText: text("query_text"),
    matched: boolean("matched").default(false),
    resourceId: varchar("resource_id"),
    statusCode: integer("status_code"),
    responseTimeMs: integer("response_time_ms"),
    ipAddress: varchar("ip_address"),
    userAgent: text("user_agent"),
    walletAddress: varchar("wallet_address"),
    trackingId: varchar("tracking_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_a2a_inter_protocol").on(table.protocol),
    index("IDX_a2a_inter_matched").on(table.matched),
    index("IDX_a2a_inter_resource").on(table.resourceId),
    index("IDX_a2a_inter_created").on(table.createdAt),
  ]
);

export const insertA2AInteractionSchema = createInsertSchema(a2aInteractions).omit({
  id: true,
  createdAt: true,
});
export type A2AInteraction = typeof a2aInteractions.$inferSelect;
export type InsertA2AInteraction = z.infer<typeof insertA2AInteractionSchema>;

// ============================================================
// ESPORTS PARTNER TRANSACTIONS (klic.gg integration)
// ============================================================
export const esportsTransactions = pgTable(
  "esports_transactions",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull().unique(),
    type: varchar("type", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    chain: varchar("chain", { length: 20 }).notNull().default("base"),
    partnerApiKeyHash: varchar("partner_api_key_hash", { length: 64 }),
    fromAddress: varchar("from_address", { length: 42 }),
    toAddress: varchar("to_address", { length: 42 }),
    amountUsd: numeric("amount_usd"),
    amountUsdc: numeric("amount_usdc"),
    feeUsdc: numeric("fee_usdc"),
    txHash: varchar("tx_hash", { length: 66 }),
    tournamentId: varchar("tournament_id"),
    playerId: varchar("player_id"),
    streamerId: varchar("streamer_id"),
    streamerWallet: varchar("streamer_wallet", { length: 42 }),
    expiresAt: timestamp("expires_at"),
    confirmedAt: timestamp("confirmed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_esports_session").on(table.sessionId),
    index("IDX_esports_type_status").on(table.type, table.status),
    index("IDX_esports_from_addr").on(table.fromAddress),
    index("IDX_esports_created").on(table.createdAt),
  ]
);

export const insertEsportsTransactionSchema = createInsertSchema(esportsTransactions).omit({
  id: true,
  createdAt: true,
});
export type EsportsTransaction = typeof esportsTransactions.$inferSelect;
export type InsertEsportsTransaction = z.infer<typeof insertEsportsTransactionSchema>;

// ============= IP BLOCKLIST =============
export const ipBlocklist = pgTable('ip_blocklist', {
  id: serial('id').primaryKey(),
  ipAddress: varchar('ip_address', { length: 64 }).notNull().unique(),
  reason: text('reason').notNull(),
  blockedBy: varchar('blocked_by', { length: 100 }).notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertIpBlocklistSchema = createInsertSchema(ipBlocklist).omit({
  id: true,
  createdAt: true,
});
export type IpBlocklistEntry = typeof ipBlocklist.$inferSelect;
export type InsertIpBlocklistEntry = z.infer<typeof insertIpBlocklistSchema>;

// x402 Canary Payments — Scheduled proof-of-settlement payments
// A background job pays /x402/first-call every 6h so every 402 challenge body
// can include a real, independently verifiable on-chain tx hash.
export const x402CanaryPayments = pgTable("x402_canary_payments", {
  id: serial("id").primaryKey(),
  txHash: varchar("tx_hash", { length: 200 }),
  explorerUrl: text("explorer_url"),
  amountUsd: varchar("amount_usd", { length: 20 }).notNull().default("0.05"),
  network: varchar("network").notNull().default("base"),
  service: varchar("service").notNull().default("first-call"),
  status: varchar("status").notNull().default("succeeded"), // succeeded | failed | skipped
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertX402CanaryPaymentSchema = createInsertSchema(x402CanaryPayments).omit({
  id: true,
  createdAt: true,
});
export type X402CanaryPayment = typeof x402CanaryPayments.$inferSelect;
export type InsertX402CanaryPayment = z.infer<typeof insertX402CanaryPaymentSchema>;


// ── Agent Yield Positions ─────────────────────────────────────────────────────
// Custodial yield accounts: agents deposit credits, platform tracks their
// fractional ownership of the vault's total position.

export const agentYieldPositions = pgTable('agent_yield_positions', {
  id:                   serial('id').primaryKey(),
  userId:               varchar('user_id', { length: 255 }).notNull(),
  amountUsdcDeposited:  numeric('amount_usdc_deposited', { precision: 12, scale: 6 }).notNull(),
  entryFeeUsdc:         numeric('entry_fee_usdc', { precision: 12, scale: 6 }).notNull(),
  usdcInVault:          numeric('usdc_in_vault', { precision: 12, scale: 6 }).notNull(),
  sharesAllocated:      numeric('shares_allocated', { precision: 20, scale: 6 }).notNull(),
  depositPricePerShare: numeric('deposit_price_per_share', { precision: 12, scale: 6 }).notNull().default('1.000000'),
  protocol:             varchar('protocol', { length: 50 }).notNull().default('Morpho Blue'),
  status:               varchar('status', { length: 20 }).notNull().default('active'),
  depositedAt:          timestamp('deposited_at').defaultNow().notNull(),
  withdrawnAt:          timestamp('withdrawn_at'),
  withdrawAmountUsdc:   numeric('withdraw_amount_usdc', { precision: 12, scale: 6 }),
});

export const insertAgentYieldPositionSchema = createInsertSchema(agentYieldPositions).omit({
  id: true,
  depositedAt: true,
});
export type AgentYieldPosition = typeof agentYieldPositions.$inferSelect;
export type InsertAgentYieldPosition = z.infer<typeof insertAgentYieldPositionSchema>;

// ── Solana USDC Yield Portal ──────────────────────────────────────────────────
// ISOLATED from Base/EVM vault — separate tables, separate keeper, no shared code.
// Non-custodial: platform builds unsigned VersionedTx, agent signs + submits.
// Protocol v1: Kamino Lending (mainnet). No rebalancing in v1.

export const solanaYieldPositions = pgTable('solana_yield_positions', {
  id:                    serial('id').primaryKey(),
  wallet:                varchar('wallet', { length: 64 }).notNull(),
  market:                varchar('market', { length: 64 }).notNull(),
  reserveAddress:        varchar('reserve_address', { length: 64 }).notNull(),
  collateralMint:        varchar('collateral_mint', { length: 64 }).notNull(),
  collateralBalanceRaw:  varchar('collateral_balance_raw', { length: 40 }).notNull().default('0'),
  depositedUsdcRaw:      varchar('deposited_usdc_raw', { length: 40 }).notNull().default('0'),
  lastValuationUsdc:     numeric('last_valuation_usdc', { precision: 18, scale: 6 }),
  txSignatureDeposit:    varchar('tx_signature_deposit', { length: 128 }),
  txSignatureWithdraw:   varchar('tx_signature_withdraw', { length: 128 }),
  status:                varchar('status', { length: 20 }).notNull().default('active'),
  openedAt:              timestamp('opened_at').defaultNow().notNull(),
  closedAt:              timestamp('closed_at'),
  updatedAt:             timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('IDX_sol_yield_pos_wallet').on(t.wallet),
  index('IDX_sol_yield_pos_status').on(t.status),
  index('IDX_sol_yield_pos_opened').on(t.openedAt),
]);

export const insertSolanaYieldPositionSchema = createInsertSchema(solanaYieldPositions).omit({
  id: true,
  openedAt: true,
  updatedAt: true,
});
export type SolanaYieldPosition = typeof solanaYieldPositions.$inferSelect;
export type InsertSolanaYieldPosition = z.infer<typeof insertSolanaYieldPositionSchema>;

export const solanaYieldEvents = pgTable('solana_yield_events', {
  id:              serial('id').primaryKey(),
  wallet:          varchar('wallet', { length: 64 }).notNull(),
  eventType:       varchar('event_type', { length: 30 }).notNull(), // deposit_intent | deposit_confirmed | withdraw_intent | withdraw_confirmed
  amountUsdcRaw:   varchar('amount_usdc_raw', { length: 40 }),
  txSignature:     varchar('tx_signature', { length: 128 }),
  slot:            bigint('slot', { mode: 'number' }),
  feeUsdcRaw:      varchar('fee_usdc_raw', { length: 40 }),
  status:          varchar('status', { length: 30 }).notNull().default('pending'), // pending | confirmed | pending_verification | failed
  errorMessage:    text('error_message'),
  idempotencyKey:  varchar('idempotency_key', { length: 128 }),  // optional; prevents double-fee on deposit retry
  bundleExpiresAt: timestamp('bundle_expires_at'),               // blockhash expiry (~90s from deposit-tx call)
  createdAt:       timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('IDX_sol_yield_evt_wallet').on(t.wallet),
  index('IDX_sol_yield_evt_type').on(t.eventType),
  index('IDX_sol_yield_evt_created').on(t.createdAt),
  index('IDX_sol_yield_evt_idem').on(t.idempotencyKey),
]);

export const insertSolanaYieldEventSchema = createInsertSchema(solanaYieldEvents).omit({
  id: true,
  createdAt: true,
});
export type SolanaYieldEvent = typeof solanaYieldEvents.$inferSelect;
export type InsertSolanaYieldEvent = z.infer<typeof insertSolanaYieldEventSchema>;

export const solanaYieldRateSnapshots = pgTable('solana_yield_rate_snapshots', {
  id:            serial('id').primaryKey(),
  market:        varchar('market', { length: 64 }).notNull(),
  reserveAddress: varchar('reserve_address', { length: 64 }).notNull(),
  apyBps:        integer('apy_bps').notNull(),
  supplyApyBps:  integer('supply_apy_bps'),
  borrowApyBps:  integer('borrow_apy_bps'),
  liquidityUsdc: numeric('liquidity_usdc', { precision: 18, scale: 2 }),
  utilizationPct: numeric('utilization_pct', { precision: 5, scale: 2 }),
  source:        varchar('source', { length: 50 }).notNull().default('dialect'),
  capturedAt:    timestamp('captured_at').defaultNow().notNull(),
}, (t) => [
  index('IDX_sol_yield_snap_market').on(t.market),
  index('IDX_sol_yield_snap_captured').on(t.capturedAt),
]);

export const insertSolanaYieldRateSnapshotSchema = createInsertSchema(solanaYieldRateSnapshots).omit({
  id: true,
  capturedAt: true,
});
export type SolanaYieldRateSnapshot = typeof solanaYieldRateSnapshots.$inferSelect;
export type InsertSolanaYieldRateSnapshot = z.infer<typeof insertSolanaYieldRateSnapshotSchema>;
