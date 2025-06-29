/**
 * DATA MONETIZATION API ROUTES
 * Endpoints for data products and analytics services
 */

import { Router, Request, Response } from 'express';
import { DataMonetizationService } from '../services/dataMonetizationService';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for data API endpoints
const dataAPIRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each client to 100 requests per windowMs
  message: {
    error: 'Too many data requests, please try again later',
    rateLimitInfo: 'Data API rate limit: 100 requests per 15 minutes'
  }
});

router.use(dataAPIRateLimit);

/**
 * Generate Market Intelligence Report
 * POST /api/data/market-report
 */
router.post('/market-report', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, anonymize = true } = req.body;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const report = await DataMonetizationService.generateMarketReport(start, end, anonymize);

    res.json({
      success: true,
      report,
      metadata: {
        generated: new Date().toISOString(),
        period: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
        anonymized: anonymize,
        dataPoints: Object.keys(report).length
      }
    });

  } catch (error) {
    console.error('Error generating market report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate market intelligence report'
    });
  }
});

/**
 * Get User Behavior Patterns
 * GET /api/data/user-behavior
 */
router.get('/user-behavior', async (req: Request, res: Response) => {
  try {
    const timeframe = parseInt(req.query.timeframe as string) || 30;
    
    if (timeframe > 365) {
      return res.status(400).json({
        success: false,
        error: 'Timeframe cannot exceed 365 days'
      });
    }

    const patterns = await DataMonetizationService.getUserBehaviorPatterns(timeframe);

    res.json({
      success: true,
      data: patterns,
      metadata: {
        timeframe: `${timeframe} days`,
        generated: new Date().toISOString(),
        anonymized: true
      }
    });

  } catch (error) {
    console.error('Error getting user behavior patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user behavior patterns'
    });
  }
});

/**
 * API Data Feed Endpoints
 * GET /api/data/feed/:endpoint
 */
router.get('/feed/:endpoint', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.params;
    const { startTime, endTime } = req.query;
    
    const validEndpoints = [
      'transaction-volume',
      'network-distribution', 
      'agent-performance'
    ];

    if (!validEndpoints.includes(endpoint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid endpoint',
        availableEndpoints: validEndpoints
      });
    }

    const start = startTime ? new Date(startTime as string) : undefined;
    const end = endTime ? new Date(endTime as string) : undefined;

    const data = await DataMonetizationService.getAPIDataFeed(endpoint, start, end);

    res.json({
      success: true,
      endpoint,
      data,
      metadata: {
        generated: new Date().toISOString(),
        startTime: start?.toISOString(),
        endTime: end?.toISOString(),
        recordCount: Array.isArray(data) ? data.length : Object.keys(data).length
      }
    });

  } catch (error) {
    console.error('Error getting API data feed:', error);
    res.status(500).json({
      success: false,
      error: `Failed to retrieve data for endpoint: ${req.params.endpoint}`
    });
  }
});

/**
 * Revenue Potential Analysis
 * GET /api/data/revenue-metrics
 */
router.get('/revenue-metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await DataMonetizationService.calculateRevenueMetrics();

    res.json({
      success: true,
      metrics,
      businessCase: {
        summary: "Data monetization represents significant revenue opportunity",
        keyInsights: [
          "Crypto analytics market valued at $2.1B annually",
          "Platform collects high-value financial behavior data",
          "Multiple monetization channels available",
          "Conservative projections show 6-figure annual potential"
        ],
        nextSteps: [
          "Establish data governance framework",
          "Develop client-facing analytics products",
          "Build enterprise sales pipeline",
          "Implement usage-based pricing models"
        ]
      }
    });

  } catch (error) {
    console.error('Error calculating revenue metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate revenue metrics'
    });
  }
});

/**
 * Data Product Catalog
 * GET /api/data/catalog
 */
router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const catalog = {
      products: [
        {
          id: 'market-intelligence',
          name: 'Market Intelligence Reports',
          description: 'Comprehensive crypto market analysis with transaction patterns and user behavior',
          pricing: '$5,000 - $25,000 per month',
          dataIncluded: [
            'Transaction volume trends',
            'Network usage patterns',
            'User behavior analytics',
            'AI agent performance metrics'
          ],
          targetMarket: 'Institutional investors, hedge funds, research firms',
          updateFrequency: 'Daily, weekly, or monthly'
        },
        {
          id: 'api-data-feeds',
          name: 'Real-time Data API',
          description: 'Live data feeds for trading platforms and analytics companies',
          pricing: '$0.01 - $0.10 per API call',
          dataIncluded: [
            'Real-time transaction volumes',
            'Network distribution metrics',
            'DEX usage statistics',
            'Cross-border payment flows'
          ],
          targetMarket: 'Trading platforms, analytics companies, fintech startups',
          updateFrequency: 'Real-time'
        },
        {
          id: 'custom-analytics',
          name: 'White-label Analytics Platform',
          description: 'Custom analytics dashboards for crypto businesses',
          pricing: '$10,000 - $100,000 setup + $2,000 - $20,000 monthly',
          dataIncluded: [
            'All platform data',
            'Custom visualizations',
            'Branded reporting',
            'API access'
          ],
          targetMarket: 'Crypto exchanges, DeFi protocols, institutional traders',
          updateFrequency: 'Real-time with custom refresh intervals'
        },
        {
          id: 'research-licensing',
          name: 'Research Data Licensing',
          description: 'Anonymized datasets for academic and commercial research',
          pricing: '$5,000 - $50,000 per dataset',
          dataIncluded: [
            'Anonymized transaction patterns',
            'User behavior datasets',
            'Market trend analysis',
            'Historical data archives'
          ],
          targetMarket: 'Universities, research institutions, consulting firms',
          updateFrequency: 'One-time or periodic updates'
        }
      ],
      totalMarketSize: '$2.1B annually',
      competitiveAdvantage: [
        'Multi-chain transaction data across 15+ networks',
        'AI agent marketplace behavioral insights',
        'Real-time referral and viral growth analytics',
        'Cross-border payment corridor intelligence'
      ]
    };

    res.json({
      success: true,
      catalog,
      contact: {
        sales: 'sales@coinrailz.com',
        support: 'data-support@coinrailz.com',
        partnership: 'partnerships@coinrailz.com'
      }
    });

  } catch (error) {
    console.error('Error getting product catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve product catalog'
    });
  }
});

export { router as dataMonetizationRoutes };