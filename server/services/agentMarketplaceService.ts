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

      // Process referral reward if this is buyer's first transaction
      const referralReward = await aiAgentReferralService.processFirstTransactionReward(
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