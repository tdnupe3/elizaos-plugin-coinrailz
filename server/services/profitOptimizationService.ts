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
   * Create irresistible sub-$1000 packages with natural upgrade paths
   */
  static createMinimumOrderStrategies(): MinimumOrderStrategy[] {
    const economics = this.calculateUnitEconomics();
    
    return [
      {
        productBundle: 'Credit Scoring Validation Pack',
        minimumQueries: 250,
        pricePerQuery: 1.49,
        totalOrderValue: 373,
        yourProfit: 364, // $1.454 profit per query
        customerSavings: 752, // vs $4.50 competitor pricing
        mustBuyFactors: [
          '250 queries = Perfect for 2-week validation test',
          'Immediate ROI: Save $752 vs competitors on first package',
          'Quick proof of concept: Validate 92% accuracy claims',
          'Low commitment: Prove value before larger investment',
          'Natural upgrade: Most customers need 500-1000 queries/month'
        ],
        competitiveAdvantage: 'Risk-free validation at 67% below market rates'
      },
      {
        productBundle: 'Market Intelligence Starter',
        minimumQueries: 300,
        pricePerQuery: 2.49,
        totalOrderValue: 747,
        yourProfit: 717, // $2.39 profit per query
        customerSavings: 1203, // vs $6.50 competitor pricing
        mustBuyFactors: [
          '300 queries = 1-2 weeks of active trading data',
          'Immediate savings: $1,203 vs competitor rates',
          'Real-time advantage: 30-second updates prove superiority',
          'Perfect sizing: Forces monthly repurchase for active traders',
          'Upgrade trigger: Heavy users need 1000+ queries/month'
        ],
        competitiveAdvantage: '62% cost savings with superior data freshness'
      },
      {
        productBundle: 'Risk Assessment Essential',
        minimumQueries: 400,
        pricePerQuery: 1.89,
        totalOrderValue: 756,
        yourProfit: 726, // $1.815 profit per query
        customerSavings: 1244, // vs $5.00 competitor pricing
        mustBuyFactors: [
          '400 queries = 1-2 weeks of fraud monitoring',
          'Massive savings: $1,244 vs market leaders',
          'Compliance included: AML reporting saves $500/month',
          'Quick deployment: Immediate fraud reduction results',
          'Growth path: High-volume users need 2000+ queries/month'
        ],
        competitiveAdvantage: '62% cost savings with regulatory compliance included'
      },
      {
        productBundle: 'Multi-Data Sampler Pack',
        minimumQueries: 500, // Mixed queries: 200 credit + 150 market + 150 risk
        pricePerQuery: 1.99, // Blended rate
        totalOrderValue: 995,
        yourProfit: 945, // Average $1.89 profit per query
        customerSavings: 1755, // vs competitor average of $5.50
        mustBuyFactors: [
          '500 mixed queries = Test all data products at once',
          'Ultimate comparison: $1,755 savings vs piecing together competitors',
          'Single platform: One API, one billing, one support contact',
          'Data consistency: All products use same transaction foundation',
          'Perfect sizing: Just under $1000 psychological barrier',
          'Expansion ready: Most customers upgrade to 2000+ queries/month'
        ],
        competitiveAdvantage: '64% cost savings with unified platform benefits'
      },
      {
        productBundle: 'Monthly Growth Pack',
        minimumQueries: 600,
        pricePerQuery: 1.79, // Volume discount for commitment
        totalOrderValue: 974,
        yourProfit: 929, // $1.715 profit per query
        customerSavings: 2026, // vs competitor average
        mustBuyFactors: [
          '600 queries = Sized for monthly consumption patterns',
          'Growth pricing: $1.79/query rewards commitment',
          'Just under $1000: Avoids procurement approval barriers',
          'Perfect fit: Designed for 20-30 queries per business day',
          'Upgrade incentive: Heavy users will need additional packages'
        ],
        competitiveAdvantage: 'Strategic pricing for monthly business cycles'
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