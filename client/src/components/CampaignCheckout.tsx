import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Target, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CampaignOffer {
  id: string;
  name: string;
  description: string;
  value: number;
  targets: number;
  deliveryTime: string;
  benefits: string[];
  campaign_type: 'defi' | 'infrastructure' | 'gaming' | 'creator';
}

interface CampaignCheckoutProps {
  campaignType?: string;
  sessionId?: string;
  offerId?: string;
}

const campaignOffers: CampaignOffer[] = [
  {
    id: 'defi-partnership',
    name: 'DeFi Protocol Partnership',
    description: 'Complete DeFi ecosystem partnership with 28 verified protocols',
    value: 5000,
    targets: 28,
    deliveryTime: '24-48 hours',
    benefits: ['Direct protocol integrations', 'Cross-platform liquidity', 'Revenue sharing deals', 'Technical support'],
    campaign_type: 'defi'
  },
  {
    id: 'infrastructure-partnership',
    name: 'Infrastructure Provider Partnership',
    description: 'Strategic infrastructure partnerships with 15 top-tier providers',
    value: 5000,
    targets: 15,
    deliveryTime: '24-48 hours',
    benefits: ['Scalable infrastructure', 'Enterprise SLA', 'Technical integration', 'Priority support'],
    campaign_type: 'infrastructure'
  },
  {
    id: 'gaming-ecosystem',
    name: 'Gaming Ecosystem Partnership',
    description: 'Complete gaming ecosystem access with 13 verified gaming platforms',
    value: 5000,
    targets: 13,
    deliveryTime: '24-48 hours',
    benefits: ['Gaming platform access', 'NFT marketplace', 'Player acquisition', 'In-game economy'],
    campaign_type: 'gaming'
  },
  {
    id: 'creator-economy',
    name: 'Creator Economy Partnership',
    description: 'Direct creator partnerships with 8 high-value creator platforms',
    value: 5000,
    targets: 8,
    deliveryTime: '24-48 hours',
    benefits: ['Creator monetization', 'Content distribution', 'Fan engagement', 'Revenue optimization'],
    campaign_type: 'creator'
  }
];

export function CampaignCheckout({ campaignType, sessionId, offerId }: CampaignCheckoutProps) {
  const [selectedOffer, setSelectedOffer] = useState<CampaignOffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    company: '',
    website: ''
  });
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load specific offer if provided
    if (offerId) {
      const offer = campaignOffers.find(o => o.id === offerId);
      setSelectedOffer(offer || null);
    } else if (campaignType) {
      const offer = campaignOffers.find(o => o.campaign_type === campaignType);
      setSelectedOffer(offer || null);
    }
  }, [campaignType, offerId]);

  const handlePurchase = async () => {
    if (!selectedOffer) return;
    
    setPaymentLoading(true);
    try {
      // Create payment intent with campaign tracking
      const paymentData = {
        amount: selectedOffer.value * 100, // Convert to cents
        currency: 'usd',
        campaign_id: selectedOffer.id,
        campaign_type: selectedOffer.campaign_type,
        session_id: sessionId,
        customer_info: customerInfo,
        metadata: {
          offer_name: selectedOffer.name,
          targets: selectedOffer.targets.toString(),
          delivery_time: selectedOffer.deliveryTime,
          source: 'campaign_conversion'
        }
      };

      const result = await apiRequest('POST', '/api/campaigns/checkout', paymentData);
      
      setPaymentResult(result);
      
      // Track conversion
      await apiRequest('POST', '/api/campaigns/track-conversion', {
        campaign_id: selectedOffer.id,
        session_id: sessionId,
        customer_email: customerInfo.email,
        conversion_stage: 'payment_initiated'
      });

      toast({
        title: "Payment Created!",
        description: "Use the payment link below to complete your purchase.",
      });

    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to create payment",
        variant: "destructive"
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  if (paymentResult) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <CardTitle>Payment Ready!</CardTitle>
          </div>
          <CardDescription>
            Complete your purchase to activate your {selectedOffer?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Payment Details</h4>
            <p className="text-green-700 text-sm mb-3">
              Payment ID: {paymentResult.paymentIntentId}
            </p>
            <Button 
              asChild 
              className="w-full"
              size="lg"
            >
              <a 
                href={`/checkout/${paymentResult.paymentIntentId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Complete Payment - ${selectedOffer?.value}
              </a>
            </Button>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Payment secured by Stripe • SSL encrypted</p>
            <p>Questions? Contact support for assistance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedOffer) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Campaign Partnership Offers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaignOffers.map((offer) => (
            <Card 
              key={offer.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedOffer(offer)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{offer.name}</CardTitle>
                  <Badge variant="secondary">${offer.value.toLocaleString()}</Badge>
                </div>
                <CardDescription>{offer.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="w-4 h-4" />
                    <span>{offer.targets} verified targets</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Delivery: {offer.deliveryTime}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">Benefits:</h4>
                  <ul className="text-xs space-y-1">
                    {offer.benefits.slice(0, 3).map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            {selectedOffer.name}
          </CardTitle>
          <CardDescription>{selectedOffer.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{selectedOffer.targets}</div>
              <div className="text-sm text-muted-foreground">Verified Targets</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">${selectedOffer.value.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-semibold">Included Benefits:</h4>
            {selectedOffer.benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase Information</CardTitle>
          <CardDescription>
            Complete the form below to proceed with your partnership purchase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@company.com"
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              value={customerInfo.company}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, company: e.target.value }))}
              placeholder="Your Company Inc."
            />
          </div>
          
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={customerInfo.website}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://yourcompany.com"
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Partnership Guarantee</h4>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Verified delivery within {selectedOffer.deliveryTime}</li>
              <li>• Blockchain-verified transaction proof</li>
              <li>• 100% refund if targets not reached</li>
              <li>• Dedicated success manager assigned</li>
            </ul>
          </div>

          <Button 
            onClick={handlePurchase}
            disabled={paymentLoading || !customerInfo.name || !customerInfo.email}
            className="w-full"
            size="lg"
          >
            {paymentLoading ? 'Creating Payment...' : `Purchase Partnership - $${selectedOffer.value.toLocaleString()}`}
          </Button>
          
          <div className="text-center">
            <Button 
              variant="ghost"
              onClick={() => setSelectedOffer(null)}
              className="text-sm"
            >
              ← Back to Offers
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}