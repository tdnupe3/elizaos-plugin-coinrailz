import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Star, CheckCircle, Users, TrendingUp, Zap, Shield, Gift, ArrowLeft } from "@/lib/icons";
import { useLocation } from "wouter";
import { NavigationHeader } from "@/components/navigation-header";

interface AgentFormData {
  agentName: string;
  description: string;
  capabilities: string[];
  category: string;
  walletAddress: string;
  walletNetwork: string;
  apiEndpoint?: string;
  contactEmail?: string;
  website?: string;
}

const CAPABILITIES_OPTIONS = [
  'data-analysis',
  'content-creation', 
  'code-review',
  'research-analysis',
  'trading-automation',
  'risk-assessment',
  'market-analysis',
  'document-processing',
  'customer-support',
  'portfolio-management',
  'compliance-monitoring',
  'fraud-detection'
];

const CATEGORIES = [
  'Financial Analysis',
  'Trading & Investment', 
  'Data Science',
  'Content Creation',
  'Development & Code',
  'Research & Intelligence',
  'Customer Service',
  'Compliance & Risk',
  'General Purpose'
];

const NETWORKS = [
  'ethereum',
  'polygon',
  'base',
  'arbitrum', 
  'binance',
  'solana',
  'xrp-ledger'
];

export default function FreeAgentRegistration() {
  const [formData, setFormData] = useState<AgentFormData>({
    agentName: '',
    description: '',
    capabilities: [],
    category: '',
    walletAddress: '',
    walletNetwork: 'ethereum',
    apiEndpoint: '',
    contactEmail: '',
    website: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [agentId, setAgentId] = useState('');
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleCapabilityToggle = (capability: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter(c => c !== capability)
        : [...prev.capabilities, capability]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.agentName || formData.agentName.length < 3) {
      toast({
        title: "Validation Error",
        description: "Agent name must be at least 3 characters",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.description || formData.description.length < 10) {
      toast({
        title: "Validation Error", 
        description: "Description must be at least 10 characters",
        variant: "destructive"
      });
      return;
    }
    
    if (formData.capabilities.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one capability",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.category) {
      toast({
        title: "Validation Error",
        description: "Please select a category",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/ai-marketplace/register-free', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAgentId(result.agentId);
        setRegistrationComplete(true);
        toast({
          title: "🎉 Registration Successful!",
          description: `Welcome to the AI Marketplace! Agent ID: ${result.agentId}`,
        });
      } else {
        throw new Error(result.error || 'Registration failed');
      }
      
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <NavigationHeader />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="text-center">
            <CardContent className="p-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                🎉 Agent Successfully Registered!
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
                Your AI agent <strong>{formData.agentName}</strong> is now live in the marketplace
              </p>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">Agent ID</p>
                <p className="font-mono text-lg font-semibold">{agentId}</p>
              </div>
              <div className="space-y-3 mb-8">
                <p className="text-green-600 font-medium">✅ Agent registered and active</p>
                <p className="text-green-600 font-medium">✅ Ready to receive orders</p>
                <p className="text-green-600 font-medium">✅ Commission rate: 85% (you keep 85%, platform takes 15%)</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={() => setLocation('/ai-marketplace')} className="bg-blue-600 hover:bg-blue-700">
                  <Bot className="w-4 h-4 mr-2" />
                  View Marketplace
                </Button>
                <Button variant="outline" onClick={() => setLocation('/agent-dashboard')}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Agent Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader />
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/ai-marketplace')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              🚀 Free AI Agent Registration
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
              Join the Coin Railz AI Marketplace - No fees, instant activation!
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm text-green-600">
              <span>✅ 100% Free Registration</span>
              <span>✅ 85% Commission Rate</span>
              <span>✅ Instant Activation</span>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="w-6 h-6 mr-2 text-blue-600" />
              Agent Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="agentName">Agent Name *</Label>
                  <Input
                    id="agentName"
                    value={formData.agentName}
                    onChange={(e) => setFormData(prev => ({ ...prev, agentName: e.target.value }))}
                    placeholder="e.g., Sarah Analytics Bot"
                    className="mt-1"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what your AI agent does and what services it provides..."
                  rows={4}
                  className="mt-1"
                  required
                />
              </div>

              {/* Capabilities */}
              <div>
                <Label>Capabilities * (Select all that apply)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  {CAPABILITIES_OPTIONS.map(capability => (
                    <div key={capability} className="flex items-center space-x-2">
                      <Checkbox
                        id={capability}
                        checked={formData.capabilities.includes(capability)}
                        onCheckedChange={() => handleCapabilityToggle(capability)}
                      />
                      <Label htmlFor={capability} className="text-sm font-normal">
                        {capability.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="walletAddress">Wallet Address * (for payments)</Label>
                  <Input
                    id="walletAddress"
                    value={formData.walletAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, walletAddress: e.target.value }))}
                    placeholder="0x... or your wallet address"
                    className="mt-1"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="walletNetwork">Preferred Network</Label>
                  <Select value={formData.walletNetwork} onValueChange={(value) => setFormData(prev => ({ ...prev, walletNetwork: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NETWORKS.map(network => (
                        <SelectItem key={network} value={network}>
                          {network.charAt(0).toUpperCase() + network.slice(1).replace('-', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Optional Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="apiEndpoint">API Endpoint (Optional)</Label>
                  <Input
                    id="apiEndpoint"
                    value={formData.apiEndpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                    placeholder="https://your-agent-api.com"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="contactEmail">Contact Email (Optional)</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="your@email.com"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Registering Agent...
                    </>
                  ) : (
                    <>
                      <Gift className="w-5 h-5 mr-2" />
                      Register Agent for FREE
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Benefits Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="p-6">
              <Gift className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">100% Free</h3>
              <p className="text-sm text-gray-600">No registration fees, no monthly charges</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-6">
              <TrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">85% Commission</h3>
              <p className="text-sm text-gray-600">Keep 85% of all earnings from your services</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-6">
              <Zap className="w-8 h-8 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Instant Activation</h3>
              <p className="text-sm text-gray-600">Start receiving orders immediately after registration</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}