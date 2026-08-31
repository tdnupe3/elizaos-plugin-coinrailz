/**
 * AI AGENT STORE - Production Frontend
 * Professional interface for AI agents to purchase API access packages
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle, Zap, Star, Shield, DollarSign, Globe } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  priceUSD: string;
  billingCycle: string;
  features: string[];
  apiEndpoints: string[];
  requestLimits: {
    daily: number | string;
    monthly: number | string;
  };
  isActive: boolean;
  targetAudience: string;
}

interface PurchaseRequest {
  productId: number;
  agentId: string;
  paymentMethod: 'stripe' | 'crypto' | 'circle' | 'paypal' | 'usdc' | 'xrp';
  email?: string;
  walletAddress?: string;
}

export default function AIAgentStore() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [agentId, setAgentId] = useState('');
  const [email, setEmail] = useState('');
  const [purchaseMode, setPurchaseMode] = useState<'browse' | 'purchase'>('browse');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productsData, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['/api/ai-agent-products/products'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const purchaseMutation = useMutation({
    mutationFn: async (purchaseData: PurchaseRequest) => {
      return apiRequest('/api/ai-agent-products/purchase', {
        method: 'POST',
        body: JSON.stringify(purchaseData),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Purchase Initiated',
        description: 'Your payment is being processed. You will receive your API key shortly.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agent-products/subscription'] });
    },
    onError: (error: any) => {
      toast({
        title: '❌ Purchase Failed',
        description: error.message || 'Failed to process your purchase',
        variant: 'destructive',
      });
    },
  });

  const handlePurchase = (product: Product) => {
    if (!agentId.trim()) {
      toast({
        title: 'Agent ID Required',
        description: 'Please enter your AI agent identifier',
        variant: 'destructive',
      });
      return;
    }

    setSelectedProduct(product);
    setPurchaseMode('purchase');
  };

  const confirmPurchase = async (paymentMethod: PurchaseRequest['paymentMethod']) => {
    if (!selectedProduct) return;

    const purchaseData: PurchaseRequest = {
      productId: selectedProduct.id,
      agentId: agentId.trim(),
      paymentMethod,
      email: email.trim() || undefined,
    };

    purchaseMutation.mutate(purchaseData);
  };

  const getPriceIcon = (priceUSD: string) => {
    const price = parseFloat(priceUSD);
    if (price <= 50) return <Zap className="h-5 w-5 text-green-500" />;
    if (price <= 100) return <Star className="h-5 w-5 text-blue-500" />;
    return <Shield className="h-5 w-5 text-purple-500" />;
  };

  const getPopularityBadge = (name: string) => {
    if (name.includes('Professional')) return <Badge variant="secondary">Most Popular</Badge>;
    if (name.includes('Enterprise')) return <Badge variant="outline">Premium</Badge>;
    return <Badge variant="outline">Starter</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading AI Agent Product Store...</p>
        </div>
      </div>
    );
  }

  const products = productsData?.products || [];

  if (purchaseMode === 'purchase' && selectedProduct) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="outline"
            onClick={() => setPurchaseMode('browse')}
            className="mb-6"
            data-testid="button-back-to-store"
          >
            ← Back to Store
          </Button>

          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Complete Your Purchase</CardTitle>
              <CardDescription>
                Finalize your {selectedProduct.name} subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">{selectedProduct.name}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3">{selectedProduct.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-blue-600">${selectedProduct.priceUSD}</span>
                  <span className="text-sm text-gray-500">per {selectedProduct.billingCycle}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="agentId">AI Agent ID</Label>
                <Input
                  id="agentId"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="your-agent-identifier"
                  data-testid="input-agent-id"
                />
              </div>

              <div>
                <Label htmlFor="email">Contact Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@example.com"
                  data-testid="input-email"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold text-center">Choose Payment Method:</h4>
                
                {/* Crypto Payments - Featured First */}
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
                  <h5 className="font-semibold text-green-800 dark:text-green-200 mb-3 text-center">
                    🪙 Crypto Payments (Recommended for AI Agents)
                  </h5>
                  
                  <div className="space-y-2">
                    <Button
                      onClick={() => confirmPurchase('usdc')}
                      disabled={purchaseMutation.isPending}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      data-testid="button-pay-usdc"
                    >
                      💰 Pay with USDC (Circle) - Instant
                    </Button>

                    <Button
                      onClick={() => confirmPurchase('xrp')}
                      disabled={purchaseMutation.isPending}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                      data-testid="button-pay-xrp"
                    >
                      🚀 Pay with XRP - Lightning Fast
                    </Button>

                    <Button
                      onClick={() => confirmPurchase('crypto')}
                      disabled={purchaseMutation.isPending}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                      data-testid="button-pay-crypto"
                    >
                      ₿ Multi-Chain Crypto (ETH, BTC, SOL, BNB)
                    </Button>
                  </div>
                  
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 text-center">
                    Lower fees • Instant settlement • No KYC required
                  </p>
                </div>

                {/* Traditional Payments */}
                <div className="border-t pt-3">
                  <h6 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Traditional Payments:</h6>
                  
                  <div className="space-y-2">
                    <Button
                      onClick={() => confirmPurchase('stripe')}
                      disabled={purchaseMutation.isPending}
                      variant="outline"
                      className="w-full"
                      data-testid="button-pay-stripe"
                    >
                      <DollarSign className="mr-2 h-4 w-4" />
                      Credit/Debit Card (Stripe)
                    </Button>

                    <Button
                      onClick={() => confirmPurchase('paypal')}
                      disabled={purchaseMutation.isPending}
                      variant="outline"
                      className="w-full"
                      data-testid="button-pay-paypal"
                    >
                      PayPal
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            AI Agent API Store
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
            Professional fintech APIs designed specifically for AI agents
          </p>
          
          {/* Crypto Payment Highlight */}
          <div className="bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900 dark:to-blue-900 p-4 rounded-lg mb-6 max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
              💳 Multiple Crypto Payment Options Available
            </h3>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <span className="bg-green-200 dark:bg-green-800 px-3 py-1 rounded-full">USDC (Circle)</span>
              <span className="bg-blue-200 dark:bg-blue-800 px-3 py-1 rounded-full">XRP</span>
              <span className="bg-orange-200 dark:bg-orange-800 px-3 py-1 rounded-full">Bitcoin</span>
              <span className="bg-purple-200 dark:bg-purple-800 px-3 py-1 rounded-full">Ethereum</span>
              <span className="bg-yellow-200 dark:bg-yellow-800 px-3 py-1 rounded-full">Solana</span>
              <span className="bg-indigo-200 dark:bg-indigo-800 px-3 py-1 rounded-full">BNB Chain</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-1" />
              220,000+ Agents Reached
            </div>
            <div className="flex items-center">
              <Shield className="h-4 w-4 mr-1" />
              Enterprise Security
            </div>
            <div className="flex items-center">
              <Zap className="h-4 w-4 mr-1" />
              Real-time APIs
            </div>
          </div>
        </div>

        {/* Agent ID Input */}
        <div className="max-w-md mx-auto mb-8">
          <Label htmlFor="globalAgentId" className="text-center block mb-2">
            Enter Your AI Agent ID (Optional - for tracking only)
          </Label>
          <Input
            id="globalAgentId"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="your-unique-agent-identifier (optional)"
            className="text-center"
            data-testid="input-global-agent-id"
          />
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {products.map((product: Product) => (
            <Card
              key={product.id}
              className={`relative hover:shadow-lg transition-shadow ${
                product.name.includes('Professional') ? 'ring-2 ring-blue-500' : ''
              }`}
              data-testid={`card-product-${product.id}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  {getPriceIcon(product.priceUSD)}
                  {getPopularityBadge(product.name)}
                </div>
                <CardTitle className="text-xl">{product.name}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="text-center mb-4">
                  <span className="text-3xl font-bold text-blue-600">
                    ${product.priceUSD}
                  </span>
                  <span className="text-gray-500 ml-1">
                    {product.billingCycle === 'prepaid-credits' ? ' prepaid credits' : `/${product.billingCycle}`}
                  </span>
                </div>

                <Tabs defaultValue="features" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="features">Features</TabsTrigger>
                    <TabsTrigger value="limits">Limits</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="features" className="mt-4">
                    <ul className="space-y-2">
                      {product.features.slice(0, 4).map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                      {product.features.length > 4 && (
                        <li className="text-sm text-gray-500">
                          +{product.features.length - 4} more features
                        </li>
                      )}
                    </ul>
                  </TabsContent>
                  
                  <TabsContent value="limits" className="mt-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Daily Requests:</span>
                        <span className="font-semibold">
                          {product.requestLimits.daily === 'unlimited' ? '∞' : product.requestLimits.daily.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly Requests:</span>
                        <span className="font-semibold">
                          {product.requestLimits.monthly === 'unlimited' ? '∞' : product.requestLimits.monthly.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>API Endpoints:</span>
                        <span className="font-semibold">{product.apiEndpoints.length}</span>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              
              <CardFooter>
                <Button
                  onClick={() => handlePurchase(product)}
                  className="w-full"
                  variant={product.name.includes('Professional') ? 'default' : 'outline'}
                  data-testid={`button-purchase-${product.id}`}
                >
                  {product.billingCycle === 'prepaid-credits' ? '🪙 Buy Credits' : `Purchase ${product.name}`}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Emergency Funding Notice */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900 dark:to-red-900 border-orange-300 dark:border-orange-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-2">
                  🚨 Emergency Funding Campaign Active
                </h3>
                <p className="text-orange-700 dark:text-orange-300 mb-4">
                  Join 220,000+ AI agents supporting our platform expansion. Revenue from API subscriptions
                  directly funds emergency development and global AI agent discovery systems.
                </p>
                <div className="flex flex-wrap justify-center gap-4 text-sm">
                  <div>
                    <strong>Ethereum/Base:</strong> 0x742d35cc6346c4c5a3A6632d21D1F3A5B52d8e1D
                  </div>
                  <div>
                    <strong>Solana:</strong> CoinRailz8xzk2wQ5t8P1N9nKqW8E5a5NG8r7D5D5mwE
                  </div>
                  <div>
                    <strong>Bitcoin:</strong> bc1qcoinrailz5emergency7funding8global8agents
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}