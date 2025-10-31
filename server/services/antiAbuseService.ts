import crypto from 'crypto';
import { db } from '../db';
import { freeCreditsClaimLog } from '@shared/schema';
import { sql, and, gte } from 'drizzle-orm';

/**
 * Anti-Abuse Service for Free Credits Claims
 * Prevents abuse through IP tracking and browser fingerprinting
 */
export class AntiAbuseService {
  
  /**
   * Generate browser fingerprint from request headers and client data
   */
  static generateFingerprint(req: any, clientFingerprint?: string): string {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      clientFingerprint || '', // Optional client-side fingerprint
    ];
    
    const fingerprintString = components.join('|');
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * Get client IP address from request (handles proxies)
   */
  static getClientIP(req: any): string {
    return (
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Check if IP or fingerprint has claimed free credits in last 24 hours
   * Returns: { allowed: boolean, reason?: string }
   */
  static async canClaimFreeCredits(
    ipAddress: string,
    fingerprint: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      // Check for recent claims from this IP
      const ipClaims = await db
        .select()
        .from(freeCreditsClaimLog)
        .where(
          and(
            sql`${freeCreditsClaimLog.ipAddress} = ${ipAddress}`,
            gte(freeCreditsClaimLog.claimedAt, twentyFourHoursAgo)
          )
        )
        .limit(1);

      if (ipClaims.length > 0) {
        return {
          allowed: false,
          reason: 'This IP address has already claimed free credits within the last 24 hours',
        };
      }

      // Check for recent claims from this fingerprint
      const fingerprintClaims = await db
        .select()
        .from(freeCreditsClaimLog)
        .where(
          and(
            sql`${freeCreditsClaimLog.fingerprint} = ${fingerprint}`,
            gte(freeCreditsClaimLog.claimedAt, twentyFourHoursAgo)
          )
        )
        .limit(1);

      if (fingerprintClaims.length > 0) {
        return {
          allowed: false,
          reason: 'This device has already claimed free credits within the last 24 hours',
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking free credits eligibility:', error);
      // Fail open - allow claim if database check fails
      return { allowed: true };
    }
  }

  /**
   * Log a successful free credit claim
   */
  static async logClaim(
    ipAddress: string,
    fingerprint: string,
    userId: string | null,
    sessionId: string | null,
    userAgent: string | null
  ): Promise<void> {
    try {
      await db.insert(freeCreditsClaimLog).values({
        ipAddress,
        fingerprint,
        userId,
        sessionId,
        userAgent,
      });
    } catch (error) {
      console.error('Error logging free credits claim:', error);
      // Non-blocking - don't fail the claim if logging fails
    }
  }

  /**
   * Get claim statistics for monitoring
   */
  static async getClaimStats(hours: number = 24): Promise<{
    totalClaims: number;
    uniqueIPs: number;
    uniqueFingerprints: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    try {
      const claims = await db
        .select()
        .from(freeCreditsClaimLog)
        .where(gte(freeCreditsClaimLog.claimedAt, since));

      const uniqueIPs = new Set(claims.map((c) => c.ipAddress)).size;
      const uniqueFingerprints = new Set(claims.map((c) => c.fingerprint)).size;

      return {
        totalClaims: claims.length,
        uniqueIPs,
        uniqueFingerprints,
      };
    } catch (error) {
      console.error('Error getting claim stats:', error);
      return { totalClaims: 0, uniqueIPs: 0, uniqueFingerprints: 0 };
    }
  }
}
