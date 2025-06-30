/**
 * COMPREHENSIVE AI MARKETPLACE USER FLOW AUDIT
 * Analyzes all critical user journeys, security vulnerabilities, and business logic gaps
 * Focus: Complete end-to-end user experience validation
 */

class AIMarketplaceUserFlowAuditor {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.vulnerabilities = [];
    this.gaps = [];
    this.recommendations = [];
    this.results = {
      totalFlows: 0,
      passedFlows: 0,
      criticalIssues: 0,
      moderateIssues: 0,
      lowIssues: 0
    };
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        }
      };
      
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const responseData = await response.text();
      
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch (e) {
        parsedData = { raw: responseData };
      }
      
      return {
        status: response.status,
        ok: response.ok,
        data: parsedData,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      return {
        status: 0,
        ok: false,
        error: error.message,
        data: null
      };
    }
  }

  recordVulnerability(severity, category, description, exploitability, impact) {
    this.vulnerabilities.push({
      severity, // CRITICAL, HIGH, MEDIUM, LOW
      category,
      description,
      exploitability, // How easy to exploit (1-10)
      impact, // Business impact (1-10)
      timestamp: new Date().toISOString()
    });
    
    if (severity === 'CRITICAL') this.results.criticalIssues++;
    else if (severity === 'HIGH') this.results.moderateIssues++;
    else this.results.lowIssues++;
  }

  recordGap(category, description, userImpact, businessImpact) {
    this.gaps.push({
      category,
      description,
      userImpact, // User experience impact (1-10)
      businessImpact, // Revenue/business impact (1-10)
      timestamp: new Date().toISOString()
    });
  }

  recordRecommendation(priority, category, description, implementation) {
    this.recommendations.push({
      priority, // HIGH, MEDIUM, LOW
      category,
      description,
      implementation,
      timestamp: new Date().toISOString()
    });
  }

  async testFlow(flowName, testFunction) {
    console.log(`\n🔍 Testing Flow: ${flowName}`);
    this.results.totalFlows++;
    
    try {
      const passed = await testFunction.call(this);
      if (passed) {
        this.results.passedFlows++;
        console.log(`✅ ${flowName}: PASSED`);
      } else {
        console.log(`❌ ${flowName}: FAILED`);
      }
      return passed;
    } catch (error) {
      console.log(`💥 ${flowName}: ERROR - ${error.message}`);
      this.recordVulnerability('HIGH', 'System Error', `Flow test crashed: ${error.message}`, 3, 7);
      return false;
    }
  }

  /**
   * 1. CUSTOMER DISCOVERY AND BROWSING FLOW
   */
  async auditCustomerDiscoveryFlow() {
    return await this.testFlow('Customer Discovery & Browsing', async () => {
      // Test marketplace page loading
      const marketplaceLoad = await this.makeRequest('GET', '/ai-marketplace');
      if (!marketplaceLoad.ok) {
        this.recordVulnerability('HIGH', 'Availability', 'Marketplace page fails to load', 8, 9);
        return false;
      }

      // Test agent search functionality
      const agentSearch = await this.makeRequest('GET', '/api/ai-agents/search?category=all&page=1&limit=10');
      if (!agentSearch.ok) {
        this.recordVulnerability('HIGH', 'Core Functionality', 'Agent search endpoint not working', 7, 8);
        return false;
      }

      // Test search filtering
      const filteredSearch = await this.makeRequest('GET', '/api/ai-agents/search?category=data-analysis&skills=python&minRating=4');
      if (!filteredSearch.ok) {
        this.recordGap('Search', 'Advanced filtering not working', 6, 7);
      }

      // Test pagination
      const paginationTest = await this.makeRequest('GET', '/api/ai-agents/search?page=999&limit=10');
      if (paginationTest.ok && paginationTest.data?.agents?.length > 0) {
        this.recordVulnerability('MEDIUM', 'Input Validation', 'Pagination allows invalid page numbers', 4, 3);
      }

      // Test malicious search inputs
      const xssTest = await this.makeRequest('GET', '/api/ai-agents/search?query=<script>alert("xss")</script>');
      if (xssTest.ok && xssTest.data?.raw?.includes('<script>')) {
        this.recordVulnerability('CRITICAL', 'XSS', 'Search endpoint vulnerable to XSS attacks', 9, 8);
      }

      return true;
    });
  }

  /**
   * 2. CUSTOMER REGISTRATION AND ONBOARDING FLOW
   */
  async auditCustomerRegistrationFlow() {
    return await this.testFlow('Customer Registration & Onboarding', async () => {
      // Test authentication status check
      const authStatus = await this.makeRequest('GET', '/api/auth/status');
      if (!authStatus.ok) {
        this.recordGap('Authentication', 'Auth status endpoint not available', 5, 6);
      }

      // Test user registration endpoint
      const testUser = {
        email: 'testuser@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const registration = await this.makeRequest('POST', '/api/auth/register', testUser);
      if (!registration.ok) {
        this.recordGap('Registration', 'User registration endpoint not working', 8, 9);
      }

      // Test duplicate registration
      const duplicateReg = await this.makeRequest('POST', '/api/auth/register', testUser);
      if (duplicateReg.ok && duplicateReg.status !== 409) {
        this.recordVulnerability('MEDIUM', 'Data Integrity', 'Duplicate user registration not prevented', 5, 4);
      }

      // Test weak password validation
      const weakPasswordUser = { ...testUser, password: '123' };
      const weakPassReg = await this.makeRequest('POST', '/api/auth/register', weakPasswordUser);
      if (weakPassReg.ok) {
        this.recordVulnerability('MEDIUM', 'Security', 'Weak password validation allows insecure passwords', 6, 5);
      }

      return true;
    });
  }

  /**
   * 3. SERVICE ORDERING AND PAYMENT FLOW
   */
  async auditServiceOrderingFlow() {
    return await this.testFlow('Service Ordering & Payment', async () => {
      // Test order creation without authentication
      const unauthOrder = await this.makeRequest('POST', '/api/ai-agents/create-order', {
        agentId: 'test-agent-1',
        serviceDescription: 'Data analysis task',
        amount: 100
      });

      if (unauthOrder.ok) {
        this.recordVulnerability('CRITICAL', 'Authentication', 'Orders can be created without authentication', 9, 10);
      }

      // Test order creation with invalid agent
      const invalidAgentOrder = await this.makeRequest('POST', '/api/ai-agents/create-order', {
        agentId: 'nonexistent-agent',
        serviceDescription: 'Test service',
        amount: 50
      });

      if (invalidAgentOrder.ok) {
        this.recordVulnerability('HIGH', 'Business Logic', 'Orders accepted for nonexistent agents', 7, 8);
      }

      // Test negative amount order
      const negativeAmountOrder = await this.makeRequest('POST', '/api/ai-agents/create-order', {
        agentId: 'test-agent-1',
        serviceDescription: 'Test service',
        amount: -100
      });

      if (negativeAmountOrder.ok) {
        this.recordVulnerability('CRITICAL', 'Financial', 'Negative amount orders accepted', 8, 10);
      }

      // Test extremely large order
      const largeOrder = await this.makeRequest('POST', '/api/ai-agents/create-order', {
        agentId: 'test-agent-1',
        serviceDescription: 'Test service',
        amount: 999999999
      });

      if (largeOrder.ok) {
        this.recordVulnerability('HIGH', 'Financial', 'No maximum order amount validation', 6, 8);
      }

      // Test payment method validation
      const paymentMethods = await this.makeRequest('GET', '/api/payment-methods');
      if (!paymentMethods.ok) {
        this.recordGap('Payment', 'Payment methods endpoint not available', 7, 8);
      }

      return true;
    });
  }

  /**
   * 4. AGENT REGISTRATION AND ONBOARDING FLOW
   */
  async auditAgentRegistrationFlow() {
    return await this.testFlow('Agent Registration & Onboarding', async () => {
      // Test human agent registration
      const humanAgent = {
        name: 'Test Human Agent',
        email: 'agent@example.com',
        skills: ['data analysis', 'python'],
        description: 'Professional data analyst',
        pricing: 50,
        category: 'data-analysis'
      };

      const humanRegister = await this.makeRequest('POST', '/api/ai-agents/register-human', humanAgent);
      if (!humanRegister.ok) {
        this.recordGap('Agent Onboarding', 'Human agent registration not working', 8, 9);
      }

      // Test AI agent self-registration
      const aiAgent = {
        name: 'Test AI Agent',
        capabilities: ['natural language processing', 'sentiment analysis'],
        apiEndpoint: 'https://example.com/api',
        description: 'AI-powered text analysis',
        pricing: 25,
        category: 'ai-services'
      };

      const aiRegister = await this.makeRequest('POST', '/api/ai-agents/register-ai', aiAgent);
      if (!aiRegister.ok) {
        this.recordGap('Agent Onboarding', 'AI agent registration not working', 8, 9);
      }

      // Test agent registration with malicious endpoint
      const maliciousAgent = {
        ...aiAgent,
        apiEndpoint: 'javascript:alert("xss")',
        name: '<script>alert("xss")</script>'
      };

      const maliciousRegister = await this.makeRequest('POST', '/api/ai-agents/register-ai', maliciousAgent);
      if (maliciousRegister.ok) {
        this.recordVulnerability('HIGH', 'XSS/Injection', 'Agent registration accepts malicious data', 7, 6);
      }

      // Test duplicate agent registration
      const duplicateAgent = await this.makeRequest('POST', '/api/ai-agents/register-human', humanAgent);
      if (duplicateAgent.ok) {
        this.recordVulnerability('MEDIUM', 'Data Integrity', 'Duplicate agent registration not prevented', 5, 4);
      }

      return true;
    });
  }

  /**
   * 5. SERVICE DELIVERY AND COMMUNICATION FLOW
   */
  async auditServiceDeliveryFlow() {
    return await this.testFlow('Service Delivery & Communication', async () => {
      // Test file upload capability
      const deliveryInit = await this.makeRequest('POST', '/api/service-delivery/initiate', {
        orderId: 'test-order-1',
        agentId: 'test-agent-1'
      });

      if (!deliveryInit.ok) {
        this.recordGap('Service Delivery', 'Delivery initiation not working', 8, 9);
      }

      // Test file upload endpoint
      const fileUpload = await this.makeRequest('POST', '/api/upload', {
        orderId: 'test-order-1',
        file: 'test-content',
        filename: 'test.txt'
      });

      if (!fileUpload.ok) {
        this.recordGap('File Upload', 'File upload endpoint not working', 7, 8);
      }

      // Test malicious file upload
      const maliciousFile = await this.makeRequest('POST', '/api/upload', {
        orderId: 'test-order-1',
        file: '<?php system($_GET["cmd"]); ?>',
        filename: 'malicious.php'
      });

      if (maliciousFile.ok) {
        this.recordVulnerability('CRITICAL', 'File Upload', 'Malicious file uploads not blocked', 9, 9);
      }

      // Test oversized file upload
      const largeFile = 'x'.repeat(100 * 1024 * 1024); // 100MB
      const largeUpload = await this.makeRequest('POST', '/api/upload', {
        orderId: 'test-order-1',
        file: largeFile,
        filename: 'large.txt'
      });

      if (largeUpload.ok) {
        this.recordVulnerability('MEDIUM', 'Resource Abuse', 'No file size limits enforced', 6, 5);
      }

      // Test customer-agent chat
      const chatMessage = await this.makeRequest('POST', '/api/chat/send', {
        orderId: 'test-order-1',
        message: 'Hello, how is the work progressing?',
        sender: 'customer'
      });

      if (!chatMessage.ok) {
        this.recordGap('Communication', 'Chat system not working', 6, 7);
      }

      return true;
    });
  }

  /**
   * 6. DISPUTE RESOLUTION FLOW
   */
  async auditDisputeResolutionFlow() {
    return await this.testFlow('Dispute Resolution', async () => {
      // Test dispute creation
      const dispute = await this.makeRequest('POST', '/api/disputes/create', {
        orderId: 'test-order-1',
        reason: 'Service not delivered as promised',
        evidence: 'Screenshots and communication logs'
      });

      if (!dispute.ok) {
        this.recordGap('Dispute System', 'Dispute creation not working', 9, 8);
      }

      // Test dispute without evidence
      const noEvidenceDispute = await this.makeRequest('POST', '/api/disputes/create', {
        orderId: 'test-order-2',
        reason: 'Just want my money back'
      });

      if (noEvidenceDispute.ok) {
        this.recordVulnerability('MEDIUM', 'Business Logic', 'Disputes accepted without evidence', 7, 6);
      }

      // Test multiple disputes for same order
      const duplicateDispute = await this.makeRequest('POST', '/api/disputes/create', {
        orderId: 'test-order-1',
        reason: 'Another complaint about same order'
      });

      if (duplicateDispute.ok) {
        this.recordVulnerability('MEDIUM', 'Business Logic', 'Multiple disputes for same order allowed', 5, 5);
      }

      // Test dispute resolution
      const resolution = await this.makeRequest('POST', '/api/disputes/resolve', {
        disputeId: 'test-dispute-1',
        resolution: 'refund',
        adminNotes: 'Customer was right'
      });

      if (!resolution.ok) {
        this.recordGap('Dispute System', 'Dispute resolution not working', 8, 9);
      }

      return true;
    });
  }

  /**
   * 7. COMMISSION AND REVENUE FLOW
   */
  async auditCommissionFlow() {
    return await this.testFlow('Commission & Revenue', async () => {
      // Test commission calculation
      const commission = await this.makeRequest('POST', '/api/commission/calculate', {
        orderAmount: 100,
        agentTier: 'premium'
      });

      if (!commission.ok) {
        this.recordGap('Revenue System', 'Commission calculation not working', 7, 10);
      }

      // Test commission with invalid tier
      const invalidTier = await this.makeRequest('POST', '/api/commission/calculate', {
        orderAmount: 100,
        agentTier: 'nonexistent'
      });

      if (invalidTier.ok) {
        this.recordVulnerability('MEDIUM', 'Business Logic', 'Invalid agent tiers accepted', 4, 6);
      }

      // Test negative commission calculation
      const negativeCommission = await this.makeRequest('POST', '/api/commission/calculate', {
        orderAmount: -100,
        agentTier: 'basic'
      });

      if (negativeCommission.ok) {
        this.recordVulnerability('HIGH', 'Financial', 'Negative commission calculations allowed', 6, 9);
      }

      // Test agent payout
      const payout = await this.makeRequest('POST', '/api/agent/payout', {
        agentId: 'test-agent-1',
        amount: 85
      });

      if (!payout.ok) {
        this.recordGap('Payment System', 'Agent payout system not working', 8, 9);
      }

      return true;
    });
  }

  /**
   * 8. SECURITY AND FRAUD PREVENTION FLOW
   */
  async auditSecurityFlow() {
    return await this.testFlow('Security & Fraud Prevention', async () => {
      // Test rate limiting
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(this.makeRequest('GET', '/api/ai-agents/search'));
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      if (!rateLimited) {
        this.recordVulnerability('MEDIUM', 'Rate Limiting', 'No rate limiting on search endpoint', 6, 4);
      }

      // Test SQL injection attempts
      const sqlInjectionTests = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM sensitive_data"
      ];

      for (const injection of sqlInjectionTests) {
        const sqlTest = await this.makeRequest('GET', `/api/ai-agents/search?query=${encodeURIComponent(injection)}`);
        if (sqlTest.ok && sqlTest.data?.error?.includes('SQL')) {
          this.recordVulnerability('CRITICAL', 'SQL Injection', `SQL injection vulnerability: ${injection}`, 9, 10);
        }
      }

      // Test session management
      const sessionTest = await this.makeRequest('GET', '/api/auth/user');
      if (sessionTest.ok && !sessionTest.headers['set-cookie']) {
        this.recordVulnerability('MEDIUM', 'Session Security', 'Session cookies not properly managed', 5, 5);
      }

      // Test fraud detection
      const suspiciousOrder = await this.makeRequest('POST', '/api/ai-agents/create-order', {
        agentId: 'test-agent-1',
        serviceDescription: 'urgent help needed money transfer',
        amount: 10000
      });

      if (suspiciousOrder.ok) {
        this.recordGap('Fraud Prevention', 'No fraud detection for suspicious orders', 6, 7);
      }

      return true;
    });
  }

  /**
   * GENERATE COMPREHENSIVE AUDIT REPORT
   */
  generateComprehensiveReport() {
    const totalIssues = this.results.criticalIssues + this.results.moderateIssues + this.results.lowIssues;
    const successRate = Math.round((this.results.passedFlows / this.results.totalFlows) * 100);
    
    const report = {
      summary: {
        totalFlows: this.results.totalFlows,
        passedFlows: this.results.passedFlows,
        successRate: `${successRate}%`,
        totalIssues,
        breakdown: {
          critical: this.results.criticalIssues,
          high: this.results.moderateIssues,
          medium: this.results.lowIssues
        }
      },
      riskLevel: this.results.criticalIssues > 0 ? 'CRITICAL' : 
                 this.results.moderateIssues > 3 ? 'HIGH' : 
                 totalIssues > 5 ? 'MEDIUM' : 'LOW',
      vulnerabilities: this.vulnerabilities,
      gaps: this.gaps,
      recommendations: this.recommendations,
      priorityActions: this.vulnerabilities
        .filter(v => v.severity === 'CRITICAL')
        .map(v => ({
          action: `Fix ${v.category}: ${v.description}`,
          urgency: 'IMMEDIATE',
          businessImpact: v.impact
        })),
      auditTimestamp: new Date().toISOString()
    };

    return report;
  }

  async runCompleteUserFlowAudit() {
    console.log('🚀 Starting Comprehensive AI Marketplace User Flow Audit...\n');
    console.log('This audit will test all critical user journeys for security vulnerabilities,');
    console.log('business logic gaps, and user experience issues.\n');

    const flows = [
      this.auditCustomerDiscoveryFlow,
      this.auditCustomerRegistrationFlow,
      this.auditServiceOrderingFlow,
      this.auditAgentRegistrationFlow,
      this.auditServiceDeliveryFlow,
      this.auditDisputeResolutionFlow,
      this.auditCommissionFlow,
      this.auditSecurityFlow
    ];

    for (const flow of flows) {
      await flow.call(this);
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause between tests
    }

    const report = this.generateComprehensiveReport();
    
    console.log('\n📊 COMPREHENSIVE USER FLOW AUDIT COMPLETE');
    console.log('='.repeat(50));
    console.log(`✅ Flows Tested: ${report.summary.totalFlows}`);
    console.log(`✅ Success Rate: ${report.summary.successRate}`);
    console.log(`⚠️  Total Issues: ${report.summary.totalIssues}`);
    console.log(`🔴 Critical: ${report.summary.breakdown.critical}`);
    console.log(`🟡 High: ${report.summary.breakdown.high}`);
    console.log(`🟢 Medium: ${report.summary.breakdown.medium}`);
    console.log(`🏆 Risk Level: ${report.riskLevel}`);

    if (report.vulnerabilities.length > 0) {
      console.log('\n🔴 CRITICAL VULNERABILITIES FOUND:');
      report.vulnerabilities
        .filter(v => v.severity === 'CRITICAL')
        .forEach(v => {
          console.log(`   • ${v.category}: ${v.description}`);
        });
    }

    return report;
  }
}

async function main() {
  const auditor = new AIMarketplaceUserFlowAuditor();
  
  try {
    const report = await auditor.runCompleteUserFlowAudit();
    
    // Save report to file
    const { writeFileSync } = await import('fs');
    writeFileSync(
      'COMPREHENSIVE_MARKETPLACE_USER_FLOW_AUDIT_REPORT.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Full audit report saved to: COMPREHENSIVE_MARKETPLACE_USER_FLOW_AUDIT_REPORT.json');
    
  } catch (error) {
    console.error('💥 Audit failed:', error.message);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}