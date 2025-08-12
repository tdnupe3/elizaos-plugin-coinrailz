/**
 * Circle API Client with Proper Authentication
 * Fixed implementation for post-May 2023 API key format
 */

export class CircleClient {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    const rawApiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!rawApiKey) {
      throw new Error('CIRCLE_API_KEY environment variable is required');
    }

    // Check if the API key is already in the correct format (contains colons)
    if (rawApiKey.includes(':')) {
      this.apiKey = rawApiKey;
    } else {
      // For older format keys, construct the proper format
      if (!entitySecret) {
        throw new Error('CIRCLE_ENTITY_SECRET is required for older API keys');
      }
      
      // Determine environment based on key prefix
      const environment = rawApiKey.startsWith('TEST_') ? 'TEST' : 'LIVE';
      
      // Extract key ID
      const keyId = rawApiKey.replace(/^(TEST_|LIVE_)/, '');
      
      // Construct proper format: ENVIRONMENT:KEY_ID:SECRET
      this.apiKey = `${environment}:${keyId}:${entitySecret}`;
    }

    this.baseURL = 'https://api.circle.com/v1';
    console.log(`✅ Circle API client initialized with format: ${this.apiKey.substring(0, 15)}...`);
  }

  /**
   * Make authenticated request to Circle API
   */
  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Circle API Error (${response.status}):`, data);
      throw new Error(`Circle API error: ${data.message || response.statusText}`);
    }

    return data;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletId: string): Promise<any> {
    return this.makeRequest(`/wallets/${walletId}/balances`);
  }

  /**
   * List all wallets
   */
  async listWallets(): Promise<any> {
    return this.makeRequest('/wallets');
  }

  /**
   * Create a new wallet
   */
  async createWallet(description?: string): Promise<any> {
    return this.makeRequest('/wallets', {
      method: 'POST',
      body: JSON.stringify({
        description: description || 'Coin Railz user wallet'
      }),
    });
  }

  /**
   * Get wallet details
   */
  async getWallet(walletId: string): Promise<any> {
    return this.makeRequest(`/wallets/${walletId}`);
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listWallets();
      console.log('✅ Circle API connection test successful');
      return true;
    } catch (error: any) {
      console.error('❌ Circle API connection test failed:', error.message);
      return false;
    }
  }
}

// Create singleton instance
export const circleClient = new CircleClient();