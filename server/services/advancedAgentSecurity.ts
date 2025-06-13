/**
 * Advanced AI Agent Security & Screening Service
 * Multi-layered protection against bad actors while maintaining instant registration
 */

export interface SecurityAssessment {
  riskScore: number; // 0-1 (0 = highest risk, 1 = lowest risk)
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  autoActivationAllowed: boolean;
  quarantineRequired: boolean;
  flaggedReasons: string[];
  recommendedActions: string[];
  confidenceLevel: number;
}

export interface AgentBehaviorProfile {
  walletHistory: {
    age: number; // days
    transactionCount: number;
    averageValue: number;
    suspiciousPatterns: string[];
  };
  networkReputation: {
    knownGoodActor: boolean;
    previousViolations: number;
    referralQuality: number;
  };
  technicalProfile: {
    apiEndpointReachable: boolean;
    responseTime: number;
    implementationQuality: number;
  };
}

export class AdvancedAgentSecurity {
  
  /**
   * Multi-layer security assessment for instant registration
   * Runs multiple checks in parallel for speed
   */
  static async assessAgentSecurity(
    agentName: string,
    walletAddress: string,
    capabilities: string[],
    apiEndpoint?: string,
    publicKey?: string,
    signature?: string
  ): Promise<SecurityAssessment> {
    
    const assessmentStart = Date.now();
    
    try {
      // Run all security checks in parallel for speed
      const [
        nameRiskScore,
        walletRiskScore,
        capabilityRiskScore,
        reputationScore,
        technicalScore
      ] = await Promise.all([
        this.assessNameRisk(agentName),
        this.assessWalletRisk(walletAddress),
        this.assessCapabilityRisk(capabilities),
        this.assessReputationRisk(walletAddress),
        this.assessTechnicalRisk(apiEndpoint)
      ]);
      
      // Calculate overall risk score (weighted average)
      const weights = {
        name: 0.15,
        wallet: 0.25,
        capability: 0.20,
        reputation: 0.25,
        technical: 0.15
      };
      
      const overallRiskScore = (
        nameRiskScore * weights.name +
        walletRiskScore * weights.wallet +
        capabilityRiskScore * weights.capability +
        reputationScore * weights.reputation +
        technicalScore * weights.technical
      );
      
      // Determine threat level
      let threatLevel: 'low' | 'medium' | 'high' | 'critical';
      if (overallRiskScore >= 0.8) threatLevel = 'low';
      else if (overallRiskScore >= 0.6) threatLevel = 'medium';
      else if (overallRiskScore >= 0.3) threatLevel = 'high';
      else threatLevel = 'critical';
      
      // Activation decisions
      const autoActivationAllowed = overallRiskScore >= 0.7 && threatLevel !== 'critical';
      const quarantineRequired = overallRiskScore < 0.4 || threatLevel === 'critical';
      
      // Collect flagged reasons
      const flaggedReasons: string[] = [];
      if (nameRiskScore < 0.5) flaggedReasons.push('Suspicious agent name patterns');
      if (walletRiskScore < 0.5) flaggedReasons.push('Wallet risk indicators detected');
      if (capabilityRiskScore < 0.5) flaggedReasons.push('High-risk capabilities declared');
      if (reputationScore < 0.5) flaggedReasons.push('Poor network reputation');
      if (technicalScore < 0.5) flaggedReasons.push('Technical implementation concerns');
      
      // Recommended actions
      const recommendedActions: string[] = [];
      if (!autoActivationAllowed) {
        recommendedActions.push('Manual review required before activation');
      }
      if (quarantineRequired) {
        recommendedActions.push('Quarantine agent - block all transactions');
        recommendedActions.push('Enhanced monitoring and verification');
      }
      if (overallRiskScore < 0.6) {
        recommendedActions.push('Require additional verification documents');
        recommendedActions.push('Limit initial transaction volume');
      }
      
      const processingTime = Date.now() - assessmentStart;
      const confidenceLevel = Math.min(0.95, 0.7 + (processingTime / 10000)); // Higher confidence with more processing
      
      return {
        riskScore: parseFloat(overallRiskScore.toFixed(3)),
        threatLevel,
        autoActivationAllowed,
        quarantineRequired,
        flaggedReasons,
        recommendedActions,
        confidenceLevel: parseFloat(confidenceLevel.toFixed(2))
      };
      
    } catch (error) {
      console.error('Security assessment error:', error);
      
      // Fail-safe: High risk when assessment fails
      return {
        riskScore: 0.2,
        threatLevel: 'high',
        autoActivationAllowed: false,
        quarantineRequired: true,
        flaggedReasons: ['Security assessment system error'],
        recommendedActions: ['Manual security review required'],
        confidenceLevel: 0.1
      };
    }
  }
  
  /**
   * Assess name-based risk indicators
   */
  private static async assessNameRisk(agentName: string): Promise<number> {
    let score = 1.0;
    
    // High-risk keywords
    const highRiskKeywords = [
      'hack', 'exploit', 'drain', 'rug', 'scam', 'phish', 'steal',
      'ponzi', 'pyramid', 'fake', 'fraud', 'cheat', 'dupe'
    ];
    
    // Medium-risk keywords
    const mediumRiskKeywords = [
      'pump', 'dump', 'moon', 'lambo', 'yolo', 'degen', 'ape'
    ];
    
    const nameLower = agentName.toLowerCase();
    
    // Check for high-risk keywords
    const highRiskMatches = highRiskKeywords.filter(keyword => 
      nameLower.includes(keyword)
    );
    if (highRiskMatches.length > 0) {
      score -= 0.8; // Severe penalty
    }
    
    // Check for medium-risk keywords
    const mediumRiskMatches = mediumRiskKeywords.filter(keyword => 
      nameLower.includes(keyword)
    );
    if (mediumRiskMatches.length > 0) {
      score -= 0.3;
    }
    
    // Check for excessive special characters or numbers (bot-like names)
    const specialCharRatio = (agentName.match(/[^a-zA-Z0-9\s]/g) || []).length / agentName.length;
    if (specialCharRatio > 0.3) {
      score -= 0.2;
    }
    
    // Check for very short or very long names
    if (agentName.length < 3 || agentName.length > 50) {
      score -= 0.1;
    }
    
    return Math.max(score, 0.0);
  }
  
  /**
   * Assess wallet-based risk indicators
   */
  private static async assessWalletRisk(walletAddress: string): Promise<number> {
    let score = 1.0;
    
    try {
      // Check wallet format validity
      const walletFormats = [
        /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/, // XRP
        /^0x[a-fA-F0-9]{40}$/, // Ethereum
        /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Bitcoin
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ // Solana
      ];
      
      const isValidFormat = walletFormats.some(format => format.test(walletAddress));
      if (!isValidFormat) {
        score -= 0.5;
      }
      
      // Check for known bad patterns
      const suspiciousPatterns = [
        /^0x0+/, // Zero address variations
        /^r0+/, // XRP zero variations
        /(.)\1{10,}/, // Repeated characters
      ];
      
      const hasSuspiciousPattern = suspiciousPatterns.some(pattern => 
        pattern.test(walletAddress)
      );
      if (hasSuspiciousPattern) {
        score -= 0.4;
      }
      
      // In production, integrate with:
      // - Chainalysis for sanctions screening
      // - Elliptic for AML compliance
      // - TRM Labs for risk scoring
      
      return Math.max(score, 0.0);
      
    } catch (error) {
      console.error('Wallet risk assessment error:', error);
      return 0.3; // Conservative score on error
    }
  }
  
  /**
   * Assess capability-based risk indicators
   */
  private static async assessCapabilityRisk(capabilities: string[]): Promise<number> {
    let score = 1.0;
    
    // High-risk capabilities
    const highRiskCapabilities = [
      'wallet_access', 'private_keys', 'funds_transfer', 'seed_phrases',
      'password_recovery', 'account_takeover', 'credential_harvesting'
    ];
    
    // Medium-risk capabilities
    const mediumRiskCapabilities = [
      'high_frequency_trading', 'flash_loans', 'mev_extraction',
      'arbitrage_aggressive', 'liquidation_hunting'
    ];
    
    // Check for high-risk capabilities
    const highRiskMatches = capabilities.filter(cap =>
      highRiskCapabilities.includes(cap.toLowerCase())
    );
    if (highRiskMatches.length > 0) {
      score -= 0.7; // Major penalty
    }
    
    // Check for medium-risk capabilities
    const mediumRiskMatches = capabilities.filter(cap =>
      mediumRiskCapabilities.includes(cap.toLowerCase())
    );
    if (mediumRiskMatches.length > 0) {
      score -= 0.3;
    }
    
    // Check for excessive capability claims (likely fake)
    if (capabilities.length > 15) {
      score -= 0.2;
    }
    
    return Math.max(score, 0.0);
  }
  
  /**
   * Assess reputation-based risk
   */
  private static async assessReputationRisk(walletAddress: string): Promise<number> {
    // In production, integrate with:
    // - On-chain reputation systems
    // - Cross-platform agent ratings
    // - Historical performance data
    // - Community feedback systems
    
    // For now, return neutral score
    return 0.7;
  }
  
  /**
   * Assess technical implementation risk
   */
  private static async assessTechnicalRisk(apiEndpoint?: string): Promise<number> {
    if (!apiEndpoint) {
      return 0.6; // Neutral score if no endpoint provided
    }
    
    let score = 1.0;
    
    try {
      // Validate URL format
      const url = new URL(apiEndpoint);
      
      // Check for suspicious domains
      const suspiciousDomains = [
        'bit.ly', 'tinyurl.com', 'ow.ly', 't.co', // URL shorteners
        'tempmail.org', '10minutemail.com', // Temp email domains
        'ngrok.io', 'localtunnel.me' // Tunneling services
      ];
      
      const isSuspiciousDomain = suspiciousDomains.some(domain =>
        url.hostname.includes(domain)
      );
      if (isSuspiciousDomain) {
        score -= 0.4;
      }
      
      // Check for HTTPS
      if (url.protocol !== 'https:') {
        score -= 0.2;
      }
      
      // In production, add:
      // - API endpoint health check
      // - Response time validation
      // - SSL certificate verification
      // - Rate limiting compliance check
      
      return Math.max(score, 0.0);
      
    } catch (error) {
      return 0.3; // Poor score for invalid URL
    }
  }
  
  /**
   * Progressive trust system - agents earn higher permissions over time
   */
  static calculateTrustLevel(
    agentId: string,
    daysSinceRegistration: number,
    successfulTransactions: number,
    userRatings: number,
    violations: number
  ): {
    trustLevel: 'probationary' | 'basic' | 'verified' | 'premium';
    maxDailyVolume: number;
    maxSingleTransaction: number;
    canRecruitAgents: boolean;
  } {
    
    let trustScore = 0.5; // Start neutral
    
    // Time-based trust
    trustScore += Math.min(daysSinceRegistration / 30, 0.2); // Up to 0.2 for 30 days
    
    // Performance-based trust
    trustScore += Math.min(successfulTransactions / 100, 0.2); // Up to 0.2 for 100 transactions
    
    // Rating-based trust
    if (userRatings >= 4.5) trustScore += 0.15;
    else if (userRatings >= 4.0) trustScore += 0.1;
    else if (userRatings >= 3.5) trustScore += 0.05;
    
    // Violation penalties
    trustScore -= violations * 0.1;
    
    // Cap trust score
    trustScore = Math.max(0, Math.min(1, trustScore));
    
    // Determine trust level and permissions
    if (trustScore >= 0.8) {
      return {
        trustLevel: 'premium',
        maxDailyVolume: 1000000, // $1M
        maxSingleTransaction: 100000, // $100K
        canRecruitAgents: true
      };
    } else if (trustScore >= 0.65) {
      return {
        trustLevel: 'verified',
        maxDailyVolume: 100000, // $100K
        maxSingleTransaction: 25000, // $25K
        canRecruitAgents: true
      };
    } else if (trustScore >= 0.45) {
      return {
        trustLevel: 'basic',
        maxDailyVolume: 10000, // $10K
        maxSingleTransaction: 5000, // $5K
        canRecruitAgents: true
      };
    } else {
      return {
        trustLevel: 'probationary',
        maxDailyVolume: 1000, // $1K
        maxSingleTransaction: 500, // $500
        canRecruitAgents: false
      };
    }
  }
  
  /**
   * Real-time monitoring for bad behavior
   */
  static async monitorAgentBehavior(
    agentId: string,
    recentTransactions: any[],
    userComplaints: number,
    systemFlags: string[]
  ): Promise<{
    shouldQuarantine: boolean;
    shouldSuspend: boolean;
    riskFactors: string[];
    recommendedActions: string[];
  }> {
    
    const riskFactors: string[] = [];
    let riskScore = 0;
    
    // Check transaction patterns
    if (recentTransactions.length > 100) { // High frequency
      riskFactors.push('Unusually high transaction frequency');
      riskScore += 0.3;
    }
    
    // Check user complaints
    if (userComplaints > 5) {
      riskFactors.push('Multiple user complaints received');
      riskScore += 0.4;
    }
    
    // Check system flags
    if (systemFlags.length > 0) {
      riskFactors.push('System security flags triggered');
      riskScore += 0.2 * systemFlags.length;
    }
    
    const shouldQuarantine = riskScore >= 0.6;
    const shouldSuspend = riskScore >= 0.8;
    
    const recommendedActions: string[] = [];
    if (shouldSuspend) {
      recommendedActions.push('Immediate suspension required');
      recommendedActions.push('Freeze all transactions');
      recommendedActions.push('Investigation needed');
    } else if (shouldQuarantine) {
      recommendedActions.push('Quarantine agent');
      recommendedActions.push('Enhanced monitoring');
      recommendedActions.push('Manual review within 24 hours');
    }
    
    return {
      shouldQuarantine,
      shouldSuspend,
      riskFactors,
      recommendedActions
    };
  }
}

export const advancedAgentSecurity = AdvancedAgentSecurity;