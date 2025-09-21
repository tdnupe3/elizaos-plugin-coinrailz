import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, ArrowRight, TrendingDown, Zap, Shield, Code, Users, Globe, Clock, DollarSign } from 'lucide-react';
import { Link } from 'wouter';

interface LicenseTier {
  id: number;
  name: string;
  description: string;
  yearlyPrice: number;
  monthlyPrice: number;
  setupFee: number;
  transactionFeeRate: string;
  fixedFeePerTransaction: number;
  monthlyTransactionLimit: number | null;
  monthlyVolumeLimit: number | null;
  supportLevel: string;
  slaGuarantee: string;
  customIntegrations: boolean;
  whiteLabeling: boolean;
  dedicatedInfrastructure: boolean;
  apiRequestsPerSecond: number;
  webhookEndpoints: number;
  teamMembers: number;
  features: string[];
  targetMarket: string;
  yearlySavings: number;
  savingsPercentage: number;
}

interface PricingCalculation {
  tier: {
    id: number;
    name: string;
    yearlyPrice: number;
    monthlyPrice: number;
    transactionFeeRate: string;
    fixedFeePerTransaction: number;
    monthlyTransactionLimit: number | null;
    monthlyVolumeLimit: number | null;
  };
  calculation: {
    monthlyTransactions: number;
    monthlyVolume: number;
    transactionFees: number;
    fixedFees: number;
    totalMonthlyFees: number;
    netRevenue: number;
    effectiveFeeRate: string;
    withinLimits: boolean;
    recommended: boolean;
  };
}

export default function SDKLandingPage() {
  const [tiers, setTiers] = useState<LicenseTier[]>([]);
  const [pricingCalculations, setPricingCalculations] = useState<PricingCalculation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [calculatorValues, setCalculatorValues] = useState({
    transactions: '10000',
    averageAmount: '50',
    tier: 'enterprise'
  });

  useEffect(() => {
    fetchTiers();
    calculatePricing();
  }, []);

  useEffect(() => {
    calculatePricing();
  }, [calculatorValues]);

  const fetchTiers = async () => {
    try {
      const response = await fetch('/api/sdk-licensing/tiers');
      const data = await response.json();
      if (data.success) {
        setTiers(data.tiers);
      }
    } catch (error) {
      console.error('Failed to fetch tiers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePricing = async () => {
    try {
      const response = await fetch(`/api/sdk-licensing/pricing-calculator?transactions=${calculatorValues.transactions}&averageAmount=${calculatorValues.averageAmount}&tier=${calculatorValues.tier}`);
      const data = await response.json();
      if (data.success) {
        setPricingCalculations(data.calculations);
      }
    } catch (error) {
      console.error('Failed to calculate pricing:', error);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const getStripeCost = (transactions: number, volume: number) => {
    // Stripe: 2.9% + $0.30 per transaction
    const transactionFees = volume * 0.029;
    const fixedFees = transactions * 0.30;
    return transactionFees + fixedFees;
  };

  const getRecommendedTier = () => {
    const transactions = parseInt(calculatorValues.transactions);
    const volume = parseInt(calculatorValues.averageAmount) * transactions;
    
    if (transactions <= 5000 && volume <= 500000) return tiers.find(t => t.name === 'Startup');
    if (transactions <= 25000 && volume <= 2500000) return tiers.find(t => t.name === 'Growth');
    if (transactions <= 100000 && volume <= 10000000) return tiers.find(t => t.name === 'Enterprise AI');
    return tiers.find(t => t.name === 'Fortune 500');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" data-testid="badge-competitive">
            83% CHEAPER THAN STRIPE
          </Badge>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent" data-testid="heading-main">
            Enterprise Payment SDK for AI Developers
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto" data-testid="text-description">
            Professional payment infrastructure with real Circle USDC integration, TypeScript SDK, and enterprise-grade security. 
            Save thousands monthly with our competitive fee structure targeting the $50+ billion AI payments market.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700" data-testid="button-get-started">
              <Link href="/sdk-enterprise-signup">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" data-testid="button-view-docs">
              <Link href="/sdk-documentation">
                View Documentation <Code className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Competitive Advantages */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="border-green-200 dark:border-green-800" data-testid="card-cost-savings">
            <CardHeader>
              <TrendingDown className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle className="text-green-700 dark:text-green-400">Massive Cost Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                <strong>0.99%-1.75% fees</strong> vs Stripe's 2.9%. Fortune 500 tier saves 
                enterprises <strong>$100K+ annually</strong> on payment processing.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-800" data-testid="card-ai-native">
            <CardHeader>
              <Zap className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle className="text-blue-700 dark:text-blue-400">AI-Native Features</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Built specifically for AI companies with <strong>multi-chain USDC support</strong>, 
                automated fee collection, and real-time analytics for AI transactions.
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800" data-testid="card-enterprise-ready">
            <CardHeader>
              <Shield className="h-8 w-8 text-purple-600 mb-2" />
              <CardTitle className="text-purple-700 dark:text-purple-400">Enterprise Ready</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                <strong>99.99% uptime SLA</strong>, dedicated infrastructure, white-label options, 
                and compliance certifications for Fortune 500 companies.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Calculator */}
        <Card className="mb-16" data-testid="card-pricing-calculator">
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="mr-2 h-5 w-5" />
              Cost Comparison Calculator
            </CardTitle>
            <CardDescription>
              See how much you'll save compared to Stripe's 2.9% + $0.30 fees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div>
                <Label htmlFor="transactions">Monthly Transactions</Label>
                <Input
                  id="transactions"
                  type="number"
                  value={calculatorValues.transactions}
                  onChange={(e) => setCalculatorValues(prev => ({ ...prev, transactions: e.target.value }))}
                  data-testid="input-transactions"
                />
              </div>
              <div>
                <Label htmlFor="averageAmount">Average Transaction ($)</Label>
                <Input
                  id="averageAmount"
                  type="number"
                  value={calculatorValues.averageAmount}
                  onChange={(e) => setCalculatorValues(prev => ({ ...prev, averageAmount: e.target.value }))}
                  data-testid="input-average-amount"
                />
              </div>
              <div>
                <Label htmlFor="tier">Target Market</Label>
                <Select value={calculatorValues.tier} onValueChange={(value) => setCalculatorValues(prev => ({ ...prev, tier: value }))}>
                  <SelectTrigger data-testid="select-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startup">Startup</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="enterprise">Enterprise AI</SelectItem>
                    <SelectItem value="fortune500">Fortune 500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pricingCalculations.length > 0 && (
              <div className="space-y-4">
                <div className="text-lg font-semibold">Monthly Volume: {formatNumber(parseInt(calculatorValues.transactions) * parseInt(calculatorValues.averageAmount))}</div>
                
                {/* Stripe Comparison */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="font-semibold text-red-700 dark:text-red-400">Stripe (2.9% + $0.30)</div>
                  <div className="text-lg">
                    {formatNumber(getStripeCost(parseInt(calculatorValues.transactions), parseInt(calculatorValues.transactions) * parseInt(calculatorValues.averageAmount)))} / month
                  </div>
                </div>

                {/* Our Tiers */}
                <div className="grid gap-4">
                  {pricingCalculations.filter(calc => calc.calculation.withinLimits).map((calc) => {
                    const stripeCost = getStripeCost(calc.calculation.monthlyTransactions, calc.calculation.monthlyVolume);
                    const savings = stripeCost - calc.calculation.totalMonthlyFees;
                    const savingsPercentage = ((savings / stripeCost) * 100);
                    
                    return (
                      <div key={calc.tier.id} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-green-700 dark:text-green-400">{calc.tier.name} ({calc.tier.transactionFeeRate})</div>
                            <div className="text-lg">{formatNumber(calc.calculation.totalMonthlyFees)} / month</div>
                            <div className="text-sm text-green-600 dark:text-green-300">
                              Save {formatNumber(savings)} monthly ({savingsPercentage.toFixed(0)}% savings)
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            {savingsPercentage.toFixed(0)}% OFF
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Tiers */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12" data-testid="heading-pricing-tiers">Enterprise Licensing Tiers</h2>
          {isLoading ? (
            <div className="text-center">Loading pricing tiers...</div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {tiers.filter(tier => ['Startup', 'Enterprise AI', 'Fortune 500'].includes(tier.name)).map((tier) => (
                <Card key={tier.id} className={`relative ${tier.name === 'Enterprise AI' ? 'border-blue-500 border-2' : ''}`} data-testid={`card-tier-${tier.name.toLowerCase().replace(' ', '-')}`}>
                  {tier.name === 'Enterprise AI' && (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white">
                      MOST POPULAR
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                    <div className="text-3xl font-bold">
                      {formatNumber(tier.yearlyPrice)}<span className="text-base font-normal">/year</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {formatNumber(tier.monthlyPrice)}/month • Save {tier.savingsPercentage}% annually
                    </div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {tier.transactionFeeRate} transaction fees
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full mb-4" variant={tier.name === 'Enterprise AI' ? 'default' : 'outline'} data-testid={`button-choose-${tier.name.toLowerCase().replace(' ', '-')}`}>
                      <Link href="/sdk-enterprise-signup">
                        Choose {tier.name}
                      </Link>
                    </Button>
                    <Separator className="mb-4" />
                    <ul className="space-y-2">
                      {tier.features.slice(0, 8).map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                      {tier.features.length > 8 && (
                        <li className="text-sm text-gray-500 dark:text-gray-400">
                          +{tier.features.length - 8} more features...
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-4 gap-8 mb-16">
          <div className="text-center" data-testid="stat-market-size">
            <div className="text-3xl font-bold text-blue-600">$50B+</div>
            <div className="text-gray-600 dark:text-gray-400">AI Payments Market</div>
          </div>
          <div className="text-center" data-testid="stat-cost-savings">
            <div className="text-3xl font-bold text-green-600">83%</div>
            <div className="text-gray-600 dark:text-gray-400">Cheaper than Stripe</div>
          </div>
          <div className="text-center" data-testid="stat-uptime">
            <div className="text-3xl font-bold text-purple-600">99.99%</div>
            <div className="text-gray-600 dark:text-gray-400">Uptime SLA</div>
          </div>
          <div className="text-center" data-testid="stat-enterprise-ready">
            <div className="text-3xl font-bold text-orange-600">24/7</div>
            <div className="text-gray-600 dark:text-gray-400">Enterprise Support</div>
          </div>
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4" data-testid="heading-cta">
              Ready to Save Thousands on Payment Processing?
            </h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Join the enterprise AI companies already saving money with our competitive payment infrastructure. 
              Get started with professional onboarding and dedicated support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" data-testid="button-start-trial">
                <Link href="/sdk-enterprise-signup">
                  Start Enterprise Trial <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600" data-testid="button-contact-sales">
                <Link href="/contact-enterprise-sales">
                  Contact Sales <Users className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}