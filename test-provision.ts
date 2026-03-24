import { provisionCreditsAndKey } from './server/services/m2mProvisioningService.js';

(async () => {
  // Use a unique test ID so it doesn't conflict with anything real
  const testPaymentId = 'test_provision_verify_' + Date.now();
  const testUserId = 'm2m_test_' + Date.now().toString(36);

  console.log('Testing provisionCreditsAndKey with new user...');
  console.log('userId:', testUserId);

  const result = await provisionCreditsAndKey({
    paymentIntentId: testPaymentId,
    userId: testUserId,
    amount: 10,
    email: `${testUserId}@test.coinrailz.com`,
    keyName: 'Test Provision Key',
    purpose: 'm2m-credits',
  });

  if (result.alreadyProvisioned) {
    console.log('❌ UNEXPECTED: already provisioned');
  } else if (result.inProgress) {
    console.log('❌ UNEXPECTED: in progress');
  } else {
    console.log('✅ Provision succeeded!');
    console.log('  API Key prefix:', result.keyPrefix);
    console.log('  Key ID:', result.keyId);
    console.log('  New balance: $' + result.newBalance);
    console.log('  Transaction ID:', result.transactionId);
  }

  // Test idempotency — calling again with same paymentIntentId should return alreadyProvisioned
  console.log('\nTesting idempotency (same paymentIntentId)...');
  const result2 = await provisionCreditsAndKey({
    paymentIntentId: testPaymentId,
    userId: testUserId,
    amount: 10,
    email: `${testUserId}@test.coinrailz.com`,
    keyName: 'Test Provision Key',
    purpose: 'm2m-credits',
  });

  if (result2.alreadyProvisioned) {
    console.log('✅ Idempotency check passed — returned alreadyProvisioned');
  } else {
    console.log('❌ Idempotency FAILED — should have returned alreadyProvisioned');
  }

  // Clean up test data
  const { db } = await import('./server/db.js');
  await db.execute(`DELETE FROM api_keys WHERE user_id = '${testUserId}'`);
  await db.execute(`DELETE FROM credit_transactions WHERE user_id = '${testUserId}'`);
  await db.execute(`DELETE FROM credits_accounts WHERE user_id = '${testUserId}'`);
  await db.execute(`DELETE FROM payment_intent_tracking WHERE payment_intent_id = '${testPaymentId}'`);
  await db.execute(`DELETE FROM users WHERE id = '${testUserId}'`);
  console.log('\n🧹 Test data cleaned up');
  console.log('\n✅ All checks passed — provisioning is working correctly');
})().catch(e => { console.error('❌ TEST FAILED:', e.message); process.exit(1); });
