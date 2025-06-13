/**
 * Enhanced Fee Calculation Endpoint
 * Implements sustainable fee structure: 4.5% + fixed fees
 * Ensures 70% profit margins for platform sustainability
 */

import { Express } from 'express';

export function registerEnhancedFeeEndpoint(app: Express) {
  // Enhanced fee calculation with sustainable profit margins
  app.post('/api/fees/enhanced', (req, res) => {
    try {
      const { amount, paymentMethod = 'credit_card', currency = 'USD' } = req.body;
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid amount provided'
        });
      }

      const transactionAmount = parseFloat(amount);
      
      // Enhanced fee structure for sustainable profitability
      const percentageFee = transactionAmount * 0.045; // 4.5% transaction fee
      const serviceFee = 5.00; // $5.00 service fee
      const platformUsageFee = 2.50; // $2.50 platform usage fee
      
      // Payment method surcharges
      let paymentSurcharge = 0;
      let surchargeDescription = 'No surcharge';
      
      if (paymentMethod === 'credit_card') {
        paymentSurcharge = transactionAmount * 0.01 + 0.30; // 1% + $0.30
        surchargeDescription = 'Credit card processing fee';
      } else if (paymentMethod === 'paypal') {
        paymentSurcharge = transactionAmount * 0.015 + 0.49; // 1.5% + $0.49
        surchargeDescription = 'PayPal processing fee';
      } else if (paymentMethod === 'crypto' || paymentMethod === 'xrp') {
        paymentSurcharge = 0.0002; // XRP network fee only
        surchargeDescription = 'Blockchain network fee';
      }
      
      const totalFees = percentageFee + serviceFee + platformUsageFee + paymentSurcharge;
      const totalAmount = transactionAmount + totalFees;
      const feePercentage = (totalFees / transactionAmount) * 100;
      
      // Calculate worst-case commission payouts (Elite tier bonuses)
      const commissionRates = [0.004, 0.002, 0.001, 0.0005, 0.0005, 0.0005, 0.0005]; // 7 tiers
      const eliteBonusMultiplier = 1.5; // +50% for Elite agents
      let totalCommissions = 0;
      
      commissionRates.forEach(rate => {
        totalCommissions += transactionAmount * rate * eliteBonusMultiplier;
      });
      
      const netPlatformRevenue = totalFees - totalCommissions;
      const profitMargin = (netPlatformRevenue / totalFees) * 100;

      // Competitive analysis
      const competitive = {
        westernUnion: '4-8%',
        paypalIntl: '5-7%',
        wireTransfer: '3-5%',
        coinRailz: feePercentage.toFixed(1) + '%',
        savings: 'Up to 3x faster, up to 50% cheaper'
      };

      res.json({
        success: true,
        amount: transactionAmount,
        fee: parseFloat(totalFees.toFixed(2)),
        total: parseFloat(totalAmount.toFixed(2)),
        feePercentage: parseFloat(feePercentage.toFixed(2)),
        currency: currency,
        paymentMethod: paymentMethod,
        feeBreakdown: {
          percentageFee: parseFloat(percentageFee.toFixed(2)),
          serviceFee: serviceFee,
          platformUsageFee: platformUsageFee,
          paymentSurcharge: parseFloat(paymentSurcharge.toFixed(2)),
          surchargeDescription: surchargeDescription
        },
        profitability: {
          totalRevenue: parseFloat(totalFees.toFixed(2)),
          commissionPayouts: parseFloat(totalCommissions.toFixed(2)),
          netProfit: parseFloat(netPlatformRevenue.toFixed(2)),
          profitMargin: parseFloat(profitMargin.toFixed(1))
        },
        competitive: competitive,
        businessModel: {
          sustainable: profitMargin > 60,
          status: profitMargin > 60 ? 'PRODUCTION READY' : 'NEEDS OPTIMIZATION',
          monthlyPotential: `$${((netPlatformRevenue / transactionAmount) * 2000000).toLocaleString()} on $2M volume`
        }
      });

    } catch (error: any) {
      console.error('Enhanced fee calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Fee calculation failed',
        error: error.message
      });
    }
  });

  // Override the old fee calculation endpoint
  app.post('/api/fees/calculate', (req, res) => {
    // Redirect to enhanced endpoint for consistent results
    const { amount, paymentMethod = 'credit_card', currency = 'USD' } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    const transactionAmount = parseFloat(amount);
    
    // Enhanced fee structure: 4.5% + fixed fees
    const percentageFee = transactionAmount * 0.045;
    const serviceFee = 5.00;
    const platformUsageFee = 2.50;
    
    let paymentSurcharge = 0;
    if (paymentMethod === 'credit_card') {
      paymentSurcharge = transactionAmount * 0.01 + 0.30;
    } else if (paymentMethod === 'paypal') {
      paymentSurcharge = transactionAmount * 0.015 + 0.49;
    }
    
    const totalFee = percentageFee + serviceFee + platformUsageFee + paymentSurcharge;
    const total = transactionAmount + totalFee;
    const feePercentage = (totalFee / transactionAmount) * 100;

    res.json({
      success: true,
      amount: transactionAmount,
      fee: parseFloat(totalFee.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      feePercentage: parseFloat(feePercentage.toFixed(2)),
      fromCurrency: 'USD',
      toCurrency: 'XRP',
      transactionType: 'p2p_transfer'
    });
  });
}