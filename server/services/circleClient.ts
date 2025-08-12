/**
 * Circle API Client with Proper Authentication
 * Fixed implementation for post-May 2023 API key format
 */

export class CircleClient {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    const rawApiKey = process.env.CIRCLE_API_KEY || process.env.CIRCLE_CLIENT_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!rawApiKey) {
      throw new Error('CIRCLE_API_KEY or CIRCLE_CLIENT_KEY environment variable is required');
    }

    if (!entitySecret) {
      throw new Error('CIRCLE_ENTITY_SECRET environment variable is required');
    }

    // Circle API key format: ENVIRONMENT:KEY_ID:SECRET (post-May 2023)
    console.log(`🔍 Raw API key format: ${rawApiKey.substring(0, 20)}...`);
    console.log(`🔍 Entity secret format: ${entitySecret.substring(0, 8)}...`);
    
    const keyParts = rawApiKey.split(':');
    
    // Check if already in proper 3-part format
    if (keyParts.length === 3 && 
        (keyParts[0] === 'TEST_API_KEY' || keyParts[0] === 'LIVE_API_KEY')) {
      this.apiKey = rawApiKey;
      console.log(`✅ Using properly formatted Circle API key`);
    }
    // If key has wrong format, construct it properly  
    else {
      // Extract the actual key ID (remove environment prefix if present)
      let keyId = rawApiKey;
      if (keyId.includes(':')) {
        keyId = keyId.split(':').pop() || keyId; // Take last part
      }
      
      // Determine environment (default to TEST for development)
      const environment = 'TEST_API_KEY';
      
      // Construct proper format: ENVIRONMENT:KEY_ID:SECRET
      this.apiKey = `${environment}:${keyId}:${entitySecret}`;
      console.log(`✅ Constructed Circle API key: ${environment}:${keyId.substring(0, 8)}...:${entitySecret.substring(0, 8)}...`);
    }

    // Use sandbox for TEST keys, production for LIVE keys
    this.baseURL = this.apiKey.includes('SAND_') || this.apiKey.includes('TEST_') 
      ? 'https://api-sandbox.circle.com/v1' 
      : 'https://api.circle.com/v1';
    
    console.log(`🌐 Using Circle API endpoint: ${this.baseURL}`);
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