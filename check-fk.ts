import { db } from './server/db.js';

(async () => {
  // Check if FK constraint exists on credits_accounts
  const fkResult = await db.execute(`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'credits_accounts' AND constraint_type = 'FOREIGN KEY'
  `);
  console.log('credits_accounts FK constraints:', JSON.stringify(fkResult.rows, null, 2));

  // Check if FK constraint exists on credit_transactions
  const fkResult2 = await db.execute(`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'credit_transactions' AND constraint_type = 'FOREIGN KEY'
  `);
  console.log('credit_transactions FK constraints:', JSON.stringify(fkResult2.rows, null, 2));

  // Check if FK constraint exists on api_keys
  const fkResult3 = await db.execute(`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'api_keys' AND constraint_type = 'FOREIGN KEY'
  `);
  console.log('api_keys FK constraints:', JSON.stringify(fkResult3.rows, null, 2));

  // Check if any m2m users exist in users table
  const m2mUsers = await db.execute(`
    SELECT id, email FROM users WHERE id LIKE 'm2m_%' LIMIT 5
  `);
  console.log('Existing m2m users:', JSON.stringify(m2mUsers.rows, null, 2));

  // Check if any m2m credits accounts exist
  const m2mAccounts = await db.execute(`
    SELECT user_id, balance FROM credits_accounts WHERE user_id LIKE 'm2m_%' LIMIT 5
  `);
  console.log('Existing m2m credits accounts:', JSON.stringify(m2mAccounts.rows, null, 2));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
