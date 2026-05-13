/**
 * Admin Observability Routes
 * GET /api/admin/observability
 *
 * Read-only dashboard data derived from existing telemetry tables.
 * All queries are date-bounded (last 7 days) and LIMIT-capped to
 * avoid full-table scans on the 2.7GB x402_interactions table.
 *
 * Protected by requireAdmin middleware — not public.
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { pool } from '../db';

const ADMIN_API_KEY_HASH = process.env.ADMIN_API_KEY
  ? crypto.createHash('sha256').update(process.env.ADMIN_API_KEY).digest('hex')
  : null;

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const apiKey         = req.headers['x-admin-key'] as string | undefined;
  const internalSecret = req.headers['x-internal-secret'] as string | undefined;

  if (process.env.INTERNAL_SERVICE_SECRET && internalSecret === process.env.INTERNAL_SERVICE_SECRET) {
    return next();
  }
  if (apiKey && ADMIN_API_KEY_HASH) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    if (keyHash === ADMIN_API_KEY_HASH) return next();
  }
  // Dev-mode open access when no ADMIN_API_KEY is configured
  if (process.env.NODE_ENV !== 'production' && !ADMIN_API_KEY_HASH) {
    return next();
  }
  return res.status(401).json({ error: 'Admin authentication required. Pass X-Admin-Key header.' });
}

const router = Router();

router.get('/observability', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 7, 30);
    const interval = `${days} days`;

    const [
      x402Summary,
      topServices,
      topEndpoints,
      paymentIntentSummary,
      recentPaymentIntents,
    ] = await Promise.all([

      // x402_interactions summary — bounded to last N days, LIMIT 200k rows scanned
      pool.query(`
        WITH r AS (
          SELECT service_name, paid, amount, response_status, created_at
          FROM x402_interactions
          WHERE created_at > NOW() - INTERVAL '${interval}'
          ORDER BY created_at DESC
          LIMIT 200000
        )
        SELECT
          COUNT(*)::int                                                   AS total_interactions,
          SUM((paid)::int)::int                                          AS paid_count,
          COALESCE(SUM(CASE WHEN paid THEN amount::numeric ELSE 0 END), 0)::numeric AS revenue_usd,
          COALESCE(AVG(CASE WHEN paid THEN amount::numeric END), 0)::numeric       AS avg_payment_usd,
          SUM(CASE WHEN response_status = 200 THEN 1 ELSE 0 END)::int  AS success_count,
          SUM(CASE WHEN response_status = 402 THEN 1 ELSE 0 END)::int  AS payment_required_count
        FROM r
      `),

      // Top services by hit count — bounded
      pool.query(`
        WITH r AS (
          SELECT service_name, paid
          FROM x402_interactions
          WHERE created_at > NOW() - INTERVAL '${interval}'
          ORDER BY created_at DESC
          LIMIT 200000
        )
        SELECT
          service_name,
          COUNT(*)::int          AS hits,
          SUM((paid)::int)::int  AS paid_hits
        FROM r
        WHERE service_name IS NOT NULL
        GROUP BY service_name
        ORDER BY hits DESC
        LIMIT 20
      `),

      // Top endpoints by hit count from endpoint_hits (18MB — safe)
      pool.query(`
        SELECT
          endpoint,
          COUNT(*)::int                AS hits,
          ROUND(AVG(response_time_ms)) AS avg_ms,
          SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END)::int AS ok_count,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)::int AS error_count
        FROM endpoint_hits
        WHERE created_at > NOW() - INTERVAL '${interval}'
        GROUP BY endpoint
        ORDER BY hits DESC
        LIMIT 20
      `),

      // Payment intents summary (368kB — full scan is fine)
      pool.query(`
        SELECT
          status,
          COUNT(*)::int                            AS count,
          COALESCE(SUM(amount::numeric), 0)::numeric AS total_usd,
          network
        FROM x402_payment_intents
        WHERE created_at > NOW() - INTERVAL '${interval}'
        GROUP BY status, network
        ORDER BY count DESC
      `),

      // Recent payment intents (last 20)
      pool.query(`
        SELECT id, service_name, payer, amount, status, network, created_at
        FROM x402_payment_intents
        WHERE created_at > NOW() - INTERVAL '${interval}'
        ORDER BY created_at DESC
        LIMIT 20
      `),
    ]);

    const summary = x402Summary.rows[0] ?? {};

    res.json({
      ok: true,
      window_days: days,
      generated_at: new Date().toISOString(),

      x402: {
        total_interactions: Number(summary.total_interactions ?? 0),
        paid_count:         Number(summary.paid_count ?? 0),
        payment_required:   Number(summary.payment_required_count ?? 0),
        success_count:      Number(summary.success_count ?? 0),
        revenue_usd:        Number(summary.revenue_usd ?? 0).toFixed(4),
        avg_payment_usd:    Number(summary.avg_payment_usd ?? 0).toFixed(4),
        conversion_rate:    summary.total_interactions > 0
          ? ((Number(summary.paid_count) / Number(summary.total_interactions)) * 100).toFixed(2) + '%'
          : '0%',
      },

      top_services: topServices.rows.map(r => ({
        service: r.service_name,
        hits:     Number(r.hits),
        paid:     Number(r.paid_hits),
      })),

      top_endpoints: topEndpoints.rows.map(r => ({
        endpoint:    r.endpoint,
        hits:        Number(r.hits),
        avg_ms:      Number(r.avg_ms ?? 0),
        ok_count:    Number(r.ok_count),
        error_count: Number(r.error_count),
      })),

      payment_intents: {
        by_status: paymentIntentSummary.rows.map(r => ({
          status:    r.status,
          network:   r.network,
          count:     Number(r.count),
          total_usd: Number(r.total_usd).toFixed(4),
        })),
        recent: recentPaymentIntents.rows.map(r => ({
          id:           r.id,
          service:      r.service_name,
          payer:        r.payer,
          amount_usd:   Number(r.amount).toFixed(4),
          status:       r.status,
          network:      r.network,
          created_at:   r.created_at,
        })),
      },
    });

  } catch (err: any) {
    console.error('[admin/observability] error:', err?.message);
    res.status(500).json({ ok: false, error: 'Failed to load observability data' });
  }
});

export default router;
