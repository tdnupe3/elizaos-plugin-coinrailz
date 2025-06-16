/**
 * Simple Production Server - No ESM Issues
 * Fixes deployment crashes for coinrailz.com
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist/public')));

// Health endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Coin Railz', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
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

// Basic API endpoints
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

// Catch all for React app
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../dist/public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application not built. Run: npm run build');
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;

// Force bind to 0.0.0.0 for deployment
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Coin Railz production server running on 0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});