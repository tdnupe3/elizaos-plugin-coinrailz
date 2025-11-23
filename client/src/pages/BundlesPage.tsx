import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Zap, Shield, DollarSign } from "lucide-react";
import { useLocation } from "wouter";

interface Bundle {
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
    starter: { bundlePrice: number; individualPrice: number; savings: number; savingsPercent: number };
    professional: { bundlePrice: number; individualPrice: number; savings: number; savingsPercent: number };
    enterprise: { bundlePrice: number; individualPrice: number; savings: number; savingsPercent: number };
  };
}

function getBundleIcon(bundleId: string) {
  switch (bundleId) {
    case "trading-intelligence":
      return <Zap className="h-6 w-6 text-yellow-500" />;
    case "security-compliance":
      return <Shield className="h-6 w-6 text-blue-500" />;
    case "payments-execution":
      return <DollarSign className="h-6 w-6 text-green-500" />;
    default:
      return null;
  }
}

export default function BundlesPage() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{ bundles: Bundle[] }>({
    queryKey: ["/api/bundles"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const bundles = data?.bundles || [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-12 text-center" data-testid="text-hero-section">
        <h1 className="text-4xl font-bold mb-4" data-testid="text-page-title">Service Bundles for AI Agents</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-page-subtitle">
          Pre-packaged microservice suites designed for autonomous agents. Save up to 50% on enterprise tiers vs individual $0.25/call pricing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {bundles.map((bundle) => (
          <Card key={bundle.id} className="flex flex-col" data-testid={`card-bundle-${bundle.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                {getBundleIcon(bundle.id)}
                <Badge variant="secondary" className="ml-auto" data-testid={`badge-service-count-${bundle.id}`}>
                  {bundle.includedServices.length} Services
                </Badge>
              </div>
              <CardTitle className="text-2xl" data-testid={`text-bundle-name-${bundle.id}`}>{bundle.name}</CardTitle>
              <CardDescription className="text-sm mt-2" data-testid={`text-target-audience-${bundle.id}`}>
                {bundle.targetAudience}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground mb-4">{bundle.description}</p>

              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-2">Outcome Promise:</h4>
                <p className="text-sm text-primary italic">"{bundle.outcomePromise}"</p>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-2">Pricing Tiers:</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid={`tier-starter-${bundle.id}`}>
                    <div>
                      <div className="font-medium">Starter</div>
                      <div className="text-xs text-muted-foreground">
                        {bundle.pricingTiers.starter.creditsPerMonth} credits/month
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold" data-testid={`price-starter-${bundle.id}`}>${bundle.pricingTiers.starter.monthlyUsd}/mo</div>
                      <div className="text-xs text-green-600" data-testid={`savings-starter-${bundle.id}`}>
                        Save {bundle.savings.starter.savingsPercent}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid={`tier-professional-${bundle.id}`}>
                    <div>
                      <div className="font-medium">Professional</div>
                      <div className="text-xs text-muted-foreground">
                        {bundle.pricingTiers.professional.creditsPerMonth} credits/month
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold" data-testid={`price-professional-${bundle.id}`}>${bundle.pricingTiers.professional.monthlyUsd}/mo</div>
                      <div className="text-xs text-green-600" data-testid={`savings-professional-${bundle.id}`}>
                        Save {bundle.savings.professional.savingsPercent}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-muted/50 border-2 border-primary" data-testid={`tier-enterprise-${bundle.id}`}>
                    <div>
                      <div className="font-medium">Enterprise</div>
                      <div className="text-xs text-muted-foreground">
                        {bundle.pricingTiers.enterprise.creditsPerMonth} credits/month
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold" data-testid={`price-enterprise-${bundle.id}`}>${bundle.pricingTiers.enterprise.monthlyUsd}/mo</div>
                      <div className="text-xs text-green-600" data-testid={`savings-enterprise-${bundle.id}`}>
                        Save {bundle.savings.enterprise.savingsPercent}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-2">Key Use Cases:</h4>
                <ul className="space-y-1">
                  {bundle.useCases.slice(0, 3).map((useCase, idx) => (
                    <li key={idx} className="flex items-start text-sm">
                      <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-green-500" />
                      <span>{useCase}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto space-y-2">
                <Button 
                  className="w-full" 
                  data-testid={`button-purchase-${bundle.id}-starter`}
                  onClick={() => setLocation(`/checkout/${bundle.id}/starter`)}
                >
                  Start with Starter
                </Button>
                <Button 
                  variant="outline"
                  className="w-full" 
                  data-testid={`button-purchase-${bundle.id}-professional`}
                  onClick={() => setLocation(`/checkout/${bundle.id}/professional`)}
                >
                  Upgrade to Professional
                </Button>
                <Button 
                  variant="outline"
                  className="w-full border-primary" 
                  data-testid={`button-purchase-${bundle.id}-enterprise`}
                  onClick={() => setLocation(`/checkout/${bundle.id}/enterprise`)}
                >
                  Go Enterprise
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>x402 Protocol Compatible</CardTitle>
            <CardDescription>
              All bundles support autonomous payment via x402 micropayments. Agents can subscribe and pay automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Network:</strong> Base (mainnet)
              </p>
              <p className="mb-2">
                <strong>Payment Asset:</strong> USDC
              </p>
              <p>
                <strong>Integration:</strong> Use @coinbase/x402 SDK or HTTP 402 protocol
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
