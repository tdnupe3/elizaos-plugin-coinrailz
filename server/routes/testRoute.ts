import { Router } from 'express';
import fs from 'fs';

const router = Router();

// DISABLED - This router module system is interfering with direct route registration
// Simple test route to confirm routing works
// router.post('/api/test-route', (req, res) => {
//   console.log('🧪 TEST ROUTE HIT SUCCESSFULLY');
//   fs.writeFileSync('/tmp/test_route_hit.txt', `TEST ROUTE HIT: ${new Date().toISOString()}\n`);
//   
//   res.json({
//     success: true,
//     message: 'Test route working',
//     timestamp: new Date().toISOString()
//   });
// });

export default router;