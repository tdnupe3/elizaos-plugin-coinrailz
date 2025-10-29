/**
 * Service Delivery Framework
 * 
 * Universal service delivery system that routes orders to appropriate service handlers
 * based on agent type. Extensible architecture for adding new agent services.
 */

import { storage } from '../storage';

export interface ServiceDeliveryRequest {
  orderId: string;
  agentId: string;
  serviceType: string;
  customerId: string;
  amount: number;
  metadata: Record<string, any>;
  
  // Service-specific data
  contractCode?: string;
  contractName?: string;
  paymentDetails?: any;
  complianceRequirements?: any;
}

export interface ServiceDeliveryResult {
  success: boolean;
  orderId: string;
  agentId: string;
  deliveryData: any;
  status: 'completed' | 'failed' | 'processing';
  error?: string;
  metadata?: Record<string, any>;
}

export interface ServiceHandler {
  canHandle(request: ServiceDeliveryRequest): boolean;
  execute(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult>;
}

class ServiceDeliveryFramework {
  private handlers: Map<string, ServiceHandler> = new Map();

  /**
   * Register a service handler for a specific agent type
   */
  registerHandler(agentId: string, handler: ServiceHandler): void {
    this.handlers.set(agentId, handler);
    console.log(`✅ Registered service handler for agent: ${agentId}`);
  }

  /**
   * Execute service delivery for an order
   */
  async executeService(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    try {
      console.log(`🚀 Service delivery initiated for agent: ${request.agentId}, order: ${request.orderId}`);

      // Find appropriate handler
      const handler = this.handlers.get(request.agentId);
      
      if (!handler) {
        console.warn(`⚠️ No handler registered for agent: ${request.agentId}`);
        return {
          success: false,
          orderId: request.orderId,
          agentId: request.agentId,
          deliveryData: null,
          status: 'failed',
          error: `No service handler available for agent: ${request.agentId}`,
        };
      }

      // Verify handler can process this request
      if (!handler.canHandle(request)) {
        console.warn(`⚠️ Handler cannot process request for agent: ${request.agentId}`);
        return {
          success: false,
          orderId: request.orderId,
          agentId: request.agentId,
          deliveryData: null,
          status: 'failed',
          error: 'Handler cannot process this service request',
        };
      }

      // Execute service
      console.log(`⚙️ Executing service handler for ${request.agentId}...`);
      const result = await handler.execute(request);

      // Update order status based on result
      if (result.success) {
        await storage.updateMarketplaceOrder(request.orderId, {
          status: result.status,
          customerRequirements: JSON.stringify({ deliveryResult: result.deliveryData }),
        });
        console.log(`✅ Service delivery completed for order: ${request.orderId}`);
      } else {
        await storage.updateOrderStatus(request.orderId, 'failed');
        console.error(`❌ Service delivery failed for order: ${request.orderId}`, result.error);
      }

      return result;

    } catch (error: any) {
      console.error(`❌ Service delivery framework error:`, error);
      
      // Update order as failed
      await storage.updateOrderStatus(request.orderId, 'failed');

      return {
        success: false,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: null,
        status: 'failed',
        error: error.message || 'Service delivery failed',
      };
    }
  }

  /**
   * Check if a handler exists for an agent
   */
  hasHandler(agentId: string): boolean {
    return this.handlers.has(agentId);
  }

  /**
   * Get list of all registered agents
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Export singleton instance
export const serviceDeliveryFramework = new ServiceDeliveryFramework();

// Export types
export type { ServiceHandler };
