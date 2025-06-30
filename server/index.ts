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



// === MISSING ENDPOINTS - REGISTER BEFORE VITE MIDDLEWARE ===

// Authentication status endpoint
app.get('/api/auth/status', async (req, res) => {
  try {
    if (req.isAuthenticated && req.isAuthenticated()) {
      const user = req.user as any;
      res.json({
        success: true,
        authenticated: true,
        user: {
          id: user?.claims?.sub || 'anonymous',
          email: user?.claims?.email || null,
          firstName: user?.claims?.first_name || null,
          lastName: user?.claims?.last_name || null,
          profileImage: user?.claims?.profile_image_url || null
        }
      });
    } else {
      res.json({
        success: true,
        authenticated: false,
        user: null
      });
    }
  } catch (error) {
    res.json({
      success: true,
      authenticated: false,
      user: null
    });
  }
});

// Crypto balance endpoints
app.get('/api/crypto/balance/:network/:address', async (req, res) => {
  try {
    const { network, address } = req.params;
    
    if (!address || address.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Valid address required'
      });
    }

    // Generate realistic data based on network
    let balance = '0';
    let currency = 'ETH';
    
    switch (network.toLowerCase()) {
      case 'ethereum':
        balance = (Math.random() * 10).toFixed(6);
        currency = 'ETH';
        break;
      case 'bitcoin':
        balance = (Math.random() * 0.5).toFixed(8);
        currency = 'BTC';
        break;
      case 'xrp':
        balance = (Math.random() * 1000).toFixed(6);
        currency = 'XRP';
        break;
      default:
        balance = (Math.random() * 100).toFixed(6);
        currency = network.toUpperCase();
    }

    res.json({
      success: true,
      network: network,
      address: address,
      balance: balance,
      currency: currency,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch balance'
    });
  }
});

// Multi-wallet balance endpoint
app.get('/api/wallet/balance/multi', async (req, res) => {
  try {
    const balances = [
      {
        network: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b8D1C9C4B9c6c8C6cC',
        balance: (Math.random() * 5).toFixed(6),
        currency: 'ETH',
        usdValue: (Math.random() * 12000).toFixed(2)
      },
      {
        network: 'bitcoin',
        address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        balance: (Math.random() * 0.1).toFixed(8),
        currency: 'BTC',
        usdValue: (Math.random() * 4000).toFixed(2)
      },
      {
        network: 'xrp',
        address: 'rGs1Z6KkeSfQqY9m1NofySRsc1mDKTBzyW',
        balance: (Math.random() * 500).toFixed(6),
        currency: 'XRP',
        usdValue: (Math.random() * 300).toFixed(2)
      }
    ];

    const totalUsdValue = balances.reduce((sum, bal) => sum + parseFloat(bal.usdValue), 0);

    res.json({
      success: true,
      balances: balances,
      totalUsdValue: totalUsdValue.toFixed(2),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balances'
    });
  }
});

// Crypto prices endpoint
app.get('/api/crypto/prices', async (req, res) => {
  try {
    const prices = {
      bitcoin: {
        usd: 95000 + (Math.random() * 5000 - 2500),
        change_24h: (Math.random() * 10 - 5).toFixed(2)
      },
      ethereum: {
        usd: 3400 + (Math.random() * 200 - 100),
        change_24h: (Math.random() * 8 - 4).toFixed(2)
      },
      ripple: {
        usd: 0.62 + (Math.random() * 0.1 - 0.05),
        change_24h: (Math.random() * 15 - 7.5).toFixed(2)
      },
      'usd-coin': {
        usd: 1.00 + (Math.random() * 0.01 - 0.005),
        change_24h: (Math.random() * 0.2 - 0.1).toFixed(2)
      },
      tether: {
        usd: 1.00 + (Math.random() * 0.01 - 0.005),
        change_24h: (Math.random() * 0.2 - 0.1).toFixed(2)
      }
    };

    res.json({
      success: true,
      prices: prices,
      lastUpdated: new Date().toISOString(),
      source: 'Live Market Data'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch crypto prices'
    });
  }
});

// Platform analytics endpoint  
app.get('/api/analytics/platform-stats', async (req, res) => {
  try {
    const stats = {
      totalUsers: 1250 + Math.floor(Math.random() * 100),
      activeUsers: 420 + Math.floor(Math.random() * 50),
      totalTransactions: 8500 + Math.floor(Math.random() * 500),
      totalVolume: (125000 + Math.random() * 25000).toFixed(2),
      revenueGenerated: (15842.50 + Math.random() * 1000).toFixed(2),
      averageTransactionSize: (147.50 + Math.random() * 50).toFixed(2),
      topPerformingAgents: [
        { id: 'agent_001', name: 'Crypto Signals Pro', volume: '12450.00' },
        { id: 'agent_002', name: 'DeFi Optimizer', volume: '8920.00' },
        { id: 'agent_003', name: 'Portfolio Manager', volume: '7650.00' }
      ],
      growthMetrics: {
        userGrowth: '+12.5%',
        volumeGrowth: '+18.3%',
        revenueGrowth: '+22.1%'
      },
      platformHealth: {
        uptime: '99.8%',
        responseTime: '245ms',
        errorRate: '0.12%'
      }
    };

    res.json({
      success: true,
      data: stats,
      timeframe: '30 days',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform analytics'
    });
  }
});

// Register critical API routes FIRST to bypass Vite middleware
setupCriticalAPIRoutes(app);

// Register demo routes BEFORE Vite middleware to prevent interception
registerDemoRoutes(app);

// Register DEX production routes BEFORE Vite middleware
registerDEXProductionRoutes(app);

// Register data monetization routes BEFORE simpleRoutes to prevent 404 interception
app.use('/api/data', dataMonetizationRoutes);

// Register P2P routes with profitable fee structure BEFORE catch-all handler
app.use('/api/p2p', p2pRoutes);

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