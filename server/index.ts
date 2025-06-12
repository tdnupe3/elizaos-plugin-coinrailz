import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { AgentMarketplaceService } from "./services/agentMarketplaceService";
import { CommissionScheduler } from "./services/commissionScheduler";

console.log('Starting server with environment:', {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'missing',
  SESSION_SECRET: process.env.SESSION_SECRET ? 'configured' : 'missing'
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize AI Agent Marketplace at startup
    await AgentMarketplaceService.initializeMarketplace();

    // Start commission payment scheduler
    CommissionScheduler.start();

    // Register demo routes first (development only)
    if (process.env.NODE_ENV === 'development') {
      let demoUserToken: string | null = null;
      
      app.post('/api/demo/authenticate', (req, res) => {
        const demoUser = {
          id: 'demo-user-123',
          email: 'demo@coinrailz.com',
          firstName: 'Demo',
          lastName: 'User',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        demoUserToken = 'demo-token-' + Date.now();
        
        res.json({
          success: true,
          user: demoUser,
          token: demoUserToken,
          message: 'Demo user authenticated for testing'
        });
      });

      app.post('/api/demo/xrp/send', (req, res) => {
        const { toAddress, amount, memo } = req.body;
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== demoUserToken) {
          return res.status(401).json({ message: 'Demo authentication required' });
        }
        
        if (!toAddress || !amount) {
          return res.status(400).json({
            success: false,
            message: 'toAddress and amount are required'
          });
        }
        
        const mockTransaction = {
          hash: 'DEMO_TX_' + Date.now(),
          from: 'rGs1Z6KkeSfQqY9m1NofySRsc1mDKTBzyW',
          to: toAddress,
          amount: amount,
          fee: 0.000012,
          memo: memo || '',
          status: 'success',
          timestamp: new Date().toISOString()
        };
        
        res.json({
          success: true,
          transaction: mockTransaction,
          message: 'Demo XRP transaction simulated successfully'
        });
      });

      app.post('/api/demo/agents/register', (req, res) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== demoUserToken) {
          return res.status(401).json({ message: 'Demo authentication required' });
        }
        
        const { agentName, walletAddress, capabilities, description } = req.body;
        
        const demoAgent = {
          id: 'DEMO_AGENT_' + Date.now(),
          agentName,
          walletAddress,
          capabilities: capabilities || [],
          description: description || '',
          owner: 'demo-user-123',
          status: 'active',
          createdAt: new Date().toISOString()
        };
        
        res.json({
          success: true,
          agent: demoAgent,
          message: 'Demo agent registered successfully'
        });
      });
    }

    const server = await registerRoutes(app);

    // API route handler middleware - catch unhandled API routes before Vite
    app.use('/api/*', (req, res) => {
      res.status(404).json({ 
        success: false, 
        message: `API endpoint not found: ${req.originalUrl}` 
      });
    });

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log error for debugging but don't expose stack trace
      console.error("Server error:", err);

      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();

// Initialize marketplace services
(async () => {
  try {
    const { agentMarketplaceService } = await import('./services/agentMarketplaceService');
    await agentMarketplaceService.registerMarketplaceServices();
    console.log('Marketplace services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize marketplace services:', error);
  }
})().catch(error => {
  console.error('Unhandled promise rejection in marketplace initialization:', error);
});