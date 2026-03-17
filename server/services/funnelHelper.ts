/**
 * FUNNEL HELPER — Safe, non-blocking funnel event emission
 *
 * - emitFirstContactAsync: fire-and-forget for fast-path routes (well-known, etc.)
 * - emitFunnelEventAsync:  fire-and-forget for downstream conversion events
 * - Both functions NEVER throw — failures are logged only
 *
 * Dedupe strategy for first_contact:
 *   PostgreSQL advisory lock (hashtext of actorKey + weekly bucket) prevents
 *   race-condition double-counting under concurrent requests. One record per
 *   actorKey per 7-day window per source.
 *
 * Privacy: raw IPs are never stored. actorKey = HMAC-SHA256(ip, salt).slice(0,24).
 */

import { db } from '../db.js';
import { conversionFunnelEvents } from '../../shared/schema.js';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

const SALT = process.env.FUNNEL_ACTOR_SALT || 'coinrailz-funnel-v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ContactSource =
  | 'x402_challenge'
  | 'well_known'
  | 'direct_trial'
  | 'landing_page'
  | 'direct_purchase'
  | 'mcp_call'
  | 'buy_page';

function hashActorKey(ip: string): string {
  return crypto.createHmac('sha256', SALT).update(ip).digest('hex').substring(0, 24);
}

async function emitFirstContact(ip: string, source: ContactSource, path?: string): Promise<void> {
  const actorKey = hashActorKey(ip);
  const lockStr = `first_contact:${actorKey}:${source}`;
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockStr}))`);

    const existing = await tx.execute(sql`
      SELECT id FROM conversion_funnel_events
      WHERE stage = 'first_contact'
        AND metadata->>'actorKey' = ${actorKey}
        AND metadata->>'source' = ${source}
        AND created_at > ${sevenDaysAgo.toISOString()}
      LIMIT 1
    `);

    if (existing.rows.length > 0) return;

    await tx.insert(conversionFunnelEvents).values({
      stage: 'first_contact',
      channel: source,
      metadata: { actorKey, source, path: path || 'unknown' },
    });
  });
}

async function emitFunnelEvent(params: {
  stage: string;
  source?: string;
  ip?: string;
  apiKeyPrefix?: string;
  creditsAmount?: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  const actorKey = params.ip ? hashActorKey(params.ip) : undefined;

  await db.insert(conversionFunnelEvents).values({
    stage: params.stage,
    channel: params.source || null,
    apiKeyPrefix: params.apiKeyPrefix || null,
    creditsAmount: params.creditsAmount != null ? String(params.creditsAmount) : null,
    metadata: {
      ...(params.metadata || {}),
      ...(actorKey ? { actorKey } : {}),
    },
  });
}

export function emitFirstContactAsync(ip: string, source: ContactSource, path?: string): void {
  void emitFirstContact(ip, source, path).catch((err: Error) => {
    console.error('⚠️ funnel first_contact failed (non-blocking):', err.message);
  });
}

export function emitFunnelEventAsync(params: Parameters<typeof emitFunnelEvent>[0]): void {
  void emitFunnelEvent(params).catch((err: Error) => {
    console.error(`⚠️ funnel ${params.stage} failed (non-blocking):`, err.message);
  });
}
