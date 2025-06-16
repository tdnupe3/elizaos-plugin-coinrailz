
import express from "express";
import productionRoutes from "./server/productionRoutes.js";
import criticalRoutes from "./server/criticalRoutes.js";
import { setupAuth } from "./server/replitAuth.js";
import { registerAuthRoutes } from "./server/authRoutes.js";
import compression from "compression";
import helmet from "helmet";

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Essential middleware
app.use(compression());
app.use(helmet());

// CORS for production
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://coinrailz.com',
    'https://www.coinrailz.com',
    'https://app.coinrailz.com'
  ];
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup authentication
await setupAuth(app);
registerAuthRoutes(app);

// Routes
app.use(criticalRoutes);
app.use(productionRoutes);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Coin Railz',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve static files
app.use(express.static('dist/public'));

// Catch-all for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist/public/index.html'));
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log('Production server running on port', port);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});
