import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { stability } from "./stability";
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
stability.setupGlobalHandlers();
console.log('Stability Manager activated - crash prevention enabled');

let server: any;

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (server) {
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  if (server) {
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  }
});

(async () => {
  try {
    server = await stability.safeExecute(
      () => registerRoutes(app),
      null,
      'route_registration'
    );

    // API route handler middleware - catch unhandled API routes before Vite
    app.use('/api/*', (req, res) => {
      res.status(404).json({ 
        success: false, 
        message: 'API endpoint not found: ' + req.originalUrl 
      });
    });

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      stability.safeExecute(
        () => {
          const status = err.status || err.statusCode || 500;
          const message = err.message || "Internal Server Error";
          console.error(status + ': ' + message);
          res.status(status).json({ message });
        },
        () => res.status(500).json({ message: "Server error" }),
        'error_handler'
      );
    });

    // Production-ready port configuration
    const port = parseInt(process.env.PORT || '5000', 10);
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    
    server.listen(port, host, () => {
      console.log(`Server running on ${host}:${port} (${process.env.NODE_ENV || 'development'})`);
      
      // Production health monitoring
      if (process.env.NODE_ENV === 'production') {
        setInterval(() => {
          console.log(`Health check: Server responding on port ${port}`);
        }, 60000); // Every minute
      }
    });

    // Handle server listening errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
    } else {
      // Production: serve static files
      serveStatic(app);
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();