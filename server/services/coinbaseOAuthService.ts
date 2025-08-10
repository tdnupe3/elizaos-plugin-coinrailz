/**
 * Coinbase OAuth Integration Service
 * Handles Coinbase account linking and authentication
 */

interface CoinbaseTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
  created_at: number;
}

interface CoinbaseUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar_url: string;
  resource: 'user';
  resource_path: string;
}

interface CoinbaseAccount {
  id: string;
  name: string;
  primary: boolean;
  type: string;
  currency: {
    code: string;
    name: string;
    color: string;
    sort_index: number;
    exponent: number;
    type: string;
    address_regex: string;
  };
  balance: {
    amount: string;
    currency: string;
  };
  created_at: string;
  updated_at: string;
  resource: 'account';
  resource_path: string;
}

export class CoinbaseOAuthService {
  private static instance: CoinbaseOAuthService;
  private readonly CLIENT_ID: string;
  private readonly CLIENT_SECRET: string;
  private readonly REDIRECT_URI: string;
  private readonly BASE_URL = 'https://api.coinbase.com';
  private readonly OAUTH_URL = 'https://www.coinbase.com/oauth';

  private constructor() {
    this.CLIENT_ID = process.env.COINBASE_CLIENT_ID!;
    this.CLIENT_SECRET = process.env.COINBASE_CLIENT_SECRET!;
    this.REDIRECT_URI = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/api/coinbase/callback`;

    if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
      throw new Error('Coinbase OAuth credentials not configured');
    }
  }

  public static getInstance(): CoinbaseOAuthService {
    if (!this.instance) {
      this.instance = new CoinbaseOAuthService();
    }
    return this.instance;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      scope: 'wallet:user:read wallet:accounts:read wallet:addresses:read wallet:transactions:read',
      state: state || Math.random().toString(36).substring(7)
    });

    return `${this.OAUTH_URL}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<CoinbaseTokens> {
    try {
      const response = await fetch(`${this.OAUTH_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          redirect_uri: this.REDIRECT_URI,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens: CoinbaseTokens = await response.json();
      console.log('✅ Successfully exchanged code for Coinbase tokens');
      return tokens;
    } catch (error) {
      console.error('❌ Failed to exchange code for token:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<CoinbaseTokens> {
    try {
      const response = await fetch(`${this.OAUTH_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const tokens: CoinbaseTokens = await response.json();
      console.log('✅ Successfully refreshed Coinbase tokens');
      return tokens;
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(accessToken: string): Promise<CoinbaseUser> {
    try {
      const response = await fetch(`${this.BASE_URL}/v2/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get user profile: ${error}`);
      }

      const data = await response.json();
      return data.data as CoinbaseUser;
    } catch (error) {
      console.error('❌ Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * Get user accounts and balances
   */
  async getUserAccounts(accessToken: string): Promise<CoinbaseAccount[]> {
    try {
      const response = await fetch(`${this.BASE_URL}/v2/accounts`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get user accounts: ${error}`);
      }

      const data = await response.json();
      return data.data as CoinbaseAccount[];
    } catch (error) {
      console.error('❌ Failed to get user accounts:', error);
      throw error;
    }
  }

  /**
   * Get account transactions
   */
  async getAccountTransactions(accessToken: string, accountId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.BASE_URL}/v2/accounts/${accountId}/transactions`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get account transactions: ${error}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('❌ Failed to get account transactions:', error);
      return [];
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserProfile(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const coinbaseOAuthService = CoinbaseOAuthService.getInstance();