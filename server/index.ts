import express from "express";
import path from "path";
import { setupVite } from "./vite";
import { setupSimpleRoutes } from "./simpleRoutes";
import { setupEnhancedBusinessLogicRoutes } from "./routes/enhancedBusinessLogicRoutes";
import { registerDemoRoutes } from "./routes-demo";
import { setupLightweightSecurity } from "./apiSecurity";
import { setupDDoSProtection } from "./ddosProtection";
import { productionSystems } from "./productionSystems";
import { bnbChainService } from "./services/bnbChainService";
import { pulseChainService } from "./services/pulseChainService";
import { connectionManager } from "./services/connectionManager";
import { sanitizeInput } from "./middleware/inputValidation";
const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

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

// XRP Ecosystem Hub route - MUST be before Vite middleware
app.get('/xrp-ecosystem', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XRP Ecosystem Dashboard - Coin Railz</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%); min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: #1e40af; font-size: 2.5rem; margin-bottom: 16px; font-weight: 700; }
        .header p { color: #6b7280; font-size: 1.25rem; margin-bottom: 16px; line-height: 1.6; }
        .status { color: #059669; font-weight: 600; font-size: 1rem; }
        .services { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-top: 40px; }
        .service { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.3s ease; border: 1px solid #e5e7eb; }
        .service:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .service h3 { color: #1e40af; margin-bottom: 12px; font-size: 1.25rem; font-weight: 600; }
        .service p { color: #6b7280; margin-bottom: 20px; line-height: 1.5; }
        .btn { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; transition: background 0.2s; }
        .btn:hover { background: #2563eb; }
        .btn-secondary { background: #6b7280; }
        .btn-secondary:hover { background: #4b5563; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>XRP Ecosystem Dashboard</h1>
            <p>Revolutionary financial services powered by XRP Ledger technology.<br>Experience ultra-fast settlements, minimal fees, and enterprise-grade security.</p>
            <div class="status">Live XRP Rate: $0.5000 USD | Platform Status: Operational</div>
        </div>
        
        <div class="services">
            <div class="service">
                <h3>Cross-Border Payments</h3>
                <p>Send money globally in 3-5 seconds with ultra-low fees (~$0.0002). Perfect for international business and remittances.</p>
                <a href="/xrp-cross-border-payments" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Liquidity Provision</h3>
                <p>Provide liquidity and earn competitive rewards on XRP transactions. Automated market making with low impermanent loss.</p>
                <a href="/xrp-liquidity-provision" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Wallet Management</h3>
                <p>Enterprise-grade XRP wallet management with multi-signature security and hardware wallet integration.</p>
                <a href="/xrp-wallet-management" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Compliance Tools</h3>
                <p>AML monitoring and regulatory compliance for XRP transactions. Real-time risk analysis and reporting.</p>
                <a href="/xrp-compliance-tools" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Instant Settlements</h3>
                <p>Real-time payment processing with immediate finality. No chargebacks, immediate liquidity access.</p>
                <a href="/xrp-instant-settlements" class="btn">Access Service</a>
            </div>
            
            <div class="service">
                <h3>Escrow Services</h3>
                <p>Secure transactions with automated escrow and dispute resolution. Smart contract security with built-in conditions.</p>
                <a href="/xrp-escrow-services" class="btn">Access Service</a>
            </div>
        </div>
        
        <div class="footer">
            <a href="/main-menu" class="btn btn-secondary">Back to Main Menu</a>
        </div>
    </div>
</body>
</html>
  `);
});

// Register demo routes BEFORE Vite middleware to prevent interception
registerDemoRoutes(app);

// Setup simple API routes BEFORE Vite middleware
const server = setupSimpleRoutes(app);

// Setup enhanced business logic routes with all safety mechanisms
setupEnhancedBusinessLogicRoutes(app);

// Production error handling
app.use(productionSystems.errorHandler());

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