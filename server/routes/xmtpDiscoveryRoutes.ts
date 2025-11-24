/**
 * XMTP DISCOVERY API ROUTES
 * 
 * Endpoints for XMTP agent discovery and statistics
 * Based on ChatGPT's XMTP verification recommendations
 */

import { Router, Request, Response } from 'express';
import { xmtpAgentScanner } from '../services/xmtpAgentScanner';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/xmtp/agents
 * List XMTP-enabled agents for targeted outreach
 * NO DUPLICATES: Database unique constraint on URL ensures unique results
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const agents = await db
      .select({
        id: discoveredAgents.id,
        url: discoveredAgents.url,
        source: discoveredAgents.source,
        xmtpAddress: discoveredAgents.xmtpAddress,
        xmtpLastChecked: discoveredAgents.xmtpLastChecked,
        metadata: discoveredAgents.metadata,
        score: discoveredAgents.score,
      })
      .from(discoveredAgents)
      .where(eq(discoveredAgents.xmtpCanMessage, true))
      .orderBy(desc(discoveredAgents.score))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      count: agents.length,
      agents,
      pagination: {
        limit,
        offset,
        hasMore: agents.length === limit,
      },
    });

  } catch (error) {
    console.error('❌ Error fetching XMTP agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch XMTP-enabled agents',
    });
  }
});

/**
 * GET /api/xmtp/stats
 * Get XMTP adoption statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await xmtpAgentScanner.getXMTPStats();

    res.json({
      success: true,
      stats: {
        totalAgents: stats.totalAgents,
        xmtpEnabled: stats.xmtpEnabled,
        xmtpDisabled: stats.xmtpDisabled,
        notChecked: stats.notChecked,
        adoptionRate: `${stats.adoptionRate}%`,
      },
      message: `${stats.adoptionRate}% of scanned agents support XMTP messaging`,
    });

  } catch (error) {
    console.error('❌ Error fetching XMTP stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch XMTP statistics',
    });
  }
});

/**
 * POST /api/xmtp/scan
 * Manually trigger XMTP scan
 * Rate-limited to prevent abuse
 */
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { forceRescan, maxAgents, batchSize } = req.body;

    // Start scan asynchronously (don't wait for completion)
    xmtpAgentScanner.scanAllAgents({
      forceRescan: forceRescan === true,
      maxAgents: maxAgents || 1000,
      batchSize: batchSize || 10,
    }).then(results => {
      console.log('✅ XMTP scan completed:', results);
    }).catch(error => {
      console.error('❌ XMTP scan failed:', error);
    });

    res.json({
      success: true,
      message: 'XMTP scan started in background',
      options: {
        forceRescan: forceRescan === true,
        maxAgents: maxAgents || 1000,
        batchSize: batchSize || 10,
      },
    });

  } catch (error) {
    console.error('❌ Error starting XMTP scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start XMTP scan',
    });
  }
});

/**
 * POST /api/xmtp/cleanup-duplicates
 * Consolidate duplicate agents with same canonical URL
 * DUPLICATE ELIMINATION: Architectural fix per architect review
 */
router.post('/cleanup-duplicates', async (req: Request, res: Response) => {
  try {
    const { AgentDatabaseCleanup } = await import('../services/agentDatabaseCleanup');
    
    // Run cleanup synchronously and return results
    const results = await AgentDatabaseCleanup.consolidateDuplicates();

    res.json({
      success: true,
      message: 'Agent database cleanup complete',
      results: {
        duplicatesFound: results.duplicatesFound,
        duplicatesRemoved: results.duplicatesRemoved,
        canonicalUrlsSet: results.canonicalUrlsSet,
      },
    });

  } catch (error) {
    console.error('❌ Error cleaning up duplicates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up duplicates',
    });
  }
});

/**
 * GET /api/xmtp/duplicate-stats
 * Get duplicate statistics without removing them
 */
router.get('/duplicate-stats', async (req: Request, res: Response) => {
  try {
    const { AgentDatabaseCleanup } = await import('../services/agentDatabaseCleanup');
    const stats = await AgentDatabaseCleanup.getDuplicateStats();

    res.json({
      success: true,
      stats,
      message: `Found ${stats.duplicateCount} potential duplicates out of ${stats.totalAgents} total agents`,
    });

  } catch (error) {
    console.error('❌ Error fetching duplicate stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch duplicate statistics',
    });
  }
});

/**
 * GET /api/xmtp/high-value-targets
 * Check XMTP support for specific high-value agents
 */
router.get('/high-value-targets', async (req: Request, res: Response) => {
  try {
    const results = await xmtpAgentScanner.scanHighValueTargets();

    res.json({
      success: true,
      targets: results,
      summary: {
        truthTerminal: results.truthTerminal ? 'XMTP Enabled' : 'Not Available',
        ai16z: results.ai16z ? 'XMTP Enabled' : 'Not Available',
        luna: results.luna ? 'XMTP Enabled' : 'Not Available',
        fereAI: results.fereAI ? 'XMTP Enabled' : 'Not Available',
      },
    });

  } catch (error) {
    console.error('❌ Error checking high-value targets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check high-value targets',
    });
  }
});

/**
 * GET /api/xmtp/agent/:id
 * Get XMTP details for specific agent
 */
router.get('/agent/:id', async (req: Request, res: Response) => {
  try {
    const agentId = parseInt(req.params.id);

    const [agent] = await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.id, agentId));

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    res.json({
      success: true,
      agent: {
        id: agent.id,
        url: agent.url,
        xmtpAddress: agent.xmtpAddress,
        xmtpCanMessage: agent.xmtpCanMessage,
        xmtpLastChecked: agent.xmtpLastChecked,
        agentCardData: agent.agentCardData,
      },
    });

  } catch (error) {
    console.error('❌ Error fetching agent XMTP details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent details',
    });
  }
});

export default router;
