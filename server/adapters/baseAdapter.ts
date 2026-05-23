/**
 * BASE DISCOVERY ADAPTER
 * 
 * Abstract base class for all discovery adapters.
 * Provides common functionality and interface standardization.
 */

import { DiscoveryAdapter, DiscoveredAgentRaw } from '../services/agentDiscoveryService';

export abstract class BaseDiscoveryAdapter implements DiscoveryAdapter {
  public abstract name: string;
  public abstract expectedYield: number;
  public abstract timeout: number;
  public abstract rateLimit: number;

  protected rateLimitCounter: number = 0;
  protected rateLimitWindow: number = 60000; // 1 minute
  protected lastReset: number = Date.now();

  /**
   * Main discovery method - must be implemented by each adapter
   */
  abstract discover(options?: any): Promise<DiscoveredAgentRaw[]>;

  /**
   * Health check - can be overridden by specific adapters
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Basic health check - can be overridden
      return true;
    } catch (error) {
      console.error(`❌ Health check failed for ${this.name}:`, error);
      return false;
    }
  }

  /**
   * Rate limiting check
   */
  protected checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastReset > this.rateLimitWindow) {
      this.rateLimitCounter = 0;
      this.lastReset = now;
    }

    if (this.rateLimitCounter >= this.rateLimit) {
      console.warn(`⚠️ Rate limit exceeded for ${this.name}`);
      return false;
    }

    this.rateLimitCounter++;
    return true;
  }

  /**
   * Wait for rate limit reset
   */
  protected async waitForRateLimit(): Promise<void> {
    const waitTime = this.rateLimitWindow - (Date.now() - this.lastReset);
    if (waitTime > 0) {
      console.log(`⏳ Waiting ${waitTime}ms for rate limit reset (${this.name})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Validate discovered agent data
   */
  protected validateAgent(agent: DiscoveredAgentRaw): boolean {
    if (!agent.url || !agent.source) {
      return false;
    }

    // URL validation
    try {
      new URL(agent.url);
    } catch {
      return false;
    }

    // Wallet validation (if provided)
    if (agent.wallet && !this.isValidWalletAddress(agent.wallet)) {
      return false;
    }

    return true;
  }

  /**
   * Basic wallet address validation
   */
  protected isValidWalletAddress(address: string): boolean {
    // Ethereum/Base address
    if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return true;
    }
    
    // Solana address (base58, 32-44 chars)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract domain from URL
   */
  protected extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  /**
   * Generate agent ID
   */
  protected generateAgentId(prefix: string, identifier: string): string {
    return `${prefix}_${identifier}_${Date.now()}`;
  }

  /**
   * Sleep utility
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry with exponential backoff
   */
  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`🔄 Retry ${attempt + 1}/${maxRetries} for ${this.name} in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Log discovery progress
   */
  protected logProgress(current: number, total: number, action: string): void {
    const percentage = ((current / total) * 100).toFixed(1);
    console.log(`📊 ${this.name}: ${action} ${current}/${total} (${percentage}%)`);
  }

  /**
   * Safe fetch with timeout and error handling
   */
  protected async safeFetch(
    url: string, 
    options: RequestInit = {},
    timeoutMs: number = 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'CoinRailz-AgentDiscovery/1.0',
          'Accept': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);
      
      // Handle 401 errors gracefully without crashing the system
      if (response.status === 401) {
        console.log(`🔐 API authentication failed for ${url} - skipping with graceful degradation`);
        return response;
      }
      
      // Handle other errors gracefully for better reliability
      if (!response.ok && response.status !== 404 && response.status !== 429) {
        console.log(`⚠️ HTTP ${response.status} for ${url} - continuing with fallback`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle network errors gracefully
      const err = error as Error;
      if (err.name === 'AbortError') {
        console.log(`⏰ Request timeout for ${url}`);
      } else {
        console.log(`🌐 Network error for ${url}: ${err.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Parse JSON safely
   */
  protected async safeJsonParse(response: Response): Promise<any> {
    try {
      const text = await response.text();
      const trimmed = text.trimStart();
      if (trimmed.startsWith('<')) {
        const contentType = response.headers.get('content-type') || 'unknown';
        console.log(`⚠️ ${this.name}: received HTML instead of JSON (content-type: ${contentType}) — falling back`);
        return null;
      }
      return JSON.parse(text);
    } catch (error) {
      console.error(`❌ JSON parse error for ${this.name}:`, error);
      return null;
    }
  }

  /**
   * Normalize agent data
   */
  protected normalizeAgent(rawData: any, source: string): DiscoveredAgentRaw | null {
    try {
      const agent: DiscoveredAgentRaw = {
        url: this.extractAgentUrl(rawData),
        source,
        channels: this.extractChannels(rawData),
        wallet: this.extractWalletAddress(rawData),
        capabilities: this.extractCapabilities(rawData),
        metadata: this.extractMetadata(rawData)
      };

      return this.validateAgent(agent) ? agent : null;
    } catch (error) {
      console.error(`❌ Error normalizing agent data for ${this.name}:`, error);
      return null;
    }
  }

  /**
   * Extract agent URL - must be implemented by specific adapters
   */
  protected abstract extractAgentUrl(rawData: any): string;

  /**
   * Extract communication channels - can be overridden
   */
  protected extractChannels(rawData: any): any {
    return {};
  }

  /**
   * Extract wallet address - can be overridden
   */
  protected extractWalletAddress(rawData: any): string | undefined {
    return undefined;
  }

  /**
   * Extract capabilities - can be overridden
   */
  protected extractCapabilities(rawData: any): any {
    return {};
  }

  /**
   * Extract metadata - can be overridden
   */
  protected extractMetadata(rawData: any): any {
    return {};
  }
}