// Test the new tiered service fee structure
const { FeeCalculator } = require('./server/services/feeCalculator.ts');

console.log('Testing New Tiered Fee Structure\n');

// Test scenarios
const scenarios = [
  { amount: 10, method: 'stripe', name: 'Small Transaction ($10)' },
  { amount: 25, method: 'stripe', name: 'Threshold Transaction ($25)' },
  { amount: 45, method: 'paypal', name: 'Medium Transaction ($45)' },
  { amount: 75, method: 'stripe', name: 'Large Transaction ($75)' },
  { amount: 100, method: 'crypto', name: 'Crypto Transaction ($100)' }
];

scenarios.forEach(scenario => {
  let feeCalc;
  
  if (scenario.method === 'stripe') {
    feeCalc = {
      originalAmount: scenario.amount,
      processingFee: Math.round((scenario.amount * 0.029 + 0.30) * 100) / 100,
      convenienceFee: scenario.amount < 25 ? 
        Math.round((scenario.amount * 0.035 + 0.50 + 1.50) * 100) / 100 :
        scenario.amount < 50 ?
        Math.round((scenario.amount * 0.032 + 0.35 + 0.75) * 100) / 100 :
        Math.round((scenario.amount * 0.032 + 0.35) * 100) / 100,
      platformFee: Math.round(scenario.amount * 0.01 * 100) / 100,
      paymentMethod: 'stripe'
    };
  } else if (scenario.method === 'paypal') {
    feeCalc = {
      originalAmount: scenario.amount,
      processingFee: Math.round((scenario.amount * 0.029 + 0.30) * 100) / 100,
      convenienceFee: scenario.amount < 25 ? 
        Math.round((scenario.amount * 0.035 + 0.50 + 1.50) * 100) / 100 :
        scenario.amount < 50 ?
        Math.round((scenario.amount * 0.032 + 0.35 + 0.75) * 100) / 100 :
        Math.round((scenario.amount * 0.032 + 0.35) * 100) / 100,
      platformFee: Math.round(scenario.amount * 0.01 * 100) / 100,
      paymentMethod: 'paypal'
    };
  } else {
    feeCalc = {
      originalAmount: scenario.amount,
      processingFee: 0,
      convenienceFee: 0,
      platformFee: Math.round(scenario.amount * 0.01 * 100) / 100,
      paymentMethod: 'crypto'
    };
  }
  
  feeCalc.totalFee = feeCalc.convenienceFee + feeCalc.platformFee;
  feeCalc.totalAmount = feeCalc.originalAmount + feeCalc.totalFee;
  feeCalc.netAmount = feeCalc.totalAmount - feeCalc.processingFee;
  
  const profit = feeCalc.totalFee - feeCalc.processingFee;
  const margin = (profit / feeCalc.totalFee) * 100;
  
  console.log(`${scenario.name}:`);
  console.log(`  Total Fee: $${feeCalc.totalFee.toFixed(2)}`);
  console.log(`  Processing Cost: $${feeCalc.processingFee.toFixed(2)}`);
  console.log(`  Net Profit: $${profit.toFixed(2)}`);
  console.log(`  Profit Margin: ${margin.toFixed(1)}%`);
  console.log(`  User Pays: $${feeCalc.totalAmount.toFixed(2)}`);
  console.log(`  Effective Rate: ${((feeCalc.totalFee / scenario.amount) * 100).toFixed(1)}%`);
  console.log('');
});

// Calculate break-even
const dailyCosts = 40;
const avgProfit = 1.2; // Conservative estimate
const breakEvenTransactions = Math.ceil(dailyCosts / avgProfit);

console.log(`Break-even Analysis:`);
console.log(`  Daily Operating Costs: $${dailyCosts}`);
console.log(`  Average Profit per Transaction: $${avgProfit}`);
console.log(`  Break-even Transactions/Day: ${breakEvenTransactions}`);
console.log(`  Break-even Monthly Volume: $${breakEvenTransactions * 50 * 30} (assuming $50 avg)`);