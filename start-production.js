#!/usr/bin/env node

/**
 * Production Startup Script for coinrailz.com
 * Handles production deployment with proper error handling
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('Starting Coin Railz production server for coinrailz.com...\n');

try {
  // Check if production build exists, create if needed
  if (!fs.existsSync('dist/production-server.js')) {
    console.log('Production build not found, creating...');
    execSync('node build-production.js', { stdio: 'inherit' });
  }

  // Set production environment
  process.env.NODE_ENV = 'production';
  process.env.PORT = process.env.PORT || '5000';

  // Import and start the production server
  const { spawn } = await import('child_process');
  
  const server = spawn('node', ['dist/production-server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      REPLIT_DOMAINS: 'coinrailz.com'
    }
  });

  server.on('exit', (code) => {
    console.log(`Production server exited with code ${code}`);
    process.exit(code);
  });

  server.on('error', (error) => {
    console.error('Production server error:', error);
    process.exit(1);
  });

} catch (error) {
  console.error('Failed to start production server:', error.message);
  
  // Fallback to development mode for coinrailz.com
  console.log('Falling back to development mode...');
  const { spawn } = await import('child_process');
  
  const devServer = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      REPLIT_DOMAINS: 'coinrailz.com'
    }
  });

  devServer.on('exit', (code) => {
    process.exit(code);
  });
}