/**
 * GPT OAuth Routes - OAuth 2.0 endpoints for ChatGPT GPT Actions
 * 
 * Enables one-click sign-in/sign-up from ChatGPT conversations.
 * Users authenticate once and their token persists across all conversations.
 * 
 * OAuth Flow:
 * 1. ChatGPT calls GET /oauth/authorize with client_id, redirect_uri, state
 * 2. User sees Coin Railz login page with options (email, Coinbase, etc.)
 * 3. User authenticates → we issue authorization code
 * 4. ChatGPT calls POST /oauth/token to exchange code for access/refresh tokens
 * 5. Subsequent requests include Authorization: Bearer <access_token>
 */

import { Router, Request, Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { storage } from '../storage';

const router = Router();

// OAuth configuration
const OAUTH_CLIENT_ID = process.env.GPT_OAUTH_CLIENT_ID || 'coinrailz-gpt';
const OAUTH_CLIENT_SECRET = process.env.GPT_OAUTH_CLIENT_SECRET || process.env.SESSION_SECRET || 'default-oauth-secret';
const BASE_URL = process.env.BASE_URL || 'https://coinrailz.com';

// Token expiration times
const ACCESS_TOKEN_EXPIRES_HOURS = 24; // 24 hours
const REFRESH_TOKEN_EXPIRES_DAYS = 30; // 30 days
const AUTH_CODE_EXPIRES_MINUTES = 10; // 10 minutes per OAuth spec

// Valid redirect URIs for ChatGPT
const VALID_REDIRECT_PATTERNS = [
  /^https:\/\/chat\.openai\.com\/aip\/g-[a-zA-Z0-9]+\/oauth\/callback$/,
  /^https:\/\/chatgpt\.com\/aip\/g-[a-zA-Z0-9]+\/oauth\/callback$/,
];

function isValidRedirectUri(uri: string): boolean {
  return VALID_REDIRECT_PATTERNS.some(pattern => pattern.test(uri));
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

// Authorization request validation
const authorizeQuerySchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url(),
  response_type: z.literal('code'),
  state: z.string().optional(),
  scope: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['plain', 'S256']).optional(),
});

// Token request validation
const tokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  client_id: z.string(),
  client_secret: z.string(),
  redirect_uri: z.string().optional(),
  code_verifier: z.string().optional(),
});

/**
 * GET /oauth/authorize
 * 
 * Authorization endpoint - redirects to login page or renders login chooser.
 * After successful login, redirects back to ChatGPT with authorization code.
 */
router.get('/authorize', async (req: Request, res: Response) => {
  try {
    const query = authorizeQuerySchema.safeParse(req.query);
    
    if (!query.success) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid or missing OAuth parameters',
        details: query.error.errors,
      });
    }

    const { client_id, redirect_uri, state, scope, code_challenge, code_challenge_method } = query.data;

    // Validate client_id
    if (client_id !== OAUTH_CLIENT_ID) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Unknown client_id',
      });
    }

    // Validate redirect_uri is a valid ChatGPT callback
    if (!isValidRedirectUri(redirect_uri)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri. Must be a valid ChatGPT callback URL.',
      });
    }

    // Store OAuth parameters in session for after login
    if (req.session) {
      (req.session as any).oauthParams = {
        client_id,
        redirect_uri,
        state,
        scope: scope || 'basic credits.read credits.charge',
        code_challenge,
        code_challenge_method,
      };
    }

    // Check if user is already authenticated via session
    if (req.isAuthenticated && req.isAuthenticated() && (req.user as any)?.claims?.sub) {
      // User already logged in - issue authorization code directly
      const userId = (req.user as any).claims.sub;
      return await issueAuthorizationCode(res, userId, redirect_uri, state, scope, code_challenge, code_challenge_method);
    }

    // Redirect to OAuth login page (a special login page for GPT OAuth)
    const loginUrl = new URL(`${BASE_URL}/oauth/login`);
    loginUrl.searchParams.set('redirect_uri', redirect_uri);
    if (state) loginUrl.searchParams.set('state', state);
    
    res.redirect(loginUrl.toString());
  } catch (error: any) {
    console.error('[GPT OAuth] Authorize error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * GET /oauth/login
 * 
 * Renders a login page with sign-in options for GPT OAuth flow.
 * This is a simple HTML page with buttons for different auth methods.
 */
router.get('/login', (req: Request, res: Response) => {
  const redirectUri = req.query.redirect_uri as string || '';
  const state = req.query.state as string || '';
  
  // Render a simple login page
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect to Coin Railz</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #00d4ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .logo p {
      color: #a0a0a0;
      margin-top: 8px;
      font-size: 14px;
    }
    .divider {
      display: flex;
      align-items: center;
      margin: 25px 0;
      color: #666;
      font-size: 13px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
    }
    .divider span { padding: 0 15px; }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      margin-bottom: 12px;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0052ff, #7c3aed);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0, 82, 255, 0.3);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    .btn svg {
      width: 20px;
      height: 20px;
      margin-right: 10px;
    }
    form { margin-top: 20px; }
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      color: #a0a0a0;
    }
    .form-group input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      color: white;
      font-size: 15px;
    }
    .form-group input:focus {
      outline: none;
      border-color: #0052ff;
    }
    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px;
      border-radius: 10px;
      margin-bottom: 16px;
      font-size: 14px;
      display: none;
    }
    .footer {
      text-align: center;
      margin-top: 25px;
      font-size: 12px;
      color: #666;
    }
    .footer a {
      color: #00d4ff;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>Coin Railz</h1>
      <p>Connect your account to access AI services</p>
    </div>
    
    <div id="error" class="error"></div>
    
    <a href="/auth/coinbase/login?oauth_redirect=${encodeURIComponent(redirectUri)}&oauth_state=${encodeURIComponent(state)}" class="btn btn-primary" data-testid="button-coinbase-login">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
      Continue with Coinbase
    </a>
    
    <a href="/auth/google/login?oauth_redirect=${encodeURIComponent(redirectUri)}&oauth_state=${encodeURIComponent(state)}" class="btn btn-secondary" style="background: #fff; color: #333; border: 1px solid #ddd;" data-testid="button-google-login">
      <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right: 8px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Continue with Google
    </a>
    
    <div class="divider"><span>or sign in with email</span></div>
    
    <form id="loginForm" onsubmit="handleLogin(event)">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required placeholder="Your password">
      </div>
      <button type="submit" class="btn btn-secondary">Sign In</button>
    </form>
    
    <div class="footer">
      <p>Don't have an account? <a href="/oauth/register?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}">Sign up</a></p>
      <p style="margin-top: 10px;">By connecting, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a></p>
    </div>
  </div>
  
  <script>
    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('error');
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.user) {
          // Login successful - complete OAuth flow
          window.location.href = '/oauth/complete?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&user_id=' + encodeURIComponent(data.user.id);
        } else {
          errorEl.textContent = data.message || 'Login failed. Please check your credentials.';
          errorEl.style.display = 'block';
        }
      } catch (error) {
        errorEl.textContent = 'Connection error. Please try again.';
        errorEl.style.display = 'block';
      }
    }
  </script>
</body>
</html>
  `);
});

/**
 * GET /oauth/register
 * 
 * Renders a registration page for new users in the GPT OAuth flow.
 */
router.get('/register', (req: Request, res: Response) => {
  const redirectUri = req.query.redirect_uri as string || '';
  const state = req.query.state as string || '';
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up for Coin Railz</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #00d4ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .logo p {
      color: #a0a0a0;
      margin-top: 8px;
      font-size: 14px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      margin-bottom: 12px;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0052ff, #7c3aed);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0, 82, 255, 0.3);
    }
    form { margin-top: 20px; }
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      color: #a0a0a0;
    }
    .form-group input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      color: white;
      font-size: 15px;
    }
    .form-group input:focus {
      outline: none;
      border-color: #0052ff;
    }
    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px;
      border-radius: 10px;
      margin-bottom: 16px;
      font-size: 14px;
      display: none;
    }
    .password-hint {
      font-size: 11px;
      color: #666;
      margin-top: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 25px;
      font-size: 12px;
      color: #666;
    }
    .footer a {
      color: #00d4ff;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>Coin Railz</h1>
      <p>Create your account to get started</p>
    </div>
    
    <div id="error" class="error"></div>
    
    <form id="registerForm" onsubmit="handleRegister(event)">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required placeholder="Create a password" minlength="8">
        <p class="password-hint">Must be 8+ chars with uppercase, lowercase, number, and special character</p>
      </div>
      <button type="submit" class="btn btn-primary">Create Account</button>
    </form>
    
    <div class="footer">
      <p>Already have an account? <a href="/oauth/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}">Sign in</a></p>
    </div>
  </div>
  
  <script>
    async function handleRegister(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('error');
      
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.user) {
          // Registration successful - complete OAuth flow
          window.location.href = '/oauth/complete?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&user_id=' + encodeURIComponent(data.user.id);
        } else {
          errorEl.textContent = data.message || 'Registration failed. Please try again.';
          errorEl.style.display = 'block';
        }
      } catch (error) {
        errorEl.textContent = 'Connection error. Please try again.';
        errorEl.style.display = 'block';
      }
    }
  </script>
</body>
</html>
  `);
});

/**
 * GET /oauth/complete
 * 
 * Completes the OAuth flow after successful login/registration.
 * Issues authorization code and redirects back to ChatGPT.
 */
router.get('/complete', async (req: Request, res: Response) => {
  try {
    const { redirect_uri, state, user_id } = req.query;
    
    if (!redirect_uri || !user_id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters',
      });
    }

    const redirectUri = redirect_uri as string;
    const userId = user_id as string;
    const stateParam = state as string || '';

    // Validate redirect_uri
    if (!isValidRedirectUri(redirectUri)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri',
      });
    }

    // Verify user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'User not found',
      });
    }

    // Get OAuth params from session if available
    const oauthParams = (req.session as any)?.oauthParams || {};
    const { code_challenge, code_challenge_method, scope } = oauthParams;

    await issueAuthorizationCode(res, userId, redirectUri, stateParam, scope, code_challenge, code_challenge_method);
  } catch (error: any) {
    console.error('[GPT OAuth] Complete error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * Helper function to issue authorization code and redirect
 */
async function issueAuthorizationCode(
  res: Response,
  userId: string,
  redirectUri: string,
  state: string | undefined,
  scope: string | undefined,
  codeChallenge: string | undefined,
  codeChallengeMethod: string | undefined
): Promise<void> {
  // Generate authorization code
  const code = generateSecureToken();
  const codeHash = hashToken(code);

  // Store authorization code (expires in 10 minutes)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_CODE_EXPIRES_MINUTES);

  await storage.createGptOAuthCode({
    codeHash,
    userId,
    clientId: OAUTH_CLIENT_ID,
    redirectUri,
    scope: scope || 'basic credits.read credits.charge',
    state: state || null,
    codeChallenge: codeChallenge || null,
    codeChallengeMethod: codeChallengeMethod || null,
    status: 'pending',
    expiresAt,
  });

  // Redirect back to ChatGPT with authorization code
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) {
    callbackUrl.searchParams.set('state', state);
  }

  console.log(`[GPT OAuth] Issued auth code for user ${userId}, redirecting to ChatGPT`);
  res.redirect(callbackUrl.toString());
}

/**
 * POST /oauth/token
 * 
 * Token endpoint - exchanges authorization code for access/refresh tokens.
 * ChatGPT calls this endpoint with the authorization code.
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    // Parse request body
    const body = tokenRequestSchema.safeParse(req.body);
    
    if (!body.success) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid token request',
        details: body.error.errors,
      });
    }

    const { grant_type, code, refresh_token, client_id, client_secret, redirect_uri, code_verifier } = body.data;

    // Validate client credentials
    if (client_id !== OAUTH_CLIENT_ID || client_secret !== OAUTH_CLIENT_SECRET) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      });
    }

    if (grant_type === 'authorization_code') {
      // Exchange authorization code for tokens
      if (!code || !redirect_uri) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing code or redirect_uri',
        });
      }

      const codeHash = hashToken(code);
      const authCode = await storage.getGptOAuthCodeByHash(codeHash);

      if (!authCode) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code',
        });
      }

      // Verify code hasn't expired
      if (new Date(authCode.expiresAt) < new Date()) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code has expired',
        });
      }

      // Verify redirect_uri matches
      if (authCode.redirectUri !== redirect_uri) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'redirect_uri mismatch',
        });
      }

      // Verify PKCE if code_challenge was provided
      if (authCode.codeChallenge) {
        if (!code_verifier) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'code_verifier required for PKCE',
          });
        }

        let expectedChallenge: string;
        if (authCode.codeChallengeMethod === 'S256') {
          expectedChallenge = createHash('sha256')
            .update(code_verifier)
            .digest('base64url');
        } else {
          expectedChallenge = code_verifier;
        }

        if (expectedChallenge !== authCode.codeChallenge) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid code_verifier',
          });
        }
      }

      // Mark code as used
      await storage.markGptOAuthCodeUsed(authCode.id);

      // Generate tokens
      const accessToken = generateSecureToken();
      const refreshTokenValue = generateSecureToken();

      const accessTokenExpiresAt = new Date();
      accessTokenExpiresAt.setHours(accessTokenExpiresAt.getHours() + ACCESS_TOKEN_EXPIRES_HOURS);

      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

      // Store tokens
      await storage.createGptOAuthToken({
        userId: authCode.userId,
        accessTokenHash: hashToken(accessToken),
        refreshTokenHash: hashToken(refreshTokenValue),
        scope: authCode.scope || 'basic credits.read credits.charge',
        status: 'active',
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        clientId: client_id,
      });

      console.log(`[GPT OAuth] Issued access token for user ${authCode.userId}`);

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRES_HOURS * 3600, // seconds
        refresh_token: refreshTokenValue,
        scope: authCode.scope || 'basic credits.read credits.charge',
      });
    } else if (grant_type === 'refresh_token') {
      // Refresh access token
      if (!refresh_token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing refresh_token',
        });
      }

      const refreshTokenHash = hashToken(refresh_token);
      const existingToken = await storage.getGptOAuthTokenByRefreshHash(refreshTokenHash);

      if (!existingToken) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired refresh token',
        });
      }

      // Check refresh token expiration
      if (existingToken.refreshTokenExpiresAt && new Date(existingToken.refreshTokenExpiresAt) < new Date()) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Refresh token has expired',
        });
      }

      // Revoke old token
      await storage.revokeGptOAuthToken(existingToken.id);

      // Generate new tokens
      const newAccessToken = generateSecureToken();
      const newRefreshToken = generateSecureToken();

      const accessTokenExpiresAt = new Date();
      accessTokenExpiresAt.setHours(accessTokenExpiresAt.getHours() + ACCESS_TOKEN_EXPIRES_HOURS);

      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

      await storage.createGptOAuthToken({
        userId: existingToken.userId,
        accessTokenHash: hashToken(newAccessToken),
        refreshTokenHash: hashToken(newRefreshToken),
        scope: existingToken.scope || 'basic credits.read credits.charge',
        status: 'active',
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        clientId: client_id,
      });

      console.log(`[GPT OAuth] Refreshed access token for user ${existingToken.userId}`);

      return res.json({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRES_HOURS * 3600,
        refresh_token: newRefreshToken,
        scope: existingToken.scope || 'basic credits.read credits.charge',
      });
    }

    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Unsupported grant type',
    });
  } catch (error: any) {
    console.error('[GPT OAuth] Token error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * POST /oauth/revoke
 * 
 * Token revocation endpoint - allows users to disconnect their account.
 */
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { token, token_type_hint } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing token',
      });
    }

    const tokenHash = hashToken(token);
    
    // Try to find and revoke the token
    const accessToken = await storage.getGptOAuthTokenByAccessHash(tokenHash);
    if (accessToken) {
      await storage.revokeGptOAuthToken(accessToken.id);
      console.log(`[GPT OAuth] Revoked access token for user ${accessToken.userId}`);
    } else {
      const refreshToken = await storage.getGptOAuthTokenByRefreshHash(tokenHash);
      if (refreshToken) {
        await storage.revokeGptOAuthToken(refreshToken.id);
        console.log(`[GPT OAuth] Revoked refresh token for user ${refreshToken.userId}`);
      }
    }

    // OAuth 2.0 spec says to return 200 OK even if token was not found
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[GPT OAuth] Revoke error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

export default router;
