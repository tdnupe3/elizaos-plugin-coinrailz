import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// COMPLETELY ISOLATED DATABASE TEST - NO MIDDLEWARE DEPENDENCIES
router.post('/direct-db-test', async (req, res) => {
  try {
    const testId = `isolated_${Date.now()}`;
    console.log(`🧪 ISOLATED DB TEST: ${testId}`);
    
    const result = await db.execute(sql`
      INSERT INTO ai_marketplace_orders (
        id, agent_id, customer_id, service_type, amount, agent_commission, 
        platform_fee, status, payment_method, service_description, 
        customer_requirements, estimated_delivery_hours
      ) VALUES (
        ${testId}, 'isolated_agent', 'isolated_customer', 'ISOLATED_TEST', 
        999, 849, 150, 'pending', 'test', 'Isolated database insertion test',
        '{"isolated": true}', 24
      ) RETURNING id
    `);
    
    console.log(`✅ ISOLATED SUCCESS: ${testId}`);
    console.log(`Result:`, result);
    
    // Verify insertion
    const verify = await db.execute(sql`
      SELECT COUNT(*) as count FROM ai_marketplace_orders WHERE id = ${testId}
    `);
    
    const count = verify.rows[0]?.count || 0;
    console.log(`🔍 VERIFICATION: ${count} rows found`);
    
    res.json({
      success: true,
      testId: testId,
      result: result,
      verification: count,
      message: 'Isolated database test completed'
    });
    
  } catch (error: any) {
    console.error(`❌ ISOLATED DB TEST FAILED:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error
    });
  }
});

export default router;