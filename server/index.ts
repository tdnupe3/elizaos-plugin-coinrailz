import express, { type Request, Response, NextFunction } from "express";
import productionRoutes from "./productionRoutes";
import criticalRoutes from "./criticalRoutes";
import { setupVite, serveStatic } from "./vite";
import { setupAuth } from "./replitAuth";
import { registerAuthRoutes } from "./authRoutes";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";


const app = express();

// Performance middleware
app.use(compression());

// CORS middleware - Essential for mobile apps and partner integrations
app.use((req: Request, res: Response, next: NextFunction) => {
  // Allow requests from your domains and development
  const allowedOrigins = [
    'https://coinrailz.com',
    'https://www.coinrailz.com',
    'https://app.coinrailz.com',
    'https://api.coinrailz.com',
    'http://localhost:3000',
    'http://localhost:5000',
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null
  ].filter(Boolean);

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

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit for development
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

// Simple crash prevention
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection prevented:', reason?.message || reason);
});

process.on('uncaughtException', (error: any) => {
  console.error('Uncaught exception prevented:', error.message);
});

console.log('Basic crash prevention activated');

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

    // Setup authentication system
    await setupAuth(app);
    registerAuthRoutes(app);

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

    // Setup Vite AFTER API routes (this handles React app serving for non-API routes)
    await setupVite(app, httpServer);

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