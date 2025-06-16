#!/usr/bin/env node

/**
 * Production Build Script
 * Handles ESM/CommonJS compatibility issues for deployment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Building Coin Railz for production deployment...\n');

try {
  // 1. Build frontend with Vite
  console.log('1. Building frontend assets...');
  execSync('vite build', { stdio: 'inherit' });
  console.log('✓ Frontend build complete\n');

  // 2. Create production server configuration
  console.log('2. Creating production server configuration...');
  
  const productionServer = `
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Production security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for React
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Basic API routes for production testing
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: 'production'
  });
});

app.get('/api/system/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

app.get('/api/demo/user', (req, res) => {
  res.json({
    id: 'demo-user',
    name: 'Demo User',
    email: 'demo@coinrailz.com',
    verified: true
  });
});

app.post('/api/demo/calculate-fee', (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount provided' });
  }
  
  const fee = Math.round(amount * 0.01); // 1% fee
  res.json({
    fee,
    feeRate: 1,
    amount: amount
  });
});

// Catch-all handler for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Production error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Production server running on 0.0.0.0:\${PORT}\`);
  console.log(\`Environment: \${process.env.NODE_ENV || 'production'}\`);
  console.log(\`Health check: http://localhost:\${PORT}/health\`);
});
`;

  fs.writeFileSync('dist/production-server.js', productionServer);
  console.log('✓ Production server configuration created\n');

  // 3. Copy static assets if they don't exist in the right place
  if (fs.existsSync('dist/public') && !fs.existsSync('dist/public/index.html')) {
    console.log('3. Copying frontend assets...');
    execSync('cp -r dist/public/* dist/ 2>/dev/null || true');
    console.log('✓ Assets copied\n');
  }

  console.log('================================================================================');
  console.log('PRODUCTION BUILD COMPLETE');
  console.log('================================================================================\n');
  
  console.log('To start the production server:');
  console.log('  NODE_ENV=production node dist/production-server.js\n');
  
  console.log('Production server features:');
  console.log('  ✓ Static file serving');
  console.log('  ✓ Security middleware (Helmet)');
  console.log('  ✓ Compression');
  console.log('  ✓ Rate limiting');
  console.log('  ✓ Health endpoints');
  console.log('  ✓ Basic API routes');
  console.log('  ✓ React Router support\n');

} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}