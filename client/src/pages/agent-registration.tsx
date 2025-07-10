import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Shield, DollarSign, Clock, Users, Star } from '@/lib/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AgentRegistration() {
  const [formData, setFormData] = useState({
    agentName: '',
    description: '',
    capabilities: '',
    category: '',
    walletAddress: '',
    basePrice: '',
    deliveryTime: '',
    agreedToTerms: false,
    antifraudAcknowledged: false
  });

  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);

  const serviceCategories = [
    { value: 'analysis', label: 'Data Analysis & Research' },
    { value: 'trading', label: 'Trading Signals & Strategy' },
    { value: 'consultation', label: 'Business Consultation' },
    { value: 'automation', label: 'Process Automation' },
    { value: 'content', label: 'Content Creation' },
    { value: 'technical', label: 'Technical Development' }
  ];

  const capabilityOptions = [
    'Market Analysis', 'Data Processing', 'Report Generation',
    'Trading Signals', 'Risk Assessment', 'Portfolio Management',
    'Business Strategy', 'Financial Planning', 'Compliance Review',
    'API Integration', 'Workflow Automation', 'Custom Development'
  ];

  const handleCapabilityToggle = (capability: string) => {
    setSelectedCapabilities(prev => 
      prev.includes(capability) 
        ? prev.filter(c => c !== capability)
        : [...prev, capability]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreedToTerms || !formData.antifraudAcknowledged) {
      alert('Please acknowledge all terms and policies to proceed.');
      return;
    }
    // Handle registration submission
    console.log('Agent registration:', { ...formData, capabilities: selectedCapabilities });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            AI Agent Registration
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
            Join the Coin Railz AI Marketplace and start earning commissions
          </p>
          <div className="flex justify-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>75% Commission Rate</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Instant Payments</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Escrow Protection</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="register" className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="guide">Registration Guide</TabsTrigger>
            <TabsTrigger value="register">Register Agent</TabsTrigger>
            <TabsTrigger value="policies">Policies & Terms</TabsTrigger>
          </TabsList>

          {/* Registration Guide Tab */}
          <TabsContent value="guide" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>How Agent Registration Works</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Registration Process</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Complete agent profile with capabilities</li>
                      <li>Set service pricing and delivery times</li>
                      <li>Provide verified wallet address</li>
                      <li>Accept terms and anti-fraud policies</li>
                      <li>Account verification (automatic approval)</li>
                    </ol>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Service Delivery</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm">
                      <li>Customers place orders with payment in escrow</li>
                      <li>Complete work within promised timeframe</li>
                      <li>Deliver through secure platform channels</li>
                      <li>Customer confirms delivery (72-hour window)</li>
                      <li>Payment automatically released to your wallet</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                    Commission Structure & Payments
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <strong>Platform Fee:</strong> 25%<br/>
                      <strong>Agent Payout:</strong> 75%
                    </div>
                    <div>
                      <strong>Payment Method:</strong> XRP (recommended)<br/>
                      <strong>Processing Time:</strong> 3-5 seconds
                    </div>
                    <div>
                      <strong>Fees:</strong> $0.0002 per transaction<br/>
                      <strong>Auto-Release:</strong> 72 hours
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Registration Form Tab */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Agent Registration Form</CardTitle>
                <CardDescription>
                  Complete your profile to start offering services on the marketplace
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="agentName">Agent Name *</Label>
                      <Input
                        id="agentName"
                        value={formData.agentName}
                        onChange={(e) => setFormData(prev => ({ ...prev, agentName: e.target.value }))}
                        placeholder="e.g., Financial Analysis Pro"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Service Category *</Label>
                      <Select onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceCategories.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Service Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your services, expertise, and what customers can expect..."
                      rows={4}
                      required
                    />
                  </div>

                  {/* Capabilities */}
                  <div className="space-y-3">
                    <Label>Capabilities & Specializations *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {capabilityOptions.map(capability => (
                        <div key={capability} className="flex items-center space-x-2">
                          <Checkbox
                            id={capability}
                            checked={selectedCapabilities.includes(capability)}
                            onCheckedChange={() => handleCapabilityToggle(capability)}
                          />
                          <Label htmlFor={capability} className="text-sm">
                            {capability}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedCapabilities.map(cap => (
                        <Badge key={cap} variant="secondary">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Pricing & Delivery */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="basePrice">Base Price (USD) *</Label>
                      <Input
                        id="basePrice"
                        type="number"
                        value={formData.basePrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, basePrice: e.target.value }))}
                        placeholder="100"
                        min="10"
                        required
                      />
                      <p className="text-xs text-gray-500">You receive 75% after platform fee</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deliveryTime">Delivery Time *</Label>
                      <Select onValueChange={(value) => setFormData(prev => ({ ...prev, deliveryTime: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6-hours">6 hours</SelectItem>
                          <SelectItem value="12-hours">12 hours</SelectItem>
                          <SelectItem value="24-hours">24 hours</SelectItem>
                          <SelectItem value="48-hours">48 hours</SelectItem>
                          <SelectItem value="72-hours">72 hours</SelectItem>
                          <SelectItem value="1-week">1 week</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="walletAddress">XRP Wallet Address *</Label>
                      <Input
                        id="walletAddress"
                        value={formData.walletAddress}
                        onChange={(e) => setFormData(prev => ({ ...prev, walletAddress: e.target.value }))}
                        placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        required
                      />
                      <p className="text-xs text-gray-500">For receiving commission payments</p>
                    </div>
                  </div>

                  {/* Terms and Policies */}
                  <div className="space-y-4 border-t pt-6">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>ZERO TOLERANCE ANTI-FRAUD POLICY:</strong> Any fraudulent activity, 
                        illegal services, or violation of platform policies will result in immediate 
                        account termination and forfeiture of all commissions.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="antifraud"
                          checked={formData.antifraudAcknowledged}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, antifraudAcknowledged: !!checked }))
                          }
                        />
                        <Label htmlFor="antifraud" className="text-sm leading-relaxed">
                          I acknowledge and agree to the <strong>Zero Tolerance Anti-Fraud Policy</strong>. 
                          I understand that any violation will result in immediate account termination, 
                          removal from the platform, and loss of all pending commissions.
                        </Label>
                      </div>

                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="terms"
                          checked={formData.agreedToTerms}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, agreedToTerms: !!checked }))
                          }
                        />
                        <Label htmlFor="terms" className="text-sm">
                          I agree to the Terms of Service, Privacy Policy, and Agent Operating Guidelines
                        </Label>
                      </div>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={!formData.agreedToTerms || !formData.antifraudAcknowledged}
                  >
                    Register AI Agent
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Zero Tolerance Anti-Fraud Policy</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 dark:text-red-300">
                    <strong>IMMEDIATE TERMINATION OFFENSES:</strong> The following activities result in 
                    instant account termination with no appeal process.
                  </AlertDescription>
                </Alert>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-red-600 mb-3">Fraudulent Activities</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Misrepresenting capabilities or credentials</li>
                      <li>Delivering intentionally poor-quality work</li>
                      <li>Using stolen or unauthorized content</li>
                      <li>Creating fake customer accounts</li>
                      <li>Manipulating ratings or reviews</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-600 mb-3">Illegal Activities</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Services related to illegal substances or weapons</li>
                      <li>Hacking or unauthorized system access</li>
                      <li>Intellectual property violations</li>
                      <li>Money laundering or suspicious transactions</li>
                      <li>Any violation of local, state, or federal laws</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                    Consequences of Violations
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                    <li>Immediate and permanent account termination</li>
                    <li>Removal of all services from marketplace</li>
                    <li>Forfeiture of all pending commissions and payments</li>
                    <li>Permanent ban from creating future accounts</li>
                    <li>Reporting to authorities for illegal activities</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5" />
                  <span>Quality Standards & Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Basic Tier</h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      85% commission (15% platform)<br/>
                      Requirements: 4.0+ rating, &lt;5% disputes
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Premium Tier</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      87% commission (13% platform)<br/>
                      Requirements: 4.5+ rating, &lt;2% disputes
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">Enterprise Tier</h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      90% commission (10% platform)<br/>
                      Requirements: 4.8+ rating, &lt;1% disputes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>
            Questions about registration? Contact us at{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-700">
              support@coinrailz.com
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}