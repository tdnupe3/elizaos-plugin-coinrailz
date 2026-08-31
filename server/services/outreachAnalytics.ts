/**
 * 📊 EXPERIMENTAL OUTREACH ANALYTICS & RESPONSE TRACKING
 * 
 * Revolutionary analytics system for blockchain-native B2B outreach.
 * Tracks conversion rates, response analytics, and campaign ROI.
 * 
 * NOBODY ELSE HAS THIS - We're measuring wallet-to-wallet B2B effectiveness!
 */

import { nanoid } from 'nanoid';

interface OutreachEvent {
  id: string;
  campaignId: string;
  walletAddress: string;
  eventType: 'contact_attempted' | 'message_delivered' | 'report_viewed' | 'invoice_viewed' | 'payment_received' | 'response_received';
  channel: 'on_chain_memo' | 'block_explorer' | 'nft_contact' | 'lead_scoring';
  timestamp: Date;
  metadata: {
    messageId?: string;
    transactionHash?: string;
    reportId?: string;
    invoiceId?: string;
    amount?: number;
    currency?: string;
    responseContent?: string;
    outreachUrl?: string;
    targetType?: string;
    leadQuality?: string;
    requiresHumanFollowUp?: boolean;
    responsePreview?: string;
  };
}

interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  totalContacts: number;
  messagesDelivered: number;
  reportsViewed: number;
  invoicesViewed: number;
  responsesReceived: number;
  paymentsReceived: number;
  totalRevenue: number;
  conversionRates: {
    deliveryRate: number; // delivered / attempted
    reportViewRate: number; // viewed / delivered
    responseRate: number; // responses / delivered
    paymentRate: number; // payments / delivered
  };
  channelPerformance: {
    [channel: string]: {
      attempted: number;
      delivered: number;
      responses: number;
      payments: number;
      revenue: number;
    };
  };
  revenueByDay: { date: string; revenue: number }[];
}

export class OutreachAnalytics {
  private events: Map<string, OutreachEvent[]> = new Map();
  private campaigns: Map<string, CampaignAnalytics> = new Map();

  /**
   * 📈 Track outreach event for analytics
   */
  trackEvent(event: Omit<OutreachEvent, 'id' | 'timestamp'>): string {
    const eventId = nanoid();
    const outreachEvent: OutreachEvent = {
      ...event,
      id: eventId,
      timestamp: new Date()
    };

    // Store event
    const campaignEvents = this.events.get(event.campaignId) || [];
    campaignEvents.push(outreachEvent);
    this.events.set(event.campaignId, campaignEvents);

    // Update campaign analytics
    this.updateCampaignAnalytics(event.campaignId);

    console.log(`📊 Analytics: Tracked ${event.eventType} for wallet ${event.walletAddress} via ${event.channel}`);
    return eventId;
  }

  /**
   * 💰 Track successful payment conversion
   */
  trackPayment(campaignId: string, walletAddress: string, amount: number, currency: string, invoiceId: string): void {
    this.trackEvent({
      campaignId,
      walletAddress,
      eventType: 'payment_received',
      channel: 'on_chain_memo', // Assume on-chain payment
      metadata: {
        amount,
        currency,
        invoiceId
      }
    });

    console.log(`💰 CONVERSION SUCCESS: ${walletAddress} paid ${amount} ${currency} for invoice ${invoiceId}`);
  }

  /**
   * 📱 Track message response from target wallet
   */
  trackResponse(campaignId: string, walletAddress: string, channel: string, responseContent: string): void {
    this.trackEvent({
      campaignId,
      walletAddress,
      eventType: 'response_received',
      channel: channel as any,
      metadata: {
        responseContent: responseContent.substring(0, 500) // Truncate for storage
      }
    });

    console.log(`📱 RESPONSE RECEIVED: ${walletAddress} responded via ${channel}`);
  }

  /**
   * 📊 Get comprehensive campaign analytics
   */
  getCampaignAnalytics(campaignId: string): CampaignAnalytics | null {
    return this.campaigns.get(campaignId) || null;
  }

  /**
   * 📈 Get performance across all campaigns
   */
  getOverallPerformance(): {
    totalCampaigns: number;
    totalContacts: number;
    totalRevenue: number;
    averageConversionRate: number;
    bestPerformingChannel: string;
    totalROI: number;
  } {
    const allCampaigns = Array.from(this.campaigns.values());
    
    const totalCampaigns = allCampaigns.length;
    const totalContacts = allCampaigns.reduce((sum, c) => sum + c.totalContacts, 0);
    const totalRevenue = allCampaigns.reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalPayments = allCampaigns.reduce((sum, c) => sum + c.paymentsReceived, 0);
    
    const averageConversionRate = totalContacts > 0 ? (totalPayments / totalContacts) * 100 : 0;

    // Find best performing channel
    const channelStats: { [channel: string]: { contacts: number; revenue: number } } = {};
    allCampaigns.forEach(campaign => {
      Object.entries(campaign.channelPerformance).forEach(([channel, stats]) => {
        if (!channelStats[channel]) {
          channelStats[channel] = { contacts: 0, revenue: 0 };
        }
        channelStats[channel].contacts += stats.attempted;
        channelStats[channel].revenue += stats.revenue;
      });
    });

    let bestChannel = 'unknown';
    let bestROI = 0;
    Object.entries(channelStats).forEach(([channel, stats]) => {
      const roi = stats.contacts > 0 ? stats.revenue / stats.contacts : 0;
      if (roi > bestROI) {
        bestROI = roi;
        bestChannel = channel;
      }
    });

    // Assume $50 cost per contact attempt (development + infrastructure)
    const estimatedCost = totalContacts * 50;
    const totalROI = estimatedCost > 0 ? ((totalRevenue - estimatedCost) / estimatedCost) * 100 : 0;

    return {
      totalCampaigns,
      totalContacts,
      totalRevenue,
      averageConversionRate,
      bestPerformingChannel: bestChannel,
      totalROI
    };
  }

  /**
   * 🎯 Get real-time campaign dashboard data
   */
  getDashboardData(): {
    recentEvents: OutreachEvent[];
    activeCampaigns: CampaignAnalytics[];
    todayStats: {
      contacts: number;
      responses: number;
      payments: number;
      revenue: number;
    };
    channelComparison: { channel: string; conversionRate: number; revenue: number }[];
  } {
    const allEvents = Array.from(this.events.values()).flat();
    const recentEvents = allEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    const today = new Date().toDateString();
    const todayEvents = allEvents.filter(event => 
      event.timestamp.toDateString() === today
    );

    const todayStats = {
      contacts: todayEvents.filter(e => e.eventType === 'contact_attempted').length,
      responses: todayEvents.filter(e => e.eventType === 'response_received').length,
      payments: todayEvents.filter(e => e.eventType === 'payment_received').length,
      revenue: todayEvents
        .filter(e => e.eventType === 'payment_received')
        .reduce((sum, e) => sum + (e.metadata.amount || 0), 0)
    };

    const activeCampaigns = Array.from(this.campaigns.values())
      .filter(c => c.totalContacts > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Channel comparison
    const channelStats: { [channel: string]: { attempts: number; payments: number; revenue: number } } = {};
    allEvents.forEach(event => {
      if (!channelStats[event.channel]) {
        channelStats[event.channel] = { attempts: 0, payments: 0, revenue: 0 };
      }
      
      if (event.eventType === 'contact_attempted') {
        channelStats[event.channel].attempts++;
      } else if (event.eventType === 'payment_received') {
        channelStats[event.channel].payments++;
        channelStats[event.channel].revenue += event.metadata.amount || 0;
      }
    });

    const channelComparison = Object.entries(channelStats).map(([channel, stats]) => ({
      channel,
      conversionRate: stats.attempts > 0 ? (stats.payments / stats.attempts) * 100 : 0,
      revenue: stats.revenue
    }));

    return {
      recentEvents,
      activeCampaigns,
      todayStats,
      channelComparison
    };
  }

  /**
   * 🔄 Update campaign analytics after new event
   */
  private updateCampaignAnalytics(campaignId: string): void {
    const events = this.events.get(campaignId) || [];
    const existingCampaign = this.campaigns.get(campaignId);

    // Calculate metrics
    const totalContacts = events.filter(e => e.eventType === 'contact_attempted').length;
    const messagesDelivered = events.filter(e => e.eventType === 'message_delivered').length;
    const reportsViewed = events.filter(e => e.eventType === 'report_viewed').length;
    const invoicesViewed = events.filter(e => e.eventType === 'invoice_viewed').length;
    const responsesReceived = events.filter(e => e.eventType === 'response_received').length;
    const paymentsReceived = events.filter(e => e.eventType === 'payment_received').length;
    const totalRevenue = events
      .filter(e => e.eventType === 'payment_received')
      .reduce((sum, e) => sum + (e.metadata.amount || 0), 0);

    // Calculate conversion rates
    const conversionRates = {
      deliveryRate: totalContacts > 0 ? (messagesDelivered / totalContacts) * 100 : 0,
      reportViewRate: messagesDelivered > 0 ? (reportsViewed / messagesDelivered) * 100 : 0,
      responseRate: messagesDelivered > 0 ? (responsesReceived / messagesDelivered) * 100 : 0,
      paymentRate: messagesDelivered > 0 ? (paymentsReceived / messagesDelivered) * 100 : 0
    };

    // Channel performance
    const channels = ['on_chain_memo', 'block_explorer', 'nft_contact'];
    const channelPerformance: any = {};
    
    channels.forEach(channel => {
      const channelEvents = events.filter(e => e.channel === channel);
      channelPerformance[channel] = {
        attempted: channelEvents.filter(e => e.eventType === 'contact_attempted').length,
        delivered: channelEvents.filter(e => e.eventType === 'message_delivered').length,
        responses: channelEvents.filter(e => e.eventType === 'response_received').length,
        payments: channelEvents.filter(e => e.eventType === 'payment_received').length,
        revenue: channelEvents
          .filter(e => e.eventType === 'payment_received')
          .reduce((sum, e) => sum + (e.metadata.amount || 0), 0)
      };
    });

    // Revenue by day (last 30 days)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toDateString();
    }).reverse();

    const revenueByDay = last30Days.map(date => {
      const dayRevenue = events
        .filter(e => e.eventType === 'payment_received' && e.timestamp.toDateString() === date)
        .reduce((sum, e) => sum + (e.metadata.amount || 0), 0);
      
      return { date, revenue: dayRevenue };
    });

    const analytics: CampaignAnalytics = {
      campaignId,
      campaignName: existingCampaign?.campaignName || `Campaign ${campaignId}`,
      totalContacts,
      messagesDelivered,
      reportsViewed,
      invoicesViewed,
      responsesReceived,
      paymentsReceived,
      totalRevenue,
      conversionRates,
      channelPerformance,
      revenueByDay
    };

    this.campaigns.set(campaignId, analytics);
  }

  /**
   * 🎯 Set campaign name for better tracking
   */
  setCampaignName(campaignId: string, name: string): void {
    const existing = this.campaigns.get(campaignId);
    if (existing) {
      existing.campaignName = name;
    } else {
      this.campaigns.set(campaignId, {
        campaignId,
        campaignName: name,
        totalContacts: 0,
        messagesDelivered: 0,
        reportsViewed: 0,
        invoicesViewed: 0,
        responsesReceived: 0,
        paymentsReceived: 0,
        totalRevenue: 0,
        conversionRates: { deliveryRate: 0, reportViewRate: 0, responseRate: 0, paymentRate: 0 },
        channelPerformance: {},
        revenueByDay: []
      });
    }
  }

  /**
   * 🧪 Simulate successful conversion for testing
   */
  simulateConversion(campaignId: string, walletAddress: string, amount: number = 999): void {
    // Simulate full conversion funnel
    this.trackEvent({
      campaignId,
      walletAddress,
      eventType: 'contact_attempted',
      channel: 'on_chain_memo',
      metadata: { messageId: nanoid() }
    });

    this.trackEvent({
      campaignId,
      walletAddress,
      eventType: 'message_delivered',
      channel: 'on_chain_memo',
      metadata: { messageId: nanoid() }
    });

    this.trackEvent({
      campaignId,
      walletAddress,
      eventType: 'report_viewed',
      channel: 'on_chain_memo',
      metadata: { reportId: nanoid() }
    });

    this.trackEvent({
      campaignId,
      walletAddress,
      eventType: 'response_received',
      channel: 'on_chain_memo',
      metadata: { responseContent: 'Interested in SDK integration. Let\'s discuss.' }
    });

    this.trackEvent({
      campaignId,
      walletAddress,
      eventType: 'payment_received',
      channel: 'on_chain_memo',
      metadata: { amount, currency: 'USDC', invoiceId: nanoid() }
    });

    console.log(`🧪 SIMULATED CONVERSION: ${walletAddress} -> $${amount} USDC`);
  }
}

export const outreachAnalytics = new OutreachAnalytics();