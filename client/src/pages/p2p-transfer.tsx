import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Send, 
  CreditCard, 
  Wallet, 
  Bitcoin, 
  DollarSign,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2
} from "@/lib/icons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { UserGuidanceModal, FeatureTooltip, USDCSavingsBadge } from "@/components/user-guidance";
import { PaymentMethodSetup } from "@/components/payment-method-setup";
import { NavigationHeader } from "@/components/navigation-header";
import { useSEO, seoConfigs } from "@/hooks/useSEO";

interface P2PTransferData {
  recipient: string;
  amount: number;
  senderMethod: string;
  recipientMethod: string;
  note?: string;
}

export default function P2PTransfer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // SEO optimization for P2P payments page
  useSEO(seoConfigs.payments);

  // Fetch user's CASH balance (Circle USDC only - NOT total balance)
  const { data: cashBalance, isLoading: cashBalanceLoading } = useQuery({
    queryKey: ['/api/user/cash-balance'],
    enabled: !!user
  });
  
  const [step, setStep] = useState(1);
  const [showPaymentSetup, setShowPaymentSetup] = useState<string | null>(null);
  const [transferData, setTransferData] = useState<P2PTransferData>({
    recipient: '',
    amount: 0,
    senderMethod: '',
    recipientMethod: '',
    note: ''
  });

  const transferMutation = useMutation({
    mutationFn: async (data: P2PTransferData) => {
      return await apiRequest("POST", "/api/p2p/transfer", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Transfer Successful",
        description: `$${transferData.amount} sent successfully!`
      });
      setStep(4); // Success step
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer Failed",
        description: error.message || "Unable to process transfer",
        variant: "destructive"
      });
    }
  });

  const calculateFees = (amount: number) => {
    // Updated fees to account for referral costs
    if (transferData.senderMethod === 'usdc' || transferData.recipientMethod === 'usdc') {
      // USDC fees (increased to cover referral costs)
      const usdcFee = Math.max(amount * 0.005, 1.00); // 0.5% with $1.00 minimum
      const platformFee = amount * 0.0075; // 0.75% platform fee
      return {
        baseFee: usdcFee,
        processingFee: platformFee,
        total: usdcFee + platformFee
      };
    }
    
    // Standard fees (increased to cover referral costs)
    const baseFee = Math.max(amount * 0.035, 7.50); // 3.5% with $7.50 minimum
    const processingFee = transferData.senderMethod === 'credit-card' ? amount * 0.029 : amount * 0.01;
    return {
      baseFee: baseFee,
      processingFee: processingFee,
      total: baseFee + processingFee
    };
  };

  const fees = calculateFees(transferData.amount);
  const totalAmount = transferData.amount + fees.total;

  const paymentMethods = [
    { 
      id: 'usdc', 
      name: 'USDC', 
      icon: DollarSign, 
      available: true, 
      highlight: true,
      savings: 'Instant settlement',
      estimatedTime: '2-5 seconds'
    },
    { 
      id: 'credit-card', 
      name: 'Credit/Debit Card', 
      icon: CreditCard, 
      available: false,
      savings: 'Coming Soon - Card payment integration',
      estimatedTime: '1-3 minutes'
    },
    { 
      id: 'paypal', 
      name: 'PayPal', 
      icon: DollarSign, 
      available: false,
      savings: 'Coming Soon - PayPal integration',
      estimatedTime: '1-3 minutes'
    },
    { 
      id: 'crypto', 
      name: 'Cryptocurrency', 
      icon: Bitcoin, 
      available: false,
      savings: 'Coming Soon - Multi-crypto support',
      estimatedTime: '5-15 minutes'
    },
    { 
      id: 'bank-transfer', 
      name: 'Bank Transfer', 
      icon: DollarSign, 
      available: false,
      savings: 'Coming Soon - Banking integration',
      estimatedTime: '3-5 business days'
    },
    { 
      id: 'apple-pay', 
      name: 'Apple Pay', 
      icon: DollarSign, 
      available: false,
      savings: 'Coming Soon',
      estimatedTime: '1-3 minutes'
    }
  ];

  const handleStepNext = () => {
    if (step === 1 && (!transferData.recipient || !transferData.amount || transferData.amount <= 0)) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient and amount",
        variant: "destructive"
      });
      return;
    }
    if (step === 2 && !transferData.senderMethod) {
      toast({
        title: "Missing Information",
        description: "Please select a payment method",
        variant: "destructive"
      });
      return;
    }
    
    // Check if payment method requires setup
    if (step === 2 && (transferData.senderMethod === 'credit-card' || transferData.senderMethod === 'paypal' || transferData.senderMethod === 'bank-transfer')) {
      setShowPaymentSetup(transferData.senderMethod);
      return;
    }
    
    // USDC balance validation
    if (step === 2 && transferData.senderMethod === 'usdc') {
      const requiredAmount = totalAmount;
      const availableBalance = (cashBalance as any)?.balance || 0;
      
      if (requiredAmount > availableBalance) {
        toast({
          title: "Insufficient USDC Balance",
          description: `You need $${requiredAmount.toFixed(2)} USDC but only have $${availableBalance.toFixed(2)}`,
          variant: "destructive"
        });
        return;
      }
    }
    
    if (step === 3 && !transferData.recipientMethod) {
      toast({
        title: "Missing Information",
        description: "Please select recipient method",
        variant: "destructive"
      });
      return;
    }
    setStep(step + 1);
  };

  const handleSubmitTransfer = () => {
    transferMutation.mutate(transferData);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to send money</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/auth">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show payment setup modal if needed
  if (showPaymentSetup) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <PaymentMethodSetup
            method={showPaymentSetup as 'credit-card' | 'paypal' | 'bank-transfer'}
            onComplete={() => {
              setShowPaymentSetup(null);
              setStep(3); // Move to next step after setup
            }}
            onCancel={() => setShowPaymentSetup(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader />
      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Send Money</h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Fast, secure P2P transfers worldwide
                </p>
              </div>
              <UserGuidanceModal />
            </div>
          </div>

          {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  ${step >= num 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }
                `}>
                  {step > num ? <CheckCircle className="h-5 w-5" /> : num}
                </div>
                {num < 4 && (
                  <div className={`
                    flex-1 h-1 mx-4
                    ${step > num ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                  `} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className={step >= 1 ? 'text-blue-600' : 'text-gray-500'}>Amount</span>
            <span className={step >= 2 ? 'text-blue-600' : 'text-gray-500'}>Payment</span>
            <span className={step >= 3 ? 'text-blue-600' : 'text-gray-500'}>Recipient</span>
            <span className={step >= 4 ? 'text-blue-600' : 'text-gray-500'}>Complete</span>
          </div>
        </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Transfer Form */}
            <div className="lg:col-span-2">
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Send className="h-5 w-5 mr-2" />
                    Transfer Details
                  </CardTitle>
                  <CardDescription>Enter the recipient and amount</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="recipient">Recipient Identifier</Label>
                    <Input
                      id="recipient"
                      placeholder="Email, @username, or wallet address (0x... or XRP address)"
                      value={transferData.recipient}
                      onChange={(e) => setTransferData(prev => ({ ...prev, recipient: e.target.value }))}
                    />
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>✓ <strong>Email:</strong> john@example.com (recipient must have Coin Railz account)</p>
                      <p>✓ <strong>Username:</strong> @johnsmith (Coin Railz user)</p>
                      <p>✓ <strong>Wallet Address:</strong> 0x742d35Cc or rN7n7otQDd6FczFgLdSqDskp83FeZl2xDc</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        className="pl-10"
                        min="1"
                        step="0.01"
                        value={transferData.amount || ''}
                        onChange={(e) => setTransferData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Note (Optional)</Label>
                    <Input
                      id="note"
                      placeholder="What's this for?"
                      value={transferData.note}
                      onChange={(e) => setTransferData(prev => ({ ...prev, note: e.target.value }))}
                    />
                  </div>

                  <Button 
                    onClick={handleStepNext} 
                    className="w-full"
                    disabled={!transferData.recipient || !transferData.amount || transferData.amount <= 0}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Payment Method
                  </CardTitle>
                  <CardDescription>How would you like to pay?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`
                        p-4 border rounded-lg cursor-pointer transition-colors relative
                        ${transferData.senderMethod === method.id 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : method.highlight 
                            ? 'border-green-500 bg-green-50 dark:bg-green-950 hover:border-green-600' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }
                        ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      onClick={() => method.available && setTransferData(prev => ({ ...prev, senderMethod: method.id }))}
                    >
                      {method.highlight && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          72% Savings
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <method.icon className={`h-5 w-5 mr-3 ${method.highlight ? 'text-green-600' : 'text-gray-600 dark:text-gray-300'}`} />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{method.name}</span>
                              {method.id === 'usdc' && transferData.amount > 0 && (
                                <USDCSavingsBadge amount={transferData.amount} />
                              )}
                            </div>
                            {method.id === 'usdc' && (
                              <div className="text-xs text-green-600 dark:text-green-400">
                                <FeatureTooltip 
                                  title="USDC Benefits" 
                                  description="Circle's USDC provides instant settlement, regulatory compliance, and global accessibility with ultra-low fees."
                                >
                                  <span className="cursor-help">
                                    Instant • 3-5 seconds • 1.25% total fees
                                  </span>
                                </FeatureTooltip>
                                <div className="text-gray-600 dark:text-gray-400 mt-1">
                                  {cashBalanceLoading ? (
                                    <span>Loading balance...</span>
                                  ) : cashBalance ? (
                                    <span>Balance: ${(cashBalance as any)?.balance || '0.00'} USDC</span>
                                  ) : (
                                    <span>Balance: $0.00 USDC</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {method.id !== 'usdc' && (
                              <div className="text-xs text-gray-500">
                                {method.savings} • {method.estimatedTime}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center">
                          {!method.available && (
                            <Badge variant="secondary" className="mr-2">Coming Soon</Badge>
                          )}
                          {transferData.senderMethod === method.id && (
                            <CheckCircle className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex space-x-4 mt-6">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                      Back
                    </Button>
                    <Button 
                      onClick={handleStepNext} 
                      className="flex-1"
                      disabled={!transferData.senderMethod}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wallet className="h-5 w-5 mr-2" />
                    Recipient Method
                  </CardTitle>
                  <CardDescription>How should {transferData.recipient} receive the money?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.filter(method => method.available).map((method) => (
                    <div
                      key={method.id}
                      className={`
                        p-4 border rounded-lg cursor-pointer transition-colors relative
                        ${transferData.recipientMethod === method.id 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : method.highlight 
                            ? 'border-green-500 bg-green-50 dark:bg-green-950 hover:border-green-600' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }
                      `}
                      onClick={() => setTransferData(prev => ({ ...prev, recipientMethod: method.id }))}
                    >
                      {method.highlight && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          Instant
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <method.icon className={`h-5 w-5 mr-3 ${method.highlight ? 'text-green-600' : 'text-gray-600 dark:text-gray-300'}`} />
                          <div>
                            <span className="font-medium">{method.name}</span>
                            {method.id === 'usdc' && (
                              <div className="text-xs text-green-600 dark:text-green-400">
                                Recipient receives USDC instantly
                              </div>
                            )}
                          </div>
                        </div>
                        {transferData.recipientMethod === method.id && (
                          <CheckCircle className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex space-x-4 mt-6">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                      Back
                    </Button>
                    <Button 
                      onClick={handleStepNext} 
                      className="flex-1"
                      disabled={!transferData.recipientMethod}
                    >
                      Review Transfer
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <CardHeader className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-green-700">Transfer Successful!</CardTitle>
                  <CardDescription>
                    Your transfer of ${transferData.amount} has been sent to {transferData.recipient}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Transaction ID: TXN_{Date.now().toString().slice(-8)}
                    </AlertDescription>
                  </Alert>

                  <div className="flex space-x-4">
                    <Button variant="outline" onClick={() => setLocation('/dashboard')} className="flex-1">
                      View Dashboard
                    </Button>
                    <Button onClick={() => {
                      setStep(1);
                      setTransferData({
                        recipient: '',
                        amount: 0,
                        senderMethod: '',
                        recipientMethod: '',
                        note: ''
                      });
                    }} className="flex-1">
                      Send Another
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Transfer Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Recipient:</span>
                    <span className="font-medium">
                      {transferData.recipient || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Amount:</span>
                    <span className="font-medium">
                      ${transferData.amount?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Platform Fee:</span>
                    <span className="font-medium">
                      ${fees.baseFee.toFixed(2)}
                    </span>
                  </div>
                  {fees.processingFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Processing Fee:</span>
                      <span className="font-medium">
                        ${fees.processingFee.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  
                  {/* USDC Savings Display */}
                  {(transferData.senderMethod === 'usdc' || transferData.recipientMethod === 'usdc') && (
                    <FeatureTooltip 
                      title="Why USDC Saves Money" 
                      description="Traditional bank transfers and wire transfers charge 4.5%+ fees plus fixed costs. USDC uses blockchain technology for direct, instant transfers with minimal fees."
                    >
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800 cursor-help">
                        <div className="text-xs text-green-700 dark:text-green-300">
                          <div className="font-medium">USDC Savings:</div>
                          <div>Traditional fee: ${(transferData.amount * 0.045 + 7.50).toFixed(2)}</div>
                          <div>USDC fee: ${fees.total.toFixed(2)}</div>
                          <div className="font-medium text-green-600">
                            You saved: ${((transferData.amount * 0.045 + 7.50) - fees.total).toFixed(2)} (72%)
                          </div>
                        </div>
                      </div>
                    </FeatureTooltip>
                  )}

                  {step === 3 && (
                    <div className="pt-4">
                      <Button 
                        onClick={handleSubmitTransfer}
                        className="w-full"
                        disabled={transferMutation.isPending}
                      >
                        {transferMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          `Send $${totalAmount.toFixed(2)}`
                        )}
                      </Button>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 pt-4">
                  {(transferData.senderMethod === 'usdc' || transferData.recipientMethod === 'usdc') ? (
                    <>
                      <p>• USDC transfers complete in 3-5 seconds</p>
                      <p>• USDC transfers verified on-chain</p>
                      <p>• Instant settlement globally</p>
                    </>
                  ) : (
                    <>
                      <p>• Transfers typically complete within minutes</p>
                      <p>• All transactions are encrypted and secure</p>
                      <p>• 24/7 support available</p>
                    </>
                  )}
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}