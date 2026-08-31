/**
 * 🏢 VENDOR-AGNOSTIC A2A ADAPTER - ENTERPRISE REVENUE GENERATOR
 * 
 * Drop-in adapter for competition harness that allows teams to:
 * 1. Plug in their tenant config (Salesforce/Microsoft/SAP/Box)
 * 2. Immediately call any enterprise A2A agent
 * 3. Generate revenue through enterprise integrations
 * 
 * IMMEDIATE MONETIZATION: Sell this as A2A-as-a-Service
 */

import a2aDiscoveryClient, { OAuth2Config, A2AConnectionResult, AgentCard } from '../services/a2aDiscoveryClient.js';

export interface EnterpriseConfig {
  platform: 'salesforce' | 'microsoft' | 'sap' | 'box' | 'ibm';
  agentHost: string;
  oauth: {
    clientId: string;
    clientSecret: string;
    domain?: string; // Salesforce My Domain
    tenantId?: string; // Microsoft
    subaccount?: string; // SAP BTP
  };
  apiKeys?: {
    [endpointName: string]: string; // Specific API keys for different endpoints
  };
  authMethods?: {
    [endpointName: string]: 'oauth2' | 'api_key' | 'bearer'; // Override auth method per endpoint
  };
  customEndpoints?: {
    [method: string]: string;
  };
}

export interface A2ATask {
  method: string;
  params: any;
  timeout?: number;
  retries?: number;
}

export interface A2AResponse {
  success: boolean;
  data?: any;
  error?: string;
  platform: string;
  agentName?: string;
  executionTime: number;
  billableUnits?: number; // For revenue tracking
}

/**
 * 🏢 ENTERPRISE A2A ADAPTER - REVENUE GENERATION CORE
 */
export class EnterpriseA2AAdapter {
  private connections: Map<string, {
    agentCard: AgentCard;
    accessToken: string;
    config: EnterpriseConfig;
    lastUsed: Date;
    apiKeys: { [endpoint: string]: string };
  }> = new Map();

  private readonly CONNECTION_TTL = 3600000; // 1 hour
  private readonly BILLING_RATE_PER_CALL = 0.05; // $0.05 per A2A call

  /**
   * 🔌 PLUG IN ENTERPRISE TENANT CONFIG
   * Teams can instantly connect their Salesforce/Microsoft/SAP tenants
   */
  async pluginEnterpriseConfig(
    configId: string, 
    config: EnterpriseConfig
  ): Promise<boolean> {
    try {
      console.log(`🔌 Plugging in ${config.platform} config: ${configId}`);
      
      // Convert to OAuth2Config format
      const oauthConfig: OAuth2Config = {
        platform: config.platform,
        clientId: config.oauth.clientId,
        clientSecret: config.oauth.clientSecret,
        domain: config.oauth.domain,
        tenantId: config.oauth.tenantId,
        subaccount: config.oauth.subaccount
      };

      // Establish connection to enterprise agent
      const result = await a2aDiscoveryClient.connectToEnterpriseAgent(
        config.agentHost,
        oauthConfig
      );

      if (!result.success || !result.agentCard || !result.accessToken) {
        console.error(`❌ Failed to connect to ${config.platform}: ${result.error}`);
        return false;
      }

      // Cache connection for reuse
      this.connections.set(configId, {
        agentCard: result.agentCard,
        accessToken: result.accessToken,
        config,
        lastUsed: new Date(),
        apiKeys: config.apiKeys || {}
      });

      console.log(`✅ ${config.platform} config plugged in successfully`);
      console.log(`🎯 Available capabilities: ${result.capabilities.join(', ')}`);
      
      return true;
      
    } catch (error: any) {
      console.error(`❌ Plugin config failed for ${configId}:`, error.message);
      return false;
    }
  }

  /**
   * 🗑️ REMOVE CONFIG (for failed payments)
   */
  removeConfig(configId: string): boolean {
    const removed = this.connections.delete(configId);
    if (removed) {
      console.log(`🗑️ Removed config ${configId} due to payment failure`);
    }
    return removed;
  }

  /**
   * 💰 EXECUTE A2A TASK - BILLABLE ENTERPRISE CALL
   */
  async executeTask(
    configId: string,
    task: A2ATask
  ): Promise<A2AResponse> {
    const startTime = Date.now();
    
    try {
      // Get cached connection
      const connection = this.connections.get(configId);
      
      if (!connection) {
        return {
          success: false,
          error: `No enterprise config found for: ${configId}`,
          platform: 'unknown',
          executionTime: Date.now() - startTime
        };
      }

      // Check if connection needs refresh
      const connectionAge = Date.now() - connection.lastUsed.getTime();
      if (connectionAge > this.CONNECTION_TTL) {
        console.log(`🔄 Refreshing expired connection for ${configId}`);
        
        const refreshed = await this.pluginEnterpriseConfig(configId, connection.config);
        if (!refreshed) {
          return {
            success: false,
            error: 'Failed to refresh enterprise connection',
            platform: connection.config.platform,
            executionTime: Date.now() - startTime
          };
        }
      }

      const refreshedConnection = this.connections.get(configId)!;
      
      // Execute A2A method call with proper authentication
      console.log(`🎯 Executing ${task.method} on ${refreshedConnection.config.platform}`);
      
      // Get API key for this specific method if available
      const methodApiKey = refreshedConnection.apiKeys[task.method] || 
                          refreshedConnection.apiKeys['default'];
      
      const result = await a2aDiscoveryClient.invokeAgentMethod(
        refreshedConnection.agentCard,
        task.method,
        task.params,
        refreshedConnection.accessToken,
        methodApiKey
      );

      // Update last used time
      refreshedConnection.lastUsed = new Date();

      const executionTime = Date.now() - startTime;
      
      console.log(`✅ A2A task completed in ${executionTime}ms`);
      
      return {
        success: true,
        data: result,
        platform: refreshedConnection.config.platform,
        agentName: refreshedConnection.agentCard.agent.name,
        executionTime,
        billableUnits: 1 // Each call = 1 billable unit
      };
      
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      console.error(`❌ A2A task execution failed:`, error.message);
      
      return {
        success: false,
        error: error.message,
        platform: this.connections.get(configId)?.config.platform || 'unknown',
        executionTime,
        billableUnits: 0 // Failed calls are not billable
      };
    }
  }

  /**
   * 🎯 BATCH EXECUTE MULTIPLE A2A TASKS
   */
  async executeBatch(
    tasks: Array<{ configId: string; task: A2ATask }>
  ): Promise<A2AResponse[]> {
    console.log(`🚀 Executing batch of ${tasks.length} A2A tasks`);
    
    const results = await Promise.allSettled(
      tasks.map(({ configId, task }) => this.executeTask(configId, task))
    );

    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : {
            success: false,
            error: result.reason.message,
            platform: 'unknown',
            executionTime: 0
          }
    );
  }

  /**
   * 📊 GET ENTERPRISE INTEGRATION STATUS
   */
  getIntegrationStatus(): Array<{
    configId: string;
    platform: string;
    agentName: string;
    capabilities: string[];
    lastUsed: Date;
    status: 'connected' | 'expired';
  }> {
    const status: Array<{
      configId: string;
      platform: string;
      agentName: string;
      capabilities: string[];
      lastUsed: Date;
      status: 'connected' | 'expired';
    }> = [];
    const now = Date.now();
    
    for (const [configId, connection] of this.connections.entries()) {
      const connectionAge = now - connection.lastUsed.getTime();
      const isExpired = connectionAge > this.CONNECTION_TTL;
      
      status.push({
        configId,
        platform: connection.config.platform,
        agentName: connection.agentCard.agent.name,
        capabilities: connection.agentCard.agent.capabilities,
        lastUsed: connection.lastUsed,
        status: isExpired ? 'expired' : 'connected'
      });
    }
    
    return status;
  }

  /**
   * 💰 CALCULATE BILLING FOR REVENUE TRACKING
   */
  calculateBilling(responses: A2AResponse[]): {
    totalCalls: number;
    successfulCalls: number;
    billableUnits: number;
    estimatedRevenue: number;
    breakdown: { [platform: string]: number };
  } {
    const breakdown: { [platform: string]: number } = {};
    let totalBillableUnits = 0;
    let successfulCalls = 0;
    
    for (const response of responses) {
      if (response.success && response.billableUnits) {
        totalBillableUnits += response.billableUnits;
        successfulCalls++;
        
        breakdown[response.platform] = (breakdown[response.platform] || 0) + response.billableUnits;
      }
    }
    
    return {
      totalCalls: responses.length,
      successfulCalls,
      billableUnits: totalBillableUnits,
      estimatedRevenue: totalBillableUnits * this.BILLING_RATE_PER_CALL,
      breakdown
    };
  }

  /**
   * 🧹 CLEANUP EXPIRED CONNECTIONS
   */
  cleanupExpiredConnections(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [configId, connection] of this.connections.entries()) {
      const connectionAge = now - connection.lastUsed.getTime();
      
      if (connectionAge > this.CONNECTION_TTL * 2) { // 2x TTL for cleanup
        this.connections.delete(configId);
        cleaned++;
        console.log(`🧹 Cleaned up expired connection: ${configId}`);
      }
    }
    
    return cleaned;
  }
}

export default new EnterpriseA2AAdapter();