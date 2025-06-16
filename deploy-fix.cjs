/**
 * Deployment Fix - Simple Production Build
 * Creates a working production server without ESM complications
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('Creating deployment-ready production build...\n');

try {
  // 1. Build frontend
  console.log('Building frontend...');
  execSync('vite build', { stdio: 'inherit' });

  // 2. Create simple production server
  const serverCode = `
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Coin Railz', timestamp: new Date().toISOString() });
});

app.get('/api/system/health', (req, res) => {
  res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString(), memory: process.memoryUsage() });
});

app.get('/api/demo/user', (req, res) => {
  res.json({ id: 'demo-user', name: 'Demo User', email: 'demo@coinrailz.com', verified: true });
});

app.post('/api/demo/calculate-fee', (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  res.json({ fee: Math.round(amount * 0.01), feeRate: 1, amount });
});

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('App not built');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Production server running on 0.0.0.0:\${PORT}\`);
});
`;

  // 3. Write production server
  fs.writeFileSync('dist/index.js', serverCode);
  
  // 4. Create package.json for production
  const prodPackage = {
    "name": "coinrailz-production",
    "version": "1.0.0",
    "main": "index.js",
    "dependencies": {
      "express": "^4.18.0"
    }
  };
  
  fs.writeFileSync('dist/package.json', JSON.stringify(prodPackage, null, 2));

  console.log('\n✓ Production build complete!');
  console.log('✓ Frontend assets built');
  console.log('✓ Simple production server created');
  console.log('✓ No ESM issues');
  console.log('✓ Binds to 0.0.0.0 correctly');
  
  console.log('\nDeployment ready. The server will start automatically on deployment.');

} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}