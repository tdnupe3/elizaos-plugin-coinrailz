import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Users, 
  CreditCard, 
  Bot,
  Shield,
  HelpCircle,
  Download,
  Upload,
  MessageSquare,
  Video,
  Settings
} from '@/lib/icons';

export default function Documentation() {
  const [activeSection, setActiveSection] = useState('sdk-overview');

  const sections = [
    { id: 'sdk-overview', title: 'SDK Overview', icon: <FileText className="w-4 h-4" /> },
    { id: 'sdk-quickstart', title: 'Quick Start', icon: <Users className="w-4 h-4" /> },
    { id: 'sdk-api-reference', title: 'API Reference', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'sdk-integration', title: 'Integration Guide', icon: <Bot className="w-4 h-4" /> },
    { id: 'sdk-examples', title: 'Code Examples', icon: <Download className="w-4 h-4" /> },
    { id: 'sdk-testing', title: 'Testing & Debugging', icon: <Settings className="w-4 h-4" /> },
    { id: 'support', title: 'Support & Help', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            @coinrailz/agent-payments SDK Documentation
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Complete developer guide for integrating payments into AI agents
          </p>
          <div className="mt-4 flex gap-3">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Production Ready
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Circle USDC Integrated
            </Badge>
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              TypeScript SDK
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                        activeSection === section.id
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {section.icon}
                      {section.title}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <ScrollArea className="h-[600px] w-full">
                  {activeSection === 'sdk-overview' && <SDKOverviewSection />}
                  {activeSection === 'sdk-quickstart' && <SDKQuickStartSection />}
                  {activeSection === 'sdk-api-reference' && <SDKAPIReferenceSection />}
                  {activeSection === 'sdk-integration' && <SDKIntegrationSection />}
                  {activeSection === 'sdk-examples' && <SDKExamplesSection />}
                  {activeSection === 'sdk-testing' && <SDKTestingSection />}
                  {activeSection === 'support' && <SupportSection />}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SDKOverviewSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">@coinrailz/agent-payments SDK</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Production-ready payment infrastructure for AI agents. Built on Circle USDC and Coinbase CDP 
          with enterprise-grade security, instant settlements, and competitive pricing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🏆 Competitive Advantages</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700">0.99% fees (vs Stripe 2.9%)</Badge>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">Instant USDC settlements</Badge>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-50 text-purple-700">Multi-chain support</Badge>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-50 text-orange-700">AI-native features</Badge>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="bg-gray-50 text-gray-700">TypeScript SDK</Badge>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">💰 Pricing Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>• <strong>Early Adopter:</strong> 0.99% + $0.05</li>
              <li>• <strong>Standard:</strong> 1.75% + $0.10</li>
              <li>• <strong>Volume:</strong> 1.25% + $0.10</li>
              <li>• <strong>Enterprise:</strong> 0.6% + $0.10 + $2K/mo</li>
            </ul>
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
              <strong>🎯 Market Position:</strong> Up to 83% cheaper than Stripe
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SDKQuickStartSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Quick Start Guide</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Get your AI agent accepting payments in under 5 minutes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📦 1. Installation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <pre className="text-green-400 text-sm">
{`npm install @coinrailz/agent-payments
# or
yarn add @coinrailz/agent-payments`}
            </pre>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Requirements:</p>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Node.js 16+, TypeScript support recommended
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔑 2. API Keys Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 list-decimal list-inside mb-4">
            <li>Get Circle API key from <a href="https://console.circle.com" className="text-blue-600 underline">Circle Console</a></li>
            <li>Get Coinbase CDP credentials from <a href="https://portal.cdp.coinbase.com" className="text-blue-600 underline">CDP Portal</a></li>
            <li>Contact us for Coin Railz SDK key (instant approval)</li>
          </ol>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-green-400 text-sm">
{`# .env file
# ⚠️ SERVER-SIDE ENVIRONMENT VARIABLES ONLY
# NEVER expose these to client/browser code
CIRCLE_API_KEY=your_circle_api_key         # PRIVATE - SERVER ONLY
CDP_API_KEY_ID=your_cdp_api_key_id        # PRIVATE - SERVER ONLY  
CDP_PRIVATE_KEY=your_cdp_private_key      # PRIVATE - SERVER ONLY
COINRAILZ_SDK_KEY=your_sdk_key`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚡ 3. First Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-green-400 text-sm overflow-x-auto">
{`import { createAgentPayments } from '@coinrailz/agent-payments';

// ⚠️ SERVER-SIDE ONLY - DO NOT USE IN CLIENT/BROWSER CODE
const payments = createAgentPayments({
  circleApiKey: 'your_circle_api_key_here',        // Replace with your Circle API key
  cdpApiKey: 'your_cdp_api_key_here',             // Replace with your CDP API key  
  cdpPrivateKey: 'your_cdp_private_key_here',     // Replace with your CDP private key - NEVER CLIENT
  sdkKey: 'your_coinrailz_sdk_key_here'           // Replace with your SDK key
});

// Create payment for AI service
const payment = await payments.createPayment({
  amount: 25.00,
  agentId: 'my-ai-agent-v1',
  serviceDescription: 'AI data analysis and report'
});

console.log('Payment created:', payment.paymentId);
console.log('Send USDC to:', payment.walletAddress);`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SDKAPIReferenceSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">API Reference</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Complete reference for all SDK methods and endpoints.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💳 createPayment()</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Creates a new payment request with auto-generated Circle wallet.</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`// Method signature
createPayment({
  amount: number,           // USD amount (e.g., 25.00)
  agentId: string,         // Your AI agent identifier
  serviceDescription: string, // What service is being paid for
  pricingTier?: 'early_adopter' | 'standard' | 'volume' | 'enterprise'
}): Promise<PaymentResponse>

// Response
{
  success: true,
  paymentId: string,       // Unique payment identifier
  walletAddress: string,   // Circle wallet for USDC deposits
  amount: number,          // Original amount
  platformFee: number,     // Our fee amount
  feeRate: string,         // Fee percentage applied
  netAmount: number,       // Amount agent receives
  status: 'pending',       // Payment status
  agentCommission: number  // Agent's cut after fees
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📊 getPaymentStatus()</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Check the current status of a payment.</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`// Method signature
getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse>

// Response
{
  success: true,
  paymentId: string,
  walletAddress: string,
  amount: number,
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💰 getAgentEarnings()</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Retrieve total earnings for an agent.</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`// Method signature
getAgentEarnings(agentId: string): Promise<EarningsResponse>

// Response
{
  totalEarnings: number,    // Total gross earnings
  platformFee: number,      // Total fees paid
  netEarnings: number,      // Net amount after fees
  transactionCount: number  // Number of transactions
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SDKIntegrationSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Integration Guide</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Step-by-step integration for different AI frameworks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🤖 OpenAI GPT Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-green-400 text-sm overflow-x-auto">
{`import OpenAI from 'openai';
import { createAgentPayments } from '@coinrailz/agent-payments';

// ⚠️ SERVER-SIDE ONLY
const openai = new OpenAI({ apiKey: 'your_openai_api_key_here' });
const payments = createAgentPayments({ /* your config */ });

class PaidGPTAgent {
  async processRequest(userMessage, paymentAmount = 10) {
    // 1. Create payment first
    const payment = await payments.createPayment({
      amount: paymentAmount,
      agentId: 'gpt-agent-v1',
      serviceDescription: 'GPT analysis: ' + userMessage.slice(0, 50) + '...'
    });
    
    // 2. Return payment info to user
    if (!payment.success) {
      throw new Error('Payment creation failed');
    }
    
    console.log('Payment created:', payment.paymentId);
    console.log('Send USDC to:', payment.walletAddress);
    
    return {
      paymentRequired: true,
      paymentDetails: payment
    };
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🚀 Express.js Webhook Handler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-green-400 text-sm overflow-x-auto">
{`import express from 'express';
import { createAgentPayments } from '@coinrailz/agent-payments';

const app = express();
const payments = createAgentPayments({ /* config */ });

// Webhook to handle payment completions
app.post('/webhook/payment-completed', async (req, res) => {
  const { paymentId, agentId, amount } = req.body;
  
  try {
    // Verify payment status
    const status = await payments.getPaymentStatus(paymentId);
    
    if (status.status === 'completed') {
      // Trigger your AI agent processing
      await processAgentTask(agentId, paymentId);
      
      res.json({ success: true, message: 'Payment processed' });
    } else {
      res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SDKExamplesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Code Examples</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Production-ready examples for common use cases.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💎 Premium AI Service</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">High-value AI service with tiered pricing</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`class PremiumAIService {
  constructor() {
    // ⚠️ SERVER-SIDE ONLY - DO NOT USE IN BROWSER
    this.payments = createAgentPayments({
      circleApiKey: 'your_circle_api_key_here',   // Replace with your Circle API key
      cdpApiKey: 'your_cdp_api_key_here',         // Replace with your CDP API key
      sdkKey: 'your_coinrailz_sdk_key_here'       // Replace with your SDK key
    });
  }
  
  async createAnalysisOrder(analysisType, dataSize) {
    const pricing = {
      'basic': 25,
      'advanced': 75,
      'enterprise': 200
    };
    
    const amount = pricing[analysisType] || 25;
    
    const payment = await this.payments.createPayment({
      amount,
      agentId: 'premium-ai-analyst-v3',
      serviceDescription: analysisType + ' data analysis (' + dataSize + ')',
      pricingTier: amount > 100 ? 'volume' : 'standard'
    });
    
    if (payment.success) {
      return {
        orderId: payment.paymentId,
        paymentInstructions: {
          walletAddress: payment.walletAddress,
          amount: payment.amount,
          feeRate: payment.feeRate,
          currency: 'USDC'
        }
      };
    }
    
    throw new Error('Payment creation failed');
  }
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚡ Micro-Payment AI Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Small payments for quick AI tasks</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`class MicroPaymentAI {
  constructor() {
    this.payments = createAgentPayments({ /* config */ });
    this.taskPricing = {
      'text_summary': 0.50,
      'image_analysis': 1.00,
      'translation': 0.75,
      'sentiment_analysis': 0.25
    };
  }
  
  async executeTask(taskType, data) {
    const amount = this.taskPricing[taskType] || 1.00;
    
    // For micro-payments, use early_adopter tier (0.99%)
    const payment = await this.payments.createPayment({
      amount,
      agentId: 'micro-ai-' + taskType,
      serviceDescription: 'AI ' + taskType.replace('_', ' '),
      pricingTier: 'early_adopter'  // Lowest fees for small amounts
    });
    
    if (payment.success) {
      return {
        taskId: payment.paymentId,
        cost: payment.amount,
        platformFee: payment.platformFee,
        netCost: payment.netAmount,
        paymentAddress: payment.walletAddress
      };
    }
  }
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SDKTestingSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Testing & Debugging</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Tools and techniques for testing your SDK integration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🧪 Test Environment Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Use Circle Sandbox for development testing</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`// .env.development
CIRCLE_API_KEY=TEST_API_KEY_SANDBOX
CDP_API_KEY_ID=sandbox_key_id
CDP_PRIVATE_KEY=sandbox_private_key
COINRAILZ_SDK_KEY=test_sdk_key

// Test configuration
const payments = createAgentPayments({
  circleApiKey: 'test_circle_api_key_sandbox',
  cdpApiKey: 'test_cdp_api_key_sandbox',
  cdpPrivateKey: 'test_cdp_private_key_sandbox',
  sdkKey: 'test_coinrailz_sdk_key',
  testMode: true  // Enables sandbox mode
});`}
              </pre>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Sandbox Mode:</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Test payments don't involve real money. Use sandbox USDC for testing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 Error Handling</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Comprehensive error handling examples</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`async function createPaymentWithErrorHandling(amount, agentId) {
  try {
    const payment = await payments.createPayment({
      amount,
      agentId,
      serviceDescription: 'Test payment'
    });
    
    if (!payment.success) {
      console.error('Payment creation failed:', payment.error);
      return null;
    }
    
    return payment;
    
  } catch (error) {
    // Handle different error types
    if (error.code === 'INVALID_API_KEY') {
      console.error('SDK API key is invalid or expired');
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error('Insufficient funds in Circle account');
    } else {
      console.error('Unexpected error:', error.message);
    }
    
    return null;
  }
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SupportSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Support & Help</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🚀 Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="font-medium">SDK Support</p>
              <p className="text-sm text-gray-600">Contact our developer team for integration help</p>
              <Button className="mt-2" size="sm">Email: sdk@coinrailz.com</Button>
            </div>
            <div>
              <p className="font-medium">Live Documentation</p>
              <p className="text-sm text-gray-600">Interactive API explorer and examples</p>
            </div>
            <div>
              <p className="font-medium">GitHub Repository</p>
              <p className="text-sm text-gray-600">Open source examples and issue tracking</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📞 Enterprise Support</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>• Priority integration assistance</li>
            <li>• Custom development support</li>
            <li>• Dedicated account management</li>
            <li>• SLA guarantees for Enterprise tier</li>
          </ul>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Enterprise Customers:</p>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Get white-glove support with dedicated infrastructure and custom integrations.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💰 Billing & Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-medium">Transparent Fees</p>
              <p className="text-sm text-gray-600">No hidden charges - see exact fees before each transaction</p>
            </div>
            <div>
              <p className="font-medium">Volume Discounts</p>
              <p className="text-sm text-gray-600">Automatic tier upgrades as your volume grows</p>
            </div>
            <div>
              <p className="font-medium">No Setup Fees</p>
              <p className="text-sm text-gray-600">Start processing payments immediately with no upfront costs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}