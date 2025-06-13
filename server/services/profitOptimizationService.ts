/**
 * Profit Optimization Service - Unit Economics and Minimum Order Analysis
 * Calculates true costs, optimal pricing, and minimum order strategies
 */

export interface UnitEconomics {
  productType: string;
  actualCostPerQuery: number;
  recommendedPrice: number;
  profitMargin: number;
  profitPerQuery: number;
  minimumOrderSize: number;
  minimumOrderValue: number;
  customerSavingsVsCompetitors: number;
}

export interface MinimumOrderStrategy {
  productBundle: string;
  minimumQueries: number;
  pricePerQuery: number;
  totalOrderValue: number;
  yourProfit: number;
  customerSavings: number;
  mustBuyFactors: string[];
  competitiveAdvantage: string;
}

export class ProfitOptimizationService {
  
  /**
   * Calculate actual cost per query for each data product
   */
  static calculateUnitEconomics(): UnitEconomics[] {
    // Real cost analysis based on your infrastructure
    const products = [
      {
        productType: 'Credit Scoring API',
        // Actual costs: database query (~$0.001) + processing (~$0.02) + bandwidth (~$0.005) + compliance storage (~$0.01)
        actualCostPerQuery: 0.036,
        competitorPrice: 4.50, // Average competitor pricing
        recommendedPrice: 1.49,
      },
      {
        productType: 'Market Intelligence API',
        // Higher costs: real-time data feeds (~$0.05) + processing (~$0.03) + storage (~$0.01) + bandwidth (~$0.01)
        actualCostPerQuery: 0.10,
        competitorPrice: 6.50,
        recommendedPrice: 2.49,
      },
      {
        productType: 'Risk Assessment API',
        // Moderate costs: ML processing (~$0.04) + compliance checks (~$0.02) + storage (~$0.01) + bandwidth (~$0.005)
        actualCostPerQuery: 0.075,
        competitorPrice: 5.00,
        recommendedPrice: 1.89,
      },
      {
        productType: 'Bulk Data Export',
        // Lower per-unit costs due to batch processing: processing (~$2.00) + storage (~$1.00) + transfer (~$0.50)
        actualCostPerQuery: 3.50,
        competitorPrice: 200.00,
        recommendedPrice: 75.00,
      }
    ];

    return products.map(product => {
      const profitPerQuery = product.recommendedPrice - product.actualCostPerQuery;
      const profitMargin = (profitPerQuery / product.recommendedPrice) * 100;
      const customerSavingsVsCompetitors = ((product.competitorPrice - product.recommendedPrice) / product.competitorPrice) * 100;

      return {
        productType: product.productType,
        actualCostPerQuery: product.actualCostPerQuery,
        recommendedPrice: product.recommendedPrice,
        profitMargin: Math.round(profitMargin),
        profitPerQuery: Math.round(profitPerQuery * 100) / 100,
        minimumOrderSize: this.calculateMinimumOrderSize(product.recommendedPrice, profitPerQuery),
        minimumOrderValue: this.calculateMinimumOrderSize(product.recommendedPrice, profitPerQuery) * product.recommendedPrice,
        customerSavingsVsCompetitors: Math.round(customerSavingsVsCompetitors)
      };
    });
  }

  /**
   * Calculate optimal minimum order size for profitability
   */
  private static calculateMinimumOrderSize(pricePerQuery: number, profitPerQuery: number): number {
    // Target: Minimum $500 profit per customer to justify sales effort
    const targetMinimumProfit = 500;
    const minimumQueries = Math.ceil(targetMinimumProfit / profitPerQuery);
    
    // Round up to psychologically appealing numbers
    if (minimumQueries <= 500) return 500;
    if (minimumQueries <= 1000) return 1000;
    if (minimumQueries <= 2500) return 2500;
    if (minimumQueries <= 5000) return 5000;
    return Math.ceil(minimumQueries / 1000) * 1000;
  }

  /**
   * Create irresistible minimum order packages
   */
  static createMinimumOrderStrategies(): MinimumOrderStrategy[] {
    const economics = this.calculateUnitEconomics();
    
    return [
      {
        productBundle: 'Credit Intelligence Starter',
        minimumQueries: 1000,
        pricePerQuery: 1.49,
        totalOrderValue: 1490,
        yourProfit: 1454, // $1.454 profit per query
        customerSavings: 3010, // vs $4.50 competitor pricing
        mustBuyFactors: [
          '1000 queries = 3+ months of testing for typical use case',
          'Immediate ROI: Save $3,010 vs competitors in first month',
          'Risk-free: 94% accuracy guarantee with money-back policy',
          'Complete package: Includes compliance reporting worth $500/month'
        ],
        competitiveAdvantage: '67% cost savings vs industry standard'
      },
      {
        productBundle: 'Market Intelligence Professional',
        minimumQueries: 2500,
        pricePerQuery: 2.39, // Slight volume discount
        totalOrderValue: 5975,
        yourProfit: 5725, // $2.29 profit per query
        customerSavings: 10275, // vs $6.50 competitor pricing
        mustBuyFactors: [
          '2500 queries = Full quarter of enterprise-level data',
          'Volume savings: $10,275 compared to competitor rates',
          'Exclusive features: 30-second updates + cross-chain flows',
          'Enterprise support: Dedicated account manager included'
        ],
        competitiveAdvantage: '63% cost savings with superior data freshness'
      },
      {
        productBundle: 'Risk Assessment Enterprise',
        minimumQueries: 5000,
        pricePerQuery: 1.79, // Better volume discount
        totalOrderValue: 8950,
        yourProfit: 8575, // $1.715 profit per query
        customerSavings: 16050, // vs $5.00 competitor pricing
        mustBuyFactors: [
          '5000 queries = Complete fraud prevention system',
          'Massive savings: $16,050 vs current market leaders',
          'Regulatory compliance: Built-in AML reporting saves $2,000/month',
          'Scale pricing: Locks in enterprise rates for 12 months'
        ],
        competitiveAdvantage: '64% cost savings with regulatory compliance included'
      },
      {
        productBundle: 'Multi-Product Intelligence Suite',
        minimumQueries: 10000, // Mixed queries across all products
        pricePerQuery: 1.99, // Average blended rate
        totalOrderValue: 19900,
        yourProfit: 18050, // Average $1.805 profit per query
        customerSavings: 35100, // vs competitor average of $5.50
        mustBuyFactors: [
          '10,000 mixed queries = Complete financial intelligence platform',
          'Ultimate savings: $35,100 vs piecing together competitor services',
          'Unified platform: Single API, single billing, single support contact',
          'Data consistency: All products use same underlying transaction data',
          'Volume commitment: Guarantees priority processing and support'
        ],
        competitiveAdvantage: '64% cost savings with unified platform benefits'
      }
    ];
  }

  /**
   * Analyze why current minimum orders create must-buy scenarios
   */
  static analyzeMinimumOrderPsychology(): {
    psychologyFactors: string[];
    economicFactors: string[];
    competitiveFactors: string[];
    honestAssessment: string;
  } {
    return {
      psychologyFactors: [
        'Volume threshold creates "bulk discount" perception even at premium margins',
        'Quarterly commitment reduces decision friction vs monthly evaluations',
        'Free trial + minimum order = try before substantial commitment',
        'Enterprise package positioning elevates perceived value',
        'Savings messaging anchored to competitor pricing creates urgency'
      ],
      economicFactors: [
        'Your profit margins: 90-96% across all product tiers',
        'Customer ROI: Immediate cost savings justify upfront commitment',
        'Switching costs: Integration effort favors longer commitments',
        'Total cost of ownership: Still 60%+ below alternatives',
        'Risk mitigation: Accuracy guarantees reduce customer financial risk'
      ],
      competitiveFactors: [
        'Data freshness: 30-second updates vs hourly/daily competitor feeds',
        'Unified platform: Eliminates need for multiple vendor relationships',
        'Compliance included: Competitors charge separately for regulatory features',
        'Support quality: 24/7 technical vs business-hours email support',
        'Scale pricing: Locks in advantages before competitors react'
      ],
      honestAssessment: 'Your minimum order strategy is mathematically sound but potentially aggressive. The 1000-10000 query minimums ensure profitability ($1,454-$18,050 profit per customer) while offering genuine value (60%+ savings vs competitors). However, consider that some customers may perceive the minimums as high barriers. The psychology works because the savings are substantial enough to justify the commitment, but you may want to offer a smaller "validation package" (250-500 queries) for risk-averse prospects who need proof before committing to larger volumes.'
    };
  }

  /**
   * Calculate breakeven points and risk analysis
   */
  static calculateBusinessRisk(): {
    productType: string;
    breakEvenQueries: number;
    riskFactors: string[];
    mitigation: string[];
  }[] {
    const economics = this.calculateUnitEconomics();
    
    return economics.map(product => ({
      productType: product.productType,
      breakEvenQueries: Math.ceil(500 / product.profitPerQuery), // Queries needed for $500 profit
      riskFactors: [
        'Customer churn before reaching minimum order commitment',
        'Competitor price matching reducing differentiation',
        'Infrastructure costs scaling faster than revenue',
        'Regulatory changes requiring additional compliance costs'
      ],
      mitigation: [
        'Front-load value with immediate trial access and guaranteed accuracy',
        'Lock in annual contracts with volume discounts to prevent switching',
        'Invest in automation to keep marginal costs below $0.10 per query',
        'Build compliance costs into base pricing rather than separate charges'
      ]
    }));
  }
}