/**
 * Agent Marketplace Service
 * Handles marketplace operations and service management
 */

import { storage } from '../storage';
import { registerDefaultMarketplaceServices, calculateAgentCommission } from '../utils/agentUtils';
import type { MarketplaceService } from '../utils/agentUtils';

export class AgentMarketplaceService {
  
  /**
   * Initialize marketplace services at startup
   */
  static async initializeMarketplace(): Promise<void> {
    try {
      console.log('Initializing AI Agent Marketplace...');
      await registerDefaultMarketplaceServices();
      console.log('AI Agent Marketplace initialized successfully');
    } catch (error) {
      console.error('Failed to initialize marketplace:', error);
    }
  }

  /**
   * Get all active marketplace services
   */
  static async getMarketplaceServices(): Promise<MarketplaceService[]> {
    try {
      return await storage.getMarketplaceServices();
    } catch (error) {
      console.error('Error fetching marketplace services:', error);
      return [];
    }
  }

  /**
   * Get services by category
   */
  static async getServicesByCategory(category: string): Promise<MarketplaceService[]> {
    try {
      const services = await storage.getMarketplaceServices();
      return services.filter(service => 
        service.category.toLowerCase() === category.toLowerCase() && 
        service.isActive
      );
    } catch (error) {
      console.error('Error fetching services by category:', error);
      return [];
    }
  }

  /**
   * Search services by name or tags
   */
  static async searchServices(query: string): Promise<MarketplaceService[]> {
    try {
      const services = await storage.getMarketplaceServices();
      const searchTerm = query.toLowerCase();
      
      return services.filter(service => 
        service.isActive && (
          service.name.toLowerCase().includes(searchTerm) ||
          service.description.toLowerCase().includes(searchTerm) ||
          service.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))
        )
      );
    } catch (error) {
      console.error('Error searching services:', error);
      return [];
    }
  }

  /**
   * Get service by ID
   */
  static async getServiceById(serviceId: string): Promise<MarketplaceService | null> {
    try {
      return await storage.getMarketplaceService(serviceId);
    } catch (error) {
      console.error('Error fetching service by ID:', error);
      return null;
    }
  }

  /**
   * Purchase a marketplace service
   */
  static async purchaseService(
    serviceId: string, 
    buyerId: string, 
    paymentMethod: string = 'stripe'
  ): Promise<{
    success: boolean;
    orderId?: string;
    platformFee?: number;
    total?: number;
    error?: string;
  }> {
    try {
      const service = await storage.getMarketplaceService(serviceId);
      if (!service) {
        return { success: false, error: 'Service not found' };
      }

      if (!service.isActive) {
        return { success: false, error: 'Service is not available' };
      }

      // Calculate fees (3.5% marketplace fee)
      const platformFee = calculateAgentCommission(service.pricing);
      const total = service.pricing;

      // Create service order
      const order = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        serviceId,
        buyerId,
        sellerId: 'marketplace', // Default marketplace services
        amount: service.pricing,
        platformFee,
        status: 'pending',
        paymentMethod,
        createdAt: new Date()
      };

      await storage.createServiceOrder(order);

      return {
        success: true,
        orderId: order.id,
        platformFee,
        total
      };
    } catch (error) {
      console.error('Error purchasing service:', error);
      return { success: false, error: 'Failed to process purchase' };
    }
  }

  /**
   * Complete service order
   */
  static async completeServiceOrder(orderId: string): Promise<boolean> {
    try {
      await storage.updateServiceOrderStatus(orderId, 'completed');
      return true;
    } catch (error) {
      console.error('Error completing service order:', error);
      return false;
    }
  }

  /**
   * Get user's service purchases
   */
  static async getUserPurchases(userId: string): Promise<any[]> {
    try {
      return await storage.getUserServiceOrders(userId);
    } catch (error) {
      console.error('Error fetching user purchases:', error);
      return [];
    }
  }

  /**
   * Get marketplace statistics
   */
  static async getMarketplaceStats(): Promise<{
    totalServices: number;
    activeServices: number;
    totalCategories: number;
    popularCategories: Array<{ category: string; count: number }>;
  }> {
    try {
      const services = await storage.getMarketplaceServices();
      const activeServices = services.filter(s => s.isActive);
      
      const categories = new Map<string, number>();
      activeServices.forEach(service => {
        const count = categories.get(service.category) || 0;
        categories.set(service.category, count + 1);
      });

      const popularCategories = Array.from(categories.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalServices: services.length,
        activeServices: activeServices.length,
        totalCategories: categories.size,
        popularCategories
      };
    } catch (error) {
      console.error('Error fetching marketplace stats:', error);
      return {
        totalServices: 0,
        activeServices: 0,
        totalCategories: 0,
        popularCategories: []
      };
    }
  }

  /**
   * Register marketplace services at startup
   */
  static async registerMarketplaceServices(): Promise<void> {
    try {
      await this.initializeMarketplace();
    } catch (error) {
      console.error('Error in registerMarketplaceServices:', error);
    }
  }

  /**
   * Quick register agent endpoint
   */
  static async quickRegisterAgent(agentData: any): Promise<any> {
    try {
      return await storage.createBasicAgent({
        id: agentData.id || `agent_${Date.now()}`,
        agentName: agentData.name,
        description: agentData.description,
        capabilities: agentData.capabilities || [],
        walletAddress: agentData.walletAddress,
        walletNetwork: agentData.walletNetwork || 'ethereum',
        publicKey: agentData.publicKey,
        signature: agentData.signature
      });
    } catch (error) {
      console.error('Error quick registering agent:', error);
      throw error;
    }
  }

  /**
   * List service endpoint
   */
  static async listService(serviceData: any): Promise<any> {
    try {
      return await storage.createServiceListing({
        agentId: serviceData.agentId,
        serviceName: serviceData.name,
        description: serviceData.description,
        category: serviceData.category,
        pricingModel: serviceData.pricingModel || 'fixed',
        basePrice: serviceData.price.toString(),
        currency: serviceData.currency || 'USDT'
      });
    } catch (error) {
      console.error('Error listing service:', error);
      throw error;
    }
  }

  /**
   * Discover services endpoint
   */
  static async discoverServices(filters?: any): Promise<any> {
    try {
      return await storage.getServiceListings(filters);
    } catch (error) {
      console.error('Error discovering services:', error);
      return [];
    }
  }

  /**
   * Get agent metrics endpoint
   */
  static async getAgentMetrics(agentId: string): Promise<any> {
    try {
      const agent = await storage.getGlobalAIAgent(agentId);
      const orders = await storage.getAgentServiceOrders(agentId);
      const listings = await storage.getAgentServiceListings(agentId);
      
      return {
        agent,
        totalOrders: orders.length,
        totalListings: listings.length,
        totalRevenue: agent?.totalVolume || '0',
        rating: agent?.reputation || 0
      };
    } catch (error) {
      console.error('Error getting agent metrics:', error);
      return null;
    }
  }
}

// Export for backward compatibility
export const agentMarketplaceService = AgentMarketplaceService;