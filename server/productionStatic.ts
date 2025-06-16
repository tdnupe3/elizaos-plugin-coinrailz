/**
 * Production Static File Serving
 * Replaces Vite HMR for production deployment
 */

import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function serveStatic(app: Express) {
  const distPath = path.join(__dirname, '..', 'dist');
  
  // Serve static assets from dist folder
  app.use(express.static(distPath, {
    maxAge: '1y', // Cache static assets for 1 year
    etag: true,
    lastModified: true
  }));

  // Handle React Router routes - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }

    const indexPath = path.join(distPath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ 
        error: 'Application not built. Run npm run build first.' 
      });
    }
  });

  console.log('Production static file serving initialized');
}