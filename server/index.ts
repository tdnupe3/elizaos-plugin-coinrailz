import express from "express";
import path from "path";
import { setupVite } from "./vite";
import { setupSimpleRoutes } from "./simpleRoutes";
import { setupEnhancedBusinessLogicRoutes } from "./routes/enhancedBusinessLogicRoutes";
import { registerDemoRoutes } from "./routes-demo";
import { registerDEXProductionRoutes } from "./dexProductionRoutes";
import { setupReferralRoutes } from "./referralRoutes";
import { setupCriticalAPIRoutes } from "./apiRoutes";
import { dataMonetizationRoutes } from "./routes/dataMonetizationRoutes";
import p2pRoutes from "./routes/p2pRoutes";
import { setupLightweightSecurity } from "./apiSecurity";
import { setupDDoSProtection } from "./ddosProtection";
import { productionSystems } from "./productionSystems";
import { bnbChainService } from "./services/bnbChainService";
import { pulseChainService } from "./services/pulseChainService";
import { connectionManager } from "./services/connectionManager";
import { sanitizeInput } from "./middleware/inputValidation";
import { errorHandler } from "./middleware/errorHandler";
const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Setup global error handlers
errorHandler.setupGlobalHandlers();

// Initialize production systems
productionSystems.initialize();

// Initialize connection management
console.log('✅ Connection manager initialized');

// Initialize blockchain services
if (bnbChainService.isEnabled()) {
  console.log('✅ BNB Chain service initialized:', { 
    network: bnbChainService.getConfig().network, 
    enabled: true 
  });
}

if (pulseChainService.isEnabled()) {
  console.log('✅ PulseChain service initialized:', { 
    network: pulseChainService.getConfig().network, 
    enabled: true 
  });
}

// Production monitoring middleware
app.use(productionSystems.trackRequests());

// Essential middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input validation and sanitization
app.use(sanitizeInput);

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

// Setup consolidated authentication system using productionAuth as primary
import { setupProductionAuth } from './productionAuth';
setupProductionAuth(app);



// Register critical API routes FIRST to bypass Vite middleware
setupCriticalAPIRoutes(app);

// Register demo routes BEFORE Vite middleware to prevent interception
registerDemoRoutes(app);

// Register DEX production routes BEFORE Vite middleware
registerDEXProductionRoutes(app);

// Register data monetization routes BEFORE simpleRoutes to prevent 404 interception
app.use('/api/data', dataMonetizationRoutes);

// Setup simple API routes BEFORE Vite middleware (contains catch-all 404 handler)
const server = setupSimpleRoutes(app);

// Setup enhanced business logic routes with all safety mechanisms
setupEnhancedBusinessLogicRoutes(app);

// Setup comprehensive error handling middleware (must be last)
app.use(errorHandler.middleware());

// Production vs Development setup
if (process.env.NODE_ENV === 'production') {
  // Production: serve static files
  app.use(express.static('dist/public'));
  
  // Catch-all handler for SPA routing - exclude API routes
  app.get('*', (req, res) => {
    // Skip API routes - they should have been handled already
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.resolve('dist/public/index.html'));
  });
  
  server.listen(port, '0.0.0.0', () => {
    console.log(`Production server running on 0.0.0.0:${port}`);
  });
} else {
  // Development: Setup Vite AFTER all API routes are registered
  setupVite(app, server).then(() => {
    console.log('Frontend serving ready');
    server.listen(port, '0.0.0.0', () => {
      console.log(`Development server running on 0.0.0.0:${port}`);
    });
  }).catch(error => {
    console.error('Vite setup failed:', error);
    server.listen(port, '0.0.0.0', () => {
      console.log(`Development server running on 0.0.0.0:${port} (without Vite)`);
    });
  });
}

export default app;