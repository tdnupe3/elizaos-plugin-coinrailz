import express from "express";
import { setupVite } from "./vite";
import { setupSimpleRoutes } from "./simpleRoutes";
import { setupSecurity, apiRateLimit, strictRateLimit } from "./security";

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Essential middleware with security limits
app.use(express.json({ limit: '1mb' })); // Reduced from 10mb for security
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Setup comprehensive institutional-grade security
setupSecurity(app);

// Enhanced request logging with security context
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      const logLevel = res.statusCode >= 400 ? '[SECURITY]' : '';
      console.log(`${logLevel} ${req.method} ${req.path} ${res.statusCode} in ${duration}ms${req.ip ? ` - IP: ${req.ip}` : ''}`);
    }
  });
  next();
});

// Setup simple API routes BEFORE Vite middleware
const server = setupSimpleRoutes(app);

// Start server listening
server.listen(port, '0.0.0.0', () => {
  console.log(`Development server running on 0.0.0.0:${port}`);
});

// Setup Vite for frontend serving
setupVite(app, server).then(() => {
  console.log('Frontend serving ready');  
}).catch(error => {
  console.error('Vite setup failed:', error);
});

export default app;