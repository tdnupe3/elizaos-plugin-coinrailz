import { Router } from 'express';
import { db } from '../db';
import { aiMarketplaceOrders, globalAIAgents, users } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const router = Router();

// Complete database and order system debug endpoint
router.get('/api/debug/order-system', async (req, res) => {
  try {
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      database: {},
      tables: {},
      constraints: {},
      testResults: {}
    };

    // Test database connection
    try {
      await db.execute(sql`SELECT 1 as test`);
      debugInfo.database.connection = 'WORKING';
    } catch (err: any) {
      debugInfo.database.connection = `FAILED: ${err.message}`;
    }

    // Check table existence and structure
    try {
      const tableInfo = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'ai_marketplace_orders'
        ORDER BY ordinal_position
      `);
      debugInfo.tables.aiMarketplaceOrders = {
        exists: tableInfo.rows.length > 0,
        columns: tableInfo.rows
      };
    } catch (err: any) {
      debugInfo.tables.aiMarketplaceOrders = `ERROR: ${err.message}`;
    }

    // Check constraints
    try {
      const constraints = await db.execute(sql`
        SELECT conname, contype, pg_get_constraintdef(oid) as definition
        FROM pg_constraint 
        WHERE conrelid = 'ai_marketplace_orders'::regclass
      `);
      debugInfo.constraints = constraints.rows;
    } catch (err: any) {
      debugInfo.constraints = `ERROR: ${err.message}`;
    }

    // Count existing records
    try {
      const orderCount = await db.execute(sql`SELECT COUNT(*) as total FROM ai_marketplace_orders`);
      debugInfo.database.orderCount = orderCount.rows[0]?.total || 0;
    } catch (err: any) {
      debugInfo.database.orderCount = `ERROR: ${err.message}`;
    }

    // Test user existence
    try {
      const userExists = await db.execute(sql`
        SELECT id FROM users WHERE id = 'oauth-test-user-1749701423054' LIMIT 1
      `);
      debugInfo.testResults.testUserExists = userExists.rows.length > 0;
    } catch (err: any) {
      debugInfo.testResults.testUserExists = `ERROR: ${err.message}`;
    }

    // Test agent existence
    try {
      const agentExists = await db.execute(sql`
        SELECT agent_id FROM global_ai_agents WHERE agent_id = 'agent_4BB7ifoc2_jW' LIMIT 1
      `);
      debugInfo.testResults.testAgentExists = agentExists.rows.length > 0;
    } catch (err: any) {
      debugInfo.testResults.testAgentExists = `ERROR: ${err.message}`;
    }

    // Test direct SQL insertion
    try {
      const testId = `test_${Date.now()}`;
      const insertResult = await db.execute(sql`
        INSERT INTO ai_marketplace_orders (
          id, agent_id, customer_id, service_type, amount, agent_commission, 
          platform_fee, status, payment_method, service_description, 
          customer_requirements, estimated_delivery_hours
        ) VALUES (
          ${testId}, 'agent_4BB7ifoc2_jW', 'oauth-test-user-1749701423054', 'DEBUG TEST', 
          100.00, 85.00, 15.00, 'pending', 'test', 'Debug insertion test',
          '{"test": true}', 24
        ) RETURNING id
      `);
      debugInfo.testResults.directSQLInsertion = {
        success: true,
        insertedId: insertResult.rows[0]?.id,
        rowsAffected: insertResult.rowCount
      };
    } catch (err: any) {
      debugInfo.testResults.directSQLInsertion = {
        success: false,
        error: err.message,
        code: err.code,
        detail: err.detail
      };
    }

    // Final order count after test
    try {
      const finalCount = await db.execute(sql`SELECT COUNT(*) as total FROM ai_marketplace_orders`);
      debugInfo.testResults.finalOrderCount = finalCount.rows[0]?.total || 0;
    } catch (err: any) {
      debugInfo.testResults.finalOrderCount = `ERROR: ${err.message}`;
    }

    res.json({
      success: true,
      debug: debugInfo
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Debug check failed',
      details: error.message
    });
  }
});

export default router;