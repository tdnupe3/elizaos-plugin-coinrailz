import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

const BUYER_SCORE_SQL = sql`
  WITH deduped AS (
    SELECT DISTINCT ON (wallet)
      wallet,
      SPLIT_PART(url, '/', 3) AS domain,
      url,
      capabilities,
      metadata,
      score,
      discovered_at
    FROM discovered_agents
    WHERE source = 'x402-bazaar'
      AND wallet IS NOT NULL AND wallet != ''
    ORDER BY wallet, score DESC NULLS LAST
  ),
  scored AS (
    SELECT
      domain,
      wallet,
      url,
      ROUND((capabilities->>'avgPrice')::numeric, 4)        AS avg_price,
      COALESCE((capabilities->>'serviceCount')::int, 1)     AS svc_count,
      capabilities->'networks'                              AS networks,
      metadata->>'description'                             AS description,
      (metadata->>'probeStatus')::int                      AS probe_status,
      metadata->>'reachabilityStatus'                      AS reachability,
      score,
      discovered_at,

      (
        CASE WHEN (metadata->>'probeStatus')::int = 402 THEN 20 ELSE 0 END
        + CASE
            WHEN COALESCE((capabilities->>'serviceCount')::int,1) <= 3  THEN 20
            WHEN COALESCE((capabilities->>'serviceCount')::int,1) <= 8  THEN 12
            WHEN COALESCE((capabilities->>'serviceCount')::int,1) <= 20 THEN 5
            ELSE 0
          END
        + CASE
            WHEN (capabilities->>'avgPrice')::numeric BETWEEN 0.05 AND 2.0  THEN 20
            WHEN (capabilities->>'avgPrice')::numeric BETWEEN 0.01 AND 0.05 THEN 10
            WHEN (capabilities->>'avgPrice')::numeric > 2.0                 THEN 8
            ELSE 0
          END
        + CASE
            WHEN LOWER(metadata->>'description') SIMILAR TO
              '%(agent|intel|signal|analys|predict|strateg|arbitrag|sentiment|trading|portfolio|risk|audit|forecast|research|scout|monitor)%'
            THEN 25 ELSE 0
          END
        + CASE
            WHEN jsonb_array_length(capabilities->'networks') >= 2 THEN 10
            WHEN jsonb_array_length(capabilities->'networks') >= 1 THEN 5
            ELSE 0
          END
        + CASE WHEN discovered_at >= NOW() - INTERVAL '90 days' THEN 5 ELSE 0 END
      ) AS buyer_score,

      CASE
        WHEN COALESCE((capabilities->>'serviceCount')::int,1) > 50 THEN true
        WHEN LOWER(metadata->>'description') SIMILAR TO '%(premium api access|data provider|api service)%' THEN true
        WHEN (capabilities->>'avgPrice')::numeric < 0.003 THEN true
        ELSE false
      END AS likely_pure_provider,

      CASE
        WHEN domain LIKE '%crestal%' OR domain LIKE '%nation.service%' THEN 'nation-fun-agents'
        WHEN domain LIKE '%questflow%' THEN 'questflow-swarm'
        WHEN LOWER(metadata->>'description') SIMILAR TO '%(trading|defi|arbitrag|portfolio|whale|swap|dex)%' THEN 'defi-trading'
        WHEN LOWER(metadata->>'description') SIMILAR TO '%(intel|signal|analys|sentiment|predict|forecast|research)%' THEN 'intelligence-analytics'
        WHEN LOWER(metadata->>'description') SIMILAR TO '%(risk|audit|scan|secur|vulnerab)%' THEN 'security-risk'
        WHEN LOWER(metadata->>'description') SIMILAR TO '%(sport|bet|odds)%' THEN 'prediction-markets'
        WHEN LOWER(metadata->>'description') SIMILAR TO '%(search|web|crawl|browse|scrape)%' THEN 'web-data'
        WHEN LOWER(metadata->>'description') SIMILAR TO '%(ai video|image|audio|generat)%' THEN 'ai-media'
        ELSE 'other'
      END AS cluster

    FROM deduped
  )
  SELECT
    domain,
    wallet,
    url,
    avg_price,
    svc_count,
    networks,
    description,
    probe_status,
    reachability,
    buyer_score,
    likely_pure_provider,
    cluster,
    discovered_at
  FROM scored
  ORDER BY buyer_score DESC, avg_price DESC NULLS LAST
`;

router.get('/api/discovery/buyer-analysis', async (req, res) => {
  try {
    const clusterFilter = req.query.cluster as string | undefined;
    const minScore = parseInt(req.query.minScore as string || '0', 10);
    const includeProviders = req.query.includeProviders === 'true';
    const limit = Math.min(parseInt(req.query.limit as string || '300', 10), 600);

    const result = await db.execute(BUYER_SCORE_SQL);
    const rows: any[] = (result as any).rows ?? [];

    const allOperators = rows.map((r: any) => ({
      domain:              r.domain,
      wallet:              r.wallet,
      url:                 r.url,
      avgPrice:            r.avg_price !== null ? parseFloat(r.avg_price) : null,
      serviceCount:        r.svc_count,
      networks:            r.networks ?? [],
      description:         r.description ?? '',
      probeStatus:         r.probe_status,
      reachability:        r.reachability,
      buyerScore:          parseInt(r.buyer_score, 10),
      likelyPureProvider:  r.likely_pure_provider,
      cluster:             r.cluster,
      discoveredAt:        r.discovered_at,
    }));

    const filtered = allOperators.filter(op => {
      if (!includeProviders && op.likelyPureProvider) return false;
      if (op.buyerScore < minScore) return false;
      if (clusterFilter && clusterFilter !== 'all' && op.cluster !== clusterFilter) return false;
      return true;
    }).slice(0, limit);

    const clusterSummary = allOperators.reduce((acc: Record<string, any>, op) => {
      if (!acc[op.cluster]) {
        acc[op.cluster] = { cluster: op.cluster, total: 0, buyers: 0, strongLeads: 0, liveEndpoints: 0 };
      }
      acc[op.cluster].total++;
      if (!op.likelyPureProvider) acc[op.cluster].buyers++;
      if (!op.likelyPureProvider && op.buyerScore >= 55) acc[op.cluster].strongLeads++;
      if (op.probeStatus === 402) acc[op.cluster].liveEndpoints++;
      return acc;
    }, {});

    res.json({
      ok: true,
      totalOperators:  allOperators.length,
      totalDomains:    new Set(allOperators.map(o => o.domain)).size,
      buyerLeads:      allOperators.filter(o => !o.likelyPureProvider).length,
      strongLeads:     allOperators.filter(o => !o.likelyPureProvider && o.buyerScore >= 55).length,
      confirmedPayers: 0,
      clusters:        Object.values(clusterSummary).sort((a: any, b: any) => b.strongLeads - a.strongLeads),
      operators:       filtered,
      generatedAt:     new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[buyer-analysis] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
