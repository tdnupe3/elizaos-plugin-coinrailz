/**
 * API KEY VALIDATION & ACCESS CONTROL MIDDLEWARE
 * Validates AI agent API keys and enforces subscription limits
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from '../storage';
import { AIAgentSubscription, AIAgentProduct } from '@shared/schema';

interface AuthenticatedRequest extends Request {
  subscription?: AIAgentSubscription;
  product?: AIAgentProduct;
  apiKey?: string;
}

interface UsageStats {
  requests_today: number;
  requests_month: number;
  last_reset: string;
}

export class APIKeyValidator {
  private cache = new Map<string, { subscription: AIAgentSubscription; product: AIAgentProduct; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private isToday(date: string): boolean {
    const today = new Date();
    const checkDate = new Date(date);
    return today.toDateString() === checkDate.toDateString();
  }

  private isThisMonth(date: string): boolean {
    const today = new Date();
    const checkDate = new Date(date);
    return today.getFullYear() === checkDate.getFullYear() && 
           today.getMonth() === checkDate.getMonth();
  }

  private async resetUsageIfNeeded(subscription: AIAgentSubscription): Promise<AIAgentSubscription> {
    const stats = subscription.usageStats as UsageStats;
    if (!stats || !stats.last_reset) {
      // Initialize usage stats
      const newStats = {
        requests_today: 0,
        requests_month: 0,
        last_reset: new Date().toISOString()
      };
      
      await storage.updateSubscriptionUsage(subscription.id, newStats);
      return { ...subscription, usageStats: newStats };
    }

    let needsUpdate = false;
    const updatedStats = { ...stats };

    // Reset daily count if it's a new day
    if (!this.isToday(stats.last_reset)) {
      updatedStats.requests_today = 0;
      needsUpdate = true;
    }

    // Reset monthly count if it's a new month
    if (!this.isThisMonth(stats.last_reset)) {
      updatedStats.requests_month = 0;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updatedStats.last_reset = new Date().toISOString();
      await storage.updateSubscriptionUsage(subscription.id, updatedStats);
      return { ...subscription, usageStats: updatedStats };
    }

    return subscription;
  }

  private async validateLimits(subscription: AIAgentSubscription, product: AIAgentProduct): Promise<{ allowed: boolean; reason?: string }> {
    const stats = subscription.usageStats as UsageStats;
    const limits = product.requestLimits as { daily: number | string; monthly: number | string };

    // Unlimited access for enterprise plans
    if (limits.daily === 'unlimited' || limits.monthly === 'unlimited') {
      return { allowed: true };
    }

    // Check daily limit
    if (typeof limits.daily === 'number' && stats.requests_today >= limits.daily) {
      return { 
        allowed: false, 
        reason: `Daily limit exceeded (${stats.requests_today}/${limits.daily})` 
      };
    }

    // Check monthly limit
    if (typeof limits.monthly === 'number' && stats.requests_month >= limits.monthly) {
      return { 
        allowed: false, 
        reason: `Monthly limit exceeded (${stats.requests_month}/${limits.monthly})` 
      };
    }

    return { allowed: true };
  }

  private async incrementUsage(subscription: AIAgentSubscription): Promise<void> {
    const stats = subscription.usageStats as UsageStats;
    const updatedStats = {
      ...stats,
      requests_today: stats.requests_today + 1,
      requests_month: stats.requests_month + 1,
      last_reset: stats.last_reset
    };

    await storage.updateSubscriptionUsage(subscription.id, updatedStats);
  }

  public validateAPIKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'API key required', 
          message: 'Please provide a valid API key in the Authorization header as "Bearer YOUR_API_KEY"'
        });
      }

      const apiKey = authHeader.substring(7); // Remove 'Bearer '
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Check cache first
      const cached = this.cache.get(apiKeyHash);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        req.subscription = cached.subscription;
        req.product = cached.product;
        req.apiKey = apiKey;
        return next();
      }

      // Validate API key
      let subscription = await storage.getSubscriptionByApiKey(apiKeyHash);
      if (!subscription) {
        return res.status(401).json({ 
          error: 'Invalid API key',
          message: 'The provided API key is not valid or has been revoked'
        });
      }

      // Check subscription status
      if (subscription.status !== 'active') {
        return res.status(403).json({ 
          error: 'Subscription inactive',
          message: `Subscription status: ${subscription.status}. Please renew your subscription.`
        });
      }

      // Check if subscription has expired
      if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
        await storage.updateSubscription(subscription.id, { status: 'expired' });
        return res.status(403).json({ 
          error: 'Subscription expired',
          message: 'Your subscription has expired. Please renew to continue using the API.'
        });
      }

      // Get product details
      const product = await storage.getProductById(subscription.productId);
      if (!product || !product.isActive) {
        return res.status(403).json({ 
          error: 'Product unavailable',
          message: 'The associated product is no longer available'
        });
      }

      // Reset usage stats if needed
      subscription = await this.resetUsageIfNeeded(subscription);

      // Validate limits
      const limitCheck = await this.validateLimits(subscription, product);
      if (!limitCheck.allowed) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          message: limitCheck.reason,
          usage: subscription.usageStats,
          limits: product.requestLimits
        });
      }

      // Cache the validated subscription and product
      this.cache.set(apiKeyHash, { 
        subscription, 
        product, 
        timestamp: Date.now() 
      });

      // Increment usage
      await this.incrementUsage(subscription);

      // Attach to request
      req.subscription = subscription;
      req.product = product;
      req.apiKey = apiKey;

      console.log(`✅ API key validated for agent ${subscription.agentId} (${product.name})`);
      next();

    } catch (error) {
      console.error('API key validation error:', error);
      res.status(500).json({ 
        error: 'Authentication service error',
        message: 'Unable to validate API key. Please try again.'
      });
    }
  };

  public validateEndpointAccess = (endpoint: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const product = req.product;
      
      if (!product) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const apiEndpoints = product.apiEndpoints as string[];
      
      // Check if endpoint is allowed
      const isAllowed = apiEndpoints.some(allowedEndpoint => {
        if (allowedEndpoint.endsWith('/*')) {
          const baseEndpoint = allowedEndpoint.slice(0, -2);
          return endpoint.startsWith(baseEndpoint);
        }
        return endpoint === allowedEndpoint;
      });

      if (!isAllowed) {
        return res.status(403).json({ 
          error: 'Endpoint not allowed',
          message: `Your subscription (${product.name}) does not include access to ${endpoint}`,
          allowedEndpoints: apiEndpoints
        });
      }

      next();
    };
  };

  public clearCache(): void {
    this.cache.clear();
  }
}

export const apiKeyValidator = new APIKeyValidator();

// Middleware functions
export const validateAPIKey = apiKeyValidator.validateAPIKey;
export const validateEndpointAccess = (endpoint: string) => apiKeyValidator.validateEndpointAccess(endpoint);