import {
  pgTable,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  serial,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// DEMO-ONLY: Isolated transaction hashes table for replay attack prevention
// This table is completely separate from production usedTransactionHashes
export const demoUsedTransactionHashes = pgTable(
  "demo_used_transaction_hashes",
  {
    id: serial("id").primaryKey(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    network: varchar("network").notNull(),
    serviceName: varchar("service_name").notNull(),
    amount: varchar("amount").notNull(),
    paidBy: varchar("paid_by"),
    usedAt: timestamp("used_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_demo_used_tx_hash_unique").on(table.txHash),
    index("IDX_demo_used_tx_network").on(table.network),
    index("IDX_demo_used_tx_service").on(table.serviceName),
    index("IDX_demo_used_tx_timestamp").on(table.usedAt),
  ],
);

// DEMO-ONLY: Transaction proofs for demo agent activities
export const demoTransactionProofs = pgTable(
  "demo_transaction_proofs",
  {
    id: serial("id").primaryKey(),
    targetAddress: varchar("target_address").notNull(),
    txSignature: varchar("tx_signature").notNull(),
    chain: varchar("chain").notNull(),
    messageSnippet: varchar("message_snippet"),
    campaignId: varchar("campaign_id"),
    status: varchar("status").default("confirmed"),
    networkFee: numeric("network_fee", { precision: 18, scale: 8 }),
    timestamp: timestamp("timestamp").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_demo_transaction_proofs_chain").on(table.chain),
    index("IDX_demo_transaction_proofs_campaign").on(table.campaignId),
    uniqueIndex("IDX_demo_transaction_proofs_signature").on(table.txSignature),
  ],
);

// DEMO-ONLY: Service usage metrics for demo agent
export const demoServiceMetrics = pgTable(
  "demo_service_metrics",
  {
    id: serial("id").primaryKey(),
    serviceName: varchar("service_name").notNull(),
    requestBody: jsonb("request_body"),
    responseData: jsonb("response_data"),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    amountPaid: varchar("amount_paid").notNull(),
    status: varchar("status").notNull(), // success, error
    errorMessage: varchar("error_message"),
    executionTimeMs: integer("execution_time_ms"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_demo_service_metrics_service").on(table.serviceName),
    index("IDX_demo_service_metrics_status").on(table.status),
    index("IDX_demo_service_metrics_created").on(table.createdAt),
  ],
);

// Zod schemas for validation
export const insertDemoUsedTransactionHashSchema = createInsertSchema(demoUsedTransactionHashes);
export const insertDemoTransactionProofSchema = createInsertSchema(demoTransactionProofs);
export const insertDemoServiceMetricSchema = createInsertSchema(demoServiceMetrics);

// TypeScript types
export type DemoUsedTransactionHash = typeof demoUsedTransactionHashes.$inferSelect;
export type InsertDemoUsedTransactionHash = z.infer<typeof insertDemoUsedTransactionHashSchema>;

export type DemoTransactionProof = typeof demoTransactionProofs.$inferSelect;
export type InsertDemoTransactionProof = z.infer<typeof insertDemoTransactionProofSchema>;

export type DemoServiceMetric = typeof demoServiceMetrics.$inferSelect;
export type InsertDemoServiceMetric = z.infer<typeof insertDemoServiceMetricSchema>;
