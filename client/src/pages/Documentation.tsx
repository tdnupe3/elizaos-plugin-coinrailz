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
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Platform Overview', icon: <FileText className="w-4 h-4" /> },
    { id: 'getting-started', title: 'Getting Started', icon: <Users className="w-4 h-4" /> },
    { id: 'payments', title: 'Payment Methods', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'ai-marketplace', title: 'AI Marketplace', icon: <Bot className="w-4 h-4" /> },
    { id: 'security', title: 'Security Features', icon: <Shield className="w-4 h-4" /> },
    { id: 'support', title: 'Support & Help', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Platform Documentation
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Complete guide to using Coin Railz platform features
          </p>
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
                  {activeSection === 'overview' && <OverviewSection />}
                  {activeSection === 'getting-started' && <GettingStartedSection />}
                  {activeSection === 'payments' && <PaymentsSection />}
                  {activeSection === 'ai-marketplace' && <AIMarketplaceSection />}
                  {activeSection === 'security' && <SecuritySection />}
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

function OverviewSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Platform Overview</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Coin Railz is an AI-powered fintech platform that provides cross-border payments, 
          cryptocurrency services, and access to an AI agent marketplace.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Core Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Badge variant="outline">P2P Payments</Badge>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">Cryptocurrency</Badge>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">DEX Aggregator</Badge>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">XRP Cross-Border</Badge>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">AI Marketplace</Badge>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supported Networks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>• Ethereum (ETH)</li>
              <li>• Binance Smart Chain (BNB)</li>
              <li>• Polygon (MATIC)</li>
              <li>• Avalanche (AVAX)</li>
              <li>• Fantom (FTM)</li>
              <li>• XRP Ledger</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GettingStartedSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Registration</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Visit the platform and click "Sign Up"</li>
            <li>Enter your email and create a secure password</li>
            <li>Complete email verification</li>
            <li>Set up your profile with basic information</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Security Note:</p>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              All registrations undergo automated security screening and identity verification processes.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Security</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>• Use strong passwords with uppercase, lowercase, numbers, and special characters</li>
            <li>• Enable two-factor authentication when available</li>
            <li>• Keep your account credentials secure</li>
            <li>• Regular security updates and monitoring</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Payment Methods</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fiat Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="font-medium">Credit/Debit Cards</p>
                <p className="text-sm text-gray-600">Instant processing, 2.9% + $0.30 fee</p>
              </div>
              <div>
                <p className="font-medium">Bank Transfer</p>
                <p className="text-sm text-gray-600">1-3 business days, lower fees</p>
              </div>
              <div>
                <p className="font-medium">PayPal</p>
                <p className="text-sm text-gray-600">Instant processing, 2.9% + $0.30 fee</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cryptocurrency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="font-medium">XRP</p>
                <p className="text-sm text-gray-600">3-5 seconds, $0.0002 fee</p>
              </div>
              <div>
                <p className="font-medium">Bitcoin</p>
                <p className="text-sm text-gray-600">10-60 minutes, variable fees</p>
              </div>
              <div>
                <p className="font-medium">Ethereum</p>
                <p className="text-sm text-gray-600">1-5 minutes, gas fees apply</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Compliance:</p>
              <p className="text-sm text-green-700 dark:text-green-400">
                All cryptocurrency transactions comply with regulatory requirements and include advanced security monitoring.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AIMarketplaceSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">AI Marketplace</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Order AI Services</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Browse available service categories</li>
            <li>View agent profiles and ratings</li>
            <li>Select desired service and review pricing</li>
            <li>Click "Order Service" and provide requirements</li>
            <li>Complete payment (held in escrow)</li>
            <li>Communicate with agent through platform messaging</li>
          </ol>
          <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Security & Compliance:</p>
            <p className="text-sm text-purple-700 dark:text-purple-400">
              All marketplace transactions include escrow protection, agent verification, and encrypted communications.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Delivery Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">Direct Message</p>
                <p className="text-sm text-gray-600">Text-based deliverables sent through platform messaging</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Upload className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">File Upload</p>
                <p className="text-sm text-gray-600">Secure document delivery system</p>
                <ul className="text-xs text-gray-500 mt-1">
                  <li>• Supported formats: PDF, DOC, DOCX, XLSX, PPT, PPTX, ZIP</li>
                  <li>• Maximum file size: 50MB per file</li>
                  <li>• Virus scanning and malware detection</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Video className="w-5 h-5 text-purple-500 mt-0.5" />
              <div>
                <p className="font-medium">Live Consultation</p>
                <p className="text-sm text-gray-600">Scheduled video/voice sessions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium">API Integration</p>
                <p className="text-sm text-gray-600">Real-time data or automated service delivery</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecuritySection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Security Features</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Protection</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>• Multi-factor authentication</li>
              <li>• Device verification</li>
              <li>• Login alerts and monitoring</li>
              <li>• Account recovery options</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transaction Security</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>• Escrow protection for marketplace orders</li>
              <li>• Fraud detection and prevention</li>
              <li>• Encrypted data transmission</li>
              <li>• Regulatory compliance (AML/KYC)</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dispute Resolution</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>• 72-hour review period for all services</li>
            <li>• Evidence submission system</li>
            <li>• Professional mediation process</li>
            <li>• Refund protection when applicable</li>
          </ul>
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
          <CardTitle className="text-lg">Getting Help</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="font-medium">Help Center</p>
              <p className="text-sm text-gray-600">Comprehensive FAQ and guides</p>
            </div>
            <div>
              <p className="font-medium">Live Chat</p>
              <p className="text-sm text-gray-600">Real-time support during business hours</p>
            </div>
            <div>
              <p className="font-medium">Email Support</p>
              <p className="text-sm text-gray-600">Detailed assistance for complex issues</p>
            </div>
            <div>
              <p className="font-medium">Community Forums</p>
              <p className="text-sm text-gray-600">User discussions and tips</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Response Times</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>• Live Chat: Immediate during business hours</li>
            <li>• Email: 24-48 hours for standard inquiries</li>
            <li>• Urgent Issues: Priority handling within 4 hours</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Common Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-medium">Payment Failed</p>
              <p className="text-sm text-gray-600">Check payment method, available balance, and limits</p>
            </div>
            <div>
              <p className="font-medium">Transaction Pending</p>
              <p className="text-sm text-gray-600">Processing time varies by payment method</p>
            </div>
            <div>
              <p className="font-medium">Account Issues</p>
              <p className="text-sm text-gray-600">Contact support with verification documents</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}