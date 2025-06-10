import express, { type Request, Response, NextFunction } from "express";
import { registerConsolidatedRoutes } from "./consolidatedRoutes";
import { setupVite, serveStatic, log } from "./vite";
import { AgentMarketplaceService } from "./services/agentMarketplaceService";

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

    const server = await registerConsolidatedRoutes(app);

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