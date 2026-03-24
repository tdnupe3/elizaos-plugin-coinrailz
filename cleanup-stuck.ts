import { db } from './server/db.js';
(async () => {
  const result = await db.execute(`
    UPDATE payment_intent_tracking 
    SET status = 'used'
    WHERE payment_intent_id = 'courtesy_nabeel_akram_10usd_1774368157723'
    AND status = 'pending'
    RETURNING payment_intent_id
  `);
  console.log('Cleaned up:', result.rows.length === 1 ? '✅ stuck pending row marked used' : '(nothing to clean)');
})().catch(e => console.error(e.message));
