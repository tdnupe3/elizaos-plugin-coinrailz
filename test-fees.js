/**
 * Test Enhanced XRP Fee Structure
 */

// Test different transaction amounts to validate tiered pricing
const testAmounts = [10, 25, 50, 100, 250, 500, 1000];

console.log('Enhanced XRP Fee Structure Test');
console.log('='.repeat(80));

testAmounts.forEach(amount => {
  // Simulate the fee calculation logic
  let serviceFee = 0;
  let platformFee = 0;
  const networkFee = 0.0002;
  
  if (amount < 50) {
    serviceFee = amount < 25 ? 3.50 : 2.50;
    platformFee = Math.round(amount * 0.002 * 100) / 100;
  } else if (amount >= 50 && amount <= 250) {
    serviceFee = amount < 100 ? 1.50 : 0.75;
    platformFee = Math.round(amount * 0.003 * 100) / 100;
  } else {
    serviceFee = 0;
    platformFee = Math.round(amount * 0.005 * 100) / 100;
  }
  
  const totalFee = networkFee + serviceFee + platformFee;
  const feePercentage = ((totalFee / amount) * 100).toFixed(2);
  
  // Wire transfer comparison
  const wireTransferFee = Math.max(25, amount * 0.03);
  const savings = wireTransferFee - totalFee;
  const percentageSaved = ((savings / wireTransferFee) * 100).toFixed(1);
  
  console.log(`Amount: $${amount}`);
  console.log(`  Network Fee: $${networkFee.toFixed(4)}`);
  console.log(`  Service Fee: $${serviceFee.toFixed(2)}`);
  console.log(`  Platform Fee: $${platformFee.toFixed(2)} (${((platformFee / amount) * 100).toFixed(1)}%)`);
  console.log(`  Total Fee: $${totalFee.toFixed(2)} (${feePercentage}%)`);
  console.log(`  Wire Transfer: $${wireTransferFee.toFixed(2)}`);
  console.log(`  Savings: $${savings.toFixed(2)} (${percentageSaved}% saved)`);
  console.log('-'.repeat(40));
});

console.log('\nKey Benefits:');
console.log('- Ultra-low network fees (~$0.0002)');
console.log('- Instant settlement (3-5 seconds)');
console.log('- 80-95% savings vs traditional wire transfers');
console.log('- Transparent fee structure');
console.log('- All fees collected to funded production wallet');