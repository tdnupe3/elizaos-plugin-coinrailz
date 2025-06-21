import express from "express";
import path from "path";
import { setupVite } from "./vite";
import { setupSimpleRoutes } from "./simpleRoutes";
import { setupLightweightSecurity } from "./apiSecurity";
import { setupDDoSProtection } from "./ddosProtection";
import { productionSystems } from "./productionSystems";
import { UnifiedAuthSystem } from "./unifiedAuth";

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Initialize unified authentication system
const authSystem = new UnifiedAuthSystem(app);

// Initialize production systems
productionSystems.initialize();

// Production monitoring middleware
app.use(productionSystems.trackRequests());

// Essential middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Environment-aware CORS
app.use((req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowedOrigins = isDevelopment 
    ? ['http://localhost:5000', 'http://127.0.0.1:5000', '*']
    : ['https://coinrailz.com', 'https://www.coinrailz.com'];
  
  const origin = req.headers.origin;
  if (isDevelopment || !origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Setup lightweight API-only security (won't block frontend)
setupLightweightSecurity(app);

// Simple request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Health monitoring endpoint
app.get('/api/health', (req, res) => {
  const health = productionSystems.getHealthMetrics();
  res.json(health);
});

// Setup simple API routes BEFORE authentication to avoid conflicts
const server = setupSimpleRoutes(app);

// Initialize unified authentication system after basic routes
authSystem.initialize().then(() => {
  console.log('✅ Unified authentication system initialized');
  
  // Setup consolidated routes after auth is ready
  import("./consolidatedRoutes").then(({ setupConsolidatedRoutes }) => {
    setupConsolidatedRoutes(app, authSystem);
  });
}).catch(error => {
  console.error('❌ Authentication initialization failed:', error);
});

// Production error handling
app.use(productionSystems.errorHandler());

// Production vs Development setup
if (process.env.NODE_ENV === 'production') {
  // Production: serve static files
  app.use(express.static('dist/public'));
  
  // Catch-all handler for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve('dist/public/index.html'));
  });
  
  server.listen(port, '0.0.0.0', () => {
    console.log(`Production server running on 0.0.0.0:${port}`);
  });
} else {
  // Development: use Vite
  server.listen(port, '0.0.0.0', () => {
    console.log(`Development server running on 0.0.0.0:${port}`);
  });
  
  setupVite(app, server).then(() => {
    console.log('Frontend serving ready');  
  }).catch(error => {
    console.error('Vite setup failed:', error);
  });
}

export default app;