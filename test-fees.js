/**
 * Test Enhanced XRP Fee Structure
 */

// Test different transaction amounts to validate tiered pricing
const testAmounts = [10, 25, 50, 100, 250, 500, 1000];

console.log('Enhanced XRP Fee Structure Test');
console.log('='.repeat(80));

testAmounts.forEach(amount => {
  // Corrected fee calculation logic for proper profitability
  let serviceFee = 0;
  let platformFee = 0;
  const networkFee = 0.0002;
  
  if (amount < 100) {
    // Under $100: $3 service fee + 1% platform fee
    serviceFee = 3.00;
    platformFee = Math.round(amount * 0.01 * 100) / 100;
  } else {
    // $100 and above: $5 service fee + 0.75% platform fee
    serviceFee = 5.00;
    platformFee = Math.round(amount * 0.0075 * 100) / 100;
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

console.log('\nRevenue Analysis (After 5% Referral Payouts):');
testAmounts.forEach(amount => {
  let serviceFee = amount < 100 ? 3.00 : 5.00;
  let platformFee = amount < 100 ? Math.round(amount * 0.01 * 100) / 100 : Math.round(amount * 0.0075 * 100) / 100;
  let totalRevenue = serviceFee + platformFee;
  let referralPayout = totalRevenue * 0.05; // 5% commission
  let netRevenue = totalRevenue - referralPayout;
  
  console.log(`$${amount} transaction: $${totalRevenue.toFixed(2)} gross → $${netRevenue.toFixed(2)} net (after $${referralPayout.toFixed(2)} referral)`);
});

console.log('\nKey Benefits:');
console.log('- Corrected fee structure ensures profitability');
console.log('- Accounts for referral payouts while maintaining margins');
console.log('- Ultra-low network fees (~$0.0002)');
console.log('- Instant settlement (3-5 seconds)');
console.log('- All fees collected to funded production wallet');