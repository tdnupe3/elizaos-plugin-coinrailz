/**
 * Production Configuration Management
 * Addresses environment separation and production hardening
 */

export interface ProductionConfig {
  isProduction: boolean;
  database: {
    poolSize: number;
    connectionTimeout: number;
    idleTimeout: number;
  };
  security: {
    enableHelmet: boolean;
    enableRateLimit: boolean;
    corsOrigins: string[];
  };
  monitoring: {
    enableHealthChecks: boolean;
    healthCheckInterval: number;
    enablePerformanceMetrics: boolean;
  };
  server: {
    port: number;
    host: string;
    enableCompression: boolean;
  };
}

export function getProductionConfig(): ProductionConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    isProduction,
    database: {
      poolSize: isProduction ? 20 : 5,
      connectionTimeout: isProduction ? 10000 : 5000,
      idleTimeout: isProduction ? 30000 : 10000,
    },
    security: {
      enableHelmet: isProduction,
      enableRateLimit: isProduction,
      corsOrigins: isProduction 
        ? ['https://coinrailz.com', 'https://www.coinrailz.com', 'https://app.coinrailz.com']
        : ['http://localhost:3000', 'http://localhost:5000'],
    },
    monitoring: {
      enableHealthChecks: isProduction,
      healthCheckInterval: isProduction ? 60000 : 300000,
      enablePerformanceMetrics: isProduction,
    },
    server: {
      port: parseInt(process.env.PORT || '5000'),
      host: isProduction ? '0.0.0.0' : 'localhost',
      enableCompression: isProduction,
    },
  };
}

// Production-specific middleware configuration
export function configureProductionSecurity(app: any, config: ProductionConfig) {
  if (config.security.enableHelmet) {
    const helmet = require('helmet');
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:", "wss:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));
  }

  if (config.security.enableRateLimit) {
    const rateLimit = require('express-rate-limit');
    app.use('/api', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: config.isProduction ? 100 : 1000, // Stricter in production
      message: 'Too many requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    }));
  }
}

// Production monitoring setup
export function initializeProductionMonitoring(config: ProductionConfig) {
  if (!config.monitoring.enableHealthChecks) return;

  let requestCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  const reportMetrics = () => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const memory = process.memoryUsage();
    
    console.log(`[PRODUCTION METRICS] Uptime: ${uptime}s, Requests: ${requestCount}, Errors: ${errorCount}, Memory: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
    
    // Reset counters periodically
    if (requestCount > 10000) {
      requestCount = Math.floor(requestCount / 2);
      errorCount = Math.floor(errorCount / 2);
    }
  };

  setInterval(reportMetrics, config.monitoring.healthCheckInterval);

  return {
    incrementRequest: () => requestCount++,
    incrementError: () => errorCount++,
    getMetrics: () => ({ requestCount, errorCount, uptime: Date.now() - startTime }),
  };
}