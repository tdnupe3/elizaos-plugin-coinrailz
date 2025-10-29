/**
 * Discovery Routes
 * Autonomous discovery endpoints for web crawlers and AI agents
 */

import express from 'express';
import { autonomousDiscoveryService } from '../services/autonomousDiscoveryService';

const router = express.Router();

/**
 * GET /sitemap.xml
 * XML sitemap for web crawlers
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const sitemap = await autonomousDiscoveryService.generateAgentSitemap();
    
    res.setHeader('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap generation failed:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate sitemap</error>');
  }
});

/**
 * GET /robots.txt
 * Robots.txt for crawler instructions
 */
router.get('/robots.txt', (req, res) => {
  try {
    const robotsTxt = autonomousDiscoveryService.generateRobotsTxt();
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(robotsTxt);
  } catch (error) {
    console.error('robots.txt generation failed:', error);
    res.status(500).send('User-agent: *\nDisallow:');
  }
});

/**
 * POST /api/discovery/ping
 * Manually trigger search engine pings
 */
router.post('/api/discovery/ping', async (req, res) => {
  try {
    const result = await autonomousDiscoveryService.pingSearchEngines();
    
    res.json(result);
  } catch (error) {
    console.error('Search engine ping failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ping search engines',
    });
  }
});

/**
 * POST /api/discovery/campaign
 * Execute full autonomous discovery campaign
 */
router.post('/api/discovery/campaign', async (req, res) => {
  try {
    const result = await autonomousDiscoveryService.executeDiscoveryCampaign();
    
    res.json({
      success: result.success,
      message: 'Discovery campaign executed',
      details: result,
    });
  } catch (error) {
    console.error('Discovery campaign failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute discovery campaign',
    });
  }
});

export default router;
