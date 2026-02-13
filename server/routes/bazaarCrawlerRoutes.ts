import { Router } from 'express';
import { crawlBazaarRegistry } from '../services/bazaarCrawler';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { sql, desc, isNotNull } from 'drizzle-orm';

const router = Router();

let crawlStatus: {
  running: boolean;
  startedAt?: string;
  results?: any;
  error?: string;
} = { running: false };

router.post('/crawl', async (req, res) => {
  if (crawlStatus.running) {
    return res.json({
      success: false,
      error: 'Crawl already in progress',
      startedAt: crawlStatus.startedAt,
    });
  }

  const maxPages = req.body.maxPages || undefined;

  crawlStatus = { running: true, startedAt: new Date().toISOString() };

  res.json({
    success: true,
    message: 'Bazaar crawl started in background',
    startedAt: crawlStatus.startedAt,
    checkStatus: '/api/bazaar/crawl-status',
  });

  try {
    const results = await crawlBazaarRegistry(maxPages);
    crawlStatus = { running: false, results };
  } catch (error: any) {
    console.error('Bazaar crawl failed:', error);
    crawlStatus = { running: false, error: error.message };
  }
});

router.get('/crawl-status', async (_req, res) => {
  res.json({
    success: true,
    ...crawlStatus,
  });
});

router.get('/targets', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const minScore = parseInt(req.query.minScore as string) || 0;
    const networkFilter = req.query.network as string || undefined;

    const allTargets = await db.select()
      .from(discoveredAgents)
      .where(isNotNull(discoveredAgents.wallet))
      .orderBy(desc(discoveredAgents.score))
      .limit(500);

    let filtered = allTargets.filter(t => t.score !== null && t.score >= minScore);

    if (networkFilter) {
      filtered = filtered.filter(t => {
        const caps = t.capabilities as any;
        if (!caps?.networks) return false;
        return caps.networks.some((n: string) => n.includes(networkFilter));
      });
    }

    const evmTargets = filtered.filter(t => {
      const w = t.wallet || '';
      return w.startsWith('0x') && w.length === 42;
    });

    const solanaTargets = filtered.filter(t => {
      const w = t.wallet || '';
      return !w.startsWith('0x') && w.length >= 32;
    });

    const contacted = filtered.filter(t => t.lastContactAt !== null);
    const uncontacted = filtered.filter(t => t.lastContactAt === null);

    res.json({
      success: true,
      summary: {
        totalWithWallets: allTargets.length,
        filteredCount: filtered.length,
        evmWallets: evmTargets.length,
        solanaWallets: solanaTargets.length,
        contacted: contacted.length,
        uncontacted: uncontacted.length,
      },
      targets: filtered.slice(0, limit).map(t => ({
        wallet: t.wallet,
        url: t.url,
        source: t.source,
        score: t.score,
        status: t.status,
        capabilities: t.capabilities,
        contacted: t.lastContactAt !== null,
        lastSeen: t.lastSeenAt,
      })),
    });
  } catch (error: any) {
    console.error('Target listing failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const totalResult = await db.select({
      count: sql<number>`count(*)`,
    }).from(discoveredAgents).where(isNotNull(discoveredAgents.wallet));

    const sourceBreakdown = await db.select({
      source: discoveredAgents.source,
      count: sql<number>`count(*)`,
    }).from(discoveredAgents)
      .where(isNotNull(discoveredAgents.wallet))
      .groupBy(discoveredAgents.source);

    const contactedCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(discoveredAgents)
      .where(sql`${discoveredAgents.wallet} IS NOT NULL AND ${discoveredAgents.lastContactAt} IS NOT NULL`);

    res.json({
      success: true,
      stats: {
        totalWalletTargets: totalResult[0]?.count || 0,
        contacted: contactedCount[0]?.count || 0,
        bySource: sourceBreakdown.map(s => ({ source: s.source, count: s.count })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
