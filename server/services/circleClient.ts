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

    if (!entitySecret) {
      throw new Error('CIRCLE_ENTITY_SECRET environment variable is required');
    }

    // Circle requires format: ENVIRONMENT:KEY_ID:SECRET (post-May 2023)
    // We need to construct this from our existing credentials
    
    const keyParts = rawApiKey.split(':');
    
    if (keyParts.length === 3) {
      // Already in correct format
      this.apiKey = rawApiKey;
      console.log(`✅ Circle API key already in correct format`);
    } else {
      // Single key format - construct proper format
      // Determine environment (sandbox vs production)
      const environment = 'TEST_API_KEY'; // Default to test environment
      
      // Use the raw key as the key ID
      const keyId = rawApiKey;
      
      // Construct proper format: ENVIRONMENT:KEY_ID:SECRET
      this.apiKey = `${environment}:${keyId}:${entitySecret}`;
      console.log(`✅ Circle API key constructed: ${environment}:${keyId.substring(0, 8)}...:${entitySecret.substring(0, 8)}...`);
    }

    this.baseURL = 'https://api.circle.com/v1';
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