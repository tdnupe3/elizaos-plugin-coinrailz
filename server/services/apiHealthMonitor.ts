/**
 * API Health Monitoring Service
 * Monitors all external API integrations and system health
 */

import { env } from '../environment';
import { stripe as _stripeFactory } from './stripeClient';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: Date;
  error?: string;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  services: HealthCheck[];
  uptime: number;
  version: string;
}

export class APIHealthMonitor {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeHealthChecks();
  }

  private initializeHealthChecks() {
    // Start monitoring all critical services
    this.startMonitoring('stripe', this.checkStripeHealth.bind(this), 300000); // 5 minutes
    this.startMonitoring('paypal', this.checkPayPalHealth.bind(this), 300000);
    this.startMonitoring('nowpayments', this.checkNOWPaymentsHealth.bind(this), 300000);
    this.startMonitoring('changenow', this.checkChangeNOWHealth.bind(this), 300000);
    this.startMonitoring('database', this.checkDatabaseHealth.bind(this), 120000); // 2 minutes
    this.startMonitoring('coingecko', this.checkCoinGeckoHealth.bind(this), 600000); // 10 minutes
  }

  private startMonitoring(serviceName: string, healthCheck: () => Promise<HealthCheck>, interval: number) {
    // Initial check
    healthCheck().then(result => {
      this.healthChecks.set(serviceName, result);
    });

    // Periodic checks
    const intervalId = setInterval(async () => {
      try {
        const result = await healthCheck();
        this.healthChecks.set(serviceName, result);
      } catch (error) {
        console.error(`Health check failed for ${serviceName}:`, error);
      }
    }, interval);

    this.checkIntervals.set(serviceName, intervalId);
  }

  private async checkStripeHealth(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      if (!env.STRIPE_SECRET_KEY) {
        return {
          service: 'stripe',
          status: 'down',
          responseTime: 0,
          lastCheck: new Date(),
          error: 'API key not configured'
        };
      }

      await _stripeFactory.customers.list({ limit: 1 });
      
      return {
        service: 'stripe',
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date()
      };
    } catch (error: any) {
      return {
        service: 'stripe',
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  private async checkPayPalHealth(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
        return {
          service: 'paypal',
          status: 'down',
          responseTime: 0,
          lastCheck: new Date(),
          error: 'API credentials not configured'
        };
      }

      // Basic PayPal API health check
      const response = await fetch('https://api.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (response.ok) {
        return {
          service: 'paypal',
          status: 'healthy',
          responseTime: Date.now() - start,
          lastCheck: new Date()
        };
      } else {
        throw new Error(`PayPal API returned ${response.status}`);
      }
    } catch (error: any) {
      return {
        service: 'paypal',
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  private async checkNOWPaymentsHealth(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      if (!env.NOWPAYMENTS_API_KEY) {
        return {
          service: 'nowpayments',
          status: 'down',
          responseTime: 0,
          lastCheck: new Date(),
          error: 'API key not configured'
        };
      }

      const response = await fetch('https://api.nowpayments.io/v1/status', {
        headers: {
          'x-api-key': env.NOWPAYMENTS_API_KEY
        }
      });

      if (response.ok) {
        return {
          service: 'nowpayments',
          status: 'healthy',
          responseTime: Date.now() - start,
          lastCheck: new Date()
        };
      } else {
        throw new Error(`NOWPayments API returned ${response.status}`);
      }
    } catch (error: any) {
      return {
        service: 'nowpayments',
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  private async checkChangeNOWHealth(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      if (!env.CHANGENOW_API_KEY) {
        return {
          service: 'changenow',
          status: 'down',
          responseTime: 0,
          lastCheck: new Date(),
          error: 'API key not configured'
        };
      }

      const response = await fetch(`https://api.changenow.io/v1/currencies?active=true&fixedRate=true`, {
        headers: {
          'X-API-KEY': env.CHANGENOW_API_KEY
        }
      });

      if (response.ok) {
        return {
          service: 'changenow',
          status: 'healthy',
          responseTime: Date.now() - start,
          lastCheck: new Date()
        };
      } else {
        throw new Error(`ChangeNOW API returned ${response.status}`);
      }
    } catch (error: any) {
      return {
        service: 'changenow',
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const { db } = await import('../db');
      
      // Simple query to check database connectivity
      await db.execute('SELECT 1');
      
      return {
        service: 'database',
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date()
      };
    } catch (error: any) {
      return {
        service: 'database',
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  private async checkCoinGeckoHealth(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const apiKey = env.COINGECKO_API_KEY;
      const url = apiKey 
        ? `https://pro-api.coingecko.com/api/v3/ping?x_cg_pro_api_key=${apiKey}`
        : 'https://api.coingecko.com/api/v3/ping';

      const response = await fetch(url);

      if (response.ok) {
        return {
          service: 'coingecko',
          status: 'healthy',
          responseTime: Date.now() - start,
          lastCheck: new Date()
        };
      } else {
        throw new Error(`CoinGecko API returned ${response.status}`);
      }
    } catch (error: any) {
      return {
        service: 'coingecko',
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  getSystemHealth(): SystemHealth {
    const services = Array.from(this.healthChecks.values());
    
    // Determine overall health
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    const totalServices = services.length;
    
    let overall: 'healthy' | 'degraded' | 'down';
    if (healthyServices === totalServices) {
      overall = 'healthy';
    } else if (healthyServices >= totalServices * 0.7) {
      overall = 'degraded';
    } else {
      overall = 'down';
    }

    return {
      overall,
      services,
      uptime: process.uptime(),
      version: '1.0.0'
    };
  }

  getServiceHealth(serviceName: string): HealthCheck | null {
    return this.healthChecks.get(serviceName) || null;
  }

  getCriticalServicesStatus(): { critical: string[]; degraded: string[]; healthy: string[] } {
    const critical: string[] = [];
    const degraded: string[] = [];
    const healthy: string[] = [];

    this.healthChecks.forEach((health, serviceName) => {
      switch (health.status) {
        case 'down':
          critical.push(serviceName);
          break;
        case 'degraded':
          degraded.push(serviceName);
          break;
        case 'healthy':
          healthy.push(serviceName);
          break;
      }
    });

    return { critical, degraded, healthy };
  }

  stop() {
    // Clear all monitoring intervals
    this.checkIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.checkIntervals.clear();
  }
}

export const apiHealthMonitor = new APIHealthMonitor();