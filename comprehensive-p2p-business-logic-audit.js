/**
 * COMPREHENSIVE P2P BUSINESS LOGIC AUDIT
 * Complete validation of fee structure, referral costs, and profitability
 */

class P2PBusinessLogicAuditor {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
  }

  async runCompleteAudit() {
    console.log('=== COMPREHENSIVE P2P BUSINESS LOGIC AUDIT ===\n');
    
    await this.auditFeeStructure();
    await this.auditReferralImpact();
    await this.auditUserFlow();
    await this.auditProfitabilityScenarios();
    await this.auditEdgeCases();
    
    this.generateFinalReport();
  }

  async auditFeeStructure() {
    console.log('1. AUDITING FEE STRUCTURE...\n');
    
    const testScenarios = [
      // Cross-platform transfers
      { amount: 100, from: 'stripe', to: 'paypal', expectedFee: 10, type: 'cross-platform' },
      { amount: 50, from: 'paypal', to: 'stripe', expectedFee: 5, type: 'cross-platform' },
      { amount: 25, from: 'credit', to: 'paypal', expectedFee: 2.5, type: 'cross-platform' },
      
      // Same-platform transfers
      { amount: 100, from: 'stripe', to: 'coinrailz', expectedFee: 3.55, type: 'standard' },
      { amount: 50, from: 'paypal', to: 'crypto', expectedFee: 2.70, type: 'standard' },
      { amount: 20, from: 'stripe', to: 'coinrailz', expectedFee: 2.70, type: 'standard' },
    ];

    for (const scenario of testScenarios) {
      try {
        const response = await this.makeRequest('POST', '/api/p2p/calculate-fee', {
          amount: scenario.amount,
          senderMethod: scenario.from,
          recipientPlatform: scenario.to
        });

        const isCorrect = Math.abs(response.fee - scenario.expectedFee) < 0.01;
        
        console.log(`${scenario.from.toUpperCase()} → ${scenario.to.toUpperCase()} ($${scenario.amount})`);
        console.log(`  Expected: $${scenario.expectedFee} | Actual: $${response.fee}`);
        console.log(`  Type: ${response.transferType || 'unknown'}`);
        console.log(`  Status: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
        
        if (response.processingCosts) {
          console.log(`  Processing costs: $${response.processingCosts.total}`);
          console.log(`  Profit margin: ${response.feeStructure.profitMargin}`);
        }
        console.log('');

        if (!isCorrect) {
          this.errors.push(`Fee calculation incorrect for ${scenario.from} → ${scenario.to}`);
        }
      } catch (error) {
        this.errors.push(`Fee calculation failed for ${scenario.from} → ${scenario.to}: ${error.message}`);
        console.log(`❌ ERROR: ${error.message}\n`);
      }
    }
  }

  async auditReferralImpact() {
    console.log('2. AUDITING REFERRAL COST IMPACT...\n');
    
    // Get current referral rates from the platform
    try {
      const referralResponse = await this.makeRequest('GET', '/api/referrals/structure');
      const referralRates = referralResponse.commissionRates || { tier1: 0.003, tier2: 0.004, tier3: 0.006 };
      
      console.log('Current referral commission rates:');
      console.log(`  Tier 1: ${(referralRates.tier1 * 100).toFixed(1)}%`);
      console.log(`  Tier 2: ${(referralRates.tier2 * 100).toFixed(1)}%`);
      console.log(`  Tier 3: ${(referralRates.tier3 * 100).toFixed(1)}%\n`);

      // Test scenarios with referral costs
      const scenarios = [
        { amount: 100, from: 'stripe', to: 'paypal', referralTier: 'tier1' },
        { amount: 100, from: 'stripe', to: 'paypal', referralTier: 'tier2' },
        { amount: 100, from: 'stripe', to: 'paypal', referralTier: 'tier3' },
        { amount: 50, from: 'stripe', to: 'coinrailz', referralTier: 'tier1' },
      ];

      for (const scenario of scenarios) {
        const feeResponse = await this.makeRequest('POST', '/api/p2p/calculate-fee', {
          amount: scenario.amount,
          senderMethod: scenario.from,
          recipientPlatform: scenario.to
        });

        const referralCost = scenario.amount * referralRates[scenario.referralTier];
        const processingCost = feeResponse.processingCosts?.total || 0;
        const totalCosts = processingCost + referralCost;
        const netProfit = feeResponse.fee - totalCosts;
        const profitMargin = ((netProfit / feeResponse.fee) * 100).toFixed(1);

        console.log(`${scenario.from.toUpperCase()} → ${scenario.to.toUpperCase()} ($${scenario.amount}) - ${scenario.referralTier.toUpperCase()}`);
        console.log(`  Platform fee: $${feeResponse.fee}`);
        console.log(`  Processing cost: $${processingCost}`);
        console.log(`  Referral cost: $${referralCost.toFixed(2)}`);
        console.log(`  Total costs: $${totalCosts.toFixed(2)}`);
        console.log(`  Net profit: $${netProfit.toFixed(2)} (${profitMargin}% margin)`);
        console.log(`  Status: ${netProfit > 0 ? '✅ PROFITABLE' : '❌ LOSING MONEY'}\n`);

        if (netProfit <= 0) {
          this.errors.push(`Transaction loses money with referrals: ${scenario.from} → ${scenario.to} (${scenario.referralTier})`);
        } else if (parseFloat(profitMargin) < 5) {
          this.warnings.push(`Low profit margin with referrals: ${scenario.from} → ${scenario.to} (${profitMargin}%)`);
        }
      }
    } catch (error) {
      this.errors.push(`Referral audit failed: ${error.message}`);
      console.log(`❌ ERROR: Could not audit referral impact - ${error.message}\n`);
    }
  }

  async auditUserFlow() {
    console.log('3. AUDITING COMPLETE USER FLOW...\n');
    
    try {
      // Test supported platforms endpoint
      const platformsResponse = await this.makeRequest('GET', '/api/p2p/supported-platforms');
      console.log('Supported platforms:', platformsResponse.platforms?.length || 0);
      
      if (platformsResponse.platforms) {
        platformsResponse.platforms.forEach(platform => {
          console.log(`  - ${platform.name}: ${platform.available ? 'Available' : 'Coming Soon'}`);
        });
        console.log('');
      }

      // Test transfer initiation
      const initiateResponse = await this.makeRequest('POST', '/api/p2p/initiate', {
        senderMethod: 'stripe',
        recipientPlatform: 'paypal',
        recipientIdentifier: 'test@example.com',
        amount: 50,
        message: 'Test transfer'
      });

      console.log('Transfer initiation test:');
      console.log(`  Success: ${initiateResponse.success ? '✅' : '❌'}`);
      console.log(`  Transfer ID: ${initiateResponse.transferId || 'N/A'}`);
      console.log(`  Fee: $${initiateResponse.fee || 0}`);
      console.log(`  Total: $${initiateResponse.total || 0}\n`);

      if (!initiateResponse.success) {
        this.errors.push(`Transfer initiation failed: ${initiateResponse.error}`);
      }

    } catch (error) {
      this.errors.push(`User flow audit failed: ${error.message}`);
      console.log(`❌ ERROR: User flow test failed - ${error.message}\n`);
    }
  }

  async auditProfitabilityScenarios() {
    console.log('4. AUDITING PROFITABILITY SCENARIOS...\n');
    
    const scenarios = [
      // Edge cases that could be problematic
      { amount: 5, from: 'stripe', to: 'paypal', desc: 'Minimum cross-platform' },
      { amount: 10, from: 'paypal', to: 'stripe', desc: 'Small cross-platform' },
      { amount: 1000, from: 'stripe', to: 'paypal', desc: 'Large cross-platform' },
      { amount: 5, from: 'stripe', to: 'coinrailz', desc: 'Minimum internal' },
      { amount: 15, from: 'paypal', to: 'crypto', desc: 'Small standard' },
    ];

    for (const scenario of scenarios) {
      try {
        const response = await this.makeRequest('POST', '/api/p2p/calculate-fee', {
          amount: scenario.amount,
          senderMethod: scenario.from,
          recipientPlatform: scenario.to
        });

        // Calculate with worst-case referral (tier3 = 0.6%)
        const referralCost = scenario.amount * 0.006;
        const processingCost = response.processingCosts?.total || 0;
        const totalCosts = processingCost + referralCost;
        const netProfit = response.fee - totalCosts;
        const profitMargin = ((netProfit / response.fee) * 100).toFixed(1);

        console.log(`${scenario.desc} - $${scenario.amount}`);
        console.log(`  Fee: $${response.fee} | Costs: $${totalCosts.toFixed(2)} | Profit: $${netProfit.toFixed(2)} (${profitMargin}%)`);
        console.log(`  Status: ${netProfit > 0 ? '✅ PROFITABLE' : '❌ UNPROFITABLE'}\n`);

        if (netProfit <= 0) {
          this.errors.push(`Unprofitable scenario: ${scenario.desc}`);
        }
      } catch (error) {
        this.errors.push(`Profitability test failed for ${scenario.desc}: ${error.message}`);
      }
    }
  }

  async auditEdgeCases() {
    console.log('5. AUDITING EDGE CASES...\n');
    
    const edgeCases = [
      { amount: 0, from: 'stripe', to: 'paypal', desc: 'Zero amount' },
      { amount: -10, from: 'stripe', to: 'paypal', desc: 'Negative amount' },
      { amount: 'invalid', from: 'stripe', to: 'paypal', desc: 'Invalid amount' },
      { amount: 100, from: 'unknown', to: 'paypal', desc: 'Unknown sender' },
      { amount: 100, from: 'stripe', to: 'unknown', desc: 'Unknown recipient' },
    ];

    for (const testCase of edgeCases) {
      try {
        const response = await this.makeRequest('POST', '/api/p2p/calculate-fee', {
          amount: testCase.amount,
          senderMethod: testCase.from,
          recipientPlatform: testCase.to
        });

        console.log(`${testCase.desc}:`);
        console.log(`  Response: ${response.success ? 'Success' : 'Error'}`);
        console.log(`  Message: ${response.error || 'No error'}\n`);

        if (testCase.desc.includes('Zero') || testCase.desc.includes('Negative') || testCase.desc.includes('Invalid')) {
          if (response.success) {
            this.warnings.push(`Edge case should fail but succeeded: ${testCase.desc}`);
          }
        }
      } catch (error) {
        console.log(`${testCase.desc}: ✅ Properly rejected (${error.message})\n`);
      }
    }
  }

  async makeRequest(method, endpoint, data = null) {
    const url = `http://localhost:5000${endpoint}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  }

  generateFinalReport() {
    console.log('=== FINAL AUDIT REPORT ===\n');
    
    console.log(`Total Errors: ${this.errors.length}`);
    console.log(`Total Warnings: ${this.warnings.length}\n`);

    if (this.errors.length > 0) {
      console.log('CRITICAL ERRORS:');
      this.errors.forEach(error => console.log(`  ❌ ${error}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('WARNINGS:');
      this.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
      console.log('');
    }

    const status = this.errors.length === 0 ? 'READY FOR PRODUCTION' : 'REQUIRES FIXES';
    const confidence = this.errors.length === 0 && this.warnings.length <= 2 ? 'HIGH' : 
                      this.errors.length === 0 ? 'MEDIUM' : 'LOW';
    
    console.log(`AUDIT STATUS: ${status}`);
    console.log(`CONFIDENCE LEVEL: ${confidence}`);
    
    if (this.errors.length > 0) {
      console.log('\nRECOMMENDATIONS:');
      console.log('1. Fix all critical errors before deployment');
      console.log('2. Review fee structure for unprofitable scenarios');
      console.log('3. Consider increasing minimum transaction amounts');
      console.log('4. Validate referral cost calculations');
    }
  }
}

// Run the audit
const auditor = new P2PBusinessLogicAuditor();
auditor.runCompleteAudit().catch(console.error);