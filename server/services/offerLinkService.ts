import { db } from '../db';
import { x402OfferLinks, x402Interactions } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { serviceCatalogService } from './serviceCatalogService';

const PRODUCTION_DOMAIN = 'https://coinrailz.com';

interface CreateOfferLinkParams {
  serviceId: string;
  outreachMessageId?: number;
  campaignId?: string;
  targetAgentUrl?: string;
  expiresInHours?: number;
  metadata?: Record<string, any>;
}

interface OfferLinkResult {
  trackingId: string;
  fullUrl: string;
  serviceId: string;
  serviceName: string;
  priceUSD: string;
  expiresAt: Date | null;
}

class OfferLinkService {
  async createOfferLink(params: CreateOfferLinkParams): Promise<OfferLinkResult> {
    const { 
      serviceId, 
      outreachMessageId, 
      campaignId, 
      targetAgentUrl, 
      expiresInHours,
      metadata 
    } = params;

    const service = serviceCatalogService.getService(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const trackingId = nanoid(12);
    
    const expiresAt = expiresInHours 
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;

    await db.insert(x402OfferLinks).values({
      trackingId,
      serviceId,
      outreachMessageId: outreachMessageId ?? null,
      campaignId: campaignId ?? null,
      targetAgentUrl: targetAgentUrl ?? null,
      expiresAt,
      isActive: true,
      metadata: metadata ?? null,
    });

    return {
      trackingId,
      fullUrl: `${PRODUCTION_DOMAIN}/x402/offer/${trackingId}`,
      serviceId,
      serviceName: service.name,
      priceUSD: service.priceUSD,
      expiresAt,
    };
  }

  async createBulkOfferLinks(
    serviceId: string,
    count: number,
    campaignId?: string
  ): Promise<OfferLinkResult[]> {
    const results: OfferLinkResult[] = [];
    
    for (let i = 0; i < count; i++) {
      const result = await this.createOfferLink({
        serviceId,
        campaignId,
      });
      results.push(result);
    }
    
    return results;
  }

  async getOfferByTrackingId(trackingId: string) {
    const [offer] = await db
      .select()
      .from(x402OfferLinks)
      .where(eq(x402OfferLinks.trackingId, trackingId))
      .limit(1);

    return offer;
  }

  async recordClick(trackingId: string, clientInfo?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }) {
    const offer = await this.getOfferByTrackingId(trackingId);
    if (!offer) return null;

    const now = new Date();
    const isFirstClick = !offer.firstClickAt;

    await db
      .update(x402OfferLinks)
      .set({
        clickCount: sql`COALESCE(${x402OfferLinks.clickCount}, 0) + 1`,
        firstClickAt: isFirstClick ? now : offer.firstClickAt,
        lastClickAt: now,
      })
      .where(eq(x402OfferLinks.trackingId, trackingId));

    return {
      offer,
      isFirstClick,
      serviceId: offer.serviceId,
    };
  }

  async recordConversion(trackingId: string, amount: number) {
    await db
      .update(x402OfferLinks)
      .set({
        convertedAt: new Date(),
        conversionAmount: amount.toString(),
      })
      .where(eq(x402OfferLinks.trackingId, trackingId));
  }

  async getOfferStats(campaignId?: string) {
    let query = db
      .select({
        total: sql<number>`COUNT(*)`,
        clicked: sql<number>`COUNT(*) FILTER (WHERE ${x402OfferLinks.clickCount} > 0)`,
        converted: sql<number>`COUNT(*) FILTER (WHERE ${x402OfferLinks.convertedAt} IS NOT NULL)`,
        totalClicks: sql<number>`COALESCE(SUM(${x402OfferLinks.clickCount}), 0)`,
        totalRevenue: sql<number>`COALESCE(SUM(${x402OfferLinks.conversionAmount}), 0)`,
      })
      .from(x402OfferLinks);

    if (campaignId) {
      query = query.where(eq(x402OfferLinks.campaignId, campaignId)) as typeof query;
    }

    const [stats] = await query;
    return {
      totalOffers: Number(stats.total),
      offersClicked: Number(stats.clicked),
      offersConverted: Number(stats.converted),
      totalClicks: Number(stats.totalClicks),
      totalRevenue: Number(stats.totalRevenue),
      clickRate: stats.total > 0 ? `${Math.round((Number(stats.clicked) / Number(stats.total)) * 100)}%` : '0%',
      conversionRate: stats.clicked > 0 ? `${Math.round((Number(stats.converted) / Number(stats.clicked)) * 100)}%` : '0%',
    };
  }

  async getRecentOffers(limit = 20) {
    return db
      .select()
      .from(x402OfferLinks)
      .orderBy(desc(x402OfferLinks.createdAt))
      .limit(limit);
  }

  async getAvailableServices() {
    const catalog = serviceCatalogService.getCatalog();
    return catalog.services.map(s => ({
      id: s.id,
      name: s.name,
      priceUSD: s.priceUSD,
      category: s.category,
    }));
  }
  
  getServiceById(serviceId: string) {
    return serviceCatalogService.getService(serviceId);
  }

  async deactivateOffer(trackingId: string) {
    await db
      .update(x402OfferLinks)
      .set({ isActive: false })
      .where(eq(x402OfferLinks.trackingId, trackingId));
  }
}

export const offerLinkService = new OfferLinkService();
