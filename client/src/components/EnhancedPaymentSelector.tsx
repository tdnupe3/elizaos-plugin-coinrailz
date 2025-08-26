import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Wallet, Bitcoin, Zap, Building2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PaymentMethod {
  id: string;
  name: string;
  icon: any;
  description: string;
  processingTime: string;
  fees: string;
  recommended?: boolean;
  comingSoon?: boolean;
}

interface EnhancedPaymentSelectorProps {
  planId: string;
  amount: number;
  isYearly: boolean;
  onPaymentInitiated: (paymentData: any) => void;
  onSuccess: (subscription: any) => void;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: 'stripe',
    name: 'Credit/Debit Card',
    icon: CreditCard,
    description: 'Pay with Visa, Mastercard, or American Express',
    processingTime: 'Instant',
    fees: '2.9% + $0.30',
    recommended: true
  },
  {
    id: 'paypal',
    name: 'PayPal',
    icon: Wallet,
    description: 'Pay with your PayPal account',
    processingTime: 'Instant',
    fees: '3.49% + $0.49'
  },
  {
    id: 'usdc',
    name: 'USDC Stablecoin',
    icon: Bitcoin,
    description: 'Pay with USD Coin on Ethereum, Polygon, or Base',
    processingTime: '1-5 minutes',
    fees: 'Network fees only (~$1-5)'
  },
  {
    id: 'nowpayments',
    name: 'Cryptocurrency',
    icon: Bitcoin,
    description: 'Pay with 150+ cryptocurrencies',
    processingTime: '5-30 minutes',
    fees: '1.5-2.5%'
  },
  {
    id: 'xrp',
    name: 'XRP Ledger',
    icon: Zap,
    description: 'Fast and low-cost payments with XRP',
    processingTime: '3-5 seconds',
    fees: 'Only $0.0002 network fee'
  },
  {
    id: 'treasury_transfer',
    name: 'Direct Transfer',
    icon: Building2,
    description: 'Wire transfer, ACH, or crypto to our treasury',
    processingTime: '1-3 business days',
    fees: 'No processing fees'
  }
];

export function EnhancedPaymentSelector({ 
  planId, 
  amount, 
  isYearly, 
  onPaymentInitiated, 
  onSuccess 
}: EnhancedPaymentSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('stripe');
  const [isLoading, setIsLoading] = useState(false);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<string[]>([]);
  const [treasuryInfo, setTreasuryInfo] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string>('');
  const { toast } = useToast();

  // Form state for different payment methods
  const [paymentData, setPaymentData] = useState({
    // Card data managed by Stripe Elements
    
    // PayPal
    paypalEmail: '',
    
    // USDC
    usdcTxHash: '',
    cryptoWalletAddress: '',
    
    // NOWPayments
    nowpaymentsEmail: '',
    nowpaymentsPreferredCurrency: 'USDT',
    
    // XRP
    xrpAddress: '',
    xrpTxHash: '',
    
    // Treasury
    treasuryTxHash: '',
    treasuryConfirmationCode: ''
  });

  useEffect(() => {
    // Load available cryptocurrencies for NOWPayments
    const loadCryptoCurrencies = async () => {
      try {
        const currencies = await apiRequest('GET', '/api/nowpayments/currencies');
        setCryptoCurrencies(currencies);
      } catch (error) {
        console.error('Failed to load cryptocurrencies:', error);
      }
    };

    // Load treasury wallet information
    const loadTreasuryInfo = async () => {
      try {
        const info = await apiRequest('GET', '/api/treasury/wallet-info');
        setTreasuryInfo(info);
      } catch (error) {
        console.error('Failed to load treasury info:', error);
      }
    };

    loadCryptoCurrencies();
    loadTreasuryInfo();
  }, []);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied to clipboard",
        description: `${field} copied successfully`,
      });
      setTimeout(() => setCopiedField(''), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive"
      });
    }
  };

  const handlePayment = async () => {
    setIsLoading(true);
    
    try {
      const requestData = {
        planId,
        paymentMethod: selectedMethod,
        isYearly,
        ...paymentData
      };

      const result = await apiRequest('POST', '/api/subscription/create', requestData);
      
      onPaymentInitiated(result);
      
      if (result.subscription) {
        onSuccess(result.subscription);
        toast({
          title: "Subscription activated!",
          description: "Your premium subscription is now active.",
        });
      } else if (result.paymentUrl) {
        // Redirect to external payment page (NOWPayments)
        window.open(result.paymentUrl, '_blank');
        toast({
          title: "Payment initiated",
          description: "Complete your payment in the opened window.",
        });
      } else if (result.paymentAddress) {
        // Show payment details for XRP
        toast({
          title: "XRP Payment Details",
          description: `Send ${result.amountXRP} XRP to ${result.paymentAddress}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Payment failed",
        description: error.message || "Failed to process payment",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderPaymentForm = () => {
    switch (selectedMethod) {
      case 'stripe':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click "Proceed" to continue with Stripe's secure checkout
            </p>
          </div>
        );

      case 'paypal':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="paypalEmail">PayPal Email</Label>
              <Input
                id="paypalEmail"
                type="email"
                placeholder="your-email@example.com"
                value={paymentData.paypalEmail}
                onChange={(e) => setPaymentData(prev => ({ ...prev, paypalEmail: e.target.value }))}
              />
            </div>
          </div>
        );

      case 'usdc':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="cryptoWalletAddress">Your Wallet Address</Label>
              <Input
                id="cryptoWalletAddress"
                placeholder="0x..."
                value={paymentData.cryptoWalletAddress}
                onChange={(e) => setPaymentData(prev => ({ ...prev, cryptoWalletAddress: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                For receiving confirmation and refunds if needed
              </p>
            </div>
            <div>
              <Label htmlFor="usdcTxHash">Transaction Hash (optional)</Label>
              <Input
                id="usdcTxHash"
                placeholder="0x... (if already sent)"
                value={paymentData.usdcTxHash}
                onChange={(e) => setPaymentData(prev => ({ ...prev, usdcTxHash: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If you've already sent USDC, enter the transaction hash
              </p>
            </div>
          </div>
        );

      case 'nowpayments':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="nowpaymentsEmail">Email for Payment Notifications</Label>
              <Input
                id="nowpaymentsEmail"
                type="email"
                placeholder="your-email@example.com"
                value={paymentData.nowpaymentsEmail}
                onChange={(e) => setPaymentData(prev => ({ ...prev, nowpaymentsEmail: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="preferredCurrency">Preferred Cryptocurrency</Label>
              <Select
                value={paymentData.nowpaymentsPreferredCurrency}
                onValueChange={(value) => setPaymentData(prev => ({ ...prev, nowpaymentsPreferredCurrency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cryptocurrency" />
                </SelectTrigger>
                <SelectContent>
                  {cryptoCurrencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'xrp':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="xrpAddress">Your XRP Address</Label>
              <Input
                id="xrpAddress"
                placeholder="rxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={paymentData.xrpAddress}
                onChange={(e) => setPaymentData(prev => ({ ...prev, xrpAddress: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                For receiving confirmation and refunds if needed
              </p>
            </div>
            <div>
              <Label htmlFor="xrpTxHash">Transaction Hash (optional)</Label>
              <Input
                id="xrpTxHash"
                placeholder="If you've already sent XRP"
                value={paymentData.xrpTxHash}
                onChange={(e) => setPaymentData(prev => ({ ...prev, xrpTxHash: e.target.value }))}
              />
            </div>
          </div>
        );

      case 'treasury_transfer':
        return (
          <div className="space-y-6">
            {treasuryInfo && (
              <Tabs defaultValue="crypto" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="crypto">Cryptocurrency</TabsTrigger>
                  <TabsTrigger value="ach">ACH Transfer</TabsTrigger>
                  <TabsTrigger value="wire">Wire Transfer</TabsTrigger>
                </TabsList>
                
                <TabsContent value="crypto" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">USDC Address</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted p-1 rounded flex-1 break-all">
                            {treasuryInfo.usdcAddress}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(treasuryInfo.usdcAddress, 'USDC Address')}
                          >
                            {copiedField === 'USDC Address' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">XRP Address</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted p-1 rounded flex-1 break-all">
                            {treasuryInfo.xrpAddress}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(treasuryInfo.xrpAddress, 'XRP Address')}
                          >
                            {copiedField === 'XRP Address' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="ach" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">ACH Transfer Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Routing Number:</span>
                        <span className="text-sm">{treasuryInfo.achDetails.routingNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Account Number:</span>
                        <span className="text-sm">{treasuryInfo.achDetails.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Account Name:</span>
                        <span className="text-sm">{treasuryInfo.achDetails.accountName}</span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="wire" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Wire Transfer Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Bank Name:</span>
                        <span className="text-sm">{treasuryInfo.wireDetails.bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">SWIFT Code:</span>
                        <span className="text-sm">{treasuryInfo.wireDetails.swiftCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Account Number:</span>
                        <span className="text-sm">{treasuryInfo.wireDetails.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Account Name:</span>
                        <span className="text-sm">{treasuryInfo.wireDetails.accountName}</span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
            
            <Separator />
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="treasuryTxHash">Transaction Hash or Reference</Label>
                <Input
                  id="treasuryTxHash"
                  placeholder="Transaction hash or bank reference number"
                  value={paymentData.treasuryTxHash}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, treasuryTxHash: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="treasuryConfirmationCode">Confirmation Code (if different)</Label>
                <Input
                  id="treasuryConfirmationCode"
                  placeholder="Alternative confirmation code"
                  value={paymentData.treasuryConfirmationCode}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, treasuryConfirmationCode: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Direct treasury transfers require manual verification and may take 1-3 business days to activate.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Choose Payment Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.map((method) => (
            <Card
              key={method.id}
              className={`cursor-pointer transition-all ${
                selectedMethod === method.id 
                  ? 'ring-2 ring-primary border-primary' 
                  : 'hover:shadow-md'
              } ${method.comingSoon ? 'opacity-50' : ''}`}
              onClick={() => !method.comingSoon && setSelectedMethod(method.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <method.icon className="w-5 h-5" />
                    <CardTitle className="text-sm">{method.name}</CardTitle>
                  </div>
                  {method.recommended && (
                    <Badge variant="secondary" className="text-xs">Recommended</Badge>
                  )}
                  {method.comingSoon && (
                    <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs mb-2">
                  {method.description}
                </CardDescription>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Processing:</span>
                    <span>{method.processingTime}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Fees:</span>
                    <span>{method.fees}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedMethod && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
            <CardDescription>
              Total: ${amount.toFixed(2)} USD {isYearly ? '(Annual)' : '(Monthly)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderPaymentForm()}
            
            <Button 
              onClick={handlePayment} 
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Processing...' : `Pay $${amount.toFixed(2)} USD`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}