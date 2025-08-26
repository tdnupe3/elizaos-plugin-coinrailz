import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Bot, 
  ArrowUpDown, 
  Gift, 
  CreditCard,
  Wallet,
  Heart,
  Zap,
  Shield
} from "@/lib/icons";
import DonationButton from "@/components/DonationButton";
import EnhancedSwapInterface from "@/components/EnhancedSwapInterface";

export default function RevenueDashboard() {
  const [p2pForm, setP2pForm] = useState({
    recipientId: '',
    amount: '',
    currency: 'USD',
    feePaymentCurrency: 'USDT'
  });
  
  const [subscriptionForm, setSubscriptionForm] = useState({
    planType: 'basic',
    paymentCurrency: 'USDT'
  });

  const [agentFeeForm, setAgentFeeForm] = useState({
    agentId: 'agent_001',
    transactionAmount: '',
    transactionCurrency: 'USD',
    feePaymentCurrency: 'USDT'
  });

  const { toast } = useToast();

  // P2P Transfer with Crypto Fee
  const p2pTransferMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await apiRequest('POST', '/api/p2p/transfer-with-crypto-fee', formData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "P2P Transfer Created",
          description: "Fee payment link generated successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Subscription Payment
  const subscriptionMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await apiRequest('POST', '/api/subscriptions/crypto-payment', formData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Subscription Payment Created",
          description: "Complete payment to activate your plan",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Subscription Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Agent Transaction Fee
  const agentFeeMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await apiRequest('POST', `/api/agents/${formData.agentId}/transaction-fee`, formData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Agent Fee Created",
          description: "Marketplace fee payment ready",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Fee Collection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const revenueStreams = [
    {
      title: "DEX Trading Fees",
      description: "Advanced trading platform with limit orders & bridge",
      fee: "0.3-0.5%",
      icon: ArrowUpDown,
      color: "bg-blue-500",
      category: "Trading",
      volume: "$125,000",
      monthlyRevenue: "$450"
    },
    {
      title: "Multi-Chain Bridge",
      description: "Cross-chain asset transfers with fee optimization",
      fee: "0.2-0.4%",
      icon: Zap,
      color: "bg-purple-500",
      category: "Bridge",
      volume: "$45,000",
      monthlyRevenue: "$150"
    },
    {
      title: "AI Agent Donations",
      description: "Direct cryptocurrency donations to agent development",
      fee: "0.4-0.5%",
      icon: Heart,
      color: "text-red-500"
    },
    {
      title: "P2P Transfer Fees",
      description: "Commission on peer-to-peer transfers",
      fee: "0.25%",
      icon: Users,
      color: "text-blue-500"
    },
    {
      title: "Agent Marketplace Fees",
      description: "Transaction fees from AI agent interactions",
      fee: "2%",
      icon: Bot,
      color: "text-purple-500"
    },
    {
      title: "Cross-Chain Swaps",
      description: "Enhanced DEX aggregation with ChangeNOW",
      fee: "Variable",
      icon: ArrowUpDown,
      color: "text-green-500"
    },
    {
      title: "Subscription Plans",
      description: "Premium features with crypto payments",
      fee: "Fixed Rate",
      icon: CreditCard,
      color: "text-orange-500"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Revenue Dashboard</h1>
          <p className="text-gray-600 mt-2">Comprehensive cryptocurrency revenue collection system</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          Multi-Stream Revenue
        </Badge>
      </div>

      {/* Revenue Streams Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {revenueStreams.map((stream, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stream.icon className={`w-5 h-5 ${stream.color}`} />
                <Badge variant="secondary" className="text-xs">
                  {stream.fee}
                </Badge>
              </div>
              <h3 className="font-medium text-sm mb-1">{stream.title}</h3>
              <p className="text-xs text-gray-500">{stream.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="donations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="donations">Donations</TabsTrigger>
          <TabsTrigger value="p2p">P2P Fees</TabsTrigger>
          <TabsTrigger value="agents">Agent Fees</TabsTrigger>
          <TabsTrigger value="swaps">DEX Swaps</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="donations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                AI Agent Donations
              </CardTitle>
              <CardDescription>
                Support AI agents with cryptocurrency donations using NOWPayments (200+ currencies)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-2 border-dashed">
                  <CardContent className="p-4 text-center">
                    <Bot className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <h4 className="font-medium mb-1">Trading Agent Alpha</h4>
                    <p className="text-sm text-gray-500 mb-3">Autonomous trading specialist</p>
                    <DonationButton agentId="agent_alpha" agentName="Trading Agent Alpha" />
                  </CardContent>
                </Card>
                
                <Card className="border-2 border-dashed">
                  <CardContent className="p-4 text-center">
                    <Bot className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <h4 className="font-medium mb-1">DeFi Yield Bot</h4>
                    <p className="text-sm text-gray-500 mb-3">Yield optimization agent</p>
                    <DonationButton agentId="agent_defi" agentName="DeFi Yield Bot" />
                  </CardContent>
                </Card>
                
                <Card className="border-2 border-dashed">
                  <CardContent className="p-4 text-center">
                    <Bot className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <h4 className="font-medium mb-1">Portfolio Manager</h4>
                    <p className="text-sm text-gray-500 mb-3">Automated portfolio balancing</p>
                    <DonationButton agentId="agent_portfolio" agentName="Portfolio Manager" />
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="p2p" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                P2P Transfer Fee Collection
              </CardTitle>
              <CardDescription>
                Collect 0.25% commission on peer-to-peer transfers using cryptocurrency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recipientId">Recipient ID</Label>
                  <Input
                    id="recipientId"
                    placeholder="recipient_123"
                    value={p2pForm.recipientId}
                    onChange={(e) => setP2pForm(prev => ({ ...prev, recipientId: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Transfer Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100.00"
                    value={p2pForm.amount}
                    onChange={(e) => setP2pForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currency">Transfer Currency</Label>
                  <Select value={p2pForm.currency} onValueChange={(value) => setP2pForm(prev => ({ ...prev, currency: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="BTC">BTC</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="feePaymentCurrency">Fee Payment Currency</Label>
                  <Select value={p2pForm.feePaymentCurrency} onValueChange={(value) => setP2pForm(prev => ({ ...prev, feePaymentCurrency: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDT">USDT</SelectItem>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="BTC">BTC</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Commission (0.25%):</span>
                  <span className="font-medium">
                    {p2pForm.amount ? (parseFloat(p2pForm.amount) * 0.0025).toFixed(4) : '0.00'} {p2pForm.feePaymentCurrency}
                  </span>
                </div>
              </div>

              <Button 
                onClick={() => p2pTransferMutation.mutate(p2pForm)}
                disabled={p2pTransferMutation.isPending || !p2pForm.amount || !p2pForm.recipientId}
                className="w-full"
              >
                {p2pTransferMutation.isPending ? "Creating Transfer..." : "Create P2P Transfer with Crypto Fee"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-500" />
                AI Agent Transaction Fees
              </CardTitle>
              <CardDescription>
                Collect 2% marketplace fees from AI agent transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="agentId">Agent ID</Label>
                  <Select value={agentFeeForm.agentId} onValueChange={(value) => setAgentFeeForm(prev => ({ ...prev, agentId: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent_001">Trading Agent Alpha</SelectItem>
                      <SelectItem value="agent_002">DeFi Yield Bot</SelectItem>
                      <SelectItem value="agent_003">Portfolio Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="transactionAmount">Transaction Amount</Label>
                  <Input
                    id="transactionAmount"
                    type="number"
                    placeholder="500.00"
                    value={agentFeeForm.transactionAmount}
                    onChange={(e) => setAgentFeeForm(prev => ({ ...prev, transactionAmount: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="transactionCurrency">Transaction Currency</Label>
                  <Select value={agentFeeForm.transactionCurrency} onValueChange={(value) => setAgentFeeForm(prev => ({ ...prev, transactionCurrency: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="BTC">BTC</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="feePaymentCurrency">Fee Payment Currency</Label>
                  <Select value={agentFeeForm.feePaymentCurrency} onValueChange={(value) => setAgentFeeForm(prev => ({ ...prev, feePaymentCurrency: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDT">USDT</SelectItem>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="BTC">BTC</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Marketplace Fee (2%):</span>
                  <span className="font-medium">
                    {agentFeeForm.transactionAmount ? (parseFloat(agentFeeForm.transactionAmount) * 0.02).toFixed(4) : '0.00'} {agentFeeForm.feePaymentCurrency}
                  </span>
                </div>
              </div>

              <Button 
                onClick={() => agentFeeMutation.mutate(agentFeeForm)}
                disabled={agentFeeMutation.isPending || !agentFeeForm.transactionAmount}
                className="w-full"
              >
                {agentFeeMutation.isPending ? "Collecting Fee..." : "Collect Agent Marketplace Fee"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="swaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-green-500" />
                Enhanced Cross-Chain Swaps
              </CardTitle>
              <CardDescription>
                ChangeNOW (900+ currencies) + 1inch DEX aggregation for best rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSwapInterface />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-500" />
                Subscription Plans
              </CardTitle>
              <CardDescription>
                Premium features with cryptocurrency payment options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={`border-2 ${subscriptionForm.planType === 'basic' ? 'border-blue-500' : 'border-gray-200'}`}>
                  <CardContent className="p-4 text-center">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <h4 className="font-medium mb-1">Basic Plan</h4>
                    <p className="text-2xl font-bold mb-2">$9.99/mo</p>
                    <p className="text-sm text-gray-500 mb-3">Essential features</p>
                    <Button 
                      variant={subscriptionForm.planType === 'basic' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSubscriptionForm(prev => ({ ...prev, planType: 'basic' }))}
                    >
                      Select Basic
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className={`border-2 ${subscriptionForm.planType === 'premium' ? 'border-blue-500' : 'border-gray-200'}`}>
                  <CardContent className="p-4 text-center">
                    <Zap className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                    <h4 className="font-medium mb-1">Premium Plan</h4>
                    <p className="text-2xl font-bold mb-2">$19.99/mo</p>
                    <p className="text-sm text-gray-500 mb-3">Advanced features</p>
                    <Button 
                      variant={subscriptionForm.planType === 'premium' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSubscriptionForm(prev => ({ ...prev, planType: 'premium' }))}
                    >
                      Select Premium
                    </Button>
                  </CardContent>
                </Card>
                
                <Card className={`border-2 ${subscriptionForm.planType === 'enterprise' ? 'border-blue-500' : 'border-gray-200'}`}>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <h4 className="font-medium mb-1">Enterprise Plan</h4>
                    <p className="text-2xl font-bold mb-2">$49.99/mo</p>
                    <p className="text-sm text-gray-500 mb-3">Full platform access</p>
                    <Button 
                      variant={subscriptionForm.planType === 'enterprise' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSubscriptionForm(prev => ({ ...prev, planType: 'enterprise' }))}
                    >
                      Select Enterprise
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Label htmlFor="paymentCurrency">Payment Currency</Label>
                <Select value={subscriptionForm.paymentCurrency} onValueChange={(value) => setSubscriptionForm(prev => ({ ...prev, paymentCurrency: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="BTC">BTC</SelectItem>
                    <SelectItem value="ETH">ETH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={() => subscriptionMutation.mutate(subscriptionForm)}
                disabled={subscriptionMutation.isPending}
                className="w-full"
              >
                {subscriptionMutation.isPending ? "Creating Payment..." : `Subscribe with ${subscriptionForm.paymentCurrency}`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Revenue Collection Wallets</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Ethereum:</span>
                  <code className="text-xs bg-white px-2 py-1 rounded">0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321</code>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Solana:</span>
                  <code className="text-xs bg-white px-2 py-1 rounded">9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5</code>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Multi-Chain Collection
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}