/**
 * Service Delivery Framework - PRODUCTION READY ✅
 * 
 * Universal service delivery system with:
 * - Service handler registry
 * - Rate limiting per agent type
 * - Performance monitoring
 * - Comprehensive error handling
 * - Execution metrics
 */

import { storage } from '../storage';

export interface ServiceDeliveryRequest {
  orderId: string;
  agentId: string;
  serviceType: string;
  customerId?: string;
  amount?: number;
  metadata: Record<string, any>;
  
  // Service-specific data
  contractCode?: string;
  contractName?: string;
  contractDetails?: any;
  paymentDetails?: any;
  complianceRequirements?: any;
  amlScreeningDetails?: any;
  
  // AI-powered service fields
  walletAddress?: string;
  chains?: string[];
  tokenAddress?: string;
  chain?: string;
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

interface ServiceMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class ServiceDeliveryFramework {
  private handlers: Map<string, ServiceHandler> = new Map();
  private metrics: Map<string, ServiceMetrics> = new Map();
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  
  // Rate limiting configuration (per agent type)
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 50; // 50 requests per minute per agent

  /**
   * Register a service handler for a specific agent type
   */
  registerHandler(agentId: string, handler: ServiceHandler): void {
    this.handlers.set(agentId, handler);
    
    // Initialize metrics for this agent
    this.metrics.set(agentId, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      lastExecutionTime: 0,
    });
    
    console.log(`✅ Registered service handler for agent: ${agentId}`);
  }

  /**
   * Execute service delivery for an order with rate limiting and monitoring
   */
  async executeService(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Service delivery initiated for agent: ${request.agentId}, order: ${request.orderId}`);
      console.log(`   Service Type: ${request.serviceType}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);

      // Check rate limit
      if (!this.checkRateLimit(request.agentId)) {
        console.warn(`⚠️ Rate limit exceeded for agent: ${request.agentId}`);
        return {
          success: false,
          orderId: request.orderId,
          agentId: request.agentId,
          deliveryData: null,
          status: 'failed',
          error: 'Rate limit exceeded - too many service requests',
        };
      }

      // Find appropriate handler
      const handler = this.handlers.get(request.agentId);
      
      if (!handler) {
        console.warn(`⚠️ No handler registered for agent: ${request.agentId}`);
        this.recordMetrics(request.agentId, false, Date.now() - startTime);
        
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
        this.recordMetrics(request.agentId, false, Date.now() - startTime);
        
        return {
          success: false,
          orderId: request.orderId,
          agentId: request.agentId,
          deliveryData: null,
          status: 'failed',
          error: 'Handler cannot process this service request',
        };
      }

      // Execute service with timeout protection
      console.log(`⚙️ Executing service handler for ${request.agentId}...`);
      const executionPromise = handler.execute(request);
      const timeoutPromise = new Promise<ServiceDeliveryResult>((_, reject) => {
        setTimeout(() => reject(new Error('Service execution timeout (5 minutes)')), 300000);
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Record metrics
      this.recordMetrics(request.agentId, result.success, executionTime);

      // Update order status based on result
      if (result.success) {
        await storage.updateMarketplaceOrder(request.orderId, {
          status: result.status,
          customerRequirements: JSON.stringify({ deliveryResult: result.deliveryData }),
        });
        console.log(`✅ Service delivery completed for order: ${request.orderId}`);
        console.log(`   Execution Time: ${executionTime}ms`);
      } else {
        await storage.updateOrderStatus(request.orderId, 'failed');
        console.error(`❌ Service delivery failed for order: ${request.orderId}`);
        console.error(`   Error: ${result.error}`);
        console.error(`   Execution Time: ${executionTime}ms`);
      }

      return result;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Service delivery framework error:`, error);
      console.error(`   Execution Time: ${executionTime}ms`);
      
      // Record failed metrics
      this.recordMetrics(request.agentId, false, executionTime);
      
      // Update order as failed
      try {
        await storage.updateOrderStatus(request.orderId, 'failed');
      } catch (updateError) {
        console.error('Failed to update order status:', updateError);
      }

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
   * Check rate limit for agent
   */
  private checkRateLimit(agentId: string): boolean {
    const now = Date.now();
    const rateLimitKey = `${agentId}`;
    const entry = this.rateLimits.get(rateLimitKey);

    if (!entry) {
      // First request in this window
      this.rateLimits.set(rateLimitKey, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Check if window has expired
    if (now - entry.windowStart > this.RATE_LIMIT_WINDOW_MS) {
      // Reset window
      this.rateLimits.set(rateLimitKey, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Check if limit exceeded
    if (entry.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`⚠️ Rate limit exceeded: ${agentId} (${entry.count}/${this.RATE_LIMIT_MAX_REQUESTS})`);
      return false;
    }

    // Increment counter
    entry.count++;
    return true;
  }

  /**
   * Record execution metrics
   */
  private recordMetrics(agentId: string, success: boolean, executionTime: number): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;

    metrics.totalExecutions++;
    metrics.lastExecutionTime = executionTime;
    
    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }

    // Update average execution time
    const totalTime = metrics.averageExecutionTime * (metrics.totalExecutions - 1) + executionTime;
    metrics.averageExecutionTime = totalTime / metrics.totalExecutions;

    // Log metrics periodically (every 10 executions)
    if (metrics.totalExecutions % 10 === 0) {
      console.log(`📊 Metrics for ${agentId}:`);
      console.log(`   Total: ${metrics.totalExecutions}`);
      console.log(`   Success Rate: ${((metrics.successfulExecutions / metrics.totalExecutions) * 100).toFixed(1)}%`);
      console.log(`   Avg Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms`);
    }
  }

  /**
   * Get metrics for an agent
   */
  getMetrics(agentId: string): ServiceMetrics | null {
    return this.metrics.get(agentId) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, ServiceMetrics> {
    const allMetrics: Record<string, ServiceMetrics> = {};
    this.metrics.forEach((metrics, agentId) => {
      allMetrics[agentId] = { ...metrics };
    });
    return allMetrics;
  }

  /**
   * Reset metrics for an agent
   */
  resetMetrics(agentId: string): void {
    this.metrics.set(agentId, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      lastExecutionTime: 0,
    });
    console.log(`🔄 Reset metrics for agent: ${agentId}`);
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

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    registeredHandlers: number;
    totalExecutions: number;
    overallSuccessRate: number;
  } {
    const allMetrics = this.getAllMetrics();
    const totalExecutions = Object.values(allMetrics).reduce((sum, m) => sum + m.totalExecutions, 0);
    const totalSuccessful = Object.values(allMetrics).reduce((sum, m) => sum + m.successfulExecutions, 0);
    const successRate = totalExecutions > 0 ? (totalSuccessful / totalExecutions) * 100 : 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (successRate < 50) {
      status = 'unhealthy';
    } else if (successRate < 80) {
      status = 'degraded';
    }

    return {
      status,
      registeredHandlers: this.handlers.size,
      totalExecutions,
      overallSuccessRate: successRate,
    };
  }
}

// Export singleton instance
export const serviceDeliveryFramework = new ServiceDeliveryFramework();
