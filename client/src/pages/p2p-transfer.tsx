import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";

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
  
  const [step, setStep] = useState(1);
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
    const baseFee = Math.max(amount * 0.025, 5.00); // 2.5% with $5 minimum
    const processingFee = transferData.senderMethod === 'credit-card' ? amount * 0.029 : 0;
    return {
      baseFee: baseFee,
      processingFee: processingFee,
      total: baseFee + processingFee
    };
  };

  const fees = calculateFees(transferData.amount);
  const totalAmount = transferData.amount + fees.total;

  const paymentMethods = [
    { id: 'wallet-balance', name: 'Coin Railz Balance', icon: Wallet, available: true },
    { id: 'credit-card', name: 'Credit/Debit Card', icon: CreditCard, available: true },
    { id: 'paypal', name: 'PayPal', icon: DollarSign, available: true },
    { id: 'crypto', name: 'Cryptocurrency', icon: Bitcoin, available: true },
    { id: 'bank-transfer', name: 'Bank Transfer', icon: DollarSign, available: false },
    { id: 'apple-pay', name: 'Apple Pay', icon: DollarSign, available: false }
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Send Money</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Fast, secure P2P transfers worldwide
          </p>
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
                    <Label htmlFor="recipient">Recipient Email or Username</Label>
                    <Input
                      id="recipient"
                      placeholder="Enter email or @username"
                      value={transferData.recipient}
                      onChange={(e) => setTransferData(prev => ({ ...prev, recipient: e.target.value }))}
                    />
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
                        p-4 border rounded-lg cursor-pointer transition-colors
                        ${transferData.senderMethod === method.id 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }
                        ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      onClick={() => method.available && setTransferData(prev => ({ ...prev, senderMethod: method.id }))}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <method.icon className="h-5 w-5 mr-3 text-gray-600 dark:text-gray-300" />
                          <span className="font-medium">{method.name}</span>
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
                        p-4 border rounded-lg cursor-pointer transition-colors
                        ${transferData.recipientMethod === method.id 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }
                      `}
                      onClick={() => setTransferData(prev => ({ ...prev, recipientMethod: method.id }))}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <method.icon className="h-5 w-5 mr-3 text-gray-600 dark:text-gray-300" />
                          <span className="font-medium">{method.name}</span>
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
                </div>

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
                  <p>• Transfers typically complete within minutes</p>
                  <p>• All transactions are encrypted and secure</p>
                  <p>• 24/7 support available</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}