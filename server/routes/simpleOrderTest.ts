import { Router } from 'express';

const router = Router();

// Simple test route to verify basic routing works
router.post('/api/orders/test-simple', (req, res) => {
  console.log('🎯 SIMPLE ORDER TEST ROUTE HIT!');
  console.log('Method:', req.method, 'Path:', req.path);
  console.log('Body:', req.body);
  
  res.json({
    success: true,
    message: 'Simple order test route is working!',
    timestamp: new Date().toISOString(),
    receivedData: req.body
  });
});

export default router;