import express, { type Request, Response, NextFunction } from "express";
import productionRoutes from "./productionRoutes";
import { setupVite, serveStatic } from "./vite";
import { stability } from './stability';
import { stabilityManager } from './services/stabilityManager';
import { setupProductionErrorHandling } from './middleware/productionStabilityWrapper';
import { setupGlobalCrashPrevention } from './middleware/productionCrashPrevention';
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

// Performance middleware
app.use(compression());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

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

// Initialize comprehensive stability system
setupProductionErrorHandling();
setupGlobalCrashPrevention();
stability.setupGlobalHandlers();
const stableManager = stabilityManager;
console.log('Production Stability System activated - comprehensive crash prevention enabled');

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

    // Add basic health check endpoint BEFORE route registration
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'Coin Railz',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Simple root endpoint for deployment health checks
    app.get('/', (req, res) => {
      if (process.env.NODE_ENV === 'production') {
        res.json({ 
          status: 'ok', 
          service: 'Coin Railz Platform',
          timestamp: new Date().toISOString()
        });
      } else {
        // In development, show basic status
        res.json({ 
          status: 'development', 
          service: 'Coin Railz Platform',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Use production routes
    app.use(productionRoutes);

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

    // Setup Vite for both development and production
    await setupVite(app, httpServer);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error(status + ': ' + message);

      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    });

    // Production health monitoring
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        console.log(`Health check: Server responding on port ${port}`);
      }, 60000); // Every minute
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();