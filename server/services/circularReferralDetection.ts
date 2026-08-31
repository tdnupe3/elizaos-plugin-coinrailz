/**
 * Circular Referral Detection System - Critical Production Fix
 * Prevents $150K+ commission manipulation through circular referral networks
 */

export interface ReferralNode {
  agentId: string;
  referredBy?: string;
  referrals: string[];
  commissionsTier: number;
  totalCommissionsEarned: number;
  registrationDate: number;
  lastActivity: number;
}

export interface ReferralPath {
  path: string[];
  isCircular: boolean;
  circularStartIndex?: number;
  maxDepth: number;
  totalCommissions: number;
}

export interface CircularDetectionResult {
  hasCircularReferrals: boolean;
  circularPaths: ReferralPath[];
  affectedAgents: string[];
  estimatedOverpayment: number;
  riskScore: number;
  recommendedActions: string[];
}

export class CircularReferralDetection {
  private static referralGraph = new Map<string, ReferralNode>();
  private static circularPaths = new Map<string, ReferralPath>();
  private static readonly MAX_REFERRAL_DEPTH = 10;
  private static readonly COMMISSION_RATE_PER_TIER = 0.01; // 1% per tier

  /**
   * Add agent to referral network
   */
  static addAgent(agentId: string, referredBy?: string): void {
    const node: ReferralNode = {
      agentId,
      referredBy,
      referrals: [],
      commissionsTier: referredBy ? this.calculateTier(referredBy) + 1 : 1,
      totalCommissionsEarned: 0,
      registrationDate: Date.now(),
      lastActivity: Date.now()
    };

    this.referralGraph.set(agentId, node);

    // Add to referrer's list if exists
    if (referredBy) {
      const referrer = this.referralGraph.get(referredBy);
      if (referrer) {
        referrer.referrals.push(agentId);
      }
    }

    // Check for new circular paths
    this.detectCircularPaths(agentId);
  }

  /**
   * Calculate agent tier in referral hierarchy
   */
  private static calculateTier(agentId: string): number {
    const visited = new Set<string>();
    let currentAgent = agentId;
    let tier = 0;

    while (currentAgent && !visited.has(currentAgent) && tier < this.MAX_REFERRAL_DEPTH) {
      visited.add(currentAgent);
      const node = this.referralGraph.get(currentAgent);
      if (!node || !node.referredBy) break;
      
      currentAgent = node.referredBy;
      tier++;
    }

    return tier;
  }

  /**
   * Detect circular referral paths starting from a specific agent
   */
  private static detectCircularPaths(startAgentId: string): ReferralPath[] {
    const detectedPaths: ReferralPath[] = [];
    const visited = new Set<string>();
    const currentPath: string[] = [];

    this.depthFirstSearch(startAgentId, visited, currentPath, detectedPaths);
    return detectedPaths;
  }

  /**
   * Depth-first search to find circular paths
   */
  private static depthFirstSearch(
    currentAgent: string,
    visited: Set<string>,
    currentPath: string[],
    detectedPaths: ReferralPath[]
  ): void {
    if (currentPath.length > this.MAX_REFERRAL_DEPTH) {
      return; // Prevent infinite recursion
    }

    const pathIndex = currentPath.indexOf(currentAgent);
    if (pathIndex !== -1) {
      // Found circular path
      const circularPath = currentPath.slice(pathIndex);
      circularPath.push(currentAgent); // Complete the circle
      
      const totalCommissions = this.calculatePathCommissions(circularPath);
      
      const path: ReferralPath = {
        path: [...circularPath],
        isCircular: true,
        circularStartIndex: pathIndex,
        maxDepth: circularPath.length - 1,
        totalCommissions
      };

      detectedPaths.push(path);
      
      // Cache the circular path
      const pathKey = circularPath.sort().join('->');
      this.circularPaths.set(pathKey, path);
      
      return;
    }

    if (visited.has(currentAgent)) {
      return; // Already explored this branch
    }

    visited.add(currentAgent);
    currentPath.push(currentAgent);

    const node = this.referralGraph.get(currentAgent);
    if (node) {
      // Follow referral chain (who referred this agent)
      if (node.referredBy) {
        this.depthFirstSearch(node.referredBy, new Set(visited), [...currentPath], detectedPaths);
      }

      // Follow referred agents (who this agent referred)
      for (const referral of node.referrals) {
        this.depthFirstSearch(referral, new Set(visited), [...currentPath], detectedPaths);
      }
    }

    currentPath.pop();
    visited.delete(currentAgent);
  }

  /**
   * Calculate total commissions for a referral path
   */
  private static calculatePathCommissions(path: string[]): number {
    let totalCommissions = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const agentId = path[i];
      const node = this.referralGraph.get(agentId);
      if (node) {
        // Calculate commission for this tier
        const tierCommission = this.COMMISSION_RATE_PER_TIER * (i + 1);
        totalCommissions += tierCommission;
      }
    }

    return totalCommissions;
  }

  /**
   * Comprehensive circular referral analysis
   */
  static analyzeReferralNetwork(): CircularDetectionResult {
    const allCircularPaths: ReferralPath[] = [];
    const affectedAgents = new Set<string>();
    let totalOverpayment = 0;

    // Analyze each agent for circular patterns
    for (const agentId of this.referralGraph.keys()) {
      const paths = this.detectCircularPaths(agentId);
      allCircularPaths.push(...paths);
      
      // Add affected agents
      paths.forEach(path => {
        path.path.forEach(agent => affectedAgents.add(agent));
        totalOverpayment += this.calculateCircularOverpayment(path);
      });
    }

    // Remove duplicate paths
    const uniquePaths = this.deduplicateCircularPaths(allCircularPaths);
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(uniquePaths, affectedAgents.size);
    
    // Generate recommendations
    const recommendedActions = this.generateRecommendations(uniquePaths, riskScore);

    return {
      hasCircularReferrals: uniquePaths.length > 0,
      circularPaths: uniquePaths,
      affectedAgents: Array.from(affectedAgents),
      estimatedOverpayment: totalOverpayment,
      riskScore,
      recommendedActions
    };
  }

  /**
   * Calculate commission overpayment from circular referrals
   */
  private static calculateCircularOverpayment(path: ReferralPath): number {
    if (!path.isCircular) return 0;

    // In a circular referral, each transaction generates commissions for all agents in the circle
    // Normal referral would only pay commission up the chain once
    const circularAgents = path.path.length - 1; // Exclude duplicate end agent
    const normalCommissionAgents = Math.min(circularAgents, 5); // Typical max referral depth
    
    const excessAgents = Math.max(0, circularAgents - normalCommissionAgents);
    const avgCommissionPerAgent = 50; // Average commission per transaction
    const avgTransactionsPerAgent = 10; // Estimated transactions per agent per month
    
    return excessAgents * avgCommissionPerAgent * avgTransactionsPerAgent;
  }

  /**
   * Remove duplicate circular paths
   */
  private static deduplicateCircularPaths(paths: ReferralPath[]): ReferralPath[] {
    const uniquePathsMap = new Map<string, ReferralPath>();
    
    for (const path of paths) {
      if (path.isCircular) {
        // Create normalized key for the circular path
        const sortedPath = [...path.path].sort();
        const key = sortedPath.join('->');
        
        if (!uniquePathsMap.has(key) || uniquePathsMap.get(key)!.totalCommissions < path.totalCommissions) {
          uniquePathsMap.set(key, path);
        }
      }
    }
    
    return Array.from(uniquePathsMap.values());
  }

  /**
   * Calculate overall risk score for circular referrals
   */
  private static calculateRiskScore(paths: ReferralPath[], affectedAgents: number): number {
    let riskScore = 0;
    
    // Base risk from number of circular paths
    riskScore += Math.min(paths.length * 15, 60);
    
    // Risk from number of affected agents
    riskScore += Math.min(affectedAgents * 2, 20);
    
    // Risk from path complexity
    const avgPathLength = paths.reduce((sum, path) => sum + path.path.length, 0) / Math.max(paths.length, 1);
    riskScore += Math.min((avgPathLength - 3) * 5, 15);
    
    // Risk from commission amounts
    const totalCommissions = paths.reduce((sum, path) => sum + path.totalCommissions, 0);
    riskScore += Math.min(totalCommissions / 1000, 5);
    
    return Math.min(100, Math.max(0, riskScore));
  }

  /**
   * Generate recommendations based on analysis
   */
  private static generateRecommendations(paths: ReferralPath[], riskScore: number): string[] {
    const recommendations: string[] = [];
    
    if (riskScore > 80) {
      recommendations.push('IMMEDIATE ACTION: Suspend commission payments to circular referral networks');
      recommendations.push('Conduct manual review of all affected agent accounts');
      recommendations.push('Implement strict referral verification before commission payments');
    } else if (riskScore > 50) {
      recommendations.push('Enhanced monitoring of circular referral patterns');
      recommendations.push('Implement commission caps per referral chain');
      recommendations.push('Require manual approval for high-tier referral commissions');
    } else if (riskScore > 20) {
      recommendations.push('Monitor referral network growth patterns');
      recommendations.push('Implement automated alerts for new circular formations');
    }
    
    if (paths.length > 0) {
      recommendations.push('Break circular referral chains by limiting referral depth to 5 levels');
      recommendations.push('Implement cooling-off period for new agent referrals');
      recommendations.push('Regular audit of referral network integrity');
    }
    
    return recommendations;
  }

  /**
   * Break circular referral chain
   */
  static breakCircularChain(agentId: string): {
    success: boolean;
    chainsBroken: number;
    affectedAgents: string[];
    error?: string;
  } {
    try {
      const node = this.referralGraph.get(agentId);
      if (!node) {
        return {
          success: false,
          chainsBroken: 0,
          affectedAgents: [],
          error: 'Agent not found in referral network'
        };
      }

      const affectedAgents: string[] = [];
      let chainsBroken = 0;

      // Find all circular paths involving this agent
      const circularPaths = this.detectCircularPaths(agentId).filter(path => path.isCircular);
      
      for (const path of circularPaths) {
        // Break the chain by removing referral relationship
        if (node.referredBy) {
          const referrer = this.referralGraph.get(node.referredBy);
          if (referrer) {
            const index = referrer.referrals.indexOf(agentId);
            if (index > -1) {
              referrer.referrals.splice(index, 1);
              affectedAgents.push(referrer.agentId);
            }
          }
          
          node.referredBy = undefined;
          chainsBroken++;
        }
      }

      // Recalculate tiers for affected agents
      for (const affectedAgent of affectedAgents) {
        this.recalculateAgentTier(affectedAgent);
      }

      console.log(`Broke ${chainsBroken} circular referral chains for agent ${agentId}`);
      
      return {
        success: true,
        chainsBroken,
        affectedAgents
      };

    } catch (error) {
      return {
        success: false,
        chainsBroken: 0,
        affectedAgents: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Recalculate agent tier after referral changes
   */
  private static recalculateAgentTier(agentId: string): void {
    const node = this.referralGraph.get(agentId);
    if (node) {
      node.commissionsTier = this.calculateTier(agentId);
    }
  }

  /**
   * Get referral network visualization data
   */
  static getReferralNetworkData(): {
    nodes: Array<{ id: string; tier: number; commissions: number; registrationDate: number }>;
    edges: Array<{ from: string; to: string; type: 'referral' | 'circular' }>;
    circularPaths: ReferralPath[];
  } {
    const nodes = Array.from(this.referralGraph.values()).map(node => ({
      id: node.agentId,
      tier: node.commissionsTier,
      commissions: node.totalCommissionsEarned,
      registrationDate: node.registrationDate
    }));

    const edges: Array<{ from: string; to: string; type: 'referral' | 'circular' }> = [];
    const circularAgents = new Set<string>();

    // Mark circular agents
    for (const path of this.circularPaths.values()) {
      path.path.forEach(agent => circularAgents.add(agent));
    }

    // Create edges
    for (const node of this.referralGraph.values()) {
      if (node.referredBy) {
        edges.push({
          from: node.referredBy,
          to: node.agentId,
          type: circularAgents.has(node.agentId) ? 'circular' : 'referral'
        });
      }
    }

    return {
      nodes,
      edges,
      circularPaths: Array.from(this.circularPaths.values())
    };
  }

  /**
   * Get statistics about referral network
   */
  static getReferralNetworkStatistics(): {
    totalAgents: number;
    circularPaths: number;
    affectedAgents: number;
    averageReferralDepth: number;
    totalCommissionOverpayment: number;
    riskScore: number;
  } {
    const analysis = this.analyzeReferralNetwork();
    
    const depths = Array.from(this.referralGraph.values()).map(node => node.commissionsTier);
    const averageDepth = depths.reduce((sum, depth) => sum + depth, 0) / Math.max(depths.length, 1);

    return {
      totalAgents: this.referralGraph.size,
      circularPaths: analysis.circularPaths.length,
      affectedAgents: analysis.affectedAgents.length,
      averageReferralDepth: Math.round(averageDepth * 100) / 100,
      totalCommissionOverpayment: analysis.estimatedOverpayment,
      riskScore: analysis.riskScore
    };
  }

  /**
   * Emergency cleanup of all circular referrals
   */
  static emergencyCleanupCircularReferrals(): {
    chainsBroken: number;
    agentsAffected: number;
    commissionsReverted: number;
  } {
    let chainsBroken = 0;
    let commissionsReverted = 0;
    const affectedAgents = new Set<string>();

    // Break all circular chains
    for (const path of this.circularPaths.values()) {
      for (const agentId of path.path) {
        const result = this.breakCircularChain(agentId);
        if (result.success) {
          chainsBroken += result.chainsBroken;
          result.affectedAgents.forEach(agent => affectedAgents.add(agent));
          commissionsReverted += path.totalCommissions;
        }
      }
    }

    this.circularPaths.clear();

    console.warn(`Emergency cleanup: ${chainsBroken} chains broken, ${affectedAgents.size} agents affected`);
    
    return {
      chainsBroken,
      agentsAffected: affectedAgents.size,
      commissionsReverted
    };
  }
}