/**
 * INTELLIGENT LEAD SCORING SERVICE
 * Automatically scores leads, categorizes objections, and triggers human follow-up for high-value prospects
 * 
 * Integrates with existing outreach infrastructure to convert "log contacts" to "qualify and nurture leads"
 */

import { db } from '../db';
import { 
  enterpriseOutreachTargets, 
  enterpriseOutreachObjections,
  type EnterpriseOutreachTarget,
  type InsertEnterpriseOutreachObjection 
} from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { outreachAnalytics } from './outreachAnalytics';

interface ScoringFactors {
  // Company Profile Factors (40% weight)
  companySize: number;        // 0-20 points
  industry: number;          // 0-10 points  
  revenue: number;           // 0-10 points
  
  // Engagement Factors (35% weight)
  responseSpeed: number;     // 0-15 points
  messageQuality: number;    // 0-10 points
  reportViewed: number;      // 0-10 points
  
  // Behavioral Factors (25% weight)  
  followUpEngagement: number; // 0-10 points
  referralPotential: number;  // 0-10 points
  paymentHistory: number;     // 0-5 points
}

interface ObjectionClassification {
  category: 'pricing' | 'timing' | 'features' | 'not_interested' | 'competitor' | 'budget' | 'authority' | 'unclear';
  sentiment: 'positive' | 'neutral' | 'negative';
  severity: number; // 1-10
  keywords: string[];
}

export class LeadScoringService {
  
  // Weighted scoring configuration
  private readonly COMPANY_WEIGHT = 0.40;
  private readonly ENGAGEMENT_WEIGHT = 0.35; 
  private readonly BEHAVIORAL_WEIGHT = 0.25;
  
  // Thresholds for lead tiers
  private readonly QUALIFIED_THRESHOLD = 75;
  private readonly HOT_THRESHOLD = 60;
  private readonly WARM_THRESHOLD = 40;

  // Objection classification keywords
  private readonly objectionKeywords = {
    pricing: ['expensive', 'cost', 'price', 'budget', 'afford', 'cheap', 'roi', 'investment'],
    timing: ['later', 'not now', 'busy', 'timing', 'next quarter', 'future', 'when'],
    features: ['missing', 'need', 'functionality', 'feature', 'capability', 'integration'],
    not_interested: ['not interested', 'no thanks', 'not for us', 'pass', 'decline'],
    competitor: ['already using', 'current solution', 'competitor', 'alternative', 'existing'],
    budget: ['no budget', 'budget constraints', 'financial', 'approved budget'],
    authority: ['decision maker', 'need approval', 'boss', 'team decision', 'committee'],
  };

  /**
   * Calculate comprehensive lead score for a target
   */
  async calculateLeadScore(targetId: string): Promise<{
    score: number;
    tier: 'cold' | 'warm' | 'hot' | 'qualified';
    factors: ScoringFactors;
    recommendations: string[];
  }> {
    try {
      console.log(`🧮 Calculating lead score for target: ${targetId}`);

      // Fetch target data
      const target = await this.getTargetWithAnalytics(targetId);
      if (!target) {
        throw new Error(`Target not found: ${targetId}`);
      }

      // Calculate individual scoring factors
      const factors: ScoringFactors = {
        companySize: this.scoreCompanySize(target.employeeCount),
        industry: this.scoreIndustry(target.industry),
        revenue: this.scoreRevenue(target.revenue),
        responseSpeed: await this.scoreResponseSpeed(targetId),
        messageQuality: await this.scoreMessageQuality(targetId),
        reportViewed: await this.scoreReportEngagement(targetId),
        followUpEngagement: await this.scoreFollowUpEngagement(targetId),
        referralPotential: this.scoreReferralPotential(target),
        paymentHistory: await this.scorePaymentHistory(targetId)
      };

      // Calculate weighted total score
      const companyScore = (factors.companySize + factors.industry + factors.revenue);
      const engagementScore = (factors.responseSpeed + factors.messageQuality + factors.reportViewed);
      const behavioralScore = (factors.followUpEngagement + factors.referralPotential + factors.paymentHistory);

      const totalScore = Math.round(
        (companyScore * this.COMPANY_WEIGHT) +
        (engagementScore * this.ENGAGEMENT_WEIGHT) +
        (behavioralScore * this.BEHAVIORAL_WEIGHT)
      );

      // Determine lead tier
      const tier = this.determineLeadTier(totalScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(factors, tier, target);

      console.log(`✅ Lead score calculated: ${totalScore}/100 (${tier}) for ${target.companyName}`);

      return {
        score: Math.min(100, Math.max(0, totalScore)),
        tier,
        factors,
        recommendations
      };

    } catch (error) {
      console.error(`❌ Lead scoring failed for ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Update target with new lead score and tier
   */
  async updateTargetScore(targetId: string): Promise<void> {
    try {
      const scoring = await this.calculateLeadScore(targetId);
      
      // Determine follow-up status
      const followUpStatus = scoring.score >= this.QUALIFIED_THRESHOLD ? 'requires_human' : 'automated';
      
      await db.update(enterpriseOutreachTargets)
        .set({
          leadScore: scoring.score,
          leadTier: scoring.tier,
          followUpStatus,
          engagementScore: this.calculateEngagementScore(scoring.factors),
          lastScoredAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(enterpriseOutreachTargets.id, targetId));

      // Log human follow-up trigger
      if (followUpStatus === 'requires_human') {
        console.log(`🚨 HIGH-VALUE LEAD DETECTED: ${targetId} (Score: ${scoring.score}) - Triggering human follow-up`);
        
        // Track this qualification event
        outreachAnalytics.trackEvent({
          campaignId: 'lead-qualification',
          walletAddress: targetId,
          eventType: 'response_received',
          channel: 'lead_scoring',
          metadata: {
            responseContent: `Qualified lead: ${scoring.score}/100 - ${scoring.recommendations.join('; ')}`
          }
        });
      }

    } catch (error) {
      console.error(`❌ Failed to update target score for ${targetId}:`, error);
      throw error;
    }
  }

  /**
   * Process and categorize objection from response content
   */
  async processObjection(
    targetId: string, 
    responseContent: string, 
    channel: string,
    campaignId?: string
  ): Promise<ObjectionClassification> {
    try {
      console.log(`🤔 Processing objection from ${targetId} via ${channel}`);

      const classification = this.classifyObjection(responseContent);
      
      // Store structured objection data
      const objectionData: InsertEnterpriseOutreachObjection = {
        targetId,
        campaignId: campaignId || 'general',
        objectionCategory: classification.category,
        objectionText: responseContent.substring(0, 1000), // Truncate for storage
        sentiment: classification.sentiment,
        severity: classification.severity,
        communicationChannel: channel,
        responseDelay: await this.calculateResponseDelay(targetId),
        isResolved: false
      };

      const [objection] = await db.insert(enterpriseOutreachObjections)
        .values(objectionData)
        .returning();

      // Update target with objection category
      await db.update(enterpriseOutreachTargets)
        .set({
          objectionCategory: classification.category,
          updatedAt: new Date()
        })
        .where(eq(enterpriseOutreachTargets.id, targetId));

      // Rescore the lead after objection processing
      await this.updateTargetScore(targetId);

      console.log(`📝 Objection classified as '${classification.category}' (severity: ${classification.severity}) for ${targetId}`);
      
      return classification;

    } catch (error) {
      console.error(`❌ Objection processing failed:`, error);
      throw error;
    }
  }

  /**
   * Get high-value leads requiring human follow-up
   */
  async getLeadsRequiringHumanFollowUp(): Promise<EnterpriseOutreachTarget[]> {
    try {
      const highValueLeads = await db.select()
        .from(enterpriseOutreachTargets)
        .where(
          and(
            eq(enterpriseOutreachTargets.followUpStatus, 'requires_human'),
            gte(enterpriseOutreachTargets.leadScore, this.QUALIFIED_THRESHOLD)
          )
        )
        .orderBy(enterpriseOutreachTargets.leadScore);

      console.log(`🎯 Found ${highValueLeads.length} high-value leads requiring human follow-up`);
      return highValueLeads;

    } catch (error) {
      console.error('❌ Failed to fetch high-value leads:', error);
      throw error;
    }
  }

  /**
   * Get objection analytics for optimization
   */
  async getObjectionAnalytics(): Promise<{
    totalObjections: number;
    categoryBreakdown: { [key: string]: number };
    severityDistribution: { [key: number]: number };
    commonKeywords: { word: string; frequency: number }[];
    resolutionRate: number;
  }> {
    try {
      const objections = await db.select()
        .from(enterpriseOutreachObjections)
        .where(gte(enterpriseOutreachObjections.createdAt, sql`NOW() - INTERVAL '30 days'`));

      const categoryBreakdown = objections.reduce((acc, obj) => {
        acc[obj.objectionCategory] = (acc[obj.objectionCategory] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

      const severityDistribution = objections.reduce((acc, obj) => {
        acc[obj.severity] = (acc[obj.severity] || 0) + 1;
        return acc;
      }, {} as { [key: number]: number });

      const resolvedCount = objections.filter(obj => obj.isResolved).length;
      const resolutionRate = objections.length > 0 ? (resolvedCount / objections.length) * 100 : 0;

      // Extract common keywords from objection text
      const allText = objections.map(obj => obj.objectionText.toLowerCase()).join(' ');
      const commonKeywords = this.extractCommonKeywords(allText);

      return {
        totalObjections: objections.length,
        categoryBreakdown,
        severityDistribution,
        commonKeywords,
        resolutionRate
      };

    } catch (error) {
      console.error('❌ Failed to generate objection analytics:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getTargetWithAnalytics(targetId: string): Promise<EnterpriseOutreachTarget | null> {
    const targets = await db.select()
      .from(enterpriseOutreachTargets)
      .where(eq(enterpriseOutreachTargets.id, targetId))
      .limit(1);
    
    return targets[0] || null;
  }

  private scoreCompanySize(employeeCount: string): number {
    // Score based on company size (0-20 points)
    const sizeMap: { [key: string]: number } = {
      '1-10': 5,
      '11-50': 8,
      '51-200': 12,
      '201-1000': 16,
      '1000+': 20,
      'startup': 10,
      'small': 8,
      'medium': 14,
      'large': 18,
      'enterprise': 20
    };
    
    return sizeMap[employeeCount.toLowerCase()] || 10; // Default medium score
  }

  private scoreIndustry(industry: string): number {
    // Score based on industry fit (0-10 points)
    const highValueIndustries = [
      'fintech', 'financial services', 'banking', 'payments', 'cryptocurrency',
      'artificial intelligence', 'ai', 'machine learning', 'blockchain',
      'enterprise software', 'saas', 'technology'
    ];
    
    const industryLower = industry.toLowerCase();
    const isHighValue = highValueIndustries.some(term => industryLower.includes(term));
    
    return isHighValue ? 10 : 5;
  }

  private scoreRevenue(revenue: string): number {
    // Score based on company revenue (0-10 points)
    const revenueLower = revenue.toLowerCase();
    
    if (revenueLower.includes('$100m+') || revenueLower.includes('billion')) return 10;
    if (revenueLower.includes('$50m') || revenueLower.includes('$75m')) return 8;
    if (revenueLower.includes('$10m') || revenueLower.includes('$25m')) return 6;
    if (revenueLower.includes('$1m') || revenueLower.includes('$5m')) return 4;
    
    return 3; // Default for smaller companies
  }

  private async scoreResponseSpeed(targetId: string): Promise<number> {
    // Score based on response speed (0-15 points)  
    const target = await this.getTargetWithAnalytics(targetId);
    if (!target?.responseTime) return 5; // Default neutral score
    
    if (target.responseTime <= 2) return 15; // Very fast response
    if (target.responseTime <= 24) return 12; // Same day response
    if (target.responseTime <= 72) return 8;  // Within 3 days
    if (target.responseTime <= 168) return 4; // Within a week
    
    return 1; // Slow response
  }

  private async scoreMessageQuality(targetId: string): Promise<number> {
    // Score based on message content quality (0-10 points)
    // This could be enhanced with ML sentiment analysis
    return 7; // Default good score - can be enhanced later
  }

  private async scoreReportEngagement(targetId: string): Promise<number> {
    // Score based on report/invoice viewing (0-10 points)
    return 5; // Default - can be enhanced with actual tracking data
  }

  private async scoreFollowUpEngagement(targetId: string): Promise<number> {
    // Score based on follow-up engagement (0-10 points)
    return 6; // Default - can be enhanced with engagement tracking
  }

  private scoreReferralPotential(target: EnterpriseOutreachTarget): number {
    // Score based on referral potential (0-10 points)
    const title = target.contactTitle.toLowerCase();
    const description = target.companyDescription.toLowerCase();
    const hasNetwork = Boolean(target.linkedinUrl) &&
      ['ceo', 'cto', 'founder'].some((role) => title.includes(role));
    const isInfluencer = ['influencer', 'thought leader'].some((term) => description.includes(term));
    
    if (hasNetwork && isInfluencer) return 10;
    if (hasNetwork || isInfluencer) return 7;
    return 4;
  }

  private async scorePaymentHistory(targetId: string): Promise<number> {
    // Score based on payment history (0-5 points)
    return 0; // Default - no payment history for new leads
  }

  private determineLeadTier(score: number): 'cold' | 'warm' | 'hot' | 'qualified' {
    if (score >= this.QUALIFIED_THRESHOLD) return 'qualified';
    if (score >= this.HOT_THRESHOLD) return 'hot';  
    if (score >= this.WARM_THRESHOLD) return 'warm';
    return 'cold';
  }

  private calculateEngagementScore(factors: ScoringFactors): number {
    return Math.round(factors.responseSpeed + factors.messageQuality + factors.reportViewed);
  }

  private classifyObjection(responseContent: string): ObjectionClassification {
    const contentLower = responseContent.toLowerCase();
    let bestMatch = 'unclear';
    let maxMatches = 0;
    const matchedKeywords: string[] = [];

    // Find the category with most keyword matches
    Object.entries(this.objectionKeywords).forEach(([category, keywords]) => {
      const matches = keywords.filter(keyword => contentLower.includes(keyword));
      if (matches.length > maxMatches) {
        maxMatches = matches.length;
        bestMatch = category;
        matchedKeywords.splice(0, matchedKeywords.length, ...matches);
      }
    });

    // Determine sentiment
    const sentiment = this.analyzeSentiment(contentLower);
    
    // Calculate severity based on negative words and tone
    const severity = this.calculateSeverity(contentLower, bestMatch);

    return {
      category: bestMatch as any,
      sentiment,
      severity,
      keywords: matchedKeywords
    };
  }

  private analyzeSentiment(content: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['interested', 'great', 'good', 'excellent', 'perfect', 'yes', 'definitely'];
    const negativeWords = ['not', 'no', 'never', 'won\'t', 'can\'t', 'don\'t', 'terrible', 'awful'];
    
    const positiveCount = positiveWords.filter(word => content.includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private calculateSeverity(content: string, category: string): number {
    // Base severity by category
    const baseSeverity: { [key: string]: number } = {
      'not_interested': 8,
      'competitor': 7,
      'pricing': 6,
      'budget': 6,
      'authority': 5,
      'timing': 4,
      'features': 3,
      'unclear': 5
    };
    
    let severity = baseSeverity[category] || 5;
    
    // Adjust based on strong negative language
    if (content.includes('never') || content.includes('absolutely not')) {
      severity += 2;
    }
    
    return Math.min(10, Math.max(1, severity));
  }

  private async calculateResponseDelay(targetId: string): Promise<number> {
    // Calculate hours between last contact and response
    const target = await this.getTargetWithAnalytics(targetId);
    if (!target?.lastContactDate) return 0;
    
    const now = new Date();
    const lastContact = new Date(target.lastContactDate);
    
    return Math.round((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60));
  }

  private generateRecommendations(factors: ScoringFactors, tier: string, target: EnterpriseOutreachTarget): string[] {
    const recommendations: string[] = [];
    
    if (tier === 'qualified' || tier === 'hot') {
      recommendations.push('Priority follow-up: Schedule discovery call within 24 hours');
      recommendations.push('Personalize next outreach with specific use case examples');
    }
    
    if (factors.responseSpeed >= 12) {
      recommendations.push('Highly engaged: Fast response indicates strong interest');
    }
    
    if (factors.companySize >= 16) {
      recommendations.push('Enterprise account: Involve senior sales team');
    }
    
    if (target.objectionCategory) {
      recommendations.push(`Address ${target.objectionCategory} concerns in next interaction`);
    }
    
    return recommendations.length > 0 ? recommendations : ['Standard follow-up sequence'];
  }

  private extractCommonKeywords(text: string): { word: string; frequency: number }[] {
    const words = text.split(/\s+/).filter(word => word.length > 3);
    const frequency: { [key: string]: number } = {};
    
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .map(([word, freq]) => ({ word, frequency: freq }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }
}

export const leadScoringService = new LeadScoringService();