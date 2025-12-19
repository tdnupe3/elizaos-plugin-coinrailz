import express, { Request, Response } from 'express';
import { storage } from '../storage';
import crypto from 'crypto';

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const isProduction = process.env.NODE_ENV === 'production';
const GOOGLE_REDIRECT_URI = isProduction 
  ? 'https://coinrailz.com/auth/google/callback'
  : 'http://localhost:5000/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️ Google OAuth credentials not found. Google login will not be available.');
}

declare module 'express-session' {
  interface SessionData {
    googleState?: string;
    oauthRedirect?: string;
    oauthState?: string;
  }
}

router.get('/google', (req: Request, res: Response) => {
  res.redirect('/auth/google/login');
});

router.get('/google/login', (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  req.session.googleState = state;
  
  if (req.query.oauth_redirect) {
    req.session.oauthRedirect = req.query.oauth_redirect as string;
  }
  if (req.query.oauth_state) {
    req.session.oauthState = req.query.oauth_state as string;
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  res.redirect(authUrl.toString());
});

router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (state !== req.session.googleState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not received' });
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Google token exchange failed:', error);
      return res.status(400).json({ error: 'Failed to exchange authorization code' });
    }

    const tokens = await tokenResponse.json() as { access_token: string; id_token?: string };

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return res.status(400).json({ error: 'Failed to fetch user info from Google' });
    }

    const googleUser = await userResponse.json() as {
      sub: string;
      email: string;
      email_verified: boolean;
      name: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    };

    let user = await storage.getUserByEmail(googleUser.email);
    
    if (!user) {
      const securePassword = crypto.randomBytes(32).toString('hex');
      user = await storage.createUser({
        email: googleUser.email,
        username: googleUser.email.split('@')[0] + '_' + crypto.randomBytes(3).toString('hex'),
        password: securePassword,
        firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || '',
        lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
      });
      console.log(`✅ Created new user via Google OAuth: ${googleUser.email}`);
    } else {
      console.log(`✅ Existing user logged in via Google OAuth: ${googleUser.email}`);
    }

    (req.session as any).user = {
      id: user.id,
      email: user.email,
      username: user.username,
      claims: {
        sub: `google_${googleUser.sub}`,
        email: googleUser.email,
        first_name: googleUser.given_name || '',
        last_name: googleUser.family_name || '',
        profile_image_url: googleUser.picture || '',
      },
    };

    const oauthRedirect = req.session.oauthRedirect;
    const oauthState = req.session.oauthState;
    
    delete req.session.googleState;
    delete req.session.oauthRedirect;
    delete req.session.oauthState;

    if (oauthRedirect) {
      return res.redirect(`/oauth/complete?redirect_uri=${encodeURIComponent(oauthRedirect)}&state=${encodeURIComponent(oauthState || '')}&user_id=${encodeURIComponent(String(user.id))}`);
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
