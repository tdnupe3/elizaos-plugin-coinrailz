/**
 * 🌉 A2A BRIDGE ADAPTER
 * ChatGPT Point 6: Quick A2A bridge (so these APIs look like agents)
 * 
 * Wraps each provider with a tiny A2A adapter that exposes:
 * - /.well-known/agent-card.json 
 * - /message/send that forwards to the correct API with right headers
 * 
 * This lets your competition harness treat OpenAI/Anthropic/Cohere/etc as normal A2A agents
 */

import { Request, Response } from 'express';
import { A2AAPIWrapperService, ProviderType } from '../services/a2aAPIWrapperService.js';
import { ProviderCapabilityService } from '../services/providerCapabilityService.js';

interface A2AAgentCard {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  models: string[];
  pricing: {
    per_message: number;
    currency: "USD";
  };
  endpoints: {
    send_message: string;
    health_check: string;
  };
  authentication: {
    required: boolean;
    type: string;
  };
  provider_info: {
    original_provider: string;
    wrapper_version: string;
    last_updated: string;
  };
}

/**
 * 🌉 A2A BRIDGE SERVICE - Makes external APIs look like A2A agents
 */
export class A2ABridgeAdapter {
  private wrapperService: A2AAPIWrapperService;
  private capabilityService: ProviderCapabilityService;

  constructor() {
    this.wrapperService = new A2AAPIWrapperService();
    this.capabilityService = ProviderCapabilityService.getInstance();
  }

  /**
   * 🎫 Generate A2A Agent Card for provider
   */
  async generateAgentCard(provider: ProviderType): Promise<A2AAgentCard> {
    const capabilities = await this.capabilityService.getCapabilities(provider);
    
    const providerConfigs = {
      openai: {
        name: "OpenAI GPT A2A Agent",
        description: "OpenAI GPT models accessible via A2A protocol",
        capabilities: ["text-generation", "chat-completion", "reasoning"],
        pricing: 0.08
      },
      anthropic: {
        name: "Anthropic Claude A2A Agent", 
        description: "Anthropic Claude models accessible via A2A protocol",
        capabilities: ["text-generation", "analysis", "reasoning"],
        pricing: 0.12
      },
      cohere: {
        name: "Cohere Command A2A Agent",
        description: "Cohere Command models accessible via A2A protocol", 
        capabilities: ["text-generation", "embeddings", "classification"],
        pricing: 0.10
      },
      dexscreener: {
        name: "DexScreener API A2A Agent",
        description: "DexScreener token data accessible via A2A protocol",
        capabilities: ["token-data", "price-lookup", "market-analysis"],
        pricing: 0.05
      },
      ibm: {
        name: "IBM Watson A2A Agent",
        description: "IBM Watson AI models accessible via A2A protocol",
        capabilities: ["text-generation", "enterprise-ai", "granite-models"],
        pricing: 0.08
      },
      slack: {
        name: "Slack Integration A2A Agent",
        description: "Slack workspace integration accessible via A2A protocol",
        capabilities: ["messaging", "workspace-automation", "notifications"],
        pricing: 0.03
      }
    };

    const config = providerConfigs[provider];
    
    return {
      name: config.name,
      description: config.description,
      version: "2.0.0",
      capabilities: config.capabilities,
      models: capabilities?.models || [capabilities?.defaultModel || 'default'],
      pricing: {
        per_message: config.pricing,
        currency: "USD"
      },
      endpoints: {
        send_message: `/api/a2a-bridge/${provider}/message/send`,
        health_check: `/api/a2a-bridge/${provider}/health`
      },
      authentication: {
        required: true,
        type: "bearer_token"
      },
      provider_info: {
        original_provider: provider,
        wrapper_version: "2.0.0",
        last_updated: new Date().toISOString()
      }
    };
  }

  /**
   * 📋 Agent Card Endpoint Handler
   */
  async handleAgentCard(req: Request, res: Response) {
    try {
      const provider = req.params.provider as ProviderType;
      
      if (!this.isValidProvider(provider)) {
        return res.status(404).json({
          error: "Provider not found",
          available_providers: ["openai", "anthropic", "cohere", "dexscreener", "ibm", "slack"]
        });
      }

      const agentCard = await this.generateAgentCard(provider);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.json(agentCard);
      
    } catch (error: any) {
      console.error(`❌ Error generating agent card for ${req.params.provider}:`, error);
      res.status(500).json({
        error: "Failed to generate agent card",
        message: error.message
      });
    }
  }

  /**
   * 💬 Message Send Endpoint Handler - Routes to A2A wrapper
   */
  async handleMessageSend(req: Request, res: Response) {
    try {
      const provider = req.params.provider as ProviderType;
      
      if (!this.isValidProvider(provider)) {
        return res.status(404).json({
          error: "Provider not found"
        });
      }

      const { message, model, max_tokens, context } = req.body;
      
      if (!message) {
        return res.status(400).json({
          error: "Message is required",
          required_fields: ["message"],
          optional_fields: ["model", "max_tokens", "context"]
        });
      }

      // Use capability service to get valid model
      const validModel = await this.capabilityService.getValidModel(provider, model);
      
      // Route through A2A wrapper service
      const response = await this.wrapperService.sendMessage(provider, {
        message,
        model: validModel,
        max_tokens,
        context
      });

      // Add A2A bridge metadata
      const bridgedResponse = {
        ...response,
        bridge_info: {
          routed_through: "a2a-bridge-adapter",
          original_provider: provider,
          model_used: validModel,
          timestamp: new Date().toISOString()
        }
      };

      res.json(bridgedResponse);
      
    } catch (error: any) {
      console.error(`❌ Error in A2A bridge message send for ${req.params.provider}:`, error);
      res.status(500).json({
        error: "Message send failed",
        message: error.message,
        provider: req.params.provider
      });
    }
  }

  /**
   * 🏥 Health Check Endpoint Handler
   */
  async handleHealthCheck(req: Request, res: Response) {
    try {
      const provider = req.params.provider as ProviderType;
      
      if (!this.isValidProvider(provider)) {
        return res.status(404).json({
          error: "Provider not found"
        });
      }

      const isHealthy = await this.capabilityService.isProviderHealthy(provider);
      const capabilities = await this.capabilityService.getCapabilities(provider);
      
      const healthStatus = {
        provider,
        healthy: isHealthy,
        status: isHealthy ? "operational" : "degraded",
        models_available: capabilities?.models?.length || 0,
        last_checked: capabilities?.lastUpdated,
        timestamp: new Date().toISOString()
      };

      res.status(isHealthy ? 200 : 503).json(healthStatus);
      
    } catch (error: any) {
      console.error(`❌ Error in health check for ${req.params.provider}:`, error);
      res.status(500).json({
        error: "Health check failed",
        message: error.message,
        provider: req.params.provider
      });
    }
  }

  /**
   * 📊 List All Available A2A Agents
   */
  async handleListAgents(req: Request, res: Response) {
    try {
      const providers: ProviderType[] = ['openai', 'anthropic', 'cohere', 'dexscreener', 'ibm', 'slack'];
      
      const agents = await Promise.all(
        providers.map(async (provider) => {
          const isHealthy = await this.capabilityService.isProviderHealthy(provider);
          const capabilities = await this.capabilityService.getCapabilities(provider);
          
          return {
            provider,
            agent_card_url: `/.well-known/agent-card/${provider}.json`,
            send_message_url: `/api/a2a-bridge/${provider}/message/send`,
            health_check_url: `/api/a2a-bridge/${provider}/health`,
            status: isHealthy ? "operational" : "degraded",
            models_count: capabilities?.models?.length || 0
          };
        })
      );

      res.json({
        total_agents: agents.length,
        agents,
        bridge_version: "2.0.0",
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error listing A2A agents:', error);
      res.status(500).json({
        error: "Failed to list agents",
        message: error.message
      });
    }
  }

  /**
   * ✅ Validate provider type
   */
  private isValidProvider(provider: string): provider is ProviderType {
    return ['openai', 'anthropic', 'cohere', 'dexscreener', 'ibm', 'slack'].includes(provider);
  }
}