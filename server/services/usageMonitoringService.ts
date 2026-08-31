/**
 * Usage Monitoring Service - Tracks customer usage and triggers upgrade opportunities
 * Monitors sub-$1000 package consumption to maximize revenue through natural upgrades
 */

import { db } from '../db';
import { apiUsageTracking } from '../../shared/schema';
import { eq, desc, sum, count, and, gte } from 'drizzle-orm';

export interface UsageAlert {
  customerId: string;
  currentUsage: number;
  packageLimit: number;
  utilizationRate: number;
  daysRemaining: number;
  upgradeRecommendation: string;
  potentialRevenue: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface UpgradeOpportunity {
  customerId: string;
  currentPackage: string;
  suggestedPackage: string;
  additionalRevenue: number;
  customerBenefit: string;
  timing: string;
  approachStrategy: string;
}

export class UsageMonitoringService {
  
  /**
   * Monitor customer usage patterns and identify upgrade opportunities
   */
  static async monitorCustomerUsage(): Promise<UsageAlert[]> {
    try {
      // In production, this would query actual usage data
      // For demo, return realistic usage patterns
      const mockUsageData = [
        {
          customerId: 'CUST_FINTECH_001',
          packageType: 'Credit Scoring Validation Pack',
          packageLimit: 250,
          currentUsage: 180,
          daysIntoPackage: 8,
          packageDuration: 14
        },
        {
          customerId: 'CUST_TRADING_002',
          packageType: 'Market Intelligence Starter',
          packageLimit: 300,
          currentUsage: 275,
          daysIntoPackage: 12,
          packageDuration: 14
        },
        {
          customerId: 'CUST_BANK_003',
          packageType: 'Risk Assessment Essential',
          packageLimit: 400,
          currentUsage: 320,
          daysIntoPackage: 10,
          packageDuration: 14
        },
        {
          customerId: 'CUST_CRYPTO_004',
          packageType: 'Multi-Data Sampler Pack',
          packageLimit: 500,
          currentUsage: 450,
          daysIntoPackage: 13,
          packageDuration: 30
        }
      ];

      return mockUsageData.map(customer => {
        const utilizationRate = (customer.currentUsage / customer.packageLimit) * 100;
        const daysRemaining = customer.packageDuration - customer.daysIntoPackage;
        const projectedUsage = customer.currentUsage + ((customer.currentUsage / customer.daysIntoPackage) * daysRemaining);
        
        let urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
        let upgradeRecommendation: string;
        let potentialRevenue: number;

        if (utilizationRate >= 90) {
          urgencyLevel = 'critical';
          upgradeRecommendation = 'Immediate additional package purchase required';
          potentialRevenue = this.calculateUpgradeRevenue(customer.packageType, 'immediate');
        } else if (utilizationRate >= 75) {
          urgencyLevel = 'high';
          upgradeRecommendation = 'Proactive upgrade to prevent service interruption';
          potentialRevenue = this.calculateUpgradeRevenue(customer.packageType, 'proactive');
        } else if (utilizationRate >= 60) {
          urgencyLevel = 'medium';
          upgradeRecommendation = 'Consider larger package for next purchase';
          potentialRevenue = this.calculateUpgradeRevenue(customer.packageType, 'planned');
        } else {
          urgencyLevel = 'low';
          upgradeRecommendation = 'Monitor usage patterns for optimization';
          potentialRevenue = 0;
        }

        return {
          customerId: customer.customerId,
          currentUsage: customer.currentUsage,
          packageLimit: customer.packageLimit,
          utilizationRate: Math.round(utilizationRate),
          daysRemaining,
          upgradeRecommendation,
          potentialRevenue,
          urgencyLevel
        };
      });

    } catch (error) {
      console.error('Usage monitoring failed:', error);
      return [];
    }
  }

  /**
   * Calculate potential revenue from package upgrades
   */
  private static calculateUpgradeRevenue(currentPackage: string, upgradeType: string): number {
    const packageUpgrades = {
      'Credit Scoring Validation Pack': {
        immediate: 373, // Additional 250-query package
        proactive: 601, // Upgrade to 600-query Monthly Growth Pack
        planned: 974 // Next month's Monthly Growth Pack
      },
      'Market Intelligence Starter': {
        immediate: 747, // Additional 300-query package
        proactive: 995, // Upgrade to Multi-Data Sampler Pack
        planned: 974 // Monthly Growth Pack for next month
      },
      'Risk Assessment Essential': {
        immediate: 756, // Additional 400-query package
        proactive: 974, // Monthly Growth Pack
        planned: 974 // Repeat Monthly Growth Pack
      },
      'Multi-Data Sampler Pack': {
        immediate: 995, // Additional sampler pack
        proactive: 1948, // Two Monthly Growth Packs
        planned: 974 // Single Monthly Growth Pack
      }
    };

    const upgrades = packageUpgrades[currentPackage as keyof typeof packageUpgrades];
    if (!upgrades || !Object.prototype.hasOwnProperty.call(upgrades, upgradeType)) {
      return 0;
    }
    return upgrades[upgradeType as keyof typeof upgrades];
  }

  /**
   * Generate personalized upgrade opportunities
   */
  static async generateUpgradeOpportunities(): Promise<UpgradeOpportunity[]> {
    const usageAlerts = await this.monitorCustomerUsage();
    
    return usageAlerts
      .filter(alert => alert.urgencyLevel !== 'low')
      .map(alert => {
        let suggestedPackage: string;
        let customerBenefit: string;
        let timing: string;
        let approachStrategy: string;

        switch (alert.urgencyLevel) {
          case 'critical':
            suggestedPackage = 'Immediate Additional Package';
            customerBenefit = 'Prevents service interruption and maintains data access';
            timing = 'Contact immediately - usage at 90%+';
            approachStrategy = 'Urgency-based: "Your package is nearly exhausted. Secure additional queries now to avoid disruption."';
            break;
          
          case 'high':
            suggestedPackage = 'Monthly Growth Pack (600 queries)';
            customerBenefit = 'Provides buffer for growth and better per-query pricing';
            timing = 'Contact within 24 hours - usage at 75%+';
            approachStrategy = 'Value-based: "You\'re a power user! Upgrade to Monthly Growth Pack for better rates and peace of mind."';
            break;
          
          case 'medium':
            suggestedPackage = 'Next-tier package for future purchase';
            customerBenefit = 'Optimizes cost per query and reduces purchase frequency';
            timing = 'Contact in 2-3 days - plan for next purchase';
            approachStrategy = 'Optimization-based: "Based on your usage, consider our Monthly Growth Pack for 40% fewer transactions and better rates."';
            break;
          
          default:
            suggestedPackage = 'Monitor';
            customerBenefit = 'Track patterns for future optimization';
            timing = 'No immediate action needed';
            approachStrategy = 'Monitoring phase';
        }

        return {
          customerId: alert.customerId,
          currentPackage: this.getCurrentPackageFromCustomerId(alert.customerId),
          suggestedPackage,
          additionalRevenue: alert.potentialRevenue,
          customerBenefit,
          timing,
          approachStrategy
        };
      });
  }

  /**
   * Helper to determine current package from customer ID
   */
  private static getCurrentPackageFromCustomerId(customerId: string): string {
    // In production, this would query actual customer data
    const packageMap: { [key: string]: string } = {
      'CUST_FINTECH_001': 'Credit Scoring Validation Pack ($373)',
      'CUST_TRADING_002': 'Market Intelligence Starter ($747)',
      'CUST_BANK_003': 'Risk Assessment Essential ($756)',
      'CUST_CRYPTO_004': 'Multi-Data Sampler Pack ($995)'
    };
    
    return packageMap[customerId] || 'Unknown Package';
  }

  /**
   * Automated upgrade outreach messaging
   */
  static generateUpgradeMessage(opportunity: UpgradeOpportunity): {
    subject: string;
    message: string;
    urgency: string;
    callToAction: string;
  } {
    const messages = {
      'critical': {
        subject: 'Urgent: Your data package is 90% exhausted',
        message: `Hi there! Your ${opportunity.currentPackage} is nearly exhausted with high usage - exactly what we love to see! To ensure uninterrupted access to your critical data, I can instantly provision additional queries. Your current usage pattern suggests you're getting excellent ROI from our platform.`,
        urgency: 'Immediate action required',
        callToAction: 'Click here to add queries instantly (2-minute setup)'
      },
      'high': {
        subject: 'Optimize your data costs - usage upgrade opportunity',
        message: `Great news! Your high usage of ${opportunity.currentPackage} qualifies you for our Monthly Growth Pack with better per-query rates. Based on your consumption pattern, you\'ll save money while getting more queries. Plus, you\'ll avoid the hassle of frequent repurchases.`,
        urgency: 'Recommended within 24 hours',
        callToAction: 'Upgrade now for instant savings and convenience'
      },
      'medium': {
        subject: 'Usage insights: Optimize your next data purchase',
        message: `I\'ve been analyzing your usage of ${opportunity.currentPackage} and noticed you\'re a consistent user. For your next purchase, consider our Monthly Growth Pack - it offers better value for users with your consumption pattern and reduces the frequency of purchases.`,
        urgency: 'Plan for next purchase cycle',
        callToAction: 'Review upgrade options for next month'
      }
    };

    const urgencyKey = opportunity.timing.includes('immediately') ? 'critical' : 
                     opportunity.timing.includes('24 hours') ? 'high' : 'medium';
    
    return messages[urgencyKey];
  }

  /**
   * Revenue projection from upgrade campaigns
   */
  static async calculateUpgradeRevenuePotential(): Promise<{
    totalPotentialRevenue: number;
    immediateRevenue: number;
    monthlyRevenue: number;
    conversionEstimates: {
      criticalAlerts: { count: number; conversionRate: number; revenue: number };
      highAlerts: { count: number; conversionRate: number; revenue: number };
      mediumAlerts: { count: number; conversionRate: number; revenue: number };
    };
  }> {
    const opportunities = await this.generateUpgradeOpportunities();
    
    const criticalAlerts = opportunities.filter(o => o.timing.includes('immediately'));
    const highAlerts = opportunities.filter(o => o.timing.includes('24 hours'));
    const mediumAlerts = opportunities.filter(o => o.timing.includes('2-3 days'));

    // Conservative conversion rate estimates based on urgency
    const criticalConversion = 0.85; // High urgency = high conversion
    const highConversion = 0.60; // Good value proposition
    const mediumConversion = 0.35; // Planning-stage purchases

    const conversionEstimates = {
      criticalAlerts: {
        count: criticalAlerts.length,
        conversionRate: criticalConversion,
        revenue: criticalAlerts.reduce((sum, o) => sum + o.additionalRevenue, 0) * criticalConversion
      },
      highAlerts: {
        count: highAlerts.length,
        conversionRate: highConversion,
        revenue: highAlerts.reduce((sum, o) => sum + o.additionalRevenue, 0) * highConversion
      },
      mediumAlerts: {
        count: mediumAlerts.length,
        conversionRate: mediumConversion,
        revenue: mediumAlerts.reduce((sum, o) => sum + o.additionalRevenue, 0) * mediumConversion
      }
    };

    const immediateRevenue = conversionEstimates.criticalAlerts.revenue + conversionEstimates.highAlerts.revenue;
    const monthlyRevenue = immediateRevenue + conversionEstimates.mediumAlerts.revenue;
    const totalPotentialRevenue = opportunities.reduce((sum, o) => sum + o.additionalRevenue, 0);

    return {
      totalPotentialRevenue,
      immediateRevenue,
      monthlyRevenue,
      conversionEstimates
    };
  }
}