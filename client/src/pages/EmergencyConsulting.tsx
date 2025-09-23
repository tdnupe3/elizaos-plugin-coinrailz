import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle, 
  Clock, 
  Shield, 
  Zap, 
  DollarSign,
  Phone,
  CheckCircle,
  ExternalLink,
  Target,
  TrendingUp,
  Heart
} from 'lucide-react';

export default function EmergencyConsulting() {
  const [emergencyForm, setEmergencyForm] = useState({
    company: '',
    issue: '',
    urgency: 'high',
    contact: '',
    budget: ''
  });

  const emergencyServices = [
    {
      id: 'platform_down',
      title: 'Platform/Website Down',
      description: 'Critical system failures, server crashes, database issues',
      response: '2 hours',
      rate: '$150/hour',
      examples: ['Payment processing failures', 'Database corruption', 'Server outages', 'API breakdowns']
    },
    {
      id: 'security_breach',
      title: 'Security Breach Response',
      description: 'Hack attempts, data breaches, vulnerability exploits',
      response: '1 hour',
      rate: '$200/hour',
      examples: ['Wallet compromises', 'SQL injection attacks', 'DDoS mitigation', 'Smart contract exploits']
    },
    {
      id: 'payment_systems',
      title: 'Payment System Failures',
      description: 'Stripe, PayPal, crypto payment processing issues',
      response: '2 hours',
      rate: '$150/hour',
      examples: ['Failed transactions', 'Webhook issues', 'Settlement problems', 'Integration breakdowns']
    },
    {
      id: 'trading_systems',
      title: 'Trading Platform Issues',
      description: 'Exchange downtime, trading bot failures, liquidity issues',
      response: '1 hour',
      rate: '$175/hour',
      examples: ['Order execution failures', 'Price feed issues', 'Liquidity problems', 'Bot malfunctions']
    }
  ];

  const successStories = [
    {
      company: 'DeFi Exchange',
      issue: 'Smart contract exploit draining $2M',
      time: '45 minutes',
      saved: '$1.8M',
      action: 'Paused contract, implemented fix, recovered funds'
    },
    {
      company: 'Crypto Startup',
      issue: 'Payment system down during token sale',
      time: '1.5 hours',
      saved: '$500K',
      action: 'Restored payments, recovered lost transactions'
    },
    {
      company: 'Trading Platform',
      issue: 'API endpoints failing, users losing money',
      time: '2 hours',
      saved: '$300K',
      action: 'Fixed critical bugs, restored trading operations'
    }
  ];

  const handleEmergencySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const urgencyEmoji = emergencyForm.urgency === 'critical' ? '🚨' : 
                        emergencyForm.urgency === 'high' ? '⚡' : '⏰';
    
    const emailBody = `${urgencyEmoji} EMERGENCY CONSULTING REQUEST

Company: ${emergencyForm.company}
Urgency Level: ${emergencyForm.urgency.toUpperCase()}
Budget: ${emergencyForm.budget || 'Flexible'}

ISSUE DESCRIPTION:
${emergencyForm.issue}

Contact Information:
${emergencyForm.contact}

---
Request submitted via Coin Railz Emergency Consulting
Time: ${new Date().toISOString()}`;

    window.open(`mailto:emergency@coinrailz.com?subject=🚨 EMERGENCY: ${emergencyForm.company} - ${emergencyForm.urgency.toUpperCase()} Priority&body=${encodeURIComponent(emailBody)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          
          {/* Emergency Header */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <AlertTriangle className="w-12 h-12 text-red-400 animate-pulse" />
              <h1 className="text-4xl font-bold text-white">🚨 Emergency Crypto Consulting</h1>
            </div>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              <strong className="text-red-400">Platform down? Security breach? Payment failures?</strong> 
              <br />Get immediate expert help from a proven crypto developer with $2M+ in platforms saved.
            </p>
            
            {/* Emergency Contact */}
            <Card className="bg-red-600/20 backdrop-blur-md border-red-400 text-white mb-8 max-w-2xl mx-auto">
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-4">
                  <Phone className="w-8 h-8 text-red-400" />
                  <div className="text-left">
                    <div className="text-2xl font-bold">📧 emergency@coinrailz.com</div>
                    <div className="text-red-300">Response within 1-2 hours • Available 24/7</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Emergency Services */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {emergencyServices.map((service) => (
              <Card key={service.id} className="bg-white/10 backdrop-blur-md border-gray-600 text-white">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl text-red-400">{service.title}</CardTitle>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-red-600 text-white mb-2">
                        {service.rate}
                      </Badge>
                      <div className="text-sm text-green-400">⚡ {service.response} response</div>
                    </div>
                  </div>
                  <CardDescription className="text-gray-300">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <h4 className="font-semibold mb-2 text-yellow-400">Common Issues:</h4>
                    <ul className="space-y-1">
                      {service.examples.map((example, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <AlertTriangle size={16} className="text-red-400" />
                          <span>{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Success Stories */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white text-center mb-8">
              <Heart className="inline w-8 h-8 mr-3 text-red-400" />
              Platforms Saved
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {successStories.map((story, idx) => (
                <Card key={idx} className="bg-green-600/20 backdrop-blur-md border-green-400 text-white">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">${story.saved}</div>
                        <div className="text-sm text-gray-300">Saved in {story.time}</div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-400 mb-2">{story.company}</h4>
                        <p className="text-sm text-gray-300 mb-3">{story.issue}</p>
                        <div className="bg-green-500/20 border border-green-400 rounded p-3">
                          <div className="text-sm font-semibold text-green-400">Solution:</div>
                          <div className="text-sm">{story.action}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Emergency Request Form */}
          <Card className="bg-white/10 backdrop-blur-md border-gray-600 text-white mb-16">
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                <Zap className="inline w-8 h-8 mr-3 text-yellow-400" />
                Submit Emergency Request
              </CardTitle>
              <CardDescription className="text-gray-300 text-center">
                Fill out this form for immediate priority response within 1-2 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmergencySubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-blue-400">Company/Platform Name *</label>
                    <Input
                      value={emergencyForm.company}
                      onChange={(e) => setEmergencyForm({...emergencyForm, company: e.target.value})}
                      placeholder="Your company or platform name"
                      required
                      className="bg-white/10 border-gray-500 text-white"
                      data-testid="input-company"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-purple-400">Urgency Level *</label>
                    <select
                      value={emergencyForm.urgency}
                      onChange={(e) => setEmergencyForm({...emergencyForm, urgency: e.target.value})}
                      className="w-full bg-white/10 border border-gray-500 rounded px-3 py-2 text-white"
                      required
                      data-testid="select-urgency"
                    >
                      <option value="critical" className="bg-red-900">🚨 CRITICAL - Platform down, losing money</option>
                      <option value="high" className="bg-orange-900">⚡ HIGH - Major issues, users affected</option>
                      <option value="medium" className="bg-yellow-900">⏰ MEDIUM - Important but not urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-green-400">Contact Information *</label>
                  <Input
                    value={emergencyForm.contact}
                    onChange={(e) => setEmergencyForm({...emergencyForm, contact: e.target.value})}
                    placeholder="Your email, phone, or Telegram for immediate contact"
                    required
                    className="bg-white/10 border-gray-500 text-white"
                    data-testid="input-contact"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-yellow-400">Emergency Budget (Optional)</label>
                  <Input
                    value={emergencyForm.budget}
                    onChange={(e) => setEmergencyForm({...emergencyForm, budget: e.target.value})}
                    placeholder="e.g. $5,000 emergency budget available"
                    className="bg-white/10 border-gray-500 text-white"
                    data-testid="input-budget"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-red-400">Describe Your Emergency *</label>
                  <Textarea
                    value={emergencyForm.issue}
                    onChange={(e) => setEmergencyForm({...emergencyForm, issue: e.target.value})}
                    placeholder="Describe what's broken, what happened, how it's affecting your business, and any error messages you're seeing..."
                    rows={6}
                    required
                    className="bg-white/10 border-gray-500 text-white"
                    data-testid="textarea-issue"
                  />
                </div>

                <div className="text-center">
                  <Button 
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-12 py-4 text-lg"
                    data-testid="button-emergency-submit"
                  >
                    <AlertTriangle className="mr-3 w-6 h-6" />
                    🚨 SEND EMERGENCY REQUEST
                  </Button>
                  <p className="text-sm text-gray-300 mt-4">
                    This will open your email client with a pre-filled emergency request
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Pricing & Guarantees */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white/10 backdrop-blur-md border-gray-600 text-white">
              <CardHeader>
                <CardTitle className="text-xl">
                  <DollarSign className="inline w-6 h-6 mr-2 text-green-400" />
                  Emergency Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Critical Security Issues</span>
                  <Badge className="bg-red-600 text-white">$200/hour</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Trading Platform Failures</span>
                  <Badge className="bg-orange-600 text-white">$175/hour</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Payment/Platform Issues</span>
                  <Badge className="bg-yellow-600 text-white">$150/hour</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>General Emergency Fixes</span>
                  <Badge className="bg-blue-600 text-white">$125/hour</Badge>
                </div>
                <div className="border-t border-gray-500 pt-4 mt-4">
                  <div className="text-sm text-gray-300">
                    ✅ Minimum 2-hour emergency consultation<br />
                    ✅ Payment after successful resolution<br />
                    ✅ 24/7 availability for critical issues
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-gray-600 text-white">
              <CardHeader>
                <CardTitle className="text-xl">
                  <Shield className="inline w-6 h-6 mr-2 text-blue-400" />
                  Emergency Guarantees
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-green-400" />
                  <span>1-2 hour response time guaranteed</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span>No payment unless we solve your issue</span>
                </div>
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-green-400" />
                  <span>Direct access to senior developer</span>
                </div>
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span>$2M+ in platforms successfully saved</span>
                </div>
                <div className="bg-green-500/20 border border-green-400 rounded p-3 mt-4">
                  <div className="text-sm">
                    <strong className="text-green-400">Success Rate:</strong> 98% of emergency issues resolved within 24 hours
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}