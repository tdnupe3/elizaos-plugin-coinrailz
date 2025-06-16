/**
 * Comprehensive Business Logic Validation
 * Implements all critical business rules and edge case handling
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

export class BusinessLogicValidator {
  
  // Fee calculation business rules
  static validateFeeCalculation(amount: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Minimum transaction amount: $10 (to ensure profitability)
    if (amount < 10) {
      errors.push('Minimum transaction amount is $10.00');
    }

    // Maximum transaction amount: $50,000 (regulatory compliance)
    if (amount > 50000) {
      errors.push('Maximum transaction amount is $50,000.00 per transaction');
    }

    // Warn about low-profit transactions
    if (amount >= 10 && amount < 50) {
      warnings.push('Small transaction amounts may have higher relative fees');
    }

    // Calculate tiered fee structure
    let feeRate = 0.01; // Default 1%
    if (amount >= 10000) feeRate = 0.008; // 0.8% for large transactions
    if (amount >= 25000) feeRate = 0.006; // 0.6% for very large transactions

    const platformFee = amount * feeRate;
    const minimumFee = 1.00; // Minimum $1 fee
    const actualFee = Math.max(platformFee, minimumFee);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: {
        originalAmount: amount,
        feeRate: feeRate * 100,
        platformFee: actualFee,
        totalFee: actualFee,
        totalAmount: amount + actualFee,
        netAmount: amount,
        profitMargin: ((actualFee - 0.30) / actualFee * 100).toFixed(1) // Account for processing costs
      }
    };
  }

  // AI Agent registration business rules
  static validateAgentRegistration(agentData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!agentData.name || agentData.name.trim().length < 3) {
      errors.push('Agent name must be at least 3 characters long');
    }

    if (!agentData.capabilities || !Array.isArray(agentData.capabilities) || agentData.capabilities.length === 0) {
      errors.push('Agent must specify at least one capability');
    }

    // Business rule: Agent names must be unique and professional
    if (agentData.name && /[^\w\s-]/.test(agentData.name)) {
      errors.push('Agent name can only contain letters, numbers, spaces, and hyphens');
    }

    // Business rule: Capabilities must be from approved list
    const approvedCapabilities = [
      'trading', 'analysis', 'data_processing', 'customer_service', 
      'financial_planning', 'risk_assessment', 'market_research',
      'payment_processing', 'compliance_monitoring'
    ];

    if (agentData.capabilities) {
      const invalidCapabilities = agentData.capabilities.filter((cap: string) => 
        !approvedCapabilities.includes(cap)
      );
      if (invalidCapabilities.length > 0) {
        warnings.push(`Unrecognized capabilities: ${invalidCapabilities.join(', ')}`);
      }
    }

    // Business rule: Description length limits
    if (agentData.description && agentData.description.length > 500) {
      errors.push('Agent description cannot exceed 500 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: {
        sanitizedName: agentData.name?.trim(),
        validCapabilities: agentData.capabilities?.filter((cap: string) => 
          approvedCapabilities.includes(cap)
        ),
        membershipTier: 'basic',
        commissionRate: 0.5,
        status: 'pending_review' // All new agents require review
      }
    };
  }

  // Payment processing business rules
  static validatePaymentIntent(paymentData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Amount validation
    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push('Payment amount must be a positive number');
    }

    if (amount < 5) {
      errors.push('Minimum payment amount is $5.00');
    }

    if (amount > 10000) {
      warnings.push('Large payments may require additional verification');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!paymentData.recipientEmail || !emailRegex.test(paymentData.recipientEmail)) {
      errors.push('Valid recipient email address is required');
    }

    // Business rule: Prevent payments to common test/spam domains
    const blockedDomains = ['test.com', 'example.com', 'spam.com', 'fake.com'];
    if (paymentData.recipientEmail) {
      const domain = paymentData.recipientEmail.split('@')[1]?.toLowerCase();
      if (blockedDomains.includes(domain)) {
        errors.push('Cannot send payments to test or invalid email domains');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: {
        validatedAmount: amount,
        processingFee: Math.max(amount * 0.029 + 0.30, 0.50), // Stripe-like fees
        netAmount: amount - Math.max(amount * 0.029 + 0.30, 0.50)
      }
    };
  }

  // XRP wallet business rules
  static validateXRPTransaction(transactionData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Amount validation for XRP (minimum 0.000001 XRP)
    const amount = parseFloat(transactionData.amount);
    if (isNaN(amount) || amount < 0.000001) {
      errors.push('Minimum XRP transaction amount is 0.000001 XRP');
    }

    // XRP address validation (basic format check)
    if (!transactionData.destinationAddress || !transactionData.destinationAddress.startsWith('r')) {
      errors.push('Invalid XRP destination address format');
    }

    if (transactionData.destinationAddress && transactionData.destinationAddress.length !== 34) {
      errors.push('XRP address must be exactly 34 characters');
    }

    // Business rule: XRP reserve requirements
    if (amount > 0 && amount < 10) {
      warnings.push('Small XRP amounts may not meet destination wallet reserve requirements');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: {
        xrpAmount: amount,
        networkFee: 0.00001, // Standard XRP network fee
        totalCost: amount + 0.00001
      }
    };
  }

  // Revenue tracking business rules
  static validateRevenueData(platformData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Data consistency checks
    if (platformData.totalTransactions > 0 && platformData.totalVolume <= 0) {
      errors.push('Total volume cannot be zero when transactions exist');
    }

    if (platformData.totalFees > platformData.totalVolume) {
      errors.push('Total fees cannot exceed total transaction volume');
    }

    // Business rule: Fee percentage should be within expected range (0.1% - 5%)
    const feePercentage = (platformData.totalFees / platformData.totalVolume) * 100;
    if (feePercentage < 0.1) {
      warnings.push('Fee percentage is unusually low (less than 0.1%)');
    }
    if (feePercentage > 5) {
      warnings.push('Fee percentage is unusually high (greater than 5%)');
    }

    // Business rule: Agent revenue split validation (should be 85% of platform fees)
    const expectedAgentRevenue = platformData.totalFees * 0.85;
    const actualAgentRevenue = platformData.agents?.totalAgentRevenue || 0;
    const revenueDifference = Math.abs(expectedAgentRevenue - actualAgentRevenue);
    
    if (revenueDifference > 0.01) {
      warnings.push(`Agent revenue calculation may be incorrect. Expected: $${expectedAgentRevenue.toFixed(2)}, Actual: $${actualAgentRevenue.toFixed(2)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: {
        feePercentage: feePercentage.toFixed(3),
        platformRetention: (platformData.totalFees * 0.15).toFixed(2),
        agentPayouts: (platformData.totalFees * 0.85).toFixed(2),
        averageTransactionSize: platformData.totalTransactions > 0 
          ? (platformData.totalVolume / platformData.totalTransactions).toFixed(2)
          : '0.00'
      }
    };
  }

  // Comprehensive platform health check
  static validatePlatformHealth(systemData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Database connectivity
    if (!systemData.databaseConnected) {
      errors.push('Database connection is not available');
    }

    // Active agents threshold
    if (systemData.activeAgents < 1) {
      warnings.push('No active AI agents available for services');
    }

    // Transaction processing capability
    if (systemData.totalTransactions === 0) {
      warnings.push('No transactions processed yet - platform may need marketing');
    }

    // Revenue generation assessment
    const revenuePerAgent = systemData.activeAgents > 0 
      ? (systemData.totalFees / systemData.activeAgents) 
      : 0;
    
    if (revenuePerAgent < 10 && systemData.activeAgents > 0) {
      warnings.push('Low revenue per agent - consider optimizing fee structure or agent utilization');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: {
        healthScore: this.calculateHealthScore(systemData),
        recommendations: this.generateRecommendations(systemData)
      }
    };
  }

  private static calculateHealthScore(systemData: any): number {
    let score = 100;
    
    // Database connectivity (critical)
    if (!systemData.databaseConnected) score -= 50;
    
    // Active agents
    if (systemData.activeAgents === 0) score -= 20;
    if (systemData.activeAgents < 3) score -= 10;
    
    // Transaction volume
    if (systemData.totalTransactions === 0) score -= 15;
    if (systemData.totalVolume < 1000) score -= 10;
    
    // Revenue efficiency
    const feePercentage = (systemData.totalFees / systemData.totalVolume) * 100;
    if (feePercentage < 0.5) score -= 10;
    if (feePercentage > 3) score -= 5;
    
    return Math.max(0, score);
  }

  private static generateRecommendations(systemData: any): string[] {
    const recommendations: string[] = [];
    
    if (systemData.activeAgents < 5) {
      recommendations.push('Consider recruiting more AI agents to improve service coverage');
    }
    
    if (systemData.totalTransactions < 100) {
      recommendations.push('Focus on user acquisition and transaction volume growth');
    }
    
    const feePercentage = (systemData.totalFees / systemData.totalVolume) * 100;
    if (feePercentage < 1) {
      recommendations.push('Consider optimizing fee structure to improve profitability');
    }
    
    return recommendations;
  }
}