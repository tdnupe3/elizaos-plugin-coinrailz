import express from "express";
import { setupVite } from "./vite";

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);

// Essential middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

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

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Development server running on 0.0.0.0:${port}`);
});

// Setup Vite for frontend serving
setupVite(app, server).then(() => {
  console.log('Frontend serving ready');
}).catch(error => {
  console.error('Vite setup failed:', error);
});

export default app;