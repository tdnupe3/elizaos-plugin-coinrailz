/**
 * Reddit OAuth Automation - No Password Required
 * One-time consent → Fully automated posting
 */

import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';

export const redditAuthRouter = Router();

interface RedditTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// In production, store this in database
let storedTokens: RedditTokens | null = null;

/**
 * Step 1: Start Reddit OAuth (one-time setup)
 */
redditAuthRouter.get('/auth/reddit', (req, res) => {
  const clientId = process.env.REDDIT_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Reddit client ID not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/reddit/callback`;
  
  const authUrl = new URL('https://www.reddit.com/api/v1/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('duration', 'permanent'); // Long-lived refresh token
  authUrl.searchParams.set('scope', 'submit identity');

  // Store state for validation (in production, use session/database)
  req.session = req.session || {};
  (req.session as any).redditState = state;

  res.redirect(authUrl.toString());
});

/**
 * Step 2: Handle OAuth callback (automatic)
 */
redditAuthRouter.get('/auth/reddit/callback', async (req, res) => {
  const { code, state } = req.query;
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  try {
    // Validate state parameter
    if (!(req.session as any)?.redditState || (req.session as any).redditState !== state) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/auth/reddit/callback`;

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://www.reddit.com/api/v1/access_token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'User-Agent': 'CoinRailz-SDK-Bot/1.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: clientId!,
          password: clientSecret!
        }
      }
    );

    const tokens = tokenResponse.data;
    
    // Store tokens (in production, encrypt and store in database)
    storedTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000)
    };

    console.log('✅ Reddit OAuth successful! Automated posting now enabled.');

    res.json({ 
      success: true, 
      message: 'Reddit automation setup complete! Automated posting will begin.',
      canPost: true
    });

  } catch (error) {
    console.error('Reddit OAuth failed:', error);
    res.status(500).json({ error: 'OAuth setup failed' });
  }
});

/**
 * Get fresh access token (automatic refresh)
 */
async function getValidAccessToken(): Promise<string | null> {
  if (!storedTokens) {
    console.log('❌ No Reddit tokens stored. Run OAuth setup first.');
    return null;
  }

  // Check if token needs refresh
  if (Date.now() > storedTokens.expires_at - 60000) { // Refresh 1 min early
    try {
      const clientId = process.env.REDDIT_CLIENT_ID;
      const clientSecret = process.env.REDDIT_CLIENT_SECRET;

      const refreshResponse = await axios.post('https://www.reddit.com/api/v1/access_token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: storedTokens.refresh_token
        }),
        {
          headers: {
            'User-Agent': 'CoinRailz-SDK-Bot/1.0',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: clientId!,
            password: clientSecret!
          }
        }
      );

      const newTokens = refreshResponse.data;
      storedTokens.access_token = newTokens.access_token;
      storedTokens.expires_at = Date.now() + (newTokens.expires_in * 1000);

      console.log('✅ Reddit token refreshed automatically');
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return null;
    }
  }

  return storedTokens.access_token;
}

/**
 * Automated Reddit posting function
 */
export async function createRedditPost(subreddit: string, title: string, text: string): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      console.log('❌ No valid Reddit access token available');
      return false;
    }

    const response = await axios.post(`https://oauth.reddit.com/api/submit`,
      new URLSearchParams({
        api_type: 'json',
        kind: 'self',
        sr: subreddit,
        title: title,
        text: text,
        resubmit: 'true'
      }),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'CoinRailz-SDK-Bot/1.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.data?.json?.errors?.length > 0) {
      console.error('Reddit post failed:', response.data.json.errors);
      return false;
    }

    console.log(`✅ Posted to r/${subreddit}: "${title}"`);
    return true;

  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log('⏳ Reddit rate limit hit - will retry later');
    } else {
      console.error('❌ Reddit post failed:', error.response?.data || error.message);
    }
    return false;
  }
}

/**
 * Check authentication status
 */
redditAuthRouter.get('/auth/reddit/status', (req, res) => {
  const isAuthenticated = storedTokens !== null;
  const canPost = isAuthenticated && storedTokens!.expires_at > Date.now();
  
  res.json({
    authenticated: isAuthenticated,
    canPost: canPost,
    nextRefresh: isAuthenticated ? new Date(storedTokens!.expires_at) : null
  });
});

export { getValidAccessToken };