/**
 * Real World Asset (RWA) Educational Service
 * COMPLIANCE: Information-only service for educational purposes
 * Does NOT facilitate transactions - only provides data and suggestions
 * AI agents can offer RWA services separately with proper credentials
 */

export interface RWAToken {
  contractAddress: string;
  symbol: string;
  name: string;
  assetType: 'treasury_bill' | 'real_estate' | 'commodity' | 'corporate_bond' | 'equity';
  network: 'ethereum' | 'polygon' | 'avalanche';
  yieldRate?: number; // Annual percentage yield
  maturityDate?: string; // For time-limited assets
  minimumInvestment: string;
  totalSupply: string;
  currentPrice: string;
  priceOracle: string;
  issuer: string;
  rating?: string; // Credit rating if applicable
  isActive: boolean;
}

export interface RWAPortfolio {
  agentId: string;
  totalValue: string;
  holdings: RWAHolding[];
  totalYield: string;
  lastUpdated: Date;
}

export interface RWAHolding {
  tokenAddress: string;
  symbol: string;
  amount: string;
  currentValue: string;
  purchasePrice: string;
  purchaseDate: Date;
  unrealizedGain: string;
  yieldEarned: string;
}

export class RWAIntegrationService {
  private static readonly SUPPORTED_RWA_TOKENS: RWAToken[] = [
    {
      contractAddress: '0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b',
      symbol: 'FOBXX',
      name: 'Fidelity Government Money Market',
      assetType: 'treasury_bill',
      network: 'ethereum',
      yieldRate: 4.85,
      minimumInvestment: '1.00',
      totalSupply: '1000000000',
      currentPrice: '1.00',
      priceOracle: '0x...',
      issuer: 'Fidelity Investments',
      rating: 'AAA',
      isActive: true
    },
    {
      contractAddress: '0x40379a439D4F6795B6fc9aa5687dB461677A2dBa',
      symbol: 'USYC',
      name: 'Hashnote US Yield Coin',
      assetType: 'treasury_bill',
      network: 'ethereum',
      yieldRate: 5.12,
      minimumInvestment: '1.00',
      totalSupply: '500000000',
      currentPrice: '1.00',
      priceOracle: '0x...',
      issuer: 'Hashnote',
      rating: 'AA+',
      isActive: true
    },
    {
      contractAddress: '0x96F6eF951840721AdBF46Ac996b59E0235CB985C',
      symbol: 'TBILL',
      name: 'OpenEden T-Bill Token',
      assetType: 'treasury_bill',
      network: 'ethereum',
      yieldRate: 4.95,
      minimumInvestment: '1000.00',
      totalSupply: '250000000',
      currentPrice: '1.00',
      priceOracle: '0x...',
      issuer: 'OpenEden',
      rating: 'AAA',
      isActive: true
    },
    {
      contractAddress: '0x2F123cF3F37CE3328CC9B5b8415f9EC5109b45e7',
      symbol: 'RWR',
      name: 'Tangible Real Estate Token',
      assetType: 'real_estate',
      network: 'ethereum',
      yieldRate: 7.25,
      minimumInvestment: '100.00',
      totalSupply: '10000000',
      currentPrice: '125.50',
      priceOracle: '0x...',
      issuer: 'Tangible',
      isActive: true
    }
  ];

  /**
   * Get all available RWA tokens
   */
  static getAvailableRWATokens(): RWAToken[] {
    return this.SUPPORTED_RWA_TOKENS.filter(token => token.isActive);
  }

  /**
   * Get RWA tokens by asset type
   */
  static getRWATokensByType(assetType: RWAToken['assetType']): RWAToken[] {
    return this.SUPPORTED_RWA_TOKENS.filter(
      token => token.assetType === assetType && token.isActive
    );
  }

  /**
   * Get treasury bill tokens (safest RWA option)
   */
  static getTreasuryBillTokens(): RWAToken[] {
    return this.getRWATokensByType('treasury_bill');
  }

  /**
   * Get real estate tokens
   */
  static getRealEstateTokens(): RWAToken[] {
    return this.getRWATokensByType('real_estate');
  }

  /**
   * Calculate potential yield for RWA investment
   */
  static calculateRWAYield(params: {
    tokenSymbol: string;
    investmentAmount: string;
    holdingPeriodDays: number;
  }): {
    annualYield: string;
    projectedReturn: string;
    dailyYield: string;
    compoundedReturn: string;
  } {
    const token = this.SUPPORTED_RWA_TOKENS.find(t => t.symbol === params.tokenSymbol);
    
    if (!token || !token.yieldRate) {
      throw new Error(`RWA token ${params.tokenSymbol} not found or no yield data available`);
    }

    const principal = parseFloat(params.investmentAmount);
    const annualRate = token.yieldRate / 100;
    const dailyRate = annualRate / 365;
    const holdingPeriod = params.holdingPeriodDays;

    const dailyYield = principal * dailyRate;
    const simpleReturn = principal * annualRate * (holdingPeriod / 365);
    const compoundedReturn = principal * Math.pow(1 + dailyRate, holdingPeriod) - principal;

    return {
      annualYield: token.yieldRate.toString(),
      projectedReturn: simpleReturn.toFixed(2),
      dailyYield: dailyYield.toFixed(4),
      compoundedReturn: compoundedReturn.toFixed(2)
    };
  }

  /**
   * Get educational RWA information for research purposes only
   * COMPLIANCE: Educational information only - not investment recommendations
   */
  static getRWAEducationalInfo(params: {
    riskProfile: 'conservative' | 'moderate' | 'aggressive';
    researchAmount: string;
    timeframe: 'short' | 'medium' | 'long';
  }): {
    tokens: RWAToken[];
    disclaimer: string;
  } {
    const amount = parseFloat(params.researchAmount);
    let tokens: RWAToken[] = [];

    if (params.riskProfile === 'conservative') {
      // Educational info on treasury bills and government-backed assets
      tokens = this.getTreasuryBillTokens()
        .filter(token => parseFloat(token.minimumInvestment) <= amount)
        .sort((a, b) => (b.yieldRate || 0) - (a.yieldRate || 0));
    } else if (params.riskProfile === 'moderate') {
      // Educational mix of treasury bills and real estate
      const treasuryBills = this.getTreasuryBillTokens()
        .filter(token => parseFloat(token.minimumInvestment) <= amount);
      const realEstate = this.getRealEstateTokens()
        .filter(token => parseFloat(token.minimumInvestment) <= amount && token.rating);
      
      tokens = [...treasuryBills, ...realEstate]
        .sort((a, b) => (b.yieldRate || 0) - (a.yieldRate || 0));
    } else {
      // Educational info on all asset types
      tokens = this.getAvailableRWATokens()
        .filter(token => parseFloat(token.minimumInvestment) <= amount)
        .sort((a, b) => (b.yieldRate || 0) - (a.yieldRate || 0));
    }

    return {
      tokens: tokens.slice(0, 5),
      disclaimer: "EDUCATIONAL ONLY: This information is for educational purposes only and does not constitute investment advice, financial advice, trading advice, or any other sort of advice. Consult with licensed financial advisors or securities brokers for investment decisions."
    };
  }

  /**
   * Educational portfolio allocation examples for research purposes
   * COMPLIANCE: Educational examples only - not investment advice
   */
  static getEducationalPortfolioExamples(params: {
    researchAmount: string;
    riskProfile: 'conservative' | 'moderate' | 'aggressive';
  }): {
    examples: Array<{
      token: RWAToken;
      exampleAmount: string;
      percentage: number;
    }>;
    educationalYieldExample: string;
    diversificationExample: number;
    disclaimer: string;
  } {
    const researchAmount = parseFloat(params.researchAmount);
    const educationalInfo = this.getRWAEducationalInfo({
      riskProfile: params.riskProfile,
      researchAmount: params.researchAmount,
      timeframe: 'medium'
    });

    const recommendations = educationalInfo.tokens;
    const totalAmount = researchAmount;
    let allocation: Array<{
      token: RWAToken;
      allocatedAmount: string;
      percentage: number;
    }> = [];

    if (params.riskProfile === 'conservative') {
      // 80% treasury bills, 20% high-grade real estate
      const treasuryBills = recommendations.filter(t => t.assetType === 'treasury_bill');
      const realEstate = recommendations.filter(t => t.assetType === 'real_estate');
      
      if (treasuryBills.length > 0) {
        allocation.push({
          token: treasuryBills[0],
          allocatedAmount: (totalAmount * 0.8).toFixed(2),
          percentage: 80
        });
      }
      
      if (realEstate.length > 0 && totalAmount >= 1000) {
        allocation.push({
          token: realEstate[0],
          allocatedAmount: (totalAmount * 0.2).toFixed(2),
          percentage: 20
        });
      }
    } else if (params.riskProfile === 'moderate') {
      // 60% treasury bills, 40% real estate
      const treasuryBills = recommendations.filter(t => t.assetType === 'treasury_bill');
      const realEstate = recommendations.filter(t => t.assetType === 'real_estate');
      
      if (treasuryBills.length > 0) {
        allocation.push({
          token: treasuryBills[0],
          allocatedAmount: (totalAmount * 0.6).toFixed(2),
          percentage: 60
        });
      }
      
      if (realEstate.length > 0) {
        allocation.push({
          token: realEstate[0],
          allocatedAmount: (totalAmount * 0.4).toFixed(2),
          percentage: 40
        });
      }
    } else {
      // Aggressive: Equal weight across asset types
      const perAssetAllocation = totalAmount / recommendations.length;
      allocation = recommendations.map(token => ({
        token,
        allocatedAmount: perAssetAllocation.toFixed(2),
        percentage: Math.round(100 / recommendations.length)
      }));
    }

    // Calculate expected yield
    const weightedYield = allocation.reduce((sum, item) => {
      const weight = item.percentage / 100;
      const yieldRate = item.token.yieldRate || 0;
      return sum + (weight * yieldRate);
    }, 0);

    // Diversification score (0-100)
    const assetTypes = new Set(allocation.map(item => item.token.assetType));
    const diversificationScore = Math.min(100, assetTypes.size * 25);

    return {
      examples: allocation.map(({ token, allocatedAmount, percentage }) => ({
        token, exampleAmount: allocatedAmount, percentage
      })),
      educationalYieldExample: weightedYield.toFixed(2),
      diversificationExample: diversificationScore,
      disclaimer: educationalInfo.disclaimer,
    };
  }

  /**
   * Validate RWA agent capabilities
   */
  static validateRWACapabilities(capabilities: string[]): {
    isValid: boolean;
    supportedAssets: string[];
    recommendations: string[];
  } {
    const validCapabilities = [
      'treasury_bill_management',
      'real_estate_tokenization',
      'commodity_trading',
      'yield_optimization',
      'portfolio_rebalancing',
      'risk_assessment',
      'compliance_monitoring'
    ];

    const supportedAssets = capabilities.filter(cap => 
      validCapabilities.includes(cap)
    );

    const recommendations = [];
    if (!capabilities.includes('treasury_bill_management')) {
      recommendations.push('Add treasury bill management for stable yield generation');
    }
    if (!capabilities.includes('risk_assessment')) {
      recommendations.push('Include risk assessment for better portfolio management');
    }

    return {
      isValid: supportedAssets.length > 0,
      supportedAssets,
      recommendations
    };
  }
}