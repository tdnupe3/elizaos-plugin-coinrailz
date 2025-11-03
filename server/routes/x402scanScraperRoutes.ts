import { Router, Request, Response } from 'express';
import { x402scanAgentScraper } from '../services/x402scanAgentScraper';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

const router = Router();

router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.body;
    
    console.log(`🚀 Starting x402scan scrape (limit: ${limit})`);
    const result = await x402scanAgentScraper.run(limit);
    
    res.json({
      success: true,
      discovered: result.discovered,
      saved: result.saved,
      message: `Successfully scraped ${result.discovered} agents from x402scan Top Agents`,
    });
  } catch (error: any) {
    console.error('❌ x402scan scrape failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/agents', async (req: Request, res: Response) => {
  try {
    const agents = await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.source, 'x402scan-top-agents'))
      .orderBy(desc(discoveredAgents.score))
      .limit(100);
    
    res.json({
      success: true,
      count: agents.length,
      agents: agents.map(agent => ({
        id: agent.id,
        url: agent.url,
        score: agent.score,
        metadata: agent.metadata,
        capabilities: agent.capabilities,
        discoveredAt: agent.discoveredAt,
        lastSeenAt: agent.lastSeenAt,
      })),
    });
  } catch (error: any) {
    console.error('❌ Failed to fetch x402scan agents:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.source, 'x402scan-top-agents'));
    
    const stats = {
      total: result.length,
      avgScore: result.reduce((sum, a) => sum + (a.score || 0), 0) / result.length || 0,
      topAgents: result
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 10)
        .map(a => ({
          name: (a.metadata as any)?.name,
          score: a.score,
          toolCalls: (a.metadata as any)?.toolCalls,
        })),
    };
    
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('❌ Failed to get stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
