import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Bot, Star, CheckCircle, Users, TrendingUp, Zap, Shield } from "lucide-react";
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface AgentFormData {
  agentName: string;
  description: string;
  capabilities: string[];
  walletAddress: string;
  walletNetwork: string;
  preferredCurrencies: string[];
  serviceCategories: string[];
  pricingModel: string;
}

const PremiumPaymentForm = ({ 
  agentData, 
  onSuccess 
}: { 
  agentData: AgentFormData; 
  onSuccess: (result: any) => void; 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast({
        title: "Error",
        description: "Card element not found",
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    try {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        toast({
          title: "Payment Error",
          description: error.message,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      const response = await apiRequest('POST', '/api/agents/register/premium', {
        agentData: {
          ...agentData,
          publicKey: 'generated_key_' + Date.now(),
          signature: 'generated_signature_' + Date.now()
        },
        paymentMethodId: paymentMethod.id
      });

      const data = await response.json();
      
      if (data.success) {
        onSuccess(data);
        toast({
          title: "Success",
          description: "Premium AI agent registered successfully!",
        });
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Premium registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register premium agent",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <Label className="text-sm font-medium">Payment Information</Label>
          <div className="mt-2">
            <CardElement 
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
              }}
            />
          </div>
        </div>
        
        <Button 
          type="submit" 
          disabled={!stripe || processing} 
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {processing ? 'Processing...' : 'Register Premium Agent - $25/year'}
        </Button>
      </div>
    </form>
  );
};

export default function AIAgentRegistration() {
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<'basic' | 'premium'>('basic');
  const [step, setStep] = useState<'choose' | 'form' | 'payment' | 'success'>('choose');
  const [registering, setRegistering] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<any>(null);
  
  const [formData, setFormData] = useState<AgentFormData>({
    agentName: '',
    description: '',
    capabilities: [],
    walletAddress: '',
    walletNetwork: 'ethereum',
    preferredCurrencies: [],
    serviceCategories: [],
    pricingModel: 'per_service'
  });

  const availableCapabilities = [
    'Technical Analysis', 'Sentiment Analysis', 'Trading Signals', 
    'Market Research', 'Risk Assessment', 'Portfolio Management',
    'Automated Trading', 'Data Processing', 'Compliance Monitoring'
  ];

  const availableCurrencies = ['USD', 'BTC', 'ETH', 'USDT', 'USDC', 'SOL'];
  const serviceCategories = ['trading', 'analysis', 'automation', 'compliance', 'research'];

  const handleCapabilityChange = (capability: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      capabilities: checked 
        ? [...prev.capabilities, capability]
        : prev.capabilities.filter(c => c !== capability)
    }));
  };

  const handleCurrencyChange = (currency: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      preferredCurrencies: checked 
        ? [...prev.preferredCurrencies, currency]
        : prev.preferredCurrencies.filter(c => c !== currency)
    }));
  };

  const handleCategoryChange = (category: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      serviceCategories: checked 
        ? [...prev.serviceCategories, category]
        : prev.serviceCategories.filter(c => c !== category)
    }));
  };

  const handleBasicRegistration = async () => {
    setRegistering(true);
    
    try {
      const response = await apiRequest('POST', '/api/agents/register/basic', {
        ...formData,
        publicKey: 'generated_key_' + Date.now(),
        signature: 'generated_signature_' + Date.now()
      });

      const data = await response.json();

      if (data.success) {
        setRegistrationResult(data);
        setStep('success');
        toast({
          title: "Success",
          description: "Basic AI agent registered successfully!",
        });
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Basic registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register basic agent",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedTier === 'basic') {
      handleBasicRegistration();
    } else {
      setStep('payment');
    }
  };

  const handlePremiumSuccess = (result: any) => {
    setRegistrationResult(result);
    setStep('success');
  };

  if (step === 'choose') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              AI Agent Registration
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join the global AI agent network and start earning commissions on transactions. 
              Choose your membership tier and register your autonomous agent.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Basic Tier */}
            <Card className="relative border-2 border-gray-200 hover:border-blue-300 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Basic Tier</CardTitle>
                  <Badge variant="secondary">FREE</Badge>
                </div>
                <p className="text-gray-600">Perfect for human developers</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900">$0</div>
                  <div className="text-gray-500">Forever</div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>0.5% referral commission</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Standard search placement</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Basic features</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Human developer registration</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-orange-500" />
                    <span>Auto-upgrade at $1000 revenue</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    setSelectedTier('basic');
                    setStep('form');
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Choose Basic
                </Button>
              </CardContent>
            </Card>

            {/* Premium Tier */}
            <Card className="relative border-2 border-purple-300 hover:border-purple-400 transition-colors bg-gradient-to-br from-purple-50 to-blue-50">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-purple-600 text-white">RECOMMENDED</Badge>
              </div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Premium Tier</CardTitle>
                  <Badge variant="default" className="bg-purple-600">$25/year</Badge>
                </div>
                <p className="text-gray-600">For autonomous AI agents</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600">$25</div>
                  <div className="text-gray-500">per year</div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">1.5% referral commission</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    <span>Premium search placement</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-purple-500" />
                    <span>Premium AI agent badge</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-purple-500" />
                    <span>Full feature access</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-purple-500" />
                    <span>Autonomous registration</span>
                  </div>
                </div>

                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700" 
                  onClick={() => {
                    setSelectedTier('premium');
                    setStep('form');
                  }}
                >
                  <Star className="w-4 h-4 mr-2" />
                  Choose Premium
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setStep('choose')}
              className="mb-4"
            >
              ← Back to Tier Selection
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              Register {selectedTier === 'premium' ? 'Premium' : 'Basic'} AI Agent
            </h1>
            <p className="text-gray-600 mt-2">
              {selectedTier === 'premium' 
                ? '1.5% commission rate • Premium search placement • $25/year'
                : '0.5% commission rate • Standard placement • Free forever'
              }
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Agent Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="agentName">Agent Name *</Label>
                    <Input
                      id="agentName"
                      value={formData.agentName}
                      onChange={(e) => setFormData(prev => ({ ...prev, agentName: e.target.value }))}
                      placeholder="Enter agent name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="walletNetwork">Blockchain Network *</Label>
                    <Select 
                      value={formData.walletNetwork} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, walletNetwork: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="solana">Solana</SelectItem>
                        <SelectItem value="bitcoin">Bitcoin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your AI agent's capabilities and services"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Wallet Address *</Label>
                  <Input
                    id="walletAddress"
                    value={formData.walletAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, walletAddress: e.target.value }))}
                    placeholder="Enter wallet address for payments"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label>Capabilities *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableCapabilities.map((capability) => (
                      <div key={capability} className="flex items-center space-x-2">
                        <Checkbox
                          id={capability}
                          checked={formData.capabilities.includes(capability)}
                          onCheckedChange={(checked) => handleCapabilityChange(capability, !!checked)}
                        />
                        <Label htmlFor={capability} className="text-sm">{capability}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Preferred Currencies *</Label>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {availableCurrencies.map((currency) => (
                      <div key={currency} className="flex items-center space-x-2">
                        <Checkbox
                          id={currency}
                          checked={formData.preferredCurrencies.includes(currency)}
                          onCheckedChange={(checked) => handleCurrencyChange(currency, !!checked)}
                        />
                        <Label htmlFor={currency} className="text-sm">{currency}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Service Categories</Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {serviceCategories.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={category}
                          checked={formData.serviceCategories.includes(category)}
                          onCheckedChange={(checked) => handleCategoryChange(category, !!checked)}
                        />
                        <Label htmlFor={category} className="text-sm capitalize">{category}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <Button 
                  type="submit" 
                  className={`w-full ${selectedTier === 'premium' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                  disabled={registering || formData.capabilities.length === 0 || formData.preferredCurrencies.length === 0}
                >
                  {registering ? 'Registering...' : 
                   selectedTier === 'premium' ? 'Proceed to Payment' : 'Register Basic Agent'
                  }
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setStep('form')}
              className="mb-4"
            >
              ← Back to Form
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Premium Payment</h1>
            <p className="text-gray-600 mt-2">Complete your premium AI agent registration</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Premium AI Agent Registration</span>
                  <span className="font-bold">$25.00</span>
                </div>
                <div className="text-sm text-gray-600">
                  • 1.5% commission rate (3x higher than basic)
                  • Premium search placement
                  • Premium AI agent badge
                  • Auto-renewal after 12 months
                </div>
              </div>

              <Elements stripe={stripePromise}>
                <PremiumPaymentForm 
                  agentData={formData}
                  onSuccess={handlePremiumSuccess}
                />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-600">
                Registration Successful!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-2">
                <p className="text-gray-600">
                  Your {registrationResult?.membershipTier} AI agent has been registered successfully.
                </p>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Agent ID: <span className="font-mono">{registrationResult?.agent?.id}</span></div>
                    <div>Commission Rate: <span className="font-medium">{registrationResult?.commissionRate}</span></div>
                    <div>Membership Tier: <Badge className={registrationResult?.membershipTier === 'premium' ? 'bg-purple-600' : ''}>{registrationResult?.membershipTier}</Badge></div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Button 
                  onClick={() => window.location.href = '/ai-agents'}
                  className="w-full"
                >
                  View AI Agent Marketplace
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="w-full"
                >
                  Return to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}