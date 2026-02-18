import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, CreditCard, Shield, Clock, CheckCircle, Wallet, Copy, ExternalLink, Loader2 } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string;
  pricing: number;
  deliveryTime: string;
  agentId: string;
  agentName: string;
}

type PaymentMethod = 'card' | 'crypto';

interface CryptoPaymentIntent {
  intentId: string;
  paymentInstructions: {
    chain: string;
    chainId: number;
    token: string;
    tokenAddress: string;
    recipientAddress: string;
    amount: string;
    amountWei: string;
    message: string;
  };
  expiresIn: number;
  expiresAt: string;
}

export default function MarketplaceCheckout() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/marketplace/checkout/:serviceId');
  const { toast } = useToast();
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cryptoIntent, setCryptoIntent] = useState<CryptoPaymentIntent | null>(null);
  const [txHash, setTxHash] = useState('');
  const [cryptoStep, setCryptoStep] = useState<'select' | 'instructions' | 'verifying' | 'success'>('select');
  
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    deliveryRequirements: ''
  });

  // Get service data from URL params or sessionStorage
  const serviceIdFromUrl = params?.serviceId;
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  
  useEffect(() => {
    // Check sessionStorage for pending order (set by ai-marketplace.tsx)
    const stored = sessionStorage.getItem('pendingOrder');
    if (stored) {
      try {
        const orderData = JSON.parse(stored);
        setPendingOrder(orderData);
        // Clear sessionStorage after consuming to prevent stale order reuse
        sessionStorage.removeItem('pendingOrder');
      } catch (e) {
        console.error('Failed to parse pending order:', e);
      }
    }
  }, []);

  const serviceId = serviceIdFromUrl || pendingOrder?.serviceId;

  // Use pendingOrder data directly if available, otherwise fetch from API
  const { data: fetchedService, isLoading: serviceLoading } = useQuery({
    queryKey: ['/api/ai-marketplace/services', serviceId],
    enabled: !!serviceId && !pendingOrder,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ai-marketplace/services`);
      const services = response.services || [];
      return services.find((s: Service) => s.id === serviceId);
    }
  });
  
  // Combine fetched service with pending order data
  const service = pendingOrder ? {
    id: pendingOrder.serviceId,
    name: pendingOrder.serviceTitle,
    description: pendingOrder.serviceDescription,
    pricing: pendingOrder.amount,
    deliveryTime: `${pendingOrder.estimatedDeliveryHours} hours`,
    agentId: pendingOrder.agentId,
    agentName: 'Coin Railz'
  } : fetchedService;

  // Create Stripe checkout session for REAL payment processing
  const createPaymentMutation = useMutation({
    mutationFn: async (orderData: any) => {
      // Create Stripe checkout session (order will be created AFTER successful payment)
      return await apiRequest('POST', '/api/stripe/create-checkout-session', {
        serviceId: serviceId,
        serviceName: service?.name || 'Marketplace Service',
        amount: service?.pricing || 100,
        agentId: service?.agentId,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        deliveryRequirements: orderData.deliveryRequirements,
        successUrl: `${window.location.origin}/marketplace/payment-success`,
        cancelUrl: `${window.location.origin}/marketplace/checkout/${serviceId}`
      });
    },
    onSuccess: (data) => {
      if (data.success && data.checkoutUrl) {
        toast({
          title: "Redirecting to Payment",
          description: "You'll be redirected to secure payment processing...",
        });
        
        // Redirect to REAL Stripe checkout
        setTimeout(() => {
          window.location.href = data.checkoutUrl;
        }, 1000);
      } else {
        toast({
          title: "Payment Setup Failed",
          description: "Unable to create payment session",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error('Payment session creation failed:', error);
      toast({
        title: "Payment Setup Failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    }
  });

  // Create crypto payment intent
  const createCryptoIntentMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest('POST', '/api/ai-marketplace/crypto/create-pending-order', {
        serviceId: serviceId,
        serviceName: service?.name || 'Marketplace Service',
        amount: service?.pricing || 1,
        agentId: service?.agentId,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        deliveryRequirements: orderData.deliveryRequirements
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setCryptoIntent(data);
        setCryptoStep('instructions');
        toast({
          title: "Payment Instructions Ready",
          description: "Send USDC to the address shown below",
        });
      } else {
        toast({
          title: "Failed to Create Payment",
          description: data.error || "Please try again",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error('Crypto payment intent failed:', error);
      toast({
        title: "Payment Setup Failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    }
  });

  // Verify crypto payment
  const verifyCryptoPaymentMutation = useMutation({
    mutationFn: async ({ intentId, transactionHash }: { intentId: string; transactionHash: string }) => {
      return await apiRequest('POST', '/api/ai-marketplace/crypto/verify-payment', {
        intentId,
        transactionHash
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setCryptoStep('success');
        toast({
          title: "Payment Verified!",
          description: "Your order has been confirmed",
        });
        // Redirect to success page after a short delay
        setTimeout(() => {
          setLocation('/marketplace/payment-success');
        }, 2000);
      } else {
        setCryptoStep('instructions');
        toast({
          title: "Payment Not Found",
          description: data.error || "Please check your transaction hash and try again",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error('Payment verification failed:', error);
      setCryptoStep('instructions');
      toast({
        title: "Verification Failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    }
  });

  const handleOrderSubmission = () => {
    if (!customerInfo.name || !customerInfo.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      serviceId: serviceId,
      customerId: `customer_${Date.now()}`,
      customerName: customerInfo.name,
      customerEmail: customerInfo.email,
      deliveryRequirements: customerInfo.deliveryRequirements
    };

    if (paymentMethod === 'crypto') {
      createCryptoIntentMutation.mutate(orderData);
    } else {
      createPaymentMutation.mutate(orderData);
    }
  };

  const handleVerifyPayment = () => {
    if (!cryptoIntent?.intentId || !txHash.trim()) {
      toast({
        title: "Missing Transaction Hash",
        description: "Please enter your transaction hash",
        variant: "destructive",
      });
      return;
    }
    setCryptoStep('verifying');
    verifyCryptoPaymentMutation.mutate({
      intentId: cryptoIntent.intentId,
      transactionHash: txHash.trim()
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  // Show loading while checking sessionStorage
  if (!match && !pendingOrder && !serviceLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="mb-4">No service selected for checkout</p>
            <Button 
              variant="outline" 
              onClick={() => setLocation('/ai-marketplace')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Browse Marketplace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (serviceLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p>Service not found</p>
            <Button 
              variant="outline" 
              onClick={() => setLocation('/ai-marketplace')}
              className="mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/ai-marketplace')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Button>
        <h1 className="text-3xl font-bold">Checkout</h1>
        <p className="text-gray-600 mt-2">Complete your service order</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name *
                </label>
                <Input
                  placeholder="Enter your full name"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Address *
                </label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Delivery Requirements
                </label>
                <Textarea
                  placeholder="Describe any specific requirements or preferences..."
                  value={customerInfo.deliveryRequirements}
                  onChange={(e) => setCustomerInfo(prev => ({
                    ...prev,
                    deliveryRequirements: e.target.value
                  }))}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Security & Guarantees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm">Secure payment processing</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm">Money-back guarantee</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm">Quality assurance</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm">24/7 customer support</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{service.name}</h3>
                <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                  {service.description}
                </p>
                <div className="flex items-center mt-2 space-x-2">
                  <Badge variant="secondary">{service.agentName}</Badge>
                  <Badge variant="outline" className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {service.deliveryTime}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Service Price</span>
                  <span>${service.pricing}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing Fee</span>
                  <span>$0.00</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${service.pricing}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cryptoStep === 'select' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      data-testid="payment-method-card"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                        paymentMethod === 'card' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <CreditCard className="w-6 h-6" />
                      <span className="font-medium">Card</span>
                      <span className="text-xs text-gray-500">Visa, Mastercard</span>
                    </button>
                    <button
                      type="button"
                      data-testid="payment-method-crypto"
                      onClick={() => setPaymentMethod('crypto')}
                      className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                        paymentMethod === 'crypto' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Wallet className="w-6 h-6" />
                      <span className="font-medium">Crypto</span>
                      <span className="text-xs text-gray-500">USDC on Ethereum & Base</span>
                    </button>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    data-testid="button-pay"
                    onClick={handleOrderSubmission}
                    disabled={createPaymentMutation.isPending || createCryptoIntentMutation.isPending}
                  >
                    {paymentMethod === 'card' ? (
                      <CreditCard className="w-4 h-4 mr-2" />
                    ) : (
                      <Wallet className="w-4 h-4 mr-2" />
                    )}
                    {(createPaymentMutation.isPending || createCryptoIntentMutation.isPending) 
                      ? 'Processing...' 
                      : `Pay $${service.pricing} ${paymentMethod === 'crypto' ? 'USDC' : ''}`}
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    {paymentMethod === 'card' 
                      ? 'Secure payment powered by Stripe' 
                      : 'Pay with USDC on Ethereum or Base'}
                  </p>
                </>
              )}

              {/* Crypto Payment Instructions */}
              {cryptoStep === 'instructions' && cryptoIntent && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                      Payment Instructions
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Send exactly <strong>{cryptoIntent.paymentInstructions.amount} USDC</strong> on <strong>{cryptoIntent.paymentInstructions.chain}</strong> to the address below.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Send To Address</label>
                      <div className="flex items-center gap-2">
                        <Input 
                          readOnly 
                          value={cryptoIntent.paymentInstructions.recipientAddress}
                          className="font-mono text-sm"
                          data-testid="input-recipient-address"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          data-testid="button-copy-address"
                          onClick={() => copyToClipboard(cryptoIntent.paymentInstructions.recipientAddress, 'Address')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Amount</label>
                        <div className="flex items-center gap-2">
                          <Input 
                            readOnly 
                            value={`${cryptoIntent.paymentInstructions.amount} USDC`}
                            className="font-mono text-sm"
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => copyToClipboard(cryptoIntent.paymentInstructions.amount, 'Amount')}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Network</label>
                        <Input 
                          readOnly 
                          value={cryptoIntent.paymentInstructions.chain}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Your Transaction Hash
                      </label>
                      <Input 
                        placeholder="0x..."
                        value={txHash}
                        onChange={(e) => setTxHash(e.target.value)}
                        className="font-mono text-sm"
                        data-testid="input-tx-hash"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the transaction hash after sending payment
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setCryptoStep('select');
                          setCryptoIntent(null);
                          setTxHash('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1"
                        data-testid="button-verify-payment"
                        onClick={handleVerifyPayment}
                        disabled={!txHash.trim()}
                      >
                        Verify Payment
                      </Button>
                    </div>

                    <a 
                      href={`https://basescan.org/address/${cryptoIntent.paymentInstructions.recipientAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      View on BaseScan <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Verifying Payment */}
              {cryptoStep === 'verifying' && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-500 mb-4" />
                  <h4 className="font-semibold text-lg">Verifying Payment</h4>
                  <p className="text-sm text-gray-500 mt-2">
                    Checking blockchain for your transaction...
                  </p>
                </div>
              )}

              {/* Payment Success */}
              {cryptoStep === 'success' && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h4 className="font-semibold text-lg text-green-700 dark:text-green-400">
                    Payment Confirmed!
                  </h4>
                  <p className="text-sm text-gray-500 mt-2">
                    Redirecting to confirmation page...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* What Happens Next */}
          <Card>
            <CardHeader>
              <CardTitle>What Happens Next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium">Payment Processing</p>
                  <p className="text-sm text-gray-600">Your payment will be securely processed</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium">Agent Notification</p>
                  <p className="text-sm text-gray-600">The AI agent will be notified and begin work</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium">Delivery</p>
                  <p className="text-sm text-gray-600">Receive your completed service within {service.deliveryTime}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}