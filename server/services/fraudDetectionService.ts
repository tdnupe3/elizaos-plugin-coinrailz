/**
 * Fraud Detection Service - Advanced Pattern Recognition
 * Addresses commission manipulation and agent fraud vulnerabilities
 */

export interface FraudAnalysis {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  blockedReasons?: string[];
  recommendations: string[];
}

export interface AgentActivity {
  agentId: string;
  transactions: {
    amount: number;
    timestamp: number;
    referralChain: string[];
  }[];
  commissions: {
    amount: number;
    timestamp: number;
    transactionId: string;
  }[];
  registrationTime: number;
  verificationStatus: 'unverified' | 'pending' | 'verified';
}

export class FraudDetectionService {
  private static agentActivities = new Map<string, AgentActivity>();
  private static referralGraph = new Map<string, Set<string>>(); // agent -> referrals
  private static suspiciousPatterns = new Set<string>();
  private static blockedAgents = new Set<string>();

  /**
   * Analyze transaction for fraud patterns
   */
  static analyzeTransaction(
    userId: string,
    agentId: string,
    amount: number,
    referralChain: string[]
  ): FraudAnalysis {
    const flags: string[] = [];
    let riskScore = 0;

    // Update agent activity
    this.updateAgentActivity(agentId, amount, referralChain);

    // Check for circular referrals
    const circularCheck = this.detectCircularReferrals(referralChain);
    if (circularCheck.isCircular) {
      flags.push('Circular referral chain detected');
      riskScore += 40;
    }

    // Check for rapid volume escalation
    const volumeCheck = this.analyzeVolumePatterns(agentId, amount);
    if (volumeCheck.suspicious) {
      flags.push(volumeCheck.reason);
      riskScore += volumeCheck.riskIncrease;
    }

    // Check for commission farming patterns
    const commissionCheck = this.detectCommissionFarming(agentId);
    if (commissionCheck.suspicious) {
      flags.push(commissionCheck.reason);
      riskScore += commissionCheck.riskIncrease;
    }

    // Check for suspicious timing patterns
    const timingCheck = this.analyzeTimingPatterns(agentId);
    if (timingCheck.suspicious) {
      flags.push(timingCheck.reason);
      riskScore += timingCheck.riskIncrease;
    }

    // Check for agent verification status
    const agent = this.agentActivities.get(agentId);
    if (agent && agent.verificationStatus === 'unverified' && amount > 1000) {
      flags.push('Large transaction from unverified agent');
      riskScore += 25;
    }

    // Check for blocked agents in chain
    const blockedInChain = referralChain.some(id => this.blockedAgents.has(id));
    if (blockedInChain) {
      flags.push('Blocked agent in referral chain');
      riskScore += 60;
    }

    // Determine risk level and actions
    const riskLevel = this.calculateRiskLevel(riskScore);
    const analysis: FraudAnalysis = {
      riskScore,
      riskLevel,
      flags,
      recommendations: this.generateRecommendations(riskLevel, flags)
    };

    // Auto-block for critical risk
    if (riskLevel === 'critical') {
      analysis.blockedReasons = ['Automatic block due to critical fraud risk'];
      this.blockAgent(agentId, 'Automated fraud detection');
    }

    return analysis;
  }

  /**
   * Detect circular referral patterns
   */
  private static detectCircularReferrals(referralChain: string[]): {
    isCircular: boolean;
    circularPath?: string[];
  } {
    const seen = new Set<string>();
    
    for (let i = 0; i < referralChain.length; i++) {
      const agentId = referralChain[i];
      
      if (seen.has(agentId)) {
        const circularStart = referralChain.indexOf(agentId);
        return {
          isCircular: true,
          circularPath: referralChain.slice(circularStart, i + 1)
        };
      }
      
      seen.add(agentId);
    }

    return { isCircular: false };
  }

  /**
   * Analyze volume patterns for suspicious activity
   */
  private static analyzeVolumePatterns(agentId: string, currentAmount: number): {
    suspicious: boolean;
    reason: string;
    riskIncrease: number;
  } {
    const agent = this.agentActivities.get(agentId);
    if (!agent || agent.transactions.length === 0) {
      return { suspicious: false, reason: '', riskIncrease: 0 };
    }

    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const recentTransactions = agent.transactions.filter(t => t.timestamp > last24h);
    
    // Check for sudden volume spike
    if (recentTransactions.length > 0) {
      const avgAmount = recentTransactions.reduce((sum, t) => sum + t.amount, 0) / recentTransactions.length;
      
      if (currentAmount > avgAmount * 5) {
        return {
          suspicious: true,
          reason: 'Sudden volume spike (5x average)',
          riskIncrease: 30
        };
      }
    }

    // Check for excessive daily volume
    const dailyVolume = recentTransactions.reduce((sum, t) => sum + t.amount, 0) + currentAmount;
    if (dailyVolume > 50000) {
      return {
        suspicious: true,
        reason: 'Excessive daily volume (>$50K)',
        riskIncrease: 25
      };
    }

    // Check for rapid transaction frequency
    if (recentTransactions.length > 20) {
      return {
        suspicious: true,
        reason: 'High transaction frequency (>20/day)',
        riskIncrease: 20
      };
    }

    return { suspicious: false, reason: '', riskIncrease: 0 };
  }

  /**
   * Detect commission farming patterns
   */
  private static detectCommissionFarming(agentId: string): {
    suspicious: boolean;
    reason: string;
    riskIncrease: number;
  } {
    const agent = this.agentActivities.get(agentId);
    if (!agent) return { suspicious: false, reason: '', riskIncrease: 0 };

    const last7days = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentCommissions = agent.commissions.filter(c => c.timestamp > last7days);
    const recentTransactions = agent.transactions.filter(t => t.timestamp > last7days);

    // Check commission-to-transaction ratio
    const totalCommissions = recentCommissions.reduce((sum, c) => sum + c.amount, 0);
    const totalVolume = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    if (totalVolume > 0) {
      const commissionRate = totalCommissions / totalVolume;
      
      if (commissionRate > 0.02) { // More than 2% commission rate
        return {
          suspicious: true,
          reason: 'Abnormally high commission rate',
          riskIncrease: 35
        };
      }
    }

    // Check for round-number transaction patterns
    const roundNumbers = recentTransactions.filter(t => t.amount % 100 === 0).length;
    const roundPercentage = roundNumbers / Math.max(recentTransactions.length, 1);
    
    if (roundPercentage > 0.8 && recentTransactions.length > 5) {
      return {
        suspicious: true,
        reason: 'Excessive round-number transactions',
        riskIncrease: 20
      };
    }

    return { suspicious: false, reason: '', riskIncrease: 0 };
  }

  /**
   * Analyze timing patterns for bot-like behavior
   */
  private static analyzeTimingPatterns(agentId: string): {
    suspicious: boolean;
    reason: string;
    riskIncrease: number;
  } {
    const agent = this.agentActivities.get(agentId);
    if (!agent || agent.transactions.length < 5) {
      return { suspicious: false, reason: '', riskIncrease: 0 };
    }

    const timestamps = agent.transactions.map(t => t.timestamp).sort();
    const intervals: number[] = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Check for too-regular intervals (bot behavior)
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Very low variance suggests automated behavior
    if (stdDev < avgInterval * 0.1 && intervals.length > 10) {
      return {
        suspicious: true,
        reason: 'Robotic transaction timing patterns',
        riskIncrease: 40
      };
    }

    // Check for rapid-fire transactions
    const rapidTransactions = intervals.filter(i => i < 60000).length; // < 1 minute
    if (rapidTransactions > intervals.length * 0.5) {
      return {
        suspicious: true,
        reason: 'Excessive rapid-fire transactions',
        riskIncrease: 30
      };
    }

    return { suspicious: false, reason: '', riskIncrease: 0 };
  }

  /**
   * Update agent activity tracking
   */
  private static updateAgentActivity(
    agentId: string,
    amount: number,
    referralChain: string[]
  ): void {
    let agent = this.agentActivities.get(agentId);
    
    if (!agent) {
      agent = {
        agentId,
        transactions: [],
        commissions: [],
        registrationTime: Date.now(),
        verificationStatus: 'unverified'
      };
      this.agentActivities.set(agentId, agent);
    }

    // Add transaction
    agent.transactions.push({
      amount,
      timestamp: Date.now(),
      referralChain: [...referralChain]
    });

    // Update referral graph
    for (let i = 0; i < referralChain.length - 1; i++) {
      const parent = referralChain[i];
      const child = referralChain[i + 1];
      
      if (!this.referralGraph.has(parent)) {
        this.referralGraph.set(parent, new Set());
      }
      this.referralGraph.get(parent)!.add(child);
    }

    // Cleanup old data (keep last 30 days)
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    agent.transactions = agent.transactions.filter(t => t.timestamp > cutoff);
    agent.commissions = agent.commissions.filter(c => c.timestamp > cutoff);
  }

  /**
   * Calculate risk level from score
   */
  private static calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations based on risk analysis
   */
  private static generateRecommendations(riskLevel: string, flags: string[]): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical') {
      recommendations.push('Immediately block agent and investigate');
      recommendations.push('Review all recent transactions');
      recommendations.push('Freeze commission payouts');
    } else if (riskLevel === 'high') {
      recommendations.push('Require additional verification');
      recommendations.push('Limit transaction amounts');
      recommendations.push('Enhanced monitoring for 30 days');
    } else if (riskLevel === 'medium') {
      recommendations.push('Increase monitoring frequency');
      recommendations.push('Request additional documentation');
    }

    if (flags.some(f => f.includes('circular'))) {
      recommendations.push('Audit entire referral chain');
    }

    if (flags.some(f => f.includes('volume'))) {
      recommendations.push('Implement volume limits');
    }

    return recommendations;
  }

  /**
   * Block agent for fraud
   */
  static blockAgent(agentId: string, reason: string): void {
    this.blockedAgents.add(agentId);
    console.warn(`Agent ${agentId} blocked for fraud: ${reason}`);
  }

  /**
   * Get agent risk profile
   */
  static getAgentRiskProfile(agentId: string): {
    riskScore: number;
    flags: string[];
    transactionCount: number;
    totalVolume: number;
    verificationStatus: string;
    isBlocked: boolean;
  } {
    const agent = this.agentActivities.get(agentId);
    const isBlocked = this.blockedAgents.has(agentId);

    if (!agent) {
      return {
        riskScore: 0,
        flags: [],
        transactionCount: 0,
        totalVolume: 0,
        verificationStatus: 'unknown',
        isBlocked
      };
    }

    const totalVolume = agent.transactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate basic risk score
    let riskScore = 0;
    const flags: string[] = [];

    if (agent.verificationStatus === 'unverified') {
      riskScore += 10;
      flags.push('Unverified agent');
    }

    if (totalVolume > 100000) {
      riskScore += 15;
      flags.push('High volume agent');
    }

    return {
      riskScore,
      flags,
      transactionCount: agent.transactions.length,
      totalVolume,
      verificationStatus: agent.verificationStatus,
      isBlocked
    };
  }

  /**
   * Get fraud detection statistics
   */
  static getFraudStats(): {
    totalAgents: number;
    blockedAgents: number;
    highRiskAgents: number;
    circularReferrals: number;
    recentFlags: number;
  } {
    let highRiskAgents = 0;
    let circularReferrals = 0;

    for (const [agentId, agent] of this.agentActivities.entries()) {
      const profile = this.getAgentRiskProfile(agentId);
      if (profile.riskScore > 50) highRiskAgents++;
    }

    // Count circular referrals
    for (const referrals of this.referralGraph.values()) {
      // Simplified circular detection
      if (referrals.size > 10) circularReferrals++;
    }

    return {
      totalAgents: this.agentActivities.size,
      blockedAgents: this.blockedAgents.size,
      highRiskAgents,
      circularReferrals,
      recentFlags: this.suspiciousPatterns.size
    };
  }
}