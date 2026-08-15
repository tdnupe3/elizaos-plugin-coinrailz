/**
 * Compliance Consultant Service Handler - AI-ENHANCED ✅
 * Handles regulatory compliance analysis and AML/KYC consulting
 * 
 * Features:
 * - Regulatory compliance consulting (licensing, requirements)
 * - Real-time AML/sanctions screening via external APIs
 * - Rule-based fallback when APIs unavailable
 * - Multi-provider support (Sanction Scanner, AMLBot, Chainalysis)
 * - AI enhancement for additional insights and recommendations
 * 
 * Service: $5.00
 * AI Cost: ~$0.03
 * Profit Margin: ~99.4%
 */

import { ServiceHandler, ServiceDeliveryRequest, ServiceDeliveryResult } from '../serviceDeliveryFramework';
import { enhanceComplianceReportWithAI } from '../openAIServiceDelivery';
import { nanoid } from 'nanoid';

export class ComplianceConsultantHandler implements ServiceHandler {
  private readonly SANCTION_SCANNER_API_KEY: string | undefined;
  private readonly AMLBOT_API_KEY: string | undefined;

  constructor() {
    this.SANCTION_SCANNER_API_KEY = process.env.SANCTION_SCANNER_API_KEY;
    this.AMLBOT_API_KEY = process.env.AMLBOT_API_KEY;

    if (!this.SANCTION_SCANNER_API_KEY && !this.AMLBOT_API_KEY) {
      console.warn('⚠️ ComplianceConsultantHandler: No compliance API keys - using rule-based fallback');
      console.warn('   For production: Add SANCTION_SCANNER_API_KEY or AMLBOT_API_KEY');
    } else {
      console.log('✅ ComplianceConsultantHandler: External API configured');
    }
  }

  canHandle(request: ServiceDeliveryRequest): boolean {
    return (
      request.agentId === 'compliance-consultant' &&
      (!!request.complianceRequirements || !!request.amlScreeningDetails)
    );
  }

  async execute(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    try {
      console.log(`📋 Starting compliance analysis for order: ${request.orderId}`);

      // Determine type of compliance check requested
      if (request.amlScreeningDetails) {
        return await this.performAMLScreening(request);
      } else if (request.complianceRequirements) {
        return await this.performRegulatoryConsulting(request);
      }

      throw new Error('Either complianceRequirements or amlScreeningDetails required');

    } catch (error: any) {
      console.error(`❌ Compliance analysis failed:`, error);
      return {
        success: false,
        orderId: request.orderId,
        agentId: request.agentId,
        deliveryData: null,
        status: 'failed',
        error: error.message || 'Compliance analysis failed',
      };
    }
  }

  /**
   * Perform AML/Sanctions Screening
   */
  private async performAMLScreening(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    const { amlScreeningDetails } = request;
    const checkId = `aml_${nanoid(16)}`;

    console.log(`🔍 Performing AML screening for order: ${request.orderId}`);

    let screeningResult: any;

    // Try external APIs first, fallback to rule-based
    if (this.SANCTION_SCANNER_API_KEY) {
      screeningResult = await this.checkWithSanctionScanner(amlScreeningDetails);
    } else if (this.AMLBOT_API_KEY) {
      screeningResult = await this.checkWithAMLBot(amlScreeningDetails);
    } else {
      screeningResult = await this.ruleBasedAMLCheck(amlScreeningDetails);
    }

    console.log(`✅ AML screening completed`);
    console.log(`   Risk Level: ${screeningResult.riskLevel}`);
    console.log(`   Compliant: ${screeningResult.compliant ? 'YES' : 'NO'}`);

    return {
      success: true,
      orderId: request.orderId,
      agentId: request.agentId,
      deliveryData: {
        amlScreeningResult: {
          checkId,
          ...screeningResult,
        },
        serviceType: 'aml_screening',
        completedAt: new Date().toISOString(),
        message: `AML screening completed using ${screeningResult.provider}`,
      },
      status: 'completed',
      metadata: {
        checkId,
        riskLevel: screeningResult.riskLevel,
        provider: screeningResult.provider,
      },
    };
  }

  /**
   * Perform Regulatory Compliance Consulting
   */
  private async performRegulatoryConsulting(request: ServiceDeliveryRequest): Promise<ServiceDeliveryResult> {
    const { complianceRequirements } = request;
    
    if (!complianceRequirements || !complianceRequirements.jurisdiction) {
      throw new Error('Compliance requirements needed: jurisdiction, businessType, and services');
    }

    const reportId = `compliance_${nanoid(12)}`;

    // Generate comprehensive compliance report
    const complianceReport = {
      reportId,
      jurisdiction: complianceRequirements.jurisdiction,
      businessType: complianceRequirements.businessType || 'fintech',
      analysisDate: new Date().toISOString(),
      
      regulatoryRequirements: this.generateRegulatoryRequirements(complianceRequirements.jurisdiction),
      
      kycAmlRequirements: {
        kycLevel: this.determineKYCLevel(complianceRequirements),
        amlCompliance: true,
        requiredDocuments: ['Government ID', 'Proof of Address', 'Business License'],
        monitoringRequired: true,
        reportingThreshold: 10000,
      },
      
      licensingRequirements: this.getLicensingRequirements(
        complianceRequirements.jurisdiction,
        complianceRequirements.businessType
      ),
      
      riskAssessment: {
        overallRisk: 'medium',
        factors: [
          'Cross-border transactions',
          'Cryptocurrency handling',
          'Multi-jurisdictional operations',
        ],
        mitigationStrategies: [
          'Implement robust KYC/AML procedures',
          'Regular compliance audits',
          'Transaction monitoring system',
          'Staff training programs',
        ],
      },
      
      recommendations: [
        'Register as Money Services Business (MSB)',
        'Implement transaction monitoring system',
        'Establish compliance team',
        'Regular third-party audits',
        'Maintain detailed transaction records for 7 years',
        'Implement geo-blocking for restricted jurisdictions',
      ],
      
      estimatedCosts: {
        initialCompliance: '$15,000 - $30,000',
        annualMaintenance: '$5,000 - $10,000',
        licensingFees: this.estimateLicensingCosts(complianceRequirements.jurisdiction),
      },
      
      timeline: {
        complianceSetup: '2-3 months',
        licensingProcess: '3-6 months',
        fullImplementation: '6-9 months',
      },
    };

    console.log(`✅ Compliance consulting completed for order: ${request.orderId}`);
    console.log(`   Jurisdiction: ${complianceRequirements.jurisdiction}`);
    console.log(`   Risk Level: ${complianceReport.riskAssessment.overallRisk}`);

    const aiEnhancement = await enhanceComplianceReportWithAI(
      complianceReport,
      request.orderId
    );

    if (aiEnhancement.success) {
      console.log(`🤖 AI enhancement added to compliance report`);
      console.log(`   💰 AI Cost: $${aiEnhancement.cost?.totalCost.toFixed(4)}, Profit: $${(5.00 - (aiEnhancement.cost?.totalCost || 0)).toFixed(2)}`);
    }

    return {
      success: true,
      orderId: request.orderId,
      agentId: request.agentId,
      deliveryData: {
        complianceReport,
        aiEnhancement: aiEnhancement.success ? aiEnhancement.data : undefined,
        costAnalysis: aiEnhancement.cost,
        deliveryTimeMs: aiEnhancement.deliveryTimeMs,
        serviceType: 'compliance_consulting',
        completedAt: new Date().toISOString(),
      },
      status: 'completed',
      metadata: {
        reportId,
        jurisdiction: complianceRequirements.jurisdiction,
      },
    };
  }

  /**
   * Check with Sanction Scanner API
   */
  private async checkWithSanctionScanner(details: any): Promise<any> {
    try {
      const response = await fetch('https://api.sanctionscanner.com/v1/screening', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.SANCTION_SCANNER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(details),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const riskScore = data.riskScore || 0;

      return {
        compliant: riskScore < 50,
        riskScore,
        riskLevel: this.calculateRiskLevel(riskScore),
        onSanctionsList: data.sanctioned || false,
        provider: 'Sanction Scanner',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Sanction Scanner failed, using fallback:', error);
      return this.ruleBasedAMLCheck(details);
    }
  }

  /**
   * Check with AMLBot API
   */
  private async checkWithAMLBot(details: any): Promise<any> {
    try {
      const response = await fetch('https://api.amlbot.com/v1/check', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.AMLBOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(details),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const riskScore = data.risk || 0;

      return {
        compliant: riskScore < 50,
        riskScore,
        riskLevel: this.calculateRiskLevel(riskScore),
        onSanctionsList: data.sanctioned || false,
        provider: 'AMLBot',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('AMLBot failed, using fallback:', error);
      return this.ruleBasedAMLCheck(details);
    }
  }

  /**
   * Rule-based AML check (fallback)
   */
  private async ruleBasedAMLCheck(details: any): Promise<any> {
    let riskScore = 0;
    const flags: string[] = [];

    // High-risk countries
    const highRiskCountries = ['KP', 'IR', 'SY', 'CU', 'VE', 'BY', 'MM', 'RU'];
    if (details.country && highRiskCountries.includes(details.country.toUpperCase())) {
      flags.push('High-risk jurisdiction');
      riskScore += 40;
    }

    // Large amounts
    if (details.amount && details.amount > 50000) {
      flags.push('Large transaction (>$50k)');
      riskScore += 15;
    }

    // Suspicious patterns
    if (details.address) {
      const suspiciousPatterns = ['0x0000', '0xdead', '0x1111'];
      if (suspiciousPatterns.some(p => details.address.toLowerCase().includes(p))) {
        flags.push('Suspicious address pattern');
        riskScore += 20;
      }
    }

    riskScore = Math.min(riskScore, 100);

    return {
      compliant: riskScore < 50,
      riskScore,
      riskLevel: this.calculateRiskLevel(riskScore),
      onSanctionsList: riskScore >= 80,
      flags,
      provider: 'Rule-Based Engine',
      timestamp: new Date().toISOString(),
    };
  }

  private calculateRiskLevel(score: number): string {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  private generateRegulatoryRequirements(jurisdiction: string): any {
    const requirements: Record<string, any> = {
      'US': {
        federal: ['FinCEN Registration', 'BSA Compliance', 'OFAC Sanctions'],
        state: ['State MSB License', 'Surety Bond'],
        regulatory_bodies: ['FinCEN', 'SEC', 'CFTC', 'State Banking Departments'],
      },
      'EU': {
        directives: ['MiCA Regulation', '5AMLD', '6AMLD'],
        requirements: ['VASP Registration', 'AML Procedures', 'Data Protection (GDPR)'],
        regulatory_bodies: ['European Banking Authority', 'National Competent Authorities'],
      },
      'UK': {
        requirements: ['FCA Registration', 'Cryptoasset Firm Registration', 'AML Compliance'],
        regulatory_bodies: ['FCA', 'HMRC'],
      },
      'default': {
        general: ['Business Registration', 'AML/KYC Procedures', 'Tax Compliance'],
        recommended: ['Legal Review', 'Compliance Officer', 'Regular Audits'],
      },
    };

    return requirements[jurisdiction] || requirements['default'];
  }

  private determineKYCLevel(requirements: any): string {
    const { transactionVolume, customerType } = requirements;
    
    if (transactionVolume > 100000 || customerType === 'institutional') {
      return 'enhanced';
    } else if (transactionVolume > 10000) {
      return 'standard';
    }
    return 'basic';
  }

  private getLicensingRequirements(jurisdiction: string, businessType: string): any {
    return {
      required: true,
      types: ['Money Services Business', 'Virtual Asset Service Provider'],
      jurisdiction,
      estimatedTimeframe: '3-6 months',
      renewalPeriod: 'Annual',
    };
  }

  private estimateLicensingCosts(jurisdiction: string): string {
    const costs: Record<string, string> = {
      'US': '$2,000 - $5,000 per state',
      'EU': '€5,000 - €20,000',
      'UK': '£5,000 - £15,000',
      'default': '$5,000 - $15,000',
    };

    return costs[jurisdiction] || costs['default'];
  }
}
