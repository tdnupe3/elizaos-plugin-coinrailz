import express from "express";
import { setupVite } from "./vite";
import { setupProductionRoutes } from "./productionRoutes";
import { setupSecurityMiddleware } from "./securityMiddleware";

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware FIRST
setupSecurityMiddleware(app);

// Essential middleware
app.use(express.json({ limit: '1mb' })); // Reduced from 10mb for security
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Production CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = isProduction 
    ? ['https://coinrailz.com', 'https://www.coinrailz.com']
    : ['http://localhost:5000', 'http://127.0.0.1:5000'];
    
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Production request logging with security info
app.use((req, res, next) => {
  const start = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms [IP: ${clientIP}]`);
      
      // Log suspicious activity
      if (res.statusCode === 429) {
        console.warn(`Rate limit exceeded for IP: ${clientIP} on ${req.path}`);
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        console.warn(`Authentication/Authorization failure for IP: ${clientIP} on ${req.path}`);
      }
    }
  });
  next();
});

// Setup production API routes BEFORE Vite middleware
const server = setupProductionRoutes(app);

// Start server listening
server.listen(port, '0.0.0.0', () => {
  console.log(`${isProduction ? 'Production' : 'Development'} server running on 0.0.0.0:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Security middleware: ACTIVE`);
  console.log(`Rate limiting: ACTIVE`);
});

// Setup Vite for frontend serving
setupVite(app, server).then(() => {
  console.log('Frontend serving ready');  
}).catch(error => {
  console.error('Vite setup failed:', error);
});

export default app;