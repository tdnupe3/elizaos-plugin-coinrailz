import express from "express";
import { setupVite } from "./vite";
import { db } from "./db";

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Essential middleware only
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Health check only
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Minimal API endpoints for testing
app.post('/api/test', (req, res) => {
  res.json({ success: true, message: 'API working' });
});

// Start server first
const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`Clean server running on 0.0.0.0:${port}`);
  
  // Setup Vite after server is running
  try {
    await setupVite(app, server);
    console.log('Vite frontend serving enabled');
  } catch (error) {
    console.error('Vite setup failed:', error);
  }
});

export { app, server };