import { Router, Request, Response } from 'express';
import { offerLinkService } from '../services/offerLinkService';
import { z } from 'zod';

const router = Router();

const createOfferSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  outreachMessageId: z.number().optional(),
  campaignId: z.string().optional(),
  targetAgentUrl: z.string().url().optional(),
  expiresInHours: z.number().min(1).max(8760).optional(),
  metadata: z.record(z.any()).optional(),
});

const bulkCreateSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  count: z.number().min(1).max(100),
  campaignId: z.string().optional(),
});

router.post('/offers', async (req: Request, res: Response) => {
  try {
    const parsed = createOfferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.errors,
      });
    }

    const result = await offerLinkService.createOfferLink(parsed.data);

    res.status(201).json({
      success: true,
      offer: result,
      usage: {
        message: 'Include this link in your outreach messages',
        link: result.fullUrl,
        exampleMessage: `Check out our ${result.serviceName} service: ${result.fullUrl}`,
      },
    });
  } catch (error: any) {
    console.error('Create offer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create offer link',
    });
  }
});

router.post('/offers/bulk', async (req: Request, res: Response) => {
  try {
    const parsed = bulkCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.errors,
      });
    }

    const results = await offerLinkService.createBulkOfferLinks(
      parsed.data.serviceId,
      parsed.data.count,
      parsed.data.campaignId
    );

    res.status(201).json({
      success: true,
      count: results.length,
      offers: results,
    });
  } catch (error: any) {
    console.error('Bulk create offers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create bulk offer links',
    });
  }
});

router.get('/offers/stats', async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const stats = await offerLinkService.getOfferStats(campaignId);

    res.json({
      success: true,
      stats,
      campaignFilter: campaignId || 'all',
    });
  } catch (error: any) {
    console.error('Get offer stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get offer stats',
    });
  }
});

router.get('/offers/recent', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offers = await offerLinkService.getRecentOffers(limit);

    res.json({
      success: true,
      count: offers.length,
      offers,
    });
  } catch (error: any) {
    console.error('Get recent offers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get recent offers',
    });
  }
});

router.get('/offers/:trackingId', async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;
    const offer = await offerLinkService.getOfferByTrackingId(trackingId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found',
      });
    }

    res.json({
      success: true,
      offer,
    });
  } catch (error: any) {
    console.error('Get offer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get offer',
    });
  }
});

router.delete('/offers/:trackingId', async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;
    await offerLinkService.deactivateOffer(trackingId);

    res.json({
      success: true,
      message: 'Offer deactivated',
    });
  } catch (error: any) {
    console.error('Deactivate offer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to deactivate offer',
    });
  }
});

router.get('/services', async (_req: Request, res: Response) => {
  try {
    const services = await offerLinkService.getAvailableServices();

    res.json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error: any) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get available services',
    });
  }
});

export default router;
