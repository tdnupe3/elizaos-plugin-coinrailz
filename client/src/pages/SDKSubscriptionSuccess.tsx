import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Copy, Download, ExternalLink, Key, Book, MessageCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionDetails {
  subscription: {
    id: number;
    licenseKey: string;
    companyName: string;
    contactEmail: string;
    tier: {
      name: string;
      transactionFeeRate: string;
      fixedFeePerTransaction: number;
    };
    billingCycle: string;
    status: string;
    amount: number;
    setupFee: number;
    startDate: string;
    endDate: string;
    nextBillingDate: string;
  };
  stripeSubscription?: {
    id: string;
    clientSecret: string;
  };
  nextSteps: string[];
}

export default function SDKSubscriptionSuccess() {
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [licenseKey, setLicenseKey] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    // Get subscription details from session storage
    const details = sessionStorage.getItem('subscriptionDetails');
    const key = sessionStorage.getItem('newLicenseKey');
    
    if (details && key) {
      setSubscriptionDetails(JSON.parse(details));
      setLicenseKey(key);
      
      // Clear sensitive data from session storage after loading
      sessionStorage.removeItem('newLicenseKey');
      sessionStorage.removeItem('subscriptionDetails');
    }
  }, []);

  const copyLicenseKey = () => {
    navigator.clipboard.writeText(licenseKey);
    toast({
      title: 'Copied!',
      description: 'License key copied to clipboard',
    });
  };

  const downloadSDK = () => {
    // This would trigger SDK download or redirect to documentation
    window.open('/sdk-documentation', '_blank');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  if (!subscriptionDetails) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No subscription details found. This page is only accessible after completing the signup process.
            </p>
            <Button asChild>
              <Link href="/sdk-enterprise-signup">
                Start New Signup
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-success">
            Welcome to Coin Railz Enterprise SDK!
          </h1>
          <p className="text-gray-600 dark:text-gray-400" data-testid="text-success-description">
            Your subscription has been created successfully
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* License Key Card */}
          <Card className="border-green-200 dark:border-green-800" data-testid="card-license-key">
            <CardHeader>
              <CardTitle className="flex items-center text-green-700 dark:text-green-400">
                <Key className="mr-2 h-5 w-5" />
                Your License Key
              </CardTitle>
              <CardDescription>
                ⚠️ Save this key securely - it will not be shown again
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <code className="text-lg font-mono break-all" data-testid="text-license-key">
                    {licenseKey}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copyLicenseKey}
                    data-testid="button-copy-license-key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                <strong>Important:</strong> Store this license key in your secure password manager or vault. 
                You'll need it to authenticate SDK requests.
              </div>
            </CardContent>
          </Card>

          {/* Subscription Details */}
          <Card data-testid="card-subscription-details">
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
              <CardDescription>
                Your {subscriptionDetails.subscription.tier.name} license information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Company:</span>
                  <span className="font-semibold">{subscriptionDetails.subscription.companyName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>License Tier:</span>
                  <Badge className="bg-blue-100 text-blue-800">
                    {subscriptionDetails.subscription.tier.name}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Transaction Fees:</span>
                  <span className="font-semibold text-green-600">
                    {subscriptionDetails.subscription.tier.transactionFeeRate}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Billing Cycle:</span>
                  <span className="capitalize">{subscriptionDetails.subscription.billingCycle}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Status:</span>
                  <Badge className="bg-green-100 text-green-800">
                    {subscriptionDetails.subscription.status}
                  </Badge>
                </div>
                
                <Separator />
                
                <div className="flex justify-between items-center">
                  <span>License Fee:</span>
                  <span className="font-semibold">{formatPrice(subscriptionDetails.subscription.amount)}</span>
                </div>
                {subscriptionDetails.subscription.setupFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Setup Fee:</span>
                    <span>{formatPrice(subscriptionDetails.subscription.setupFee)}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between items-center">
                  <span>Valid Until:</span>
                  <span>{formatDate(subscriptionDetails.subscription.endDate)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Next Billing:</span>
                  <span>{formatDate(subscriptionDetails.subscription.nextBillingDate)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Start Guide */}
          <Card data-testid="card-quick-start">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Book className="mr-2 h-5 w-5" />
                Quick Start Guide
              </CardTitle>
              <CardDescription>
                Get up and running with your new SDK license
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subscriptionDetails.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold mr-3">
                      {index + 1}
                    </div>
                    <span className="text-sm">{step}</span>
                  </div>
                ))}
              </div>
              
              <Separator className="my-4" />
              
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" size="sm" onClick={downloadSDK} data-testid="button-view-docs">
                  <Book className="mr-2 h-4 w-4" />
                  View Docs
                </Button>
                <Button variant="outline" size="sm" asChild data-testid="button-sdk-landing">
                  <Link href="/sdk-landing">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    SDK Home
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Support & Contact */}
          <Card data-testid="card-support">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="mr-2 h-5 w-5" />
                Support & Onboarding
              </CardTitle>
              <CardDescription>
                Get help with your SDK integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="font-semibold text-blue-700 dark:text-blue-400 mb-2">
                    Enterprise Support Included
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-300">
                    As an Enterprise SDK customer, you have access to priority support with dedicated response times.
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold">Email Support</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      enterprise-support@coinrailz.com
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">Documentation</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Complete guides, API reference, and code examples
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">Response Time</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {subscriptionDetails.subscription.tier.name === 'Startup' ? '48 hours' :
                       subscriptionDetails.subscription.tier.name === 'Growth' ? '12 hours' :
                       subscriptionDetails.subscription.tier.name === 'Enterprise AI' ? '4 hours' :
                       '1 hour'} (business days)
                    </div>
                  </div>
                </div>
                
                <Button variant="outline" className="w-full" data-testid="button-contact-support">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Tips */}
        <Card className="mt-8 max-w-4xl mx-auto" data-testid="card-integration-tips">
          <CardHeader>
            <CardTitle>Integration Tips</CardTitle>
            <CardDescription>
              Best practices for implementing your enterprise payment infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">TypeScript SDK</h4>
                <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
{`import { CoinRailzSDK } from '@coinrailz/payments';

const sdk = new CoinRailzSDK({
  licenseKey: '${licenseKey.substring(0, 20)}...',
  environment: 'production'
});`}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Environment Variables</h4>
                <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
{`COINRAILZ_LICENSE_KEY=${licenseKey.substring(0, 20)}...
COINRAILZ_ENVIRONMENT=production
COINRAILZ_WEBHOOK_SECRET=your_webhook_secret`}
                </pre>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <Button asChild data-testid="button-full-documentation">
                <Link href="/sdk-documentation">
                  View Complete Documentation
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}