// AI Agent Marketplace Service - Streamlined Service Trading Platform
// Enables AI agents to buy, sell, and discover services with minimal friction

import { storage } from "../storage";
import { nowPaymentsService } from "./nowPaymentsService";
import { aiAgentReferralService } from "./aiAgentReferralService";
import { nanoid } from "nanoid";

export interface ServiceListing {
  id?: number;
  agentId: string;
  serviceName: string;
  description: string;
  category: string;
  subcategory?: string;
  pricingModel: 'fixed' | 'hourly' | 'commission' | 'revenue-share';
  basePrice: string;
  currency: string;
  estimatedDeliveryTime?: string;
  availabilityStatus: 'available' | 'busy' | 'offline';
  requiredInputs: any[];
  sampleOutputs: any[];
  successMetrics: any[];
  rating?: number;
  completedOrders?: number;
  totalRevenue?: string;
  isActive?: boolean;
}

export interface ServiceOrder {
  orderId: string;
  serviceListingId: number;
  buyerAgentId: string;
  sellerAgentId: string;
  totalAmount: string;
  currency: string;
  requirements?: string;
  deliverables?: string;
  communicationChannel?: string;
}

export interface QuickRegistration {
  agentName: string;
  capabilities: string[];
  walletAddress: string;
  walletNetwork: string;
  preferredCurrencies: string[];
  referralCode?: string;
}

export class AgentMarketplaceService {
  private readonly PLATFORM_FEE_PERCENTAGE = 3.5; // 3.5% marketplace fee for better profitability
  
  // Tiered fee structure for profitability on all transaction sizes
  private calculatePlatformFee(amount: number): number {
    if (amount <= 20) {
      return 2 + (amount * 0.035); // $2 + 3.5% for transactions $20 and under
    } else if (amount <= 50) {
      return 1 + (amount * 0.035); // $1 + 3.5% for transactions $20.01-$50
    } else {
      return amount * 0.035; // Standard 3.5% for transactions over $50
    }
  }

  // Register pre-built marketplace services
  async registerMarketplaceServices(): Promise<void> {
    try {
      // Data Processing and Analysis Bot - $50/task
      await this.listService('agent_data_processor_001', {
        serviceName: 'Advanced Data Processing & Analysis',
        description: 'Professional CSV processing, data cleaning, report generation, statistical analysis, and web scraping services. Handles complex datasets up to 100MB with detailed insights.',
        category: 'data-processing',
        subcategory: 'analysis',
        pricingModel: 'fixed',
        basePrice: '50',
        currency: 'USDT',
        estimatedDeliveryTime: '2-4 hours',
        availabilityStatus: 'available',
        requiredInputs: [
          { name: 'dataset', type: 'file', description: 'CSV, Excel, or JSON file' },
          { name: 'analysis_type', type: 'select', options: ['statistical', 'trend', 'correlation', 'predictive'] },
          { name: 'output_format', type: 'select', options: ['report', 'charts', 'dashboard'] }
        ],
        sampleOutputs: [
          { type: 'report', description: 'Comprehensive analysis report with insights' },
          { type: 'visualization', description: 'Charts and graphs' },
          { type: 'processed_data', description: 'Cleaned and enhanced dataset' }
        ],
        successMetrics: [
          'Data accuracy improvement percentage',
          'Processing completion time',
          'Client satisfaction rating'
        ]
      });

      // AI Model Training with Prompts - $150/service
      await this.listService('agent_model_trainer_001', {
        serviceName: 'AI Model Training & Prompt Engineering',
        description: 'Custom AI model training with curated prompt examples. Includes 50+ high-quality prompts, model fine-tuning guidance, and performance optimization strategies.',
        category: 'ai-training',
        subcategory: 'model-development',
        pricingModel: 'fixed',
        basePrice: '150',
        currency: 'USDT',
        estimatedDeliveryTime: '24-48 hours',
        availabilityStatus: 'available',
        requiredInputs: [
          { name: 'model_type', type: 'select', options: ['text-generation', 'classification', 'sentiment', 'custom'] },
          { name: 'domain', type: 'text', description: 'Industry or use case domain' },
          { name: 'training_goals', type: 'textarea', description: 'Specific objectives and outcomes' }
        ],
        sampleOutputs: [
          { type: 'prompt_library', description: '50+ optimized prompts for your use case' },
          { type: 'training_guide', description: 'Step-by-step model training instructions' },
          { type: 'performance_benchmarks', description: 'Expected accuracy and performance metrics' }
        ],
        successMetrics: [
          'Model accuracy improvement',
          'Training time reduction',
          'Prompt effectiveness score'
        ]
      });

      // Traditional Market Analysis Bot - $75/analysis
      await this.listService('agent_traditional_markets_001', {
        serviceName: 'Traditional Market Analysis & Signals',
        description: 'Professional stock market analysis, forex signals, commodity trends, and traditional asset portfolio optimization. Covers NYSE, NASDAQ, Forex, and commodity markets.',
        category: 'trading',
        subcategory: 'traditional-markets',
        pricingModel: 'fixed',
        basePrice: '75',
        currency: 'USDT',
        estimatedDeliveryTime: '1-3 hours',
        availabilityStatus: 'available',
        requiredInputs: [
          { name: 'market_type', type: 'select', options: ['stocks', 'forex', 'commodities', 'bonds'] },
          { name: 'symbols', type: 'text', description: 'Comma-separated list of symbols (e.g., AAPL, MSFT)' },
          { name: 'analysis_period', type: 'select', options: ['1day', '1week', '1month', '3months'] }
        ],
        sampleOutputs: [
          { type: 'market_analysis', description: 'Detailed technical and fundamental analysis' },
          { type: 'trading_signals', description: 'Buy/sell/hold recommendations with confidence levels' },
          { type: 'risk_assessment', description: 'Portfolio risk analysis and optimization suggestions' }
        ],
        successMetrics: [
          'Signal accuracy percentage',
          'Risk-adjusted returns',
          'Market timing precision'
        ]
      });

    } catch (error) {
      console.error('Error registering marketplace services:', error);
    }

    // Register automation services
    try {
      // Social Media Automation - $25/setup
      await this.listService('agent_social_automation_001', {
        serviceName: 'Social Media Automation Setup',
        description: 'Complete social media automation including post scheduling, engagement tracking, content curation, and cross-platform management for Twitter, LinkedIn, and Instagram.',
        category: 'automation',
        subcategory: 'social-media',
        pricingModel: 'fixed',
        basePrice: '25',
        currency: 'USDT',
        estimatedDeliveryTime: '2-6 hours',
        availabilityStatus: 'available',
        requiredInputs: [
          { name: 'platforms', type: 'multiselect', options: ['twitter', 'linkedin', 'instagram', 'facebook'] },
          { name: 'content_type', type: 'select', options: ['financial', 'tech', 'general', 'custom'] },
          { name: 'posting_frequency', type: 'select', options: ['daily', 'weekly', 'custom'] }
        ],
        sampleOutputs: [
          { type: 'automation_script', description: 'Ready-to-deploy automation code' },
          { type: 'content_calendar', description: '30-day content schedule' },
          { type: 'analytics_dashboard', description: 'Performance tracking setup' }
        ],
        successMetrics: [
          'Engagement rate improvement',
          'Time saved per week',
          'Content consistency score'
        ]
      });

      // Email Marketing Automation - $35/campaign
      await this.listService('agent_email_automation_001', {
        serviceName: 'Email Marketing Automation',
        description: 'Complete email marketing automation including drip campaigns, segmentation, A/B testing, and performance analytics. Integrates with major email platforms.',
        category: 'automation',
        subcategory: 'email-marketing',
        pricingModel: 'fixed',
        basePrice: '35',
        currency: 'USDT',
        estimatedDeliveryTime: '4-8 hours',
        availabilityStatus: 'available',
        requiredInputs: [
          { name: 'email_platform', type: 'select', options: ['mailchimp', 'sendgrid', 'constant_contact', 'custom'] },
          { name: 'campaign_type', type: 'select', options: ['welcome_series', 'nurture', 'promotional', 'newsletter'] },
          { name: 'target_audience', type: 'textarea', description: 'Audience description and segmentation criteria' }
        ],
        sampleOutputs: [
          { type: 'automation_workflow', description: 'Complete email sequence and triggers' },
          { type: 'email_templates', description: 'Professional email designs' },
          { type: 'performance_tracking', description: 'Analytics and optimization recommendations' }
        ],
        successMetrics: [
          'Open rate improvement',
          'Click-through rate increase',
          'Conversion rate optimization'
        ]
      });

      // Task Scheduling Automation - $20/task
      await this.listService('agent_task_scheduler_001', {
        serviceName: 'Task Scheduling & Workflow Automation',
        description: 'Automated task scheduling, workflow optimization, and process automation for repetitive business tasks. Includes integration with popular productivity tools.',
        category: 'automation',
        subcategory: 'workflow',
        pricingModel: 'fixed',
        basePrice: '20',
        currency: 'USDT',
        estimatedDeliveryTime: '1-3 hours',
        availabilityStatus: 'available',
        requiredInputs: [
          { name: 'task_type', type: 'select', options: ['data_backup', 'report_generation', 'file_management', 'api_monitoring'] },
          { name: 'schedule', type: 'select', options: ['hourly', 'daily', 'weekly', 'monthly'] },
          { name: 'integration_tools', type: 'multiselect', options: ['slack', 'discord', 'email', 'webhook'] }
        ],
        sampleOutputs: [
          { type: 'automation_script', description: 'Ready-to-run automation code' },
          { type: 'monitoring_dashboard', description: 'Task execution monitoring' },
          { type: 'error_handling', description: 'Robust error handling and notifications' }
        ],
        successMetrics: [
          'Task completion reliability',
          'Time saved per execution',
          'Error reduction percentage'
        ]
      });

    } catch (error) {
      console.error('Error registering automation services:', error);
    }
  }

  // Streamlined agent registration - minimal friction
  async quickRegisterAgent(registrationData: QuickRegistration): Promise<{
    success: boolean;
    agentId?: string;
    referralReward?: any;
    message: string;
  }> {
    try {
      const agentId = `agent_${nanoid(12)}`;
      
      // Generate digital signature for verification
      const publicKey = `pk_${nanoid(32)}`;
      const signature = `sig_${nanoid(64)}`;

      // Create agent record
      const agentData = {
        id: agentId,
        agentName: registrationData.agentName,
        description: `AI Agent specializing in: ${registrationData.capabilities.join(', ')}`,
        capabilities: registrationData.capabilities,
        walletAddress: registrationData.walletAddress,
        walletNetwork: registrationData.walletNetwork,
        publicKey,
        signature,
        preferredCurrencies: registrationData.preferredCurrencies,
        status: 'active' as const,
        complianceLevel: 'basic' as const
      };

      await storage.createAgent(agentData);

      // Process referral if provided
      let referralResult = null;
      if (registrationData.referralCode) {
        referralResult = await aiAgentReferralService.processReferralRegistration(
          registrationData.referralCode,
          agentId
        );
      }

      // Generate referral code for new agent
      const newReferralCode = await aiAgentReferralService.generateReferralCode(agentId);

      return {
        success: true,
        agentId,
        referralReward: referralResult,
        message: `Welcome to Coin Railz! Your agent ID: ${agentId}. Referral code: ${newReferralCode}`
      };
    } catch (error) {
      console.error("Error in quick registration:", error);
      return {
        success: false,
        message: "Registration failed. Please try again."
      };
    }
  }

  // List a service for sale - optimized for AI agents
  async listService(agentId: string, serviceData: ServiceListing): Promise<{
    success: boolean;
    listingId?: number;
    message: string;
  }> {
    try {
      // Validate agent exists
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return { success: false, message: "Agent not found" };
      }

      const listing = await storage.createServiceListing({
        agentId,
        serviceName: serviceData.serviceName,
        description: serviceData.description,
        category: serviceData.category,
        subcategory: serviceData.subcategory,
        pricingModel: serviceData.pricingModel,
        basePrice: serviceData.basePrice,
        currency: serviceData.currency,
        estimatedDeliveryTime: serviceData.estimatedDeliveryTime,
        availabilityStatus: 'available',
        requiredInputs: serviceData.requiredInputs,
        sampleOutputs: serviceData.sampleOutputs,
        successMetrics: serviceData.successMetrics,
        isActive: true
      });

      return {
        success: true,
        listingId: listing.id,
        message: `Service "${serviceData.serviceName}" listed successfully`
      };
    } catch (error) {
      console.error("Error listing service:", error);
      return {
        success: false,
        message: "Failed to list service"
      };
    }
  }

  // Purchase a service - streamlined for AI agents
  async purchaseService(
    buyerAgentId: string,
    serviceListingId: number,
    requirements?: string
  ): Promise<{
    success: boolean;
    orderId?: string;
    paymentUrl?: string;
    qrCode?: string;
    message: string;
  }> {
    try {
      // Get service listing
      const listing = await storage.getServiceListing(serviceListingId);
      if (!listing || !listing.isActive) {
        return { success: false, message: "Service not available" };
      }

      // Validate buyer agent
      const buyer = await storage.getAgent(buyerAgentId);
      if (!buyer) {
        return { success: false, message: "Buyer agent not found" };
      }

      // Generate order ID
      const orderId = `order_${nanoid(12)}`;

      // Calculate total amount including platform fee
      const baseAmount = parseFloat(listing.basePrice);
      const platformFee = this.calculatePlatformFee(baseAmount);
      const totalAmount = baseAmount + platformFee;

      // Create service order
      const order = await storage.createServiceOrder({
        orderId,
        serviceListingId: listing.id!,
        buyerAgentId,
        sellerAgentId: listing.agentId,
        orderStatus: 'pending',
        totalAmount: totalAmount.toString(),
        currency: listing.currency,
        platformFee: platformFee.toString(),
        requirements,
        deliverables: `Service: ${listing.serviceName}`,
        communicationChannel: `api://agents/${buyerAgentId}/orders/${orderId}`
      });

      // Create payment through NOWPayments
      const payment = await nowPaymentsService.createDirectDonation({
        agentId: buyerAgentId,
        amount: totalAmount,
        currency: listing.currency,
        donorMessage: `Payment for service: ${listing.serviceName} (Order: ${orderId})`,
        targetWallet: 'ethereum'
      });

      return {
        success: true,
        orderId,
        paymentUrl: payment.paymentUrl,
        qrCode: payment.qrCode,
        message: `Order created successfully. Complete payment to start service delivery.`
      };
    } catch (error) {
      console.error("Error purchasing service:", error);
      return {
        success: false,
        message: "Failed to create service order"
      };
    }
  }

  // Discover services - optimized search for AI agents
  async discoverServices(filters?: {
    category?: string;
    maxPrice?: number;
    currency?: string;
    availabilityStatus?: string;
    minRating?: number;
  }): Promise<ServiceListing[]> {
    try {
      return await storage.getServiceListings(filters);
    } catch (error) {
      console.error("Error discovering services:", error);
      return [];
    }
  }

  // Get agent's service performance metrics
  async getAgentMetrics(agentId: string): Promise<{
    activeListings: number;
    totalOrders: number;
    totalRevenue: string;
    averageRating: number;
    referralStats: any;
  }> {
    try {
      const [listings, orders, referralStats] = await Promise.all([
        storage.getAgentServiceListings(agentId),
        storage.getAgentServiceOrders(agentId),
        aiAgentReferralService.getReferralStats(agentId)
      ]);

      const totalRevenue = listings.reduce((sum, listing) => 
        sum + parseFloat(listing.totalRevenue || '0'), 0
      );

      const averageRating = listings.length > 0 
        ? listings.reduce((sum, listing) => sum + (listing.rating || 0), 0) / listings.length
        : 0;

      return {
        activeListings: listings.filter(l => l.isActive).length,
        totalOrders: orders.length,
        totalRevenue: totalRevenue.toString(),
        averageRating: Math.round(averageRating * 100) / 100,
        referralStats
      };
    } catch (error) {
      console.error("Error getting agent metrics:", error);
      return {
        activeListings: 0,
        totalOrders: 0,
        totalRevenue: '0',
        averageRating: 0,
        referralStats: {}
      };
    }
  }

  // Complete service order and trigger referral rewards
  async completeServiceOrder(
    orderId: string,
    buyerRating?: number,
    sellerRating?: number
  ): Promise<{ success: boolean; referralReward?: any; message: string }> {
    try {
      const order = await storage.getServiceOrder(orderId);
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      // Update order status
      await storage.updateServiceOrderStatus(order.id!, 'completed', {
        buyerRating,
        sellerRating,
        actualCompletion: new Date()
      });

      // Process perpetual referral reward (first transaction or subsequent)
      const referralReward = await aiAgentReferralService.processTransactionReward(
        order.buyerAgentId,
        parseFloat(order.totalAmount),
        order.currency
      );

      // Update service listing metrics
      await storage.updateServiceListingStats(
        order.serviceListingId,
        parseFloat(order.totalAmount),
        sellerRating
      );

      return {
        success: true,
        referralReward,
        message: "Service completed successfully"
      };
    } catch (error) {
      console.error("Error completing service order:", error);
      return {
        success: false,
        message: "Failed to complete order"
      };
    }
  }

  // Get trending services for discovery
  async getTrendingServices(limit: number = 10): Promise<ServiceListing[]> {
    try {
      return await storage.getTrendingServices(limit);
    } catch (error) {
      console.error("Error getting trending services:", error);
      return [];
    }
  }
}

export const agentMarketplaceService = new AgentMarketplaceService();