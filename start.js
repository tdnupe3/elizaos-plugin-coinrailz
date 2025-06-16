#!/usr/bin/env node

/**
 * Production Start Script for Deployment
 * Simple production server without dev dependencies
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Basic middleware
app.use(express.static('dist/public'));
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Coin Railz', timestamp: new Date().toISOString() });
});

// Catch all for React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});