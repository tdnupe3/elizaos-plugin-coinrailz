/**
 * 🔐 API AUTHENTICATION MIDDLEWARE
 * Validates purchased API keys and enforces usage limits
 * CRITICAL: Ensures only paying customers can access premium APIs
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { aiAgentSubscriptions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  subscription?: any;
  agentId?: string;
  usageRemaining?: number;
}

/**
 * 🔑 VALIDATE API KEY MIDDLEWARE
 * Ensures only paying customers can access premium APIs
 */
export const validateAPIKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Extract API key from Authorization header or x-api-key header
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];
    
    let apiKey: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    } else if (apiKeyHeader) {
      apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    }
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Include Authorization: Bearer <key> or X-API-Key header',
        getAccess: 'https://coinrailz.com/api/ai-products/products'
      });
    }
    
    // Hash the API key to match stored hash
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // Find active subscription with this API key
    const subscriptions = await db.select()
      .from(aiAgentSubscriptions)
      .where(eq(aiAgentSubscriptions.apiKey, apiKeyHash))
      .limit(1);
    
    if (subscriptions.length === 0) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'API key not found or expired',
        getAccess: 'https://coinrailz.com/api/ai-products/products'
      });
    }
    
    const subscription = subscriptions[0];
    
    // Check subscription status
    if (subscription.status !== 'active') {
      return res.status(403).json({
        error: 'Subscription inactive',
        message: `Subscription status: ${subscription.status}`,
        renewAccess: 'https://coinrailz.com/api/ai-products/products'
      });
    }
    
    // Check if subscription has expired
    if (subscription.endDate && new Date() > subscription.endDate) {
      return res.status(403).json({
        error: 'Subscription expired',
        message: 'Please renew your subscription',
        renewAccess: 'https://coinrailz.com/api/ai-products/products'
      });
    }
    
    // Check usage limits based on product tier
    const usageCheck = await checkUsageLimits(subscription, req.path);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        message: usageCheck.message,
        currentUsage: usageCheck.currentUsage,
        upgradeOptions: 'https://coinrailz.com/api/ai-products/products'
      });
    }
    
    // Attach subscription info to request
    req.subscription = subscription;
    req.agentId = subscription.agentId;
    req.usageRemaining = usageCheck.remaining;
    
    // Track this API call
    await trackAPIUsage(subscription.id, req.path, req.method);
    
    console.log(`✅ API access granted to agent ${subscription.agentId} (${req.method} ${req.path})`);
    next();
    
  } catch (error) {
    console.error('API authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal authentication error'
    });
  }
};

/**
 * 📊 CHECK USAGE LIMITS BASED ON SUBSCRIPTION TIER
 */
async function checkUsageLimits(subscription: any, endpoint: string): Promise<{
  allowed: boolean;
  message?: string;
  currentUsage?: number;
  remaining?: number;
}> {
  try {
    // Parse usage stats
    const usageStats = subscription.usageStats || { 
      requests_today: 0, 
      requests_month: 0, 
      last_reset: new Date().toISOString() 
    };
    
    // Get product limits based on product ID
    const productLimits = getProductLimits(subscription.productId);
    
    // Check daily limits
    if (productLimits.dailyLimit && usageStats.requests_today >= productLimits.dailyLimit) {
      return {
        allowed: false,
        message: `Daily limit of ${productLimits.dailyLimit} requests exceeded`,
        currentUsage: usageStats.requests_today
      };
    }
    
    // Check monthly limits
    if (productLimits.monthlyLimit && usageStats.requests_month >= productLimits.monthlyLimit) {
      return {
        allowed: false,
        message: `Monthly limit of ${productLimits.monthlyLimit} requests exceeded`,
        currentUsage: usageStats.requests_month
      };
    }
    
    // Check endpoint-specific limits
    if (productLimits.restrictedEndpoints && productLimits.restrictedEndpoints.some(ep => endpoint.includes(ep))) {
      return {
        allowed: false,
        message: `Endpoint ${endpoint} requires higher tier subscription`,
        currentUsage: usageStats.requests_month
      };
    }
    
    return {
      allowed: true,
      remaining: productLimits.monthlyLimit ? productLimits.monthlyLimit - usageStats.requests_month : undefined
    };
    
  } catch (error) {
    console.error('Usage limit check error:', error);
    return { allowed: true }; // Allow on error to avoid blocking paying customers
  }
}

/**
 * 📈 GET PRODUCT LIMITS BASED ON PRODUCT ID
 */
function getProductLimits(productId: number): {
  dailyLimit?: number;
  monthlyLimit?: number;
  restrictedEndpoints?: string[];
} {
  const limits = {
    1: { // Starter
      dailyLimit: 1000,
      monthlyLimit: 30000,
      restrictedEndpoints: ['/api/enterprise-data', '/api/trading/signals']
    },
    2: { // Pro
      dailyLimit: 5000,
      monthlyLimit: 150000,
      restrictedEndpoints: ['/api/enterprise-data']
    },
    3: { // Enterprise
      dailyLimit: undefined, // unlimited
      monthlyLimit: undefined, // unlimited
      restrictedEndpoints: []
    }
  };
  
  return limits[productId] || limits[1]; // Default to starter limits
}

/**
 * 📝 TRACK API USAGE FOR BILLING AND LIMITS
 */
async function trackAPIUsage(subscriptionId: string, endpoint: string, method: string): Promise<void> {
  try {
    // Get current subscription
    const subscriptions = await db.select()
      .from(aiAgentSubscriptions)
      .where(eq(aiAgentSubscriptions.id, subscriptionId))
      .limit(1);
    
    if (subscriptions.length === 0) return;
    
    const subscription = subscriptions[0];
    const usageStats = subscription.usageStats || { 
      requests_today: 0, 
      requests_month: 0, 
      last_reset: new Date().toISOString() 
    };
    
    // Check if we need to reset daily counter
    const lastReset = new Date(usageStats.last_reset);
    const now = new Date();
    const shouldResetDaily = now.getDate() !== lastReset.getDate() || 
                            now.getMonth() !== lastReset.getMonth() ||
                            now.getFullYear() !== lastReset.getFullYear();
    
    // Check if we need to reset monthly counter
    const shouldResetMonthly = now.getMonth() !== lastReset.getMonth() ||
                              now.getFullYear() !== lastReset.getFullYear();
    
    // Update usage stats
    const newUsageStats = {
      requests_today: shouldResetDaily ? 1 : usageStats.requests_today + 1,
      requests_month: shouldResetMonthly ? 1 : usageStats.requests_month + 1,
      last_reset: shouldResetDaily ? now.toISOString() : usageStats.last_reset,
      last_request: now.toISOString(),
      last_endpoint: endpoint,
      last_method: method
    };
    
    // Update in database
    await db.update(aiAgentSubscriptions)
      .set({ 
        usageStats: newUsageStats,
        updatedAt: now
      })
      .where(eq(aiAgentSubscriptions.id, subscriptionId));
    
    console.log(`📊 Usage tracked: ${subscriptionId} - ${method} ${endpoint} (${newUsageStats.requests_today} today, ${newUsageStats.requests_month} this month)`);
    
  } catch (error) {
    console.error('Failed to track API usage:', error);
  }
}

/**
 * 🎯 REQUIRE SPECIFIC SUBSCRIPTION TIER
 * Middleware to enforce minimum subscription level for premium endpoints
 */
export const requireTier = (minProductId: number) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.subscription) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'API key required for this endpoint'
      });
    }
    
    if (req.subscription.productId < minProductId) {
      const tierNames = { 1: 'Starter', 2: 'Pro', 3: 'Enterprise' };
      return res.status(403).json({
        error: 'Insufficient subscription tier',
        message: `This endpoint requires ${tierNames[minProductId]} tier or higher`,
        currentTier: tierNames[req.subscription.productId],
        upgradeUrl: 'https://coinrailz.com/api/ai-products/products'
      });
    }
    
    next();
  };
};

export default { validateAPIKey, requireTier };