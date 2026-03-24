import { db } from './server/db.js';
(async () => {
  const stuck = await db.execute(`
    SELECT payment_intent_id, status, created_at, 
           EXTRACT(EPOCH FROM (NOW() - created_at))/60 as age_minutes
    FROM payment_intent_tracking
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log('Pending tracking rows:', JSON.stringify(stuck.rows, null, 2));
})().catch(e => console.error(e.message));
