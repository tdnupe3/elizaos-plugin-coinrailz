/**
 * DATABASE SCHEMA FOR AI MARKETPLACE MESSAGING SYSTEM
 * Extends the existing schema with chat and delivery functionality
 */

import { pgTable, text, timestamp, uuid, jsonb, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Conversations table for organizing chat sessions between customers and agents
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: text('order_id').notNull(),
  customerId: text('customer_id').notNull(),
  agentId: text('agent_id').notNull(),
  status: text('status').notNull().default('active'), // active, completed, paused
  lastMessageAt: timestamp('last_message_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Messages table for storing all chat messages
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  fromId: text('from_id').notNull(),
  fromType: text('from_type').notNull(), // customer, agent, system
  toId: text('to_id').notNull(),
  toType: text('to_type').notNull(), // customer, agent, system
  content: text('content').notNull(),
  messageType: text('message_type').default('text'), // text, file, milestone, system
  attachments: jsonb('attachments').$type<string[]>().default([]),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Service deliveries table for tracking order fulfillment
export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: text('order_id').notNull().unique(),
  agentId: text('agent_id').notNull(),
  customerId: text('customer_id').notNull(),
  status: text('status').notNull().default('pending'), // pending, in_progress, delivered, approved, rejected
  description: text('description'),
  files: jsonb('files').$type<Array<{
    id: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    uploadDate: string;
    virusScanResult: { clean: boolean; threat?: string };
  }>>().default([]),
  deliveredAt: timestamp('delivered_at'),
  approvedAt: timestamp('approved_at'),
  rejectedAt: timestamp('rejected_at'),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Order integration table (enhanced version of existing orders)
export const marketplaceOrders = pgTable('marketplace_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: text('agent_id').notNull(),
  customerId: text('customer_id').notNull(),
  serviceType: text('service_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  amount: text('amount').notNull(), // Store as string to avoid floating point precision issues
  currency: text('currency').default('USD'),
  status: text('status').notNull().default('pending'), // pending, accepted, in_progress, delivered, completed, cancelled
  paymentStatus: text('payment_status').default('pending'), // pending, paid, escrowed, released, refunded
  paymentMethod: text('payment_method').default('stripe_card'), // stripe_card, x402_usdc
  paymentIntentId: text('payment_intent_id'),
  transactionHash: text('transaction_hash'), // For crypto payments - on-chain tx hash
  escrowAmount: text('escrow_amount'),
  platformFee: text('platform_fee'),
  agentPayout: text('agent_payout'),
  acceptedAt: timestamp('accepted_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Schema exports for validation
export const insertConversationSchema = createInsertSchema(conversations);
export const insertMessageSchema = createInsertSchema(messages);
export const insertDeliverySchema = createInsertSchema(deliveries);
export const insertMarketplaceOrderSchema = createInsertSchema(marketplaceOrders);

// Type exports
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Delivery = typeof deliveries.$inferSelect;
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type MarketplaceOrder = typeof marketplaceOrders.$inferSelect;
export type InsertMarketplaceOrder = z.infer<typeof insertMarketplaceOrderSchema>;