import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Building, Users, CreditCard, Zap, Shield, ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';

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
  features: string[];
  targetMarket: string;
  yearlySavings: number;
  savingsPercentage: number;
}

const signupSchema = z.object({
  tierId: z.number().min(1, 'Please select a license tier'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactEmail: z.string().email('Please enter a valid email address'),
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  phoneNumber: z.string().optional(),
  companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']),
  useCase: z.string().min(20, 'Please describe your use case (minimum 20 characters)'),
  billingCycle: z.enum(['monthly', 'yearly']),
  paymentMethod: z.enum(['stripe', 'crypto', 'wire_transfer', 'check']),
  allowedDomains: z.string().optional(),
  webhookUrls: z.string().optional(),
  signupSource: z.string().optional(),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SDKEnterpriseSignup() {
  const [tiers, setTiers] = useState<LicenseTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<LicenseTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      billingCycle: 'yearly',
      paymentMethod: 'stripe',
      companySize: 'medium',
      signupSource: 'website'
    }
  });

  useEffect(() => {
    fetchTiers();
  }, []);

  useEffect(() => {
    const tierId = form.watch('tierId');
    if (tierId && tiers.length > 0) {
      const tier = tiers.find(t => t.id === tierId);
      setSelectedTier(tier || null);
    }
  }, [form.watch('tierId'), tiers]);

  const fetchTiers = async () => {
    try {
      const response = await fetch('/api/sdk-licensing/tiers');
      const data = await response.json();
      if (data.success) {
        setTiers(data.tiers);
        // Auto-select Enterprise AI tier as most popular
        const enterpriseTier = data.tiers.find((t: LicenseTier) => t.name === 'Enterprise AI');
        if (enterpriseTier) {
          form.setValue('tierId', enterpriseTier.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tiers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pricing tiers. Please refresh the page.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      // Parse domains and webhook URLs
      const allowedDomains = data.allowedDomains ? 
        data.allowedDomains.split(',').map(d => d.trim()).filter(d => d) : 
        [];
      const webhookUrls = data.webhookUrls ? 
        data.webhookUrls.split(',').map(u => u.trim()).filter(u => u) : 
        [];

      const payload = {
        ...data,
        allowedDomains,
        webhookUrls
      };

      const response = await fetch('/api/sdk-licensing/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success!',
          description: 'Your SDK license subscription has been created successfully.',
        });

        // Store license key temporarily for display
        sessionStorage.setItem('newLicenseKey', result.subscription.licenseKey);
        sessionStorage.setItem('subscriptionDetails', JSON.stringify(result));
        
        // Redirect to success page
        window.location.href = '/sdk-subscription-success';
      } else {
        throw new Error(result.error || 'Failed to create subscription');
      }
    } catch (error) {
      console.error('Subscription creation failed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create subscription. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading pricing tiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4" data-testid="button-back">
            <Link href="/sdk-landing">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to SDK Overview
            </Link>
          </Button>
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-main">Enterprise SDK License Signup</h1>
          <p className="text-gray-600 dark:text-gray-400" data-testid="text-description">
            Get started with professional payment infrastructure for your AI company
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Signup Form */}
          <Card data-testid="card-signup-form">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="mr-2 h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Tell us about your company and payment infrastructure needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* License Tier Selection */}
                <div className="space-y-3">
                  <Label htmlFor="tierId">License Tier</Label>
                  <Select 
                    value={form.watch('tierId')?.toString() || ''} 
                    onValueChange={(value) => form.setValue('tierId', parseInt(value))}
                  >
                    <SelectTrigger data-testid="select-tier">
                      <SelectValue placeholder="Select a license tier" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id.toString()}>
                          {tier.name} - {formatPrice(tier.yearlyPrice)}/year ({tier.transactionFeeRate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.tierId && (
                    <p className="text-sm text-red-600">{form.formState.errors.tierId.message}</p>
                  )}
                </div>

                {/* Company Details */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      {...form.register('companyName')}
                      placeholder="Your Company Inc."
                      data-testid="input-company-name"
                    />
                    {form.formState.errors.companyName && (
                      <p className="text-sm text-red-600">{form.formState.errors.companyName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="companySize">Company Size</Label>
                    <Select 
                      value={form.watch('companySize')} 
                      onValueChange={(value) => form.setValue('companySize', value as any)}
                    >
                      <SelectTrigger data-testid="select-company-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="startup">Startup (1-10 employees)</SelectItem>
                        <SelectItem value="small">Small (11-50 employees)</SelectItem>
                        <SelectItem value="medium">Medium (51-200 employees)</SelectItem>
                        <SelectItem value="large">Large (201-1000 employees)</SelectItem>
                        <SelectItem value="enterprise">Enterprise (1000+ employees)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactName">Contact Name</Label>
                    <Input
                      id="contactName"
                      {...form.register('contactName')}
                      placeholder="John Smith"
                      data-testid="input-contact-name"
                    />
                    {form.formState.errors.contactName && (
                      <p className="text-sm text-red-600">{form.formState.errors.contactName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Business Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      {...form.register('contactEmail')}
                      placeholder="john@company.com"
                      data-testid="input-contact-email"
                    />
                    {form.formState.errors.contactEmail && (
                      <p className="text-sm text-red-600">{form.formState.errors.contactEmail.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                  <Input
                    id="phoneNumber"
                    {...form.register('phoneNumber')}
                    placeholder="+1 (555) 123-4567"
                    data-testid="input-phone-number"
                  />
                </div>

                <div>
                  <Label htmlFor="useCase">Use Case Description</Label>
                  <Textarea
                    id="useCase"
                    {...form.register('useCase')}
                    placeholder="Describe how you plan to use our payment SDK (minimum 20 characters)"
                    rows={4}
                    data-testid="textarea-use-case"
                  />
                  {form.formState.errors.useCase && (
                    <p className="text-sm text-red-600">{form.formState.errors.useCase.message}</p>
                  )}
                </div>

                {/* Technical Configuration */}
                <Separator />
                <div>
                  <Label htmlFor="allowedDomains">Allowed Domains (Optional)</Label>
                  <Input
                    id="allowedDomains"
                    {...form.register('allowedDomains')}
                    placeholder="yourapp.com, api.yourapp.com (comma-separated)"
                    data-testid="input-allowed-domains"
                  />
                  <p className="text-sm text-gray-500 mt-1">Leave empty for no domain restrictions</p>
                </div>

                <div>
                  <Label htmlFor="webhookUrls">Webhook URLs (Optional)</Label>
                  <Input
                    id="webhookUrls"
                    {...form.register('webhookUrls')}
                    placeholder="https://yourapp.com/webhook, https://api.yourapp.com/webhook"
                    data-testid="input-webhook-urls"
                  />
                  <p className="text-sm text-gray-500 mt-1">Comma-separated webhook endpoints</p>
                </div>

                {/* Billing Configuration */}
                <Separator />
                <div className="space-y-3">
                  <Label>Billing Cycle</Label>
                  <RadioGroup 
                    value={form.watch('billingCycle')} 
                    onValueChange={(value) => form.setValue('billingCycle', value as any)}
                    data-testid="radio-group-billing-cycle"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yearly" id="yearly" />
                      <Label htmlFor="yearly">Yearly (Save {selectedTier?.savingsPercentage}%)</Label>
                      {selectedTier && (
                        <Badge className="bg-green-100 text-green-800">
                          Save {formatPrice(selectedTier.yearlySavings)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly">Monthly</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label>Payment Method</Label>
                  <RadioGroup 
                    value={form.watch('paymentMethod')} 
                    onValueChange={(value) => form.setValue('paymentMethod', value as any)}
                    data-testid="radio-group-payment-method"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="stripe" id="stripe" />
                      <Label htmlFor="stripe" className="flex items-center">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Credit Card (Stripe)
                      </Label>
                      <Badge className="bg-blue-100 text-blue-800">Recommended</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="crypto" id="crypto" />
                      <Label htmlFor="crypto">Cryptocurrency (USDC)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="wire_transfer" id="wire" />
                      <Label htmlFor="wire">Wire Transfer</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="check" id="check" />
                      <Label htmlFor="check">Company Check</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                  data-testid="button-create-subscription"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Subscription...
                    </>
                  ) : (
                    <>
                      Create SDK License Subscription
                      <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <div className="space-y-6">
            {selectedTier && (
              <Card data-testid="card-order-summary">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{selectedTier.name} License</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedTier.description}</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">{selectedTier.transactionFeeRate}</Badge>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>License Fee ({form.watch('billingCycle')})</span>
                        <span>
                          {form.watch('billingCycle') === 'yearly' 
                            ? formatPrice(selectedTier.yearlyPrice)
                            : formatPrice(selectedTier.monthlyPrice)
                          }
                        </span>
                      </div>
                      {selectedTier.setupFee > 0 && (
                        <div className="flex justify-between">
                          <span>Setup Fee</span>
                          <span>{formatPrice(selectedTier.setupFee)}</span>
                        </div>
                      )}
                      {form.watch('billingCycle') === 'yearly' && (
                        <div className="flex justify-between text-green-600">
                          <span>Annual Savings</span>
                          <span>-{formatPrice(selectedTier.yearlySavings)}</span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>
                        {formatPrice(
                          (form.watch('billingCycle') === 'yearly' 
                            ? selectedTier.yearlyPrice 
                            : selectedTier.monthlyPrice
                          ) + selectedTier.setupFee
                        )}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Transaction fees: {selectedTier.transactionFeeRate} + ${selectedTier.fixedFeePerTransaction} per transaction
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Benefits Card */}
            <Card data-testid="card-benefits">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="mr-2 h-5 w-5 text-yellow-600" />
                  Why Choose Our SDK?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">83% cheaper than Stripe (0.99% vs 2.9%)</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Real Circle USDC integration</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Professional TypeScript SDK</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">99.99% uptime SLA</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Enterprise-grade security</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Dedicated support included</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Card */}
            <Card data-testid="card-security">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-blue-600" />
                  Enterprise Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>✓ SOC 2 Type II Certified</p>
                  <p>✓ PCI DSS Level 1 Compliant</p>
                  <p>✓ AES-256 Encryption</p>
                  <p>✓ Multi-region deployment</p>
                  <p>✓ 24/7 security monitoring</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}