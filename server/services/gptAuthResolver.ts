/**
 * GPT Session Auth Resolver Service
 * 
 * Resolves authentication from OpenAI GPT headers with fallback to API keys.
 * Priority: GPT Session > API Key > Anonymous
 * 
 * Design based on architect review:
 * - Hash-based fingerprint lookup (O(1))
 * - Provisional session bootstrap for first-time users
 * - Dual-mode compatibility for gradual migration
 */

import { Request } from 'express';
import { createHash } from 'crypto';
import { storage } from '../storage';
import { PIIEncryption } from '../utils/piiEncryption';
import { creditsService } from './creditsService';
import type { GptAuthSession } from '@shared/schema';

// Auth modes in priority order
export type AuthMode = 'gpt_session' | 'gpt_provisional' | 'api_key' | 'anonymous';

// Auth context carried through request lifecycle
export interface AuthContext {
  mode: AuthMode;
  userId?: string;
  user?: any;
  session?: GptAuthSession;
  apiKeyId?: string; // UUID string, not number
  provisionalSessionId?: number;
  fingerprints?: {
    conversation: string;
    session: string;
  };
}

// Headers extracted from OpenAI GPT requests
export interface GptHeaders {
  conversationId?: string;
  sessionId?: string;
  userEmail?: string;
  ephemeralUserId?: string;
}

// Feature flags for GPT session auth rollout
// MUST match paymentOrchestrator.ts for consistent behavior
// Set GPT_SESSION_AUTH=true to enable zero-friction GPT session auth path
const GPT_SESSION_AUTH_ENABLED = process.env.GPT_SESSION_AUTH === 'true';
const GPT_SESSION_BOOTSTRAP_ENABLED = process.env.GPT_SESSION_AUTH === 'true'; // Tied to main flag

/**
 * Extract OpenAI GPT headers from request
 */
export function extractGptHeaders(req: Request): GptHeaders | null {
  const conversationId = req.get('openai-conversation-id') || req.get('x-openai-conversation-id');
  const sessionId = req.get('openai-ephemeral-user-id') || req.get('x-openai-session-id');
  const userEmail = req.get('openai-gpt-id'); // Sometimes contains email
  const ephemeralUserId = req.get('openai-ephemeral-user-id');

  if (!conversationId && !sessionId) {
    return null;
  }

  return {
    conversationId: conversationId || undefined,
    sessionId: sessionId || ephemeralUserId || undefined,
    userEmail: userEmail || undefined,
    ephemeralUserId: ephemeralUserId || undefined,
  };
}

/**
 * Compute deterministic fingerprints from raw headers
 */
export function computeFingerprints(headers: GptHeaders): { conversation: string; session: string } | null {
  if (!headers.conversationId || !headers.sessionId) {
    return null;
  }
  
  return {
    conversation: PIIEncryption.hash(headers.conversationId),
    session: PIIEncryption.hash(headers.sessionId),
  };
}

/**
 * Check if a session is expired
 */
function isSessionExpired(session: GptAuthSession): boolean {
  if (!session.expiresAt) return false;
  return new Date(session.expiresAt) < new Date();
}

/**
 * Check if a session is in valid state for auth
 * Note: 'linked' is a valid status - it means session has credits account linked
 */
function isSessionValid(session: GptAuthSession): boolean {
  const validStatuses = ['active', 'pending_link', 'linked'];
  return validStatuses.includes(session.status) && !isSessionExpired(session);
}

/**
 * Bootstrap a provisional GPT session for first-time users
 */
async function bootstrapProvisionalSession(headers: GptHeaders): Promise<GptAuthSession | null> {
  if (!GPT_SESSION_BOOTSTRAP_ENABLED) {
    console.log('[GPT Auth] Bootstrap disabled by feature flag');
    return null;
  }

  const fingerprints = computeFingerprints(headers);
  if (!fingerprints) {
    return null;
  }

  try {
    // Create provisional session with 30-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Capture identifier from headers if provided
    // openai-gpt-id can be an email OR an opaque UUID
    // Store appropriately for indexed lookups:
    // - Email → email column (encrypted) + emailHash column (indexed)
    // - Non-email → gptIdentifierHash column (indexed for cross-conversation correlation)
    const rawGptId = headers.userEmail;
    const isEmail = rawGptId && rawGptId.includes('@');
    const email = isEmail ? rawGptId : undefined;
    const gptIdentifierHash = rawGptId && !isEmail ? PIIEncryption.hash(rawGptId) : undefined;

    // Require at least one stable identifier for cross-conversation correlation
    if (!email && !gptIdentifierHash) {
      console.log('[GPT Auth] Bootstrap rejected: no stable identifier (email or GPT ID) provided');
      return null;
    }

    const session = await storage.createGptAuthSession({
      conversationFingerprint: fingerprints.conversation,
      sessionFingerprint: fingerprints.session,
      encryptedConversationId: PIIEncryption.encrypt(headers.conversationId!),
      encryptedSessionId: PIIEncryption.encrypt(headers.sessionId!),
      email, // Will be encrypted and hashed by storage layer if present
      gptIdentifierHash, // Pre-hashed for indexed lookup
      status: 'pending_link',
      expiresAt,
      metadata: {
        bootstrappedAt: new Date().toISOString(),
        source: 'gpt_action',
      },
    });

    console.log(`[GPT Auth] Bootstrapped provisional session ID: ${session.id}`);
    return session;
  } catch (error) {
    console.error('[GPT Auth] Failed to bootstrap session:', error);
    return null;
  }
}

/**
 * Validate API key and return auth context
 */
async function resolveApiKeyAuth(apiKey: string): Promise<AuthContext | null> {
  try {
    // Use existing API key validation from creditsService
    const result = await creditsService.validateApiKey(apiKey);
    if (!result.valid || !result.userId) {
      return null;
    }

    return {
      mode: 'api_key',
      userId: result.userId,
      apiKeyId: result.keyId, // Keep as string UUID
    };
  } catch (error) {
    console.error('[GPT Auth] API key validation error:', error);
    return null;
  }
}

/**
 * Sync fingerprints and identifier to user record for linkage
 */
async function syncFingerprintsToUser(
  userId: string, 
  fingerprints: { conversation: string; session: string },
  gptIdentifierHash?: string
): Promise<void> {
  try {
    // Update user with GPT session fingerprints for future lookups
    // These fields are defined in users table schema (Phase 1B)
    const updates: any = {
      lastGptConversationFingerprint: fingerprints.conversation,
      lastGptSessionFingerprint: fingerprints.session,
      lastGptSessionAt: new Date(),
    };
    if (gptIdentifierHash) {
      updates.lastGptIdentifierHash = gptIdentifierHash;
    }
    await storage.updateUser(userId, updates);
  } catch (error) {
    console.error('[GPT Auth] Failed to sync fingerprints to user:', error);
  }
}

/**
 * Main auth resolver - determines auth context from request
 * 
 * Priority order:
 * 1. GPT Session (if valid headers present)
 * 2. API Key (X-API-Key header)
 * 3. Anonymous
 */
export async function resolveAuth(req: Request): Promise<AuthContext> {
  const authContext: AuthContext = { mode: 'anonymous' };

  // Check if GPT session auth is enabled
  if (!GPT_SESSION_AUTH_ENABLED) {
    // Fall through to API key only
    const apiKey = req.get('x-api-key');
    if (apiKey) {
      const apiKeyAuth = await resolveApiKeyAuth(apiKey);
      if (apiKeyAuth) return apiKeyAuth;
    }
    return authContext;
  }

  // Step 1: Try GPT session auth
  const gptHeaders = extractGptHeaders(req);
  if (gptHeaders) {
    const fingerprints = computeFingerprints(gptHeaders);
    if (fingerprints) {
      authContext.fingerprints = fingerprints;

      // Look up existing session
      const session = await storage.getGptAuthSessionByFingerprints(
        fingerprints.conversation,
        fingerprints.session
      );

      if (session && isSessionValid(session)) {
        // Update last used timestamp
        await storage.updateGptAuthSessionLastUsed(session.id);

        // Load linked user if present
        let user = null;
        if (session.userId) {
          user = await storage.getUser(session.userId);
          // Sync fingerprints and identifier back to user for future lookups
          await syncFingerprintsToUser(session.userId, fingerprints, session.gptIdentifierHash || undefined);
        }

        return {
          mode: 'gpt_session',
          userId: session.userId || undefined,
          user,
          session,
          fingerprints,
        };
      }

      // Session not found by fingerprints - try cross-conversation correlation
      if (!session) {
        // Try to find existing session by gptIdentifierHash or email
        const rawGptId = gptHeaders.userEmail;
        const isEmail = rawGptId && rawGptId.includes('@');
        // Compute hash ONCE for non-email identifiers to ensure consistency
        const gptIdHash = rawGptId && !isEmail ? PIIEncryption.hash(rawGptId) : undefined;
        
        if (rawGptId) {
          let existingSession: GptAuthSession | null = null;
          
          if (isEmail) {
            existingSession = await storage.getGptAuthSessionByEmail(rawGptId);
          } else if (gptIdHash) {
            existingSession = await storage.getGptAuthSessionByGptIdHash(gptIdHash);
          }
          
          if (existingSession && isSessionValid(existingSession)) {
            // Found existing session via correlation - reuse it
            console.log(`[GPT Auth] Cross-conversation correlation found session ID: ${existingSession.id}`);
            await storage.updateGptAuthSessionLastUsed(existingSession.id);
            
            let user = null;
            if (existingSession.userId) {
              user = await storage.getUser(existingSession.userId);
              // Reuse the pre-computed gptIdHash (no re-hashing)
              await syncFingerprintsToUser(existingSession.userId, fingerprints, gptIdHash);
            }
            
            return {
              mode: 'gpt_session',
              userId: existingSession.userId || undefined,
              user,
              session: existingSession,
              fingerprints,
            };
          }
        }
        
        // No existing session found - bootstrap provisional
        const provisionalSession = await bootstrapProvisionalSession(gptHeaders);
        if (provisionalSession) {
          return {
            mode: 'gpt_provisional',
            session: provisionalSession,
            provisionalSessionId: provisionalSession.id,
            fingerprints,
          };
        }
      }
    }
  }

  // Step 2: Fall back to API key
  const apiKey = req.get('x-api-key');
  if (apiKey) {
    const apiKeyAuth = await resolveApiKeyAuth(apiKey);
    if (apiKeyAuth) return apiKeyAuth;
  }

  // Step 3: Anonymous
  return authContext;
}

/**
 * Middleware to attach auth context to request
 */
export async function gptAuthMiddleware(
  req: Request,
  _res: any,
  next: () => void
): Promise<void> {
  try {
    const authContext = await resolveAuth(req);
    
    // Attach to request for downstream use
    (req as any).authContext = authContext;

    // Dual-write logging for debugging
    if (authContext.mode !== 'anonymous') {
      console.log(`[GPT Auth] Resolved: mode=${authContext.mode}, userId=${authContext.userId || 'none'}`);
    }
  } catch (error) {
    console.error('[GPT Auth] Middleware error:', error);
    (req as any).authContext = { mode: 'anonymous' };
  }

  next();
}

/**
 * Helper to get auth context from request (type-safe)
 */
export function getAuthContext(req: Request): AuthContext {
  return (req as any).authContext || { mode: 'anonymous' };
}

/**
 * Helper to check if request has valid GPT session
 */
export function hasValidGptSession(req: Request): boolean {
  const ctx = getAuthContext(req);
  return ctx.mode === 'gpt_session' && !!ctx.session;
}

/**
 * Helper to require authenticated request (GPT session or API key)
 * Note: gpt_provisional is NOT authenticated - requires user linkage first
 */
export function isAuthenticated(req: Request): boolean {
  const ctx = getAuthContext(req);
  return ctx.mode === 'gpt_session' || ctx.mode === 'api_key';
}

/**
 * Check if request has a valid session that could be used for billing
 * (either fully authenticated OR provisional with potential for linkage)
 */
export function hasValidSession(req: Request): boolean {
  const ctx = getAuthContext(req);
  return ctx.mode === 'gpt_session' || ctx.mode === 'gpt_provisional' || ctx.mode === 'api_key';
}

/**
 * Check if request is in provisional mode (needs user linkage)
 */
export function isProvisional(req: Request): boolean {
  const ctx = getAuthContext(req);
  return ctx.mode === 'gpt_provisional';
}

/**
 * Generate a deterministic RFC-4122 compliant UUID v4 from session fingerprint
 * Uses SHA-256 hash with proper version (4) and variant (10xx) bits
 */
function generateDeterministicUUID(fingerprint: string): string {
  const hashBytes = createHash('sha256').update(`gpt-user:${fingerprint}`).digest();
  // Set version to 4 (0100 in bits 12-15 of time_hi_and_version)
  hashBytes[6] = (hashBytes[6] & 0x0f) | 0x40;
  // Set variant to RFC 4122 (10xx in bits 0-1 of clock_seq_hi_and_reserved)
  hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;
  // Use slice directly on Buffer digest (already hex-safe in Node.js)
  const hex = hashBytes.slice(0, 16).toString('hex');
  // Format as UUID: 8-4-4-4-12 (total 32 hex chars + 4 dashes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Resolve or create a user for provisional/session-based auth
 * This creates a real user record that can be used for credits billing
 * Also updates the auth context for downstream handlers
 */
export async function resolveOrCreateSessionUser(req: Request): Promise<string | null> {
  const ctx = getAuthContext(req);
  
  // If already have a userId, return it
  if (ctx.userId) {
    return ctx.userId;
  }
  
  // For provisional sessions, create a user from the session
  if ((ctx.mode === 'gpt_provisional' || ctx.mode === 'gpt_session') && ctx.session) {
    try {
      // Generate deterministic UUID from session fingerprint (FK-safe format)
      const sessionFingerprint = ctx.session.sessionFingerprint || `session-${ctx.session.id}`;
      const gptUserId = generateDeterministicUUID(sessionFingerprint);
      
      // Create user if doesn't exist (similar to creditsService pattern)
      let user = await storage.getUser(gptUserId);
      
      if (!user) {
        // Create provisional user from session data
        const email = ctx.session.email || `gpt-${ctx.session.id}@gpt-user.coinrailz.com`;
        
        console.log(`🤖 Creating GPT session user: ${gptUserId}`);
        user = await storage.createUser({
          id: gptUserId,
          email,
        });
        
        // Link session to newly created user
        await storage.linkGptSessionToUser(ctx.session.id, gptUserId);
      }
      
      // Update auth context for downstream handlers (critical for same-request flow)
      ctx.userId = gptUserId;
      ctx.user = user;
      // Also update session object to reflect linkage
      if (ctx.session) {
        ctx.session = { ...ctx.session, userId: gptUserId };
      }
      if (ctx.mode === 'gpt_provisional') {
        ctx.mode = 'gpt_session'; // Upgrade to full session after user creation
      }
      
      // Reassign updated context back to request for downstream consumers
      (req as any).authContext = ctx;
      
      return gptUserId;
    } catch (error) {
      console.error('[GPT Auth] Failed to resolve/create session user:', error);
      return null;
    }
  }
  
  return null;
}

/**
 * Get the real userId for credits/billing (FK-safe)
 * Returns ONLY real user IDs that exist in users table
 * Does NOT return synthetic IDs - those would break FK constraints
 */
export function getRealUserId(req: Request): string | null {
  const ctx = getAuthContext(req);
  
  // Only return userId if it's a real user ID
  if (ctx.userId) {
    return ctx.userId;
  }
  
  return null;
}

/**
 * Get session ID for provisional linkage flows
 */
export function getProvisionaSessionId(req: Request): number | null {
  const ctx = getAuthContext(req);
  if (ctx.mode === 'gpt_provisional' && ctx.provisionalSessionId) {
    return ctx.provisionalSessionId;
  }
  return null;
}

// Legacy alias for backward compatibility
export function getClientId(req: Request): string | null {
  return getRealUserId(req);
}

/**
 * Refresh and validate auth context after session resolution
 * Throws error if context is not properly linked
 */
export async function refreshAndValidateAuthContext(req: Request): Promise<{ userId: string; authContext: AuthContext }> {
  // First, try to resolve or create user
  const userId = await resolveOrCreateSessionUser(req);
  
  // Re-read auth context after resolution
  const authContext = getAuthContext(req);
  
  // Validate that context is properly linked
  if (!userId || !authContext.userId || authContext.userId !== userId) {
    throw new Error('GPT session not properly linked - userId mismatch or missing');
  }
  
  if (authContext.mode !== 'gpt_session' && authContext.mode !== 'api_key') {
    throw new Error(`GPT session not properly linked - unexpected mode: ${authContext.mode}`);
  }
  
  return { userId, authContext };
}
