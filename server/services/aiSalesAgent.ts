/**
 * AI Sales Agent Service
 * Autonomous enterprise client acquisition system for data monetization
 */

import OpenAI from 'openai';
import { db } from '../db/db';
import { 
  aiProspects, 
  aiOutreachSequences, 
  aiSalesMetrics,
  users 
} from '../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

// Types for AI Sales Agent
interface Prospect {
  id?: number;
  companyName: string;
  domain?: string;
  industry: string;
  employeeCount?: number;
  revenueRange?: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactLinkedin?: string;
  painPoints: string[];
  valueProposition: string;
  personalizationData: any;
  aiScore: number;
}

interface OutreachSequence {
  linkedinConnection: string;
  emailSubject: string;
  emailContent: string;
  linkedinFollowup: string;
  phoneScript: string;
  timing: {
    linkedin: number; // days
    email: number;
    followup: number;
  };
}

interface ProspectIntel {
  decisionMakers: string[];
  painPoints: string[];
  valueProposition: string;
  approachStrategy: string;
  competitiveLandscape: string[];
  buyingSignals: string[];
}

interface LeadScore {
  overall: number;
  breakdown: {
    firmographic: number;
    behavioral: number;
    intent: number;
    competitive: number;
  };
  recommendation: string;
  nextBestAction: string;
}

class AISalesAgentService {
  private openai: OpenAI;
  private isInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️ OPENAI_API_KEY not found - AI Sales Agent running in simulation mode');
        return;
      }

      this.openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });
      
      this.isInitialized = true;
      console.log('✅ AI Sales Agent initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AI Sales Agent:', error);
    }
  }

  /**
   * Research prospect company and generate intelligence
   */
  async generateProspectResearch(company: string, industry: string): Promise<ProspectIntel> {
    if (!this.isInitialized) {
      return this.getMockProspectIntel(company, industry);
    }

    try {
      const research = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert B2B sales researcher specializing in crypto data analytics sales. Analyze companies and identify key pain points, decision makers, and personalized value propositions for behavioral crypto data services.

Focus on how multi-chain transaction intelligence, AI agent marketplace data, and cross-border payment analytics can solve their specific challenges.

Return analysis in JSON format with: decisionMakers, painPoints, valueProposition, approachStrategy, competitiveLandscape, buyingSignals.`
          },
          {
            role: "user", 
            content: `Research ${company} in the ${industry} industry. Provide comprehensive sales intelligence for crypto behavioral data analytics services.`
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(research.choices[0].message.content);
    } catch (error) {
      console.error('Error generating prospect research:', error);
      return this.getMockProspectIntel(company, industry);
    }
  }

  /**
   * Generate personalized outreach sequence for prospect
   */
  async generatePersonalizedOutreach(prospect: Prospect): Promise<OutreachSequence> {
    if (!this.isInitialized) {
      return this.getMockOutreachSequence(prospect);
    }

    try {
      const sequence = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a top-performing enterprise sales representative specializing in crypto data analytics. Generate highly personalized, professional outreach sequences that drive meetings and demos.

Focus on:
- Specific value for their industry and role
- Quantified benefits from behavioral data
- Social proof from similar companies
- Clear call-to-action for meetings

Return as JSON with: linkedinConnection, emailSubject, emailContent, linkedinFollowup, phoneScript, timing object.`
          },
          {
            role: "user",
            content: `Create personalized outreach sequence for:
Company: ${prospect.companyName}
Contact: ${prospect.contactName}, ${prospect.contactTitle}
Industry: ${prospect.industry}
Pain Points: ${prospect.painPoints.join(', ')}
Value Prop: ${prospect.valueProposition}

Include specific benefits of multi-chain behavioral data, AI agent marketplace insights, and competitive intelligence.`
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(sequence.choices[0].message.content);
      return {
        ...result,
        timing: result.timing || { linkedin: 1, email: 3, followup: 7 }
      };
    } catch (error) {
      console.error('Error generating outreach sequence:', error);
      return this.getMockOutreachSequence(prospect);
    }
  }

  /**
   * Score prospect based on fit and buying potential
   */
  async scoreProspect(prospect: Prospect): Promise<LeadScore> {
    if (!this.isInitialized) {
      return this.getMockLeadScore(prospect);
    }

    try {
      const scoring = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert sales analyst. Score prospects for crypto data analytics services on a 0-100 scale across these dimensions:

1. Firmographic fit (industry, size, revenue)
2. Behavioral signals (engagement, responsiveness)
3. Intent indicators (data needs, current solutions)
4. Competitive position (urgency, budget)

Return JSON with: overall score, breakdown object, recommendation, nextBestAction.`
          },
          {
            role: "user",
            content: `Score this prospect:
Company: ${prospect.companyName} (${prospect.industry})
Contact: ${prospect.contactTitle}
Employee Count: ${prospect.employeeCount || 'Unknown'}
Revenue: ${prospect.revenueRange || 'Unknown'}
Pain Points: ${prospect.painPoints.join(', ')}`
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(scoring.choices[0].message.content);
    } catch (error) {
      console.error('Error scoring prospect:', error);
      return this.getMockLeadScore(prospect);
    }
  }

  /**
   * Analyze inbound response and determine next action
   */
  async analyzeResponse(message: string, prospectId: number): Promise<any> {
    if (!this.isInitialized) {
      return {
        intent: 'interested',
        sentiment: 'positive',
        nextAction: 'schedule_demo',
        suggestedResponse: 'Thank you for your interest! I\'d love to show you how our behavioral data can help your team.'
      };
    }

    try {
      const analysis = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `Analyze this sales response and determine:
1. Intent (interested, not_interested, request_info, schedule_meeting, pricing_question, objection)
2. Sentiment (positive, neutral, negative)
3. Next action (schedule_demo, send_info, handle_objection, nurture, qualify_further)
4. Suggested response

Return as JSON object.`
          },
          {
            role: "user",
            content: `Analyze this response: "${message}"`
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(analysis.choices[0].message.content);
    } catch (error) {
      console.error('Error analyzing response:', error);
      return {
        intent: 'unknown',
        sentiment: 'neutral',
        nextAction: 'follow_up',
        suggestedResponse: 'Thank you for your response. I\'d love to learn more about your data analytics needs.'
      };
    }
  }

  /**
   * Create new prospect in database
   */
  async createProspect(prospectData: Omit<Prospect, 'id'>): Promise<number> {
    try {
      const [prospect] = await db.insert(aiProspects).values({
        companyName: prospectData.companyName,
        domain: prospectData.domain,
        industry: prospectData.industry,
        employeeCount: prospectData.employeeCount,
        revenueRange: prospectData.revenueRange,
        contactName: prospectData.contactName,
        contactTitle: prospectData.contactTitle,
        contactEmail: prospectData.contactEmail,
        contactLinkedin: prospectData.contactLinkedin,
        painPoints: prospectData.painPoints,
        valueProposition: prospectData.valueProposition,
        personalizationData: prospectData.personalizationData,
        aiScore: prospectData.aiScore,
        outreachStatus: 'not_contacted'
      }).returning();

      return prospect.id;
    } catch (error) {
      console.error('Error creating prospect:', error);
      throw error;
    }
  }

  /**
   * Launch automated outreach campaign for prospect
   */
  async launchCampaign(prospectId: number): Promise<void> {
    try {
      // Get prospect details
      const [prospect] = await db
        .select()
        .from(aiProspects)
        .where(eq(aiProspects.id, prospectId));

      if (!prospect) {
        throw new Error('Prospect not found');
      }

      // Generate outreach sequence
      const sequence = await this.generatePersonalizedOutreach(prospect as any);

      // Create outreach records
      const outreachSteps = [
        {
          prospectId,
          sequenceType: 'linkedin' as const,
          stepNumber: 1,
          subjectLine: 'Connection Request',
          messageContent: sequence.linkedinConnection,
          sendDate: new Date(),
          deliveryStatus: 'scheduled' as const
        },
        {
          prospectId,
          sequenceType: 'email' as const,
          stepNumber: 2,
          subjectLine: sequence.emailSubject,
          messageContent: sequence.emailContent,
          sendDate: new Date(Date.now() + sequence.timing.email * 24 * 60 * 60 * 1000),
          deliveryStatus: 'scheduled' as const
        },
        {
          prospectId,
          sequenceType: 'linkedin' as const,
          stepNumber: 3,
          subjectLine: 'Follow-up Message',
          messageContent: sequence.linkedinFollowup,
          sendDate: new Date(Date.now() + sequence.timing.followup * 24 * 60 * 60 * 1000),
          deliveryStatus: 'scheduled' as const
        }
      ];

      await db.insert(aiOutreachSequences).values(outreachSteps);

      // Update prospect status
      await db
        .update(aiProspects)
        .set({ 
          outreachStatus: 'in_sequence',
          lastContactDate: new Date(),
          nextFollowupDate: new Date(Date.now() + sequence.timing.linkedin * 24 * 60 * 60 * 1000)
        })
        .where(eq(aiProspects.id, prospectId));

      console.log(`✅ Campaign launched for prospect ${prospectId}`);
    } catch (error) {
      console.error('Error launching campaign:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics for AI sales system
   */
  async getPerformanceMetrics(days: number = 30): Promise<any> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const metrics = await db
        .select({
          totalProspects: sql<number>`count(*)`,
          contacted: sql<number>`count(*) filter (where outreach_status != 'not_contacted')`,
          responded: sql<number>`count(*) filter (where response_status = 'responded')`,
          qualified: sql<number>`count(*) filter (where ai_score >= 70)`,
          avgScore: sql<number>`avg(ai_score)`
        })
        .from(aiProspects)
        .where(sql`created_at >= ${startDate}`);

      const [result] = metrics;

      const responseRate = result.contacted > 0 ? (result.responded / result.contacted * 100).toFixed(1) : '0';
      const qualificationRate = result.totalProspects > 0 ? (result.qualified / result.totalProspects * 100).toFixed(1) : '0';

      return {
        totalProspects: result.totalProspects,
        contacted: result.contacted,
        responded: result.responded,
        qualified: result.qualified,
        responseRate: `${responseRate}%`,
        qualificationRate: `${qualificationRate}%`,
        averageScore: Math.round(result.avgScore || 0),
        period: `Last ${days} days`
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        totalProspects: 0,
        contacted: 0,
        responded: 0,
        qualified: 0,
        responseRate: '0%',
        qualificationRate: '0%',
        averageScore: 0,
        period: `Last ${days} days`
      };
    }
  }

  /**
   * Get prospects ready for outreach
   */
  async getProspectsForOutreach(limit: number = 50): Promise<any[]> {
    try {
      return await db
        .select()
        .from(aiProspects)
        .where(eq(aiProspects.outreachStatus, 'not_contacted'))
        .orderBy(desc(aiProspects.aiScore))
        .limit(limit);
    } catch (error) {
      console.error('Error getting prospects for outreach:', error);
      return [];
    }
  }

  // Mock data methods for when OpenAI API is not available
  private getMockProspectIntel(company: string, industry: string): ProspectIntel {
    return {
      decisionMakers: ['Chief Data Officer', 'Head of Analytics', 'VP of Strategy'],
      painPoints: [
        'Limited visibility into cross-chain user behavior',
        'Need for real-time market intelligence',
        'Lack of competitive analysis data'
      ],
      valueProposition: `Help ${company} gain competitive advantage through multi-chain behavioral analytics and AI-powered market intelligence`,
      approachStrategy: 'Lead with competitive intelligence and ROI-focused messaging',
      competitiveLandscape: ['Traditional data providers', 'Internal analytics teams'],
      buyingSignals: ['Recent funding', 'Hiring data scientists', 'Digital transformation initiatives']
    };
  }

  private getMockOutreachSequence(prospect: Prospect): OutreachSequence {
    return {
      linkedinConnection: `Hi ${prospect.contactName}, I noticed ${prospect.companyName}'s innovative work in ${prospect.industry}. We help similar companies gain competitive advantages through behavioral crypto analytics. Would love to connect!`,
      emailSubject: `Crypto market intelligence for ${prospect.companyName}`,
      emailContent: `Hi ${prospect.contactName},\n\nI've been following ${prospect.companyName}'s growth in ${prospect.industry} and thought you might be interested in how we're helping similar companies gain market advantages through behavioral data analytics.\n\nOur platform provides unique insights that traditional data sources miss entirely - real user behavior patterns across 15+ blockchain networks.\n\nWould you be interested in a brief conversation about how behavioral intelligence could enhance ${prospect.companyName}'s competitive position?\n\nBest regards,\nAI Sales Agent`,
      linkedinFollowup: `Hi ${prospect.contactName}, following up on my message about behavioral analytics for ${prospect.companyName}. Happy to share some specific insights relevant to ${prospect.industry} if you're interested.`,
      phoneScript: `Hi ${prospect.contactName}, this is the AI Sales Agent from Coin Railz. I've been researching ${prospect.companyName} and believe our behavioral analytics platform could provide significant value for your ${prospect.industry} initiatives. Do you have 2 minutes to discuss?`,
      timing: {
        linkedin: 1,
        email: 3,
        followup: 7
      }
    };
  }

  private getMockLeadScore(prospect: Prospect): LeadScore {
    const baseScore = 60 + Math.random() * 30; // 60-90 range
    
    return {
      overall: Math.round(baseScore),
      breakdown: {
        firmographic: Math.round(baseScore * 0.9),
        behavioral: Math.round(baseScore * 1.1),
        intent: Math.round(baseScore * 0.95),
        competitive: Math.round(baseScore * 1.05)
      },
      recommendation: baseScore > 75 ? 'High priority - contact immediately' : 'Good fit - include in next campaign',
      nextBestAction: baseScore > 80 ? 'Phone call within 24 hours' : 'Email sequence with LinkedIn outreach'
    };
  }
}

export const aiSalesAgentService = new AISalesAgentService();