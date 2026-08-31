import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BundleDetails {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  pricingTiers: {
    starter: { monthlyUsd: number; creditsPerMonth: number };
    professional: { monthlyUsd: number; creditsPerMonth: number };
    enterprise: { monthlyUsd: number; creditsPerMonth: number };
  };
  includedServices: string[];
  useCases: string[];
  outcomePromise: string;
  savings: {
    starter: { savingsPercent: number };
    professional: { savingsPercent: number };
    enterprise: { savingsPercent: number };
  };
}

export default function BundleCheckoutPage() {
  const params = useParams<{ bundleId: string; tier: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { bundleId, tier } = params;

  const { data: bundle, isLoading } = useQuery<BundleDetails>({
    queryKey: [`/api/bundles/${bundleId}`],
    enabled: !!bundleId,
  });

  const createCheckoutSession = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/bundles/checkout', {
        method: 'POST',
        body: JSON.stringify({
          bundleId,
          tier,
        }),
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Checkout Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bundle || !tier) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Bundle Not Found</h1>
          <Button onClick={() => setLocation('/bundles')}>Back to Bundles</Button>
        </div>
      </div>
    );
  }

  const tierKey = tier as 'starter' | 'professional' | 'enterprise';
  const selectedTier = bundle.pricingTiers[tierKey];
  const savings = bundle.savings[tierKey];

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-6">
        <Button variant="outline" onClick={() => setLocation('/bundles')}>
          ← Back to Bundles
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{bundle.name}</CardTitle>
          <CardDescription className="text-lg capitalize">{tier} Tier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-6">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="text-4xl font-bold">${selectedTier.monthlyUsd}</div>
                <div className="text-muted-foreground">per month</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-green-600">
                  Save {savings.savingsPercent}%
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedTier.creditsPerMonth} credits/month
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">What's Included:</h3>
            <ul className="space-y-2">
              {bundle.includedServices.map((service) => (
                <li key={service} className="flex items-start">
                  <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Key Use Cases:</h3>
            <ul className="space-y-2">
              {bundle.useCases.slice(0, 4).map((useCase, idx) => (
                <li key={idx} className="flex items-start">
                  <Check className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{useCase}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-primary/10 rounded-lg p-4">
            <p className="text-sm italic">"{bundle.outcomePromise}"</p>
          </div>

          <div className="border-t pt-6">
            <Button
              className="w-full text-lg py-6"
              size="lg"
              onClick={() => createCheckoutSession.mutate()}
              disabled={createCheckoutSession.isPending}
              data-testid="button-checkout"
            >
              {createCheckoutSession.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating checkout session...
                </>
              ) : (
                <>
                  Subscribe for ${selectedTier.monthlyUsd}/month
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Secure checkout powered by Stripe • Cancel anytime
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
