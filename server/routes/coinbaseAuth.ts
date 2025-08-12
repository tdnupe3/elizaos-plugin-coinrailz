import express from 'express';
import { z } from 'zod';
import { storage } from '../storage';

// Extend Express session to include our custom properties
declare module 'express-session' {
  interface SessionData {
    coinbaseState?: string;
    user?: {
      claims: {
        sub: string;
        email: string;
        first_name: string;
        last_name: string;
        profile_image_url: string;
      };
      coinbase?: {
        accessToken: string;
        userId: string;
        isVerified: boolean;
      };
    };
  }
}

const router = express.Router();

// Coinbase OAuth configuration
const COINBASE_CLIENT_ID = process.env.COINBASE_CLIENT_ID;
const COINBASE_CLIENT_SECRET = process.env.COINBASE_CLIENT_SECRET;
const COINBASE_REDIRECT_URI = process.env.COINBASE_REDIRECT_URI || 'http://localhost:5000/auth/coinbase/callback';

if (!COINBASE_CLIENT_ID || !COINBASE_CLIENT_SECRET) {
  console.warn('⚠️ Coinbase OAuth credentials not found. Coinbase login will not be available.');
}

// Coinbase user profile schema
const CoinbaseUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().optional(),
  profile_location: z.string().optional(),
  profile_bio: z.string().optional(),
  profile_url: z.string().optional(),
  avatar_url: z.string().optional(),
  resource: z.string(),
  resource_path: z.string(),
  email: z.string().email().optional(),
  time_zone: z.string().optional(),
  native_currency: z.string().optional(),
  bitcoin_unit: z.string().optional(),
  state: z.string().optional(),
  country: z.object({
    code: z.string(),
    name: z.string()
  }).optional(),
  nationality: z.object({
    code: z.string(),
    name: z.string()
  }).optional(),
  region_supports_fiat_transfers: z.boolean().optional(),
  region_supports_crypto_to_crypto_transfers: z.boolean().optional(),
  created_at: z.string(),
  supports_rewards: z.boolean().optional(),
  tiers: z.object({
    completed_description: z.string(),
    upgrade_button_text: z.string().optional(),
    header: z.string().optional(),
    body: z.string().optional()
  }).optional(),
  referring_user: z.object({
    id: z.string(),
    resource: z.string(),
    resource_path: z.string()
  }).optional(),
  referral_money: z.object({
    amount: z.string(),
    currency: z.string()
  }).optional()
});

// Redirect /coinbase to /coinbase/login for convenience
router.get('/coinbase', (req, res) => {
  res.redirect('/auth/coinbase/login');
});

// Initiate Coinbase OAuth flow
router.get('/coinbase/login', (req, res) => {
  if (!COINBASE_CLIENT_ID) {
    return res.status(500).json({ error: 'Coinbase OAuth not configured' });
  }

  const state = Math.random().toString(36).substring(2, 15);
  req.session.coinbaseState = state;

  const authUrl = new URL('https://www.coinbase.com/oauth/authorize');
  authUrl.searchParams.set('client_id', COINBASE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', COINBASE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'wallet:user:read,wallet:accounts:read');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// Handle Coinbase OAuth callback
router.get('/coinbase/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Verify state parameter
    if (state !== req.session.coinbaseState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not received' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.coinbase.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        client_id: COINBASE_CLIENT_ID,
        client_secret: COINBASE_CLIENT_SECRET,
        redirect_uri: COINBASE_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user profile from Coinbase
    const profileResponse = await fetch('https://api.coinbase.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'CB-VERSION': '2021-06-27',
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const profileData = await profileResponse.json();
    const coinbaseUser = CoinbaseUserSchema.parse(profileData.data);

    // Create or update user in our system
    const userData = {
      id: `coinbase_${coinbaseUser.id}`,
      email: coinbaseUser.email || `${coinbaseUser.id}@coinbase.local`,
      firstName: coinbaseUser.name.split(' ')[0] || coinbaseUser.name,
      lastName: coinbaseUser.name.split(' ').slice(1).join(' ') || '',
      profileImageUrl: coinbaseUser.avatar_url || null,
      coinbaseId: coinbaseUser.id,
      coinbaseAccessToken: accessToken,
      coinbaseProfile: JSON.stringify(coinbaseUser),
      isKycVerified: true, // Users coming from Coinbase are already KYC verified
      kycLevel: 'complete',
      kycProvider: 'coinbase',
      coinbaseNativeCurrency: coinbaseUser.native_currency || 'USD',
      coinbaseCountry: coinbaseUser.country?.code || null,
      coinbaseRegionSupportsTransfers: coinbaseUser.region_supports_fiat_transfers || false,
    };

    const user = await storage.upsertUser(userData);

    // Create session
    req.session.user = {
      claims: {
        sub: user.id,
        email: user.email || '',
        first_name: user.firstName || '',
        last_name: user.lastName || '',
        profile_image_url: user.profileImageUrl || '',
      },
      coinbase: {
        accessToken: accessToken,
        userId: coinbaseUser.id,
        isVerified: true,
      }
    };

    // Clear the state
    delete req.session.coinbaseState;

    // Redirect to dashboard or intended page
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error('Coinbase OAuth callback error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get Coinbase user accounts (requires authentication)
router.get('/coinbase/accounts', async (req, res) => {
  try {
    if (!req.session.user?.coinbase?.accessToken) {
      return res.status(401).json({ error: 'Not authenticated with Coinbase' });
    }

    const accountsResponse = await fetch('https://api.coinbase.com/v2/accounts', {
      headers: {
        'Authorization': `Bearer ${req.session.user.coinbase.accessToken}`,
        'CB-VERSION': '2021-06-27',
      },
    });

    if (!accountsResponse.ok) {
      throw new Error('Failed to fetch accounts');
    }

    const accountsData = await accountsResponse.json();
    res.json(accountsData);

  } catch (error) {
    console.error('Coinbase accounts error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch accounts', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Check Coinbase authentication status
router.get('/coinbase/status', (req, res) => {
  const isAuthenticated = !!(req.session.user?.coinbase?.accessToken);
  const coinbaseUser = req.session.user?.coinbase || null;
  
  res.json({
    isAuthenticated,
    user: isAuthenticated ? {
      id: coinbaseUser?.userId,
      isVerified: coinbaseUser?.isVerified,
    } : null,
  });
});

// Logout from Coinbase (clear session)
router.post('/coinbase/logout', (req, res) => {
  if (req.session.user?.coinbase) {
    delete req.session.user.coinbase;
  }
  
  res.json({ success: true, message: 'Logged out from Coinbase' });
});

export default router;