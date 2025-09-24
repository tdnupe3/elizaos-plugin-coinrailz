/**
 * 🔍 PROVIDER CAPABILITY SERVICE
 * ChatGPT Point 4: Query models/endpoints first (avoid "unknown model")
 * 
 * Before first call each run, cache provider capabilities to avoid
 * sending doomed requests with invalid models.
 */

import { ProviderType } from './a2aAPIWrapperService.js';

interface ProviderCapabilities {
  provider: ProviderType;
  models: string[];
  defaultModel: string;
  lastUpdated: string;
  isHealthy: boolean;
}

/**
 * 🧠 PROVIDER CAPABILITY CACHE
 */
export class ProviderCapabilityService {
  private static instance: ProviderCapabilityService;
  private capabilityCache = new Map<ProviderType, ProviderCapabilities>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour cache
  
  public static getInstance(): ProviderCapabilityService {
    if (!ProviderCapabilityService.instance) {
      ProviderCapabilityService.instance = new ProviderCapabilityService();
    }
    return ProviderCapabilityService.instance;
  }

  /**
   * 🔍 Get valid model for provider (with fallback to safe defaults)
   */
  async getValidModel(provider: ProviderType, requestedModel?: string): Promise<string> {
    const capabilities = await this.getCapabilities(provider);
    
    if (!capabilities?.isHealthy) {
      return this.getSafeDefaultModel(provider);
    }

    // If specific model requested and available, use it
    if (requestedModel && capabilities.models.includes(requestedModel)) {
      return requestedModel;
    }

    // Otherwise use provider's safe default
    return capabilities.defaultModel;
  }

  /**
   * 🏥 Check if provider is healthy and has valid models
   */
  async isProviderHealthy(provider: ProviderType): Promise<boolean> {
    const capabilities = await this.getCapabilities(provider);
    return capabilities?.isHealthy ?? false;
  }

  /**
   * 📋 Get all capabilities for a provider
   */
  async getCapabilities(provider: ProviderType): Promise<ProviderCapabilities | null> {
    const cached = this.capabilityCache.get(provider);
    
    // Return cached if still fresh
    if (cached && this.isCacheFresh(cached)) {
      return cached;
    }

    // Refresh capabilities
    return await this.refreshCapabilities(provider);
  }

  /**
   * 🔄 Refresh provider capabilities by querying their API
   */
  private async refreshCapabilities(provider: ProviderType): Promise<ProviderCapabilities | null> {
    console.log(`🔍 Refreshing capabilities for ${provider}...`);

    try {
      let capabilities: ProviderCapabilities;

      switch (provider) {
        case 'openai':
          capabilities = await this.queryOpenAIModels();
          break;
        case 'anthropic':
          capabilities = await this.queryAnthropicModels();
          break;
        case 'cohere':
          capabilities = await this.queryCohereModels();
          break;
        case 'ibm':
          capabilities = await this.queryIBMModels();
          break;
        case 'dexscreener':
          capabilities = await this.queryDexScreenerCapabilities();
          break;
        case 'slack':
          capabilities = await this.querySlackCapabilities();
          break;
        default:
          console.warn(`🚨 Unknown provider: ${provider}`);
          return null;
      }

      this.capabilityCache.set(provider, capabilities);
      console.log(`✅ ${provider} capabilities cached: ${capabilities.models.length} models`);
      return capabilities;

    } catch (error: any) {
      console.error(`❌ Failed to refresh ${provider} capabilities:`, error.message);
      
      // Return unhealthy state with safe defaults
      const safeCapabilities: ProviderCapabilities = {
        provider,
        models: [this.getSafeDefaultModel(provider)],
        defaultModel: this.getSafeDefaultModel(provider),
        lastUpdated: new Date().toISOString(),
        isHealthy: false
      };
      
      this.capabilityCache.set(provider, safeCapabilities);
      return safeCapabilities;
    }
  }

  /**
   * 🤖 Query OpenAI Models API
   */
  private async queryOpenAIModels(): Promise<ProviderCapabilities> {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'User-Agent': 'CoinRailz-A2A-Platform/2.0 (business@coinrailz.com; +https://coinrailz.com/a2a)'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenAI models API failed: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data
      ?.filter((m: any) => m.id.includes('gpt'))
      ?.map((m: any) => m.id) || ['gpt-4o-mini'];

    return {
      provider: 'openai',
      models,
      defaultModel: models.includes('gpt-4o-mini') ? 'gpt-4o-mini' : models[0] || 'gpt-4o-mini',
      lastUpdated: new Date().toISOString(),
      isHealthy: true
    };
  }

  /**
   * 🧠 Query Anthropic Models API
   */
  private async queryAnthropicModels(): Promise<ProviderCapabilities> {
    // Anthropic models are well-known, use safe defaults
    const models = [
      'claude-3-haiku-20240307',
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229'
    ];

    return {
      provider: 'anthropic',
      models,
      defaultModel: 'claude-3-haiku-20240307', // Cheapest option
      lastUpdated: new Date().toISOString(),
      isHealthy: true
    };
  }

  /**
   * 🔗 Query Cohere Models API
   */
  private async queryCohereModels(): Promise<ProviderCapabilities> {
    const models = ['command-r-plus', 'command-r', 'command'];

    return {
      provider: 'cohere',
      models,
      defaultModel: 'command-r', // Balanced option
      lastUpdated: new Date().toISOString(),
      isHealthy: true
    };
  }

  /**
   * 🏢 Query IBM Models
   */
  private async queryIBMModels(): Promise<ProviderCapabilities> {
    const models = [
      'ibm/granite-3-8b-instruct',
      'ibm/granite-13b-chat-v2'
    ];

    return {
      provider: 'ibm',
      models,
      defaultModel: 'ibm/granite-3-8b-instruct',
      lastUpdated: new Date().toISOString(),
      isHealthy: true
    };
  }

  /**
   * 📊 Query DexScreener Capabilities
   */
  private async queryDexScreenerCapabilities(): Promise<ProviderCapabilities> {
    // Test basic connectivity
    const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=ethereum', {
      headers: {
        'User-Agent': 'CoinRailz-A2A-Platform/2.0 (business@coinrailz.com; +https://coinrailz.com/a2a)'
      }
    });

    const isHealthy = response.ok;

    return {
      provider: 'dexscreener',
      models: ['search'], // DexScreener only has search functionality
      defaultModel: 'search',
      lastUpdated: new Date().toISOString(),
      isHealthy
    };
  }

  /**
   * 💬 Query Slack Capabilities
   */
  private async querySlackCapabilities(): Promise<ProviderCapabilities> {
    const models = ['chat.postMessage', 'conversations.list', 'users.list'];

    return {
      provider: 'slack',
      models,
      defaultModel: 'chat.postMessage',
      lastUpdated: new Date().toISOString(),
      isHealthy: !!process.env.SLACK_BOT_TOKEN
    };
  }

  /**
   * 🛡️ Get safe default model when provider is unhealthy
   */
  private getSafeDefaultModel(provider: ProviderType): string {
    const safeDefaults: Record<ProviderType, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku-20240307',
      cohere: 'command-r',
      ibm: 'ibm/granite-3-8b-instruct',
      dexscreener: 'search',
      slack: 'chat.postMessage'
    };

    return safeDefaults[provider];
  }

  /**
   * ⏰ Check if cached capabilities are still fresh
   */
  private isCacheFresh(capabilities: ProviderCapabilities): boolean {
    const age = Date.now() - new Date(capabilities.lastUpdated).getTime();
    return age < this.CACHE_TTL;
  }

  /**
   * 🔄 Warm up all provider capabilities on startup
   */
  async warmupAllProviders(): Promise<void> {
    console.log('🔥 Warming up provider capabilities...');
    
    const providers: ProviderType[] = ['openai', 'anthropic', 'cohere', 'dexscreener', 'ibm', 'slack'];
    
    await Promise.allSettled(
      providers.map(provider => this.refreshCapabilities(provider))
    );

    console.log('🔥 Provider capability warmup complete');
  }
}