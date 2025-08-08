import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useLocation, useRouter } from 'wouter';
import { 
  CreditCard, 
  DollarSign, 
  Shield, 
  Clock,
  CheckCircle,
  ArrowLeft
} from '@/lib/icons';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface OrderData {
  serviceTitle: string;
  serviceDescription: string;
  amount: number;
  agentId: string;
  estimatedDeliveryHours: number;
  requirements?: string;
}

interface CheckoutFormProps {
  orderData: OrderData;
  clientSecret: string;
  onSuccess: () => void;
}

function CheckoutForm({ orderData, clientSecret, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/my-orders`,
        },
        redirect: 'if_required'
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Successful",
          description: "Your order has been placed! The agent will begin work shortly.",
        });
        onSuccess();
      }
    } catch (err) {
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred during payment.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Service:</span>
            <span className="font-medium">{orderData.serviceTitle}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount:</span>
            <span className="font-medium">${orderData.amount}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform Fee (15%):</span>
            <span>${(orderData.amount * 0.15).toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Total:</span>
            <span className="font-semibold">${orderData.amount}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">Payment Method</Label>
        <PaymentElement />
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-blue-800 dark:text-blue-200">Escrow Protection</span>
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Your payment is held securely in escrow until you approve the completed work. 
          Funds are only released to the agent after successful delivery.
        </p>
      </div>

      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
            Processing Payment...
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 mr-2" />
            Secure Payment - ${orderData.amount}
          </>
        )}
      </Button>
    </form>
  );
}

export default function MarketplaceCheckout() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | 'usdc'>('stripe');

  // Get order data from URL params or local storage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderDataParam = urlParams.get('orderData');
    
    if (orderDataParam) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(orderDataParam));
        setOrderData(parsedData);
      } catch (error) {
        console.error('Failed to parse order data:', error);
        toast({
          title: "Invalid Order Data",
          description: "Please return to the marketplace and try again.",
          variant: "destructive",
        });
      }
    } else {
      // Try to get from sessionStorage
      const savedOrderData = sessionStorage.getItem('pendingOrder');
      if (savedOrderData) {
        setOrderData(JSON.parse(savedOrderData));
      } else {
        toast({
          title: "No Order Data",
          description: "Please select a service from the marketplace first.",
          variant: "destructive",
        });
        setLocation('/ai-marketplace');
      }
    }
  }, [toast, setLocation]);

  // Create order and payment intent
  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderData) => {
      return await apiRequest('POST', '/api/ai-marketplace/create-order', {
        serviceTitle: data.serviceTitle,
        serviceDescription: data.serviceDescription,
        amount: data.amount,
        agentId: data.agentId,
        estimatedDeliveryHours: data.estimatedDeliveryHours,
        customerRequirements: data.requirements,
        paymentMethod: paymentMethod
      });
    },
    onSuccess: (data) => {
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      }
      toast({
        title: "Order Created",
        description: "Complete payment to proceed with your order.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Order Creation Failed",
        description: error.message || "Failed to create order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePaymentSuccess = () => {
    // Clear pending order data
    sessionStorage.removeItem('pendingOrder');
    
    // Redirect to orders page
    setTimeout(() => {
      setLocation('/my-orders');
    }, 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to complete your order.</p>
            <Button onClick={() => setLocation('/auth')}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Loading Order...</h2>
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/ai-marketplace')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Secure Checkout</h1>
          <p className="text-gray-600 dark:text-gray-400">Complete your AI service order</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Service Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="font-semibold">Service:</Label>
                  <p>{orderData.serviceTitle}</p>
                </div>
                <div>
                  <Label className="font-semibold">Description:</Label>
                  <p className="text-gray-600 dark:text-gray-300">{orderData.serviceDescription}</p>
                </div>
                {orderData.requirements && (
                  <div>
                    <Label className="font-semibold">Your Requirements:</Label>
                    <p className="text-gray-600 dark:text-gray-300">{orderData.requirements}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold">Amount:</Label>
                    <p className="text-2xl font-bold text-green-600">${orderData.amount}</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Delivery Time:</Label>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{orderData.estimatedDeliveryHours} hours</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={paymentMethod} 
                  onValueChange={(value: 'stripe' | 'paypal' | 'usdc') => setPaymentMethod(value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="stripe" id="stripe" />
                    <Label htmlFor="stripe" className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4" />
                      <span>Credit/Debit Card</span>
                      <Badge variant="secondary">Recommended</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="usdc" id="usdc" />
                    <Label htmlFor="usdc" className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4" />
                      <span>USDC (Stablecoin)</span>
                      <Badge variant="outline">Lower Fees</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="paypal" id="paypal" />
                    <Label htmlFor="paypal" className="flex items-center space-x-2">
                      <span>PayPal</span>
                      <Badge variant="outline">Coming Soon</Badge>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent>
                {!clientSecret ? (
                  <div className="space-y-4">
                    <Button 
                      onClick={() => createOrderMutation.mutate(orderData)}
                      disabled={createOrderMutation.isPending}
                      className="w-full"
                      size="lg"
                    >
                      {createOrderMutation.isPending ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          Creating Order...
                        </>
                      ) : (
                        'Create Order & Proceed to Payment'
                      )}
                    </Button>
                  </div>
                ) : (
                  <Elements 
                    stripe={stripePromise} 
                    options={{ 
                      clientSecret,
                      appearance: {
                        theme: 'stripe'
                      }
                    }}
                  >
                    <CheckoutForm 
                      orderData={orderData} 
                      clientSecret={clientSecret}
                      onSuccess={handlePaymentSuccess} 
                    />
                  </Elements>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}