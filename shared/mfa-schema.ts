import { z } from "zod";
import { pgTable, varchar, boolean, timestamp, serial, text } from "drizzle-orm/pg-core";
import { users } from "./schema";

// MFA Methods table
export const mfaMethods = pgTable("mfa_methods", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // 'email', 'sms'
  isEnabled: boolean("is_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used"),
});

// MFA Verification Codes table for tracking codes sent to user
export const mfaVerificationCodes = pgTable("mfa_verification_codes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  code: varchar("code").notNull(),
  method: varchar("method").notNull(), // 'email' or 'sms'
  verified: boolean("verified").default(false),
  attempts: serial("attempts").default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Device Trust table for remembering trusted devices
export const trustedDevices = pgTable("trusted_devices", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  deviceFingerprint: varchar("device_fingerprint").notNull(),
  deviceName: varchar("device_name"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used"),
});

// Zod schemas for validation
export const enableMfaSchema = z.object({
  method: z.enum(['email', 'sms']),
});

export const sendMfaCodeSchema = z.object({
  method: z.enum(['email', 'sms']),
});

export const verifyMfaCodeSchema = z.object({
  code: z.string().length(6),
  method: z.enum(['email', 'sms']),
  trustDevice: z.boolean().default(false),
});

// Types
export type MfaMethod = typeof mfaMethods.$inferSelect;
export type InsertMfaMethod = typeof mfaMethods.$inferInsert;
export type MfaVerificationCode = typeof mfaVerificationCodes.$inferSelect;
export type InsertMfaVerificationCode = typeof mfaVerificationCodes.$inferInsert;
export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type InsertTrustedDevice = typeof trustedDevices.$inferInsert;

export type EnableMfaRequest = z.infer<typeof enableMfaSchema>;
export type SendMfaCodeRequest = z.infer<typeof sendMfaCodeSchema>;
export type VerifyMfaCodeRequest = z.infer<typeof verifyMfaCodeSchema>;