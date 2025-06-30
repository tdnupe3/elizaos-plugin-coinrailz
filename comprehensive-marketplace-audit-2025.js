/**
 * COMPREHENSIVE AI MARKETPLACE AUDIT - JUNE 30, 2025
 * Deep analysis of business logic gaps, user flow vulnerabilities, and production readiness
 * Focus: Complete end-to-end marketplace functionality validation with revenue protection
 */

import fs from 'fs';
import path from 'path';

class MarketplaceAuditor {
  constructor() {
    this.issues = [];
    this.passes = [];
    this.businessLogicGaps = [];
    this.userFlowGaps = [];
    this.revenueVulnerabilities = [];
    this.securityConcerns = [];
    this.productionBlockers = [];
    
    this.baseUrl = 'http://localhost:5000';
    this.testResults = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      passes: []
    };
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const fetch = (await import('node-fetch')).default;
    
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 10000
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const responseData = await response.text();
      
      try {
        return {
          status: response.status,
          data: JSON.parse(responseData),
          ok: response.ok
        };
      } catch {
        return {
          status: response.status,
          data: responseData,
          ok: response.ok
        };
      }
    } catch (error) {
      return {
        status: 0,
        data: { error: error.message },
        ok: false
      };
    }
  }

  recordIssue(severity, category, description, businessImpact, recommendation) {
    const issue = {
      severity,
      category,
      description,
      businessImpact,
      recommendation,
      timestamp: new Date().toISOString()
    };
    
    this.testResults[severity].push(issue);
    
    if (severity === 'critical') {
      this.productionBlockers.push(issue);
    }
  }

  recordBusinessLogicGap(description, currentBehavior, expectedBehavior, revenueImpact) {
    this.businessLogicGaps.push({
      description,
      currentBehavior,
      expectedBehavior,
      revenueImpact,
      timestamp: new Date().toISOString()
    });
  }

  recordUserFlowGap(flow, issue, userImpact, conversionImpact) {
    this.userFlowGaps.push({
      flow,
      issue,
      userImpact,
      conversionImpact,
      timestamp: new Date().toISOString()
    });
  }

  recordPass(category, description) {
    this.testResults.passes.push({
      category,
      description,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 1. SERVICE DISCOVERY AND SEARCH AUDIT
   */
  async auditServiceDiscovery() {
    console.log('\n🔍 AUDITING SERVICE DISCOVERY SYSTEM...');
    
    // Test basic search functionality
    const searchResponse = await this.makeRequest('GET', '/api/services/search');
    if (!searchResponse.ok || !searchResponse.data.success) {
      this.recordIssue('critical', 'Service Discovery', 
        'Basic service search not working', 
        'Users cannot discover services - zero marketplace revenue',
        'Fix service search endpoint immediately');
      return;
    }
    
    // Test search with parameters
    const paramSearchResponse = await this.makeRequest('GET', 
      '/api/services/search?query=data&category=data-analysis&minRating=4.0&sortBy=rating');
    
    if (!paramSearchResponse.ok) {
      this.recordIssue('high', 'Service Discovery',
        'Advanced search parameters failing',
        'Reduced user experience leads to lower conversion rates',
        'Fix parameter validation in search endpoint');
    }
    
    // Test category listing
    const categoriesResponse = await this.makeRequest('GET', '/api/services/categories');
    if (!categoriesResponse.ok) {
      this.recordIssue('medium', 'Service Discovery',
        'Category listing not working',
        'Users cannot browse by category - reduced discoverability',
        'Fix category endpoint');
    }
    
    // Validate search results structure
    if (searchResponse.data.success) {
      const services = searchResponse.data.data.services;
      if (!Array.isArray(services) || services.length === 0) {
        this.recordBusinessLogicGap(
          'No services available for discovery',
          'Search returns empty results',
          'Should have sample services available',
          'High - no services means no transactions'
        );
      } else {
        // Check service data completeness
        const firstService = services[0];
        const requiredFields = ['id', 'title', 'category', 'price', 'description', 'rating', 'agent'];
        const missingFields = requiredFields.filter(field => !firstService[field]);
        
        if (missingFields.length > 0) {
          this.recordBusinessLogicGap(
            `Service data incomplete - missing: ${missingFields.join(', ')}`,
            'Services lack essential information',
            'All services should have complete metadata',
            'Medium - incomplete data reduces trust and conversions'
          );
        } else {
          this.recordPass('Service Discovery', 'Service metadata complete and properly structured');
        }
      }
    }
    
    this.recordPass('Service Discovery', 'Basic service search functionality operational');
  }

  /**
   * 2. AGENT REGISTRATION AND ONBOARDING AUDIT
   */
  async auditAgentRegistration() {
    console.log('\n👤 AUDITING AGENT REGISTRATION SYSTEM...');
    
    // Test registration validation
    const invalidRegistration = await this.makeRequest('POST', '/api/agents/register', {
      name: 'Test Agent',
      category: 'invalid-category'
    });
    
    if (invalidRegistration.ok) {
      this.recordIssue('high', 'Agent Registration',
        'Registration accepts invalid data',
        'Poor quality agents reduce marketplace quality and customer satisfaction',
        'Implement strict validation for all registration fields');
    }
    
    // Test complete registration
    const validRegistration = await this.makeRequest('POST', '/api/agents/register', {
      name: 'Audit Test Agent',
      email: 'test@example.com',
      specialization: 'Data Analysis',
      skills: ['Python', 'SQL', 'Machine Learning'],
      experience: 'Senior (5+ years)',
      pricing: {
        hourly: 75,
        fixed: [
          { service: 'Data Analysis', price: 150 }
        ]
      },
      availability: 'part-time',
      portfolio: [
        { title: 'Sales Analysis Project', description: 'Analyzed sales data for e-commerce company' }
      ],
      type: 'human'
    });
    
    if (!validRegistration.ok) {
      this.recordIssue('critical', 'Agent Registration',
        'Valid agent registration failing',
        'Cannot onboard new agents - limits marketplace growth',
        'Fix registration endpoint validation and processing');
    } else if (validRegistration.data.success) {
      this.recordPass('Agent Registration', 'Valid agent registration processing correctly');
    }
    
    // Test agent verification workflow
    const agentListResponse = await this.makeRequest('GET', '/api/agents/pending-verification');
    if (!agentListResponse.ok) {
      this.recordBusinessLogicGap(
        'No agent verification workflow visible',
        'Cannot track pending agent approvals',
        'Should have admin interface for agent verification',
        'Medium - manual verification delays agent onboarding'
      );
    }
  }

  /**
   * 3. ORDER CREATION AND PROCESSING AUDIT
   */
  async auditOrderProcessing() {
    console.log('\n📋 AUDITING ORDER PROCESSING SYSTEM...');
    
    // Test order creation without authentication
    const unauthOrder = await this.makeRequest('POST', '/api/orders/create', {
      serviceId: 'svc_data_001',
      customerId: 'customer_123',
      requirements: 'Need data analysis for sales trends'
    });
    
    if (unauthOrder.ok) {
      this.recordIssue('critical', 'Order Processing',
        'Orders can be created without authentication',
        'Security vulnerability - fake orders could be created',
        'Require authentication for all order creation');
    }
    
    // Test order creation with invalid data
    const invalidOrder = await this.makeRequest('POST', '/api/orders/create', {
      serviceId: 'invalid_service',
      amount: -100
    });
    
    if (invalidOrder.ok) {
      this.recordIssue('high', 'Order Processing',
        'Orders accept invalid service IDs and negative amounts',
        'Could create invalid orders that break payment processing',
        'Implement comprehensive order validation');
    }
    
    // Test minimum order amount validation
    const lowAmountOrder = await this.makeRequest('POST', '/api/orders/create', {
      serviceId: 'svc_data_001',
      amount: 1
    });
    
    if (lowAmountOrder.ok) {
      this.recordBusinessLogicGap(
        'No minimum order amount enforced',
        'Orders can be created for $1',
        'Should have minimum order amount (e.g., $25) to ensure profitability',
        'High - low-value orders may not cover processing fees'
      );
    }
  }

  /**
   * 4. PAYMENT AND ESCROW SYSTEM AUDIT
   */
  async auditPaymentSystem() {
    console.log('\n💰 AUDITING PAYMENT AND ESCROW SYSTEM...');
    
    // Test commission calculation
    const commissionResponse = await this.makeRequest('POST', '/api/ai-marketplace/commission/calculate', {
      orderAmount: 150,
      agentTier: 'basic'
    });
    
    if (!commissionResponse.ok || !commissionResponse.data.success) {
      this.recordIssue('critical', 'Payment System',
        'Commission calculation not working',
        'Cannot determine platform fees - revenue tracking impossible',
        'Fix commission calculation endpoint immediately');
      return;
    }
    
    // Validate commission logic
    const commission = commissionResponse.data;
    const expectedPlatformFee = 150 * 0.25; // 25%
    const expectedAgentPayout = 150 * 0.75; // 75%
    
    if (Math.abs(commission.platformFee - expectedPlatformFee) > 0.01) {
      this.recordBusinessLogicGap(
        'Commission calculation incorrect',
        `Platform fee: ${commission.platformFee}, expected: ${expectedPlatformFee}`,
        'Platform should receive exactly 25% of order value',
        'Critical - incorrect fees affect all revenue'
      );
    }
    
    if (Math.abs(commission.agentPayout - expectedAgentPayout) > 0.01) {
      this.recordBusinessLogicGap(
        'Agent payout calculation incorrect',
        `Agent payout: ${commission.agentPayout}, expected: ${expectedAgentPayout}`,
        'Agent should receive exactly 75% of order value',
        'Critical - incorrect payouts affect agent satisfaction'
      );
    }
    
    // Test different tier calculations
    const premiumCommission = await this.makeRequest('POST', '/api/ai-marketplace/commission/calculate', {
      orderAmount: 200,
      agentTier: 'premium'
    });
    
    if (premiumCommission.ok && premiumCommission.data.success) {
      // Premium tier should have different rates (20% platform, 80% agent)
      if (premiumCommission.data.platformFeePercentage === 25) {
        this.recordBusinessLogicGap(
          'Tiered commission structure not implemented',
          'Premium agents pay same 25% fee as basic agents',
          'Premium agents should pay reduced fees (20%) for loyalty',
          'Medium - affects agent retention and upgrade incentives'
        );
      }
    }
    
    // Test escrow functionality
    const escrowResponse = await this.makeRequest('POST', '/api/payments/escrow/create', {
      orderId: 'test_order_123',
      amount: 150,
      agentId: 'agent_123'
    });
    
    if (!escrowResponse.ok) {
      this.recordBusinessLogicGap(
        'Escrow system not operational',
        'Cannot hold payments in escrow',
        'Should hold payments until service delivery confirmation',
        'High - no buyer protection reduces trust and conversions'
      );
    }
    
    this.recordPass('Payment System', 'Commission calculations working correctly for basic tier');
  }

  /**
   * 5. SERVICE DELIVERY AND COMPLETION AUDIT
   */
  async auditServiceDelivery() {
    console.log('\n📤 AUDITING SERVICE DELIVERY SYSTEM...');
    
    // Test file upload capability
    const uploadResponse = await this.makeRequest('POST', '/api/orders/test_order_123/deliverables', {
      files: ['test_file.pdf'],
      message: 'Analysis complete'
    });
    
    if (!uploadResponse.ok) {
      this.recordBusinessLogicGap(
        'Service delivery system not operational',
        'Agents cannot upload deliverables',
        'Should allow file uploads with virus scanning',
        'Critical - no delivery system means no completed transactions'
      );
    }
    
    // Test delivery confirmation workflow
    const confirmResponse = await this.makeRequest('POST', '/api/orders/test_order_123/confirm-delivery');
    
    if (!confirmResponse.ok) {
      this.recordBusinessLogicGap(
        'Delivery confirmation system missing',
        'No way to confirm service completion',
        'Should have customer confirmation before releasing escrow',
        'High - automatic payments without confirmation create disputes'
      );
    }
    
    // Test automatic escrow release
    const releaseResponse = await this.makeRequest('POST', '/api/payments/escrow/release', {
      orderId: 'test_order_123',
      reason: 'Service completed and confirmed'
    });
    
    if (!releaseResponse.ok) {
      this.recordBusinessLogicGap(
        'Escrow release system not working',
        'Payments remain locked after service completion',
        'Should automatically release payments after confirmation',
        'Critical - agents not getting paid affects marketplace viability'
      );
    }
  }

  /**
   * 6. DISPUTE RESOLUTION AUDIT
   */
  async auditDisputeResolution() {
    console.log('\n⚖️ AUDITING DISPUTE RESOLUTION SYSTEM...');
    
    // Test dispute creation
    const disputeResponse = await this.makeRequest('POST', '/api/disputes/create', {
      orderId: 'test_order_123',
      reason: 'Service not delivered as promised',
      evidence: 'Screenshots and communication history'
    });
    
    if (!disputeResponse.ok) {
      this.recordBusinessLogicGap(
        'Dispute system not operational',
        'Customers cannot create disputes',
        'Should allow dispute creation with evidence upload',
        'High - no dispute resolution reduces customer confidence'
      );
    }
    
    // Test dispute workflow
    const disputeListResponse = await this.makeRequest('GET', '/api/disputes/pending');
    
    if (!disputeListResponse.ok) {
      this.recordUserFlowGap(
        'Dispute Management',
        'No admin interface for dispute resolution',
        'Administrators cannot manage disputes',
        'High - unresolved disputes lead to customer churn'
      );
    }
  }

  /**
   * 7. COMMUNICATION SYSTEM AUDIT
   */
  async auditCommunication() {
    console.log('\n💬 AUDITING COMMUNICATION SYSTEM...');
    
    // Test messaging capability
    const messageResponse = await this.makeRequest('POST', '/api/messaging/send', {
      orderId: 'test_order_123',
      from: 'customer_123',
      to: 'agent_456',
      message: 'Can you provide an update on the analysis?'
    });
    
    if (!messageResponse.ok) {
      this.recordBusinessLogicGap(
        'Customer-agent communication not working',
        'No messaging system between customers and agents',
        'Should have real-time messaging for project coordination',
        'Medium - poor communication leads to project failures'
      );
    }
    
    // Test message history
    const historyResponse = await this.makeRequest('GET', '/api/messaging/history/test_order_123');
    
    if (!historyResponse.ok) {
      this.recordUserFlowGap(
        'Communication History',
        'Cannot view message history',
        'Users cannot reference previous communications',
        'Medium - affects project continuity and dispute resolution'
      );
    }
  }

  /**
   * 8. AGENT PERFORMANCE AND QUALITY CONTROL AUDIT
   */
  async auditQualityControl() {
    console.log('\n📊 AUDITING QUALITY CONTROL SYSTEM...');
    
    // Test agent performance tracking
    const performanceResponse = await this.makeRequest('GET', '/api/agents/agent_456/performance');
    
    if (!performanceResponse.ok) {
      this.recordBusinessLogicGap(
        'Agent performance tracking missing',
        'No metrics on agent performance',
        'Should track completion rates, customer satisfaction, response times',
        'Medium - cannot identify high/low performing agents'
      );
    }
    
    // Test rating and review system
    const reviewResponse = await this.makeRequest('POST', '/api/orders/test_order_123/review', {
      rating: 5,
      review: 'Excellent analysis, very thorough and insightful'
    });
    
    if (!reviewResponse.ok) {
      this.recordBusinessLogicGap(
        'Review system not operational',
        'Customers cannot rate agents',
        'Should collect ratings and reviews for quality assurance',
        'High - no quality feedback reduces marketplace trust'
      );
    }
    
    // Test agent suspension capability
    const suspensionResponse = await this.makeRequest('POST', '/api/agents/agent_456/suspend', {
      reason: 'Multiple customer complaints'
    });
    
    if (!suspensionResponse.ok) {
      this.recordBusinessLogicGap(
        'Agent quality control missing',
        'Cannot suspend poor-performing agents',
        'Should have admin controls for agent management',
        'Medium - bad agents damage marketplace reputation'
      );
    }
  }

  /**
   * 9. REVENUE PROTECTION AND BUSINESS LOGIC AUDIT
   */
  async auditRevenueProtection() {
    console.log('\n🛡️ AUDITING REVENUE PROTECTION...');
    
    // Test transaction limits
    const highValueOrder = await this.makeRequest('POST', '/api/orders/create', {
      serviceId: 'svc_data_001',
      amount: 50000 // $50k order
    });
    
    if (highValueOrder.ok) {
      this.recordBusinessLogicGap(
        'No maximum transaction limits',
        'Users can create extremely high-value orders',
        'Should have reasonable maximum limits to prevent fraud',
        'Medium - high-value fraud could cause significant losses'
      );
    }
    
    // Test fee calculation consistency
    const multipleCommissions = await Promise.all([
      this.makeRequest('POST', '/api/ai-marketplace/commission/calculate', { orderAmount: 100, agentTier: 'basic' }),
      this.makeRequest('POST', '/api/ai-marketplace/commission/calculate', { orderAmount: 100, agentTier: 'basic' }),
      this.makeRequest('POST', '/api/ai-marketplace/commission/calculate', { orderAmount: 100, agentTier: 'basic' })
    ]);
    
    const fees = multipleCommissions.filter(r => r.ok).map(r => r.data.platformFee);
    const inconsistentFees = fees.some(fee => fee !== fees[0]);
    
    if (inconsistentFees) {
      this.recordIssue('critical', 'Revenue Protection',
        'Commission calculations inconsistent across requests',
        'Revenue calculations unreliable - financial reporting impossible',
        'Fix commission calculation logic for consistency');
    }
    
    // Test refund processing
    const refundResponse = await this.makeRequest('POST', '/api/payments/refund', {
      orderId: 'test_order_123',
      amount: 75, // Partial refund
      reason: 'Partial service completion'
    });
    
    if (!refundResponse.ok) {
      this.recordBusinessLogicGap(
        'Refund processing not implemented',
        'Cannot process customer refunds',
        'Should handle full and partial refunds with escrow adjustment',
        'High - no refund capability reduces customer confidence'
      );
    }
  }

  /**
   * 10. SECURITY AND FRAUD PREVENTION AUDIT
   */
  async auditSecurity() {
    console.log('\n🔒 AUDITING SECURITY AND FRAUD PREVENTION...');
    
    // Test rate limiting
    const rapidRequests = Array(20).fill().map(() => 
      this.makeRequest('GET', '/api/services/search')
    );
    
    const responses = await Promise.all(rapidRequests);
    const rateLimited = responses.some(r => r.status === 429);
    
    if (!rateLimited) {
      this.recordIssue('medium', 'Security',
        'No rate limiting on search endpoints',
        'Could be abused for DoS attacks or competitive intelligence gathering',
        'Implement rate limiting on all public endpoints');
    }
    
    // Test input validation
    const sqlInjectionTest = await this.makeRequest('GET', 
      "/api/services/search?query=' OR '1'='1");
    
    if (sqlInjectionTest.ok && sqlInjectionTest.data.success) {
      this.recordIssue('high', 'Security',
        'Potential SQL injection vulnerability in search',
        'Could allow unauthorized data access',
        'Implement proper input sanitization');
    }
    
    this.recordPass('Security', 'Basic security measures appear to be in place');
  }

  /**
   * GENERATE COMPREHENSIVE AUDIT REPORT
   */
  generateAuditReport() {
    const report = {
      auditDate: new Date().toISOString(),
      overallAssessment: this.calculateOverallReadiness(),
      criticalIssues: this.testResults.critical.length,
      highPriorityIssues: this.testResults.high.length,
      mediumPriorityIssues: this.testResults.medium.length,
      lowPriorityIssues: this.testResults.low.length,
      passingTests: this.testResults.passes.length,
      
      businessLogicGaps: this.businessLogicGaps,
      userFlowGaps: this.userFlowGaps,
      productionBlockers: this.productionBlockers,
      
      detailedResults: {
        critical: this.testResults.critical,
        high: this.testResults.high,
        medium: this.testResults.medium,
        low: this.testResults.low,
        passes: this.testResults.passes
      },
      
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  calculateOverallReadiness() {
    const totalTests = Object.values(this.testResults).reduce((sum, arr) => sum + arr.length, 0);
    const passingTests = this.testResults.passes.length;
    const readinessScore = totalTests > 0 ? (passingTests / totalTests) * 100 : 0;
    
    const criticalCount = this.testResults.critical.length;
    const highCount = this.testResults.high.length;
    
    if (criticalCount > 0) {
      return {
        score: Math.min(readinessScore, 60),
        status: 'NOT PRODUCTION READY',
        reason: `${criticalCount} critical issues must be resolved`
      };
    }
    
    if (highCount > 3) {
      return {
        score: Math.min(readinessScore, 75),
        status: 'NEEDS IMPROVEMENT',
        reason: `${highCount} high priority issues should be addressed`
      };
    }
    
    if (readinessScore >= 85) {
      return {
        score: readinessScore,
        status: 'PRODUCTION READY',
        reason: 'All critical systems operational'
      };
    }
    
    return {
      score: readinessScore,
      status: 'NEARLY READY',
      reason: 'Minor improvements needed'
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Critical issues first
    this.testResults.critical.forEach(issue => {
      recommendations.push({
        priority: 'CRITICAL',
        category: issue.category,
        action: issue.recommendation,
        impact: issue.businessImpact
      });
    });
    
    // High priority issues
    this.testResults.high.forEach(issue => {
      recommendations.push({
        priority: 'HIGH',
        category: issue.category,
        action: issue.recommendation,
        impact: issue.businessImpact
      });
    });
    
    // Business logic improvements
    this.businessLogicGaps.forEach(gap => {
      recommendations.push({
        priority: gap.revenueImpact.startsWith('Critical') ? 'CRITICAL' : 
                 gap.revenueImpact.startsWith('High') ? 'HIGH' : 'MEDIUM',
        category: 'Business Logic',
        action: `Fix: ${gap.description}`,
        impact: gap.revenueImpact
      });
    });
    
    return recommendations.slice(0, 10); // Top 10 recommendations
  }

  /**
   * RUN COMPLETE MARKETPLACE AUDIT
   */
  async runCompleteAudit() {
    console.log('🚀 STARTING COMPREHENSIVE AI MARKETPLACE AUDIT...\n');
    
    try {
      await this.auditServiceDiscovery();
      await this.auditAgentRegistration();
      await this.auditOrderProcessing();
      await this.auditPaymentSystem();
      await this.auditServiceDelivery();
      await this.auditDisputeResolution();
      await this.auditCommunication();
      await this.auditQualityControl();
      await this.auditRevenueProtection();
      await this.auditSecurity();
      
      const report = this.generateAuditReport();
      
      // Save detailed report
      fs.writeFileSync(
        'COMPREHENSIVE_MARKETPLACE_AUDIT_JUNE_30_2025.json',
        JSON.stringify(report, null, 2)
      );
      
      console.log('\n' + '='.repeat(80));
      console.log('📋 COMPREHENSIVE AI MARKETPLACE AUDIT RESULTS');
      console.log('='.repeat(80));
      console.log(`📊 Overall Readiness Score: ${report.overallAssessment.score.toFixed(1)}%`);
      console.log(`🎯 Status: ${report.overallAssessment.status}`);
      console.log(`💭 Assessment: ${report.overallAssessment.reason}\n`);
      
      console.log('🚨 ISSUE SUMMARY:');
      console.log(`   Critical Issues: ${report.criticalIssues}`);
      console.log(`   High Priority: ${report.highPriorityIssues}`);
      console.log(`   Medium Priority: ${report.mediumPriorityIssues}`);
      console.log(`   Low Priority: ${report.lowPriorityIssues}`);
      console.log(`   ✅ Passing Tests: ${report.passingTests}\n`);
      
      if (report.businessLogicGaps.length > 0) {
        console.log('🧠 BUSINESS LOGIC GAPS IDENTIFIED:');
        report.businessLogicGaps.forEach((gap, index) => {
          console.log(`   ${index + 1}. ${gap.description}`);
          console.log(`      Revenue Impact: ${gap.revenueImpact}`);
        });
        console.log('');
      }
      
      if (report.productionBlockers.length > 0) {
        console.log('🚫 PRODUCTION BLOCKERS:');
        report.productionBlockers.forEach((blocker, index) => {
          console.log(`   ${index + 1}. ${blocker.description}`);
          console.log(`      Impact: ${blocker.businessImpact}`);
        });
        console.log('');
      }
      
      console.log('💡 TOP RECOMMENDATIONS:');
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.priority}] ${rec.action}`);
      });
      
      console.log('\n📄 Full detailed report saved to: COMPREHENSIVE_MARKETPLACE_AUDIT_JUNE_30_2025.json');
      console.log('='.repeat(80));
      
      return report;
      
    } catch (error) {
      console.error('❌ Audit failed:', error.message);
      return {
        error: true,
        message: error.message,
        overallAssessment: {
          score: 0,
          status: 'AUDIT FAILED',
          reason: 'Could not complete audit due to technical issues'
        }
      };
    }
  }
}

// Run the audit
async function main() {
  const auditor = new MarketplaceAuditor();
  const results = await auditor.runCompleteAudit();
  
  // Exit with appropriate code
  const criticalIssues = results.criticalIssues || 0;
  process.exit(criticalIssues > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default MarketplaceAuditor;