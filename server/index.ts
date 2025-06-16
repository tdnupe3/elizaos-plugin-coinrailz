import express, { type Request, Response, NextFunction } from "express";
import productionRoutes from "./productionRoutes";
import criticalRoutes from "./criticalRoutes";
import { setupVite } from "./vite";
import { serveStatic } from "./productionStatic";
import { setupAuth } from "./replitAuth";
import { registerAuthRoutes } from "./authRoutes";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { getProductionConfig, configureProductionSecurity, initializeProductionMonitoring } from "./productionConfig";
import { monitoring as advancedMonitoring } from "./monitoring";


// Force production mode if deployed (regardless of npm script used)
if (process.env.REPLIT_DEPLOYMENT || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL) {
  process.env.NODE_ENV = 'production';
}

const app = express();
const productionConfig = getProductionConfig();

// Production-aware middleware configuration
if (productionConfig.server.enableCompression) {
  app.use(compression());
}

// Initialize production monitoring
const monitoring = initializeProductionMonitoring(productionConfig);

// Production-aware CORS configuration
app.use((req: Request, res: Response, next: NextFunction) => {
  const devDomain = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '';
  const allowedOrigins = productionConfig.security.corsOrigins.concat(devDomain ? [devDomain] : []);

  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Production-aware security configuration
configureProductionSecurity(app, productionConfig);

// Request logging middleware
function log(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // Record metrics for advanced monitoring
    try {
      advancedMonitoring.recordMetric('request', 1);
      advancedMonitoring.recordMetric('response_time', duration);
      if (res.statusCode >= 400) {
        advancedMonitoring.recordMetric('error', 1);
      }
    } catch (error) {
      // Graceful degradation - monitoring failures don't affect logging
    }
    
    if (path.startsWith("/api")) {
      let logLine = req.method + ' ' + path + ' ' + res.statusCode + ' in ' + duration + 'ms';
      if (capturedJsonResponse) {
        logLine += ' :: ' + JSON.stringify(capturedJsonResponse);
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
}

app.use(log);

// Production stability system
import { initializeStability } from './stability';
initializeStability();

let httpServer: any;

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (httpServer) {
    httpServer.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  if (httpServer) {
    httpServer.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  }
});

(async () => {
  try {
    const port = parseInt(process.env.PORT || '5000', 10);
    const host = '0.0.0.0';

    // Essential middleware for request body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Setup production authentication system
    const { setupProductionAuth } = await import('./productionAuth');
    setupProductionAuth(app);

    // Add critical routes FIRST to ensure API functionality
    app.use(criticalRoutes);
    
    // Add remaining production routes
    app.use(productionRoutes);

    // Health check endpoint (non-conflicting with frontend)
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'Coin Railz',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Initialize HTTP server
    httpServer = app.listen(port, host, () => {
      console.log(`Server running on ${host}:${port} (${process.env.NODE_ENV || 'development'})`);
    });

    // Handle server listening errors
    httpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

    // Global error handler BEFORE Vite setup
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('Global error handler:', status + ': ' + message);

      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    });

    // Production vs Development serving
    if (process.env.NODE_ENV === 'production') {
      // Production: serve static files from dist
      await serveStatic(app);
    } else {
      // Development: use Vite HMR
      await setupVite(app, httpServer);
    }

    // Production health monitoring with memory tracking
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        // Record memory metrics
        try {
          advancedMonitoring.recordMetric('memory', memoryMB);
        } catch (error) {
          // Graceful degradation
        }
        
        console.log(`Health check: Server responding on port ${port}, Memory: ${memoryMB}MB`);
      }, 60000); // Every minute
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();