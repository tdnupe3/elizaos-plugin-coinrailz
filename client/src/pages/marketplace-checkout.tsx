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
import { ArrowLeft, CreditCard, Shield, Clock, CheckCircle } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string;
  pricing: number;
  deliveryTime: string;
  agentId: string;
  agentName: string;
}

export default function MarketplaceCheckout() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/marketplace/checkout/:serviceId');
  const { toast } = useToast();
  
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    deliveryRequirements: ''
  });

  const serviceId = params?.serviceId;

  // Fetch service details
  const { data: service, isLoading: serviceLoading } = useQuery({
    queryKey: ['/api/ai-marketplace/services', serviceId],
    enabled: !!serviceId,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ai-marketplace/services`);
      const services = response.services || [];
      return services.find((s: Service) => s.id === serviceId);
    }
  });

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
      customerId: `customer_${Date.now()}`, // In real app, get from auth
      customerName: customerInfo.name,
      customerEmail: customerInfo.email,
      deliveryRequirements: customerInfo.deliveryRequirements
    };

    createPaymentMutation.mutate(orderData);
  };

  if (!match) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Invalid checkout URL</p>
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

          {/* Payment Button */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleOrderSubmission}
                disabled={createPaymentMutation.isPending}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {createPaymentMutation.isPending ? 'Processing...' : `Pay $${service.pricing}`}
              </Button>
              <p className="text-xs text-gray-500 text-center mt-2">
                Secure payment powered by Stripe
              </p>
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