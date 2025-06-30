/**
 * Focused Input Validation Test
 * Tests XSS and SQL injection protection without rate limiting interference
 */

async function testInputValidation() {
  console.log('Testing Input Validation System...\n');
  
  // Test XSS Protection
  console.log('=== XSS Protection Test ===');
  try {
    const xssResponse = await fetch('http://localhost:5000/api/validate-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: '<script>alert("xss")</script>',
        fromUser: 'test@example.com',
        toUser: 'test2@example.com'
      })
    });
    
    console.log(`XSS Test Status: ${xssResponse.status}`);
    const xssResult = await xssResponse.json();
    console.log('XSS Response:', xssResult);
    
    if (xssResponse.status === 400) {
      console.log('✅ XSS Protection: WORKING - Malicious script rejected');
    } else {
      console.log('❌ XSS Protection: FAILED - Script not blocked');
    }
  } catch (error) {
    console.log('❌ XSS Test Error:', error.message);
  }
  
  // Test SQL Injection Protection
  console.log('\n=== SQL Injection Protection Test ===');
  try {
    const sqlResponse = await fetch('http://localhost:5000/api/validate-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 100,
        fromUser: "'; DROP TABLE users; --",
        toUser: 'test@example.com'
      })
    });
    
    console.log(`SQL Test Status: ${sqlResponse.status}`);
    const sqlResult = await sqlResponse.json();
    console.log('SQL Response:', sqlResult);
    
    if (sqlResponse.status === 400) {
      console.log('✅ SQL Injection Protection: WORKING - Malicious SQL rejected');
    } else {
      console.log('❌ SQL Injection Protection: FAILED - SQL not blocked');
    }
  } catch (error) {
    console.log('❌ SQL Test Error:', error.message);
  }
  
  // Test Normal Input (should work)
  console.log('\n=== Normal Input Test ===');
  try {
    const normalResponse = await fetch('http://localhost:5000/api/validate-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 100,
        fromUser: 'alice@example.com',
        toUser: 'bob@example.com'
      })
    });
    
    console.log(`Normal Test Status: ${normalResponse.status}`);
    const normalResult = await normalResponse.json();
    console.log('Normal Response:', normalResult);
    
    if (normalResponse.status === 200) {
      console.log('✅ Normal Input: WORKING - Valid input accepted');
    } else {
      console.log('❌ Normal Input: ISSUE - Valid input rejected');
    }
  } catch (error) {
    console.log('❌ Normal Test Error:', error.message);
  }
  
  console.log('\n=== Input Validation Test Complete ===');
}

testInputValidation().catch(console.error);