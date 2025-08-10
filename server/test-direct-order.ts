// DIRECT TEST - Register order endpoint immediately on app startup
import express from 'express';

export function registerDirectOrderTest(app: express.Express) {
  console.log('🚀 REGISTERING DIRECT ORDER TEST ENDPOINT');
  
  app.post('/api/orders/create-urgent', (req, res) => {
    console.log('🎯 DIRECT URGENT ORDER ENDPOINT HIT!');
    console.log('Method:', req.method, 'Path:', req.path);
    console.log('Body:', req.body);
    
    res.json({
      success: true,
      message: 'URGENT: Direct order endpoint working!',
      timestamp: new Date().toISOString(),
      data: req.body
    });
  });
  
  console.log('✅ Direct order test endpoint registered at /api/orders/create-urgent');
}