import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, ArrowLeft, ArrowRight, DollarSign, Clock, CheckCircle, CreditCard, Smartphone, Building2 } from "@/lib/icons";
import { useLocation } from "wouter";
import TransactionFlowOrchestrator from "@/components/TransactionFlowOrchestrator";
import { StripePayment } from "@/components/stripe-payment";

const SENDER_METHODS = [
  { id: 'paypal', name: 'PayPal', icon: CreditCard, description: 'Instant transfer from PayPal balance', available: true },
  { id: 'debit', name: 'Debit Card', icon: CreditCard, description: 'Instant transfer via Stripe', available: true },
  { id: 'credit', name: 'Credit Card', icon: CreditCard, description: 'Instant transfer via Stripe', available: true },
  { id: 'bank', name: 'Bank Account', icon: Building2, description: '1-3 business days', available: false },
  { id: 'crypto', name: 'Cryptocurrency', icon: DollarSign, description: 'USDC, USDT, BTC, ETH', available: true },
  { id: 'coinrailz', name: 'Coin Railz Balance', icon: Smartphone, description: 'Use platform balance', available: true }
];

const RECIPIENT_PLATFORMS = [
  { id: 'paypal', name: 'PayPal', identifier: 'email', placeholder: 'recipient@email.com', available: true },
  { id: 'zelle', name: 'Zelle', identifier: 'email/phone', placeholder: 'email@example.com or +1 555-0123', available: false },
  { id: 'venmo', name: 'Venmo', identifier: 'username/phone', placeholder: '@username or +1 555-0123', available: false },
  { id: 'cashapp', name: 'Cash App', identifier: '$cashtag/phone', placeholder: '$username or +1 555-0123', available: false },
  { id: 'bank', name: 'Bank Transfer', identifier: 'account', placeholder: 'Account/routing number', available: false },
  { id: 'crypto', name: 'Crypto Wallet', identifier: 'address', placeholder: 'Wallet address', available: true },
  { id: 'coinrailz', name: 'Coin Railz User', identifier: 'email/id', placeholder: 'user@email.com or CR123456', available: true }
];

export default function P2PTransfer() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1); // 1: Sender Method, 2: Recipient Details, 3: Review
  
  // Form state
  const [senderMethod, setSenderMethod] = useState("");
  const [recipientPlatform, setRecipientPlatform] = useState("");
  const [recipientIdentifier, setRecipientIdentifier] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [showFlowOrchestrator, setShowFlowOrchestrator] = useState(false);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [stripePaymentSuccess, setStripePaymentSuccess] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState("");

  const calculateFee = () => {
    const amt = parseFloat(amount) || 0;
    if (amt === 0) return 0;
    
    // Cross-platform fee structure accounting for dual processing costs
    const isCrossPlatform = isCrossPlatformTransfer(senderMethod, recipientPlatform);
    
    if (isCrossPlatform) {
      // Cross-platform transfers: 10% fee to cover dual processing costs
      return Math.round((amt * 0.10) * 100) / 100;
    } else {
      // Same-platform or internal transfers: tiered structure
      if (amt < 25) {
        return Math.round((amt * 0.035 + 2.00) * 100) / 100;
      } else if (amt < 50) {
        return Math.round((amt * 0.032 + 1.10) * 100) / 100;
      } else {
        return Math.round((amt * 0.032 + 0.35) * 100) / 100;
      }
    }
  };

  const isCrossPlatformTransfer = (sender: string, recipient: string) => {
    const externalPlatforms = ['paypal', 'credit', 'debit'];
    return externalPlatforms.includes(sender) && externalPlatforms.includes(recipient);
  };

  const selectedSenderMethod = SENDER_METHODS.find(m => m.id === senderMethod);
  const selectedRecipientPlatform = RECIPIENT_PLATFORMS.find(p => p.id === recipientPlatform);

  const handleNextStep = () => {
    if (step === 1 && senderMethod) {
      setStep(2);
    } else if (step === 2 && recipientPlatform && recipientIdentifier && amount) {
      const amountValue = parseFloat(amount);
      if (amountValue < 2.50) {
        alert('Minimum transaction $2.50');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = () => {
    // Check if using Stripe payment methods (credit/debit cards)
    if (senderMethod === 'credit' || senderMethod === 'debit') {
      setShowStripePayment(true);
    } else {
      setShowFlowOrchestrator(true);
    }
  };

  const handleStripeSuccess = (paymentId: string) => {
    setPaymentIntentId(paymentId);
    setStripePaymentSuccess(true);
    setShowStripePayment(false);
    setShowFlowOrchestrator(true);
  };

  const handleStripeCancel = () => {
    setShowStripePayment(false);
  };

  const handleTransactionComplete = () => {
    setShowFlowOrchestrator(false);
    // Reset form
    setStep(1);
    setSenderMethod("");
    setRecipientPlatform("");
    setRecipientIdentifier("");
    setAmount("");
    setMessage("");
  };

  const handleTransactionCancel = () => {
    setShowFlowOrchestrator(false);
  };

  if (showStripePayment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <StripePayment
          amount={parseFloat(amount) + calculateFee()}
          onSuccess={handleStripeSuccess}
          onCancel={handleStripeCancel}
        />
      </div>
    );
  }

  if (showFlowOrchestrator) {
    return (
      <TransactionFlowOrchestrator
        isOpen={showFlowOrchestrator}
        onClose={handleTransactionCancel}
        flowConfig={{
          type: 'p2p_transfer',
          data: {
            senderMethod,
            recipientPlatform,
            recipientIdentifier,
            amount: parseFloat(amount),
            message,
            fee: calculateFee(),
            total: parseFloat(amount) + calculateFee(),
            ...(stripePaymentSuccess && { paymentIntentId })
          },
          steps: [
            { id: 'validate', name: 'Validate Details', status: 'pending' },
            { id: 'authorize', name: 'Authorize Payment', status: 'pending' },
            { id: 'process', name: 'Process Transfer', status: 'pending' },
            { id: 'confirm', name: 'Confirm Receipt', status: 'pending' }
          ]
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/demo')}
                className="min-h-[44px] touch-manipulation"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Back to Demo</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">P2P Transfer</h1>
                <p className="text-sm text-gray-600">Send money between platforms</p>
              </div>
            </div>
            <Badge variant="outline">Production Ready</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="text-sm font-medium">Payment Method</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="text-sm font-medium">Recipient Details</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="text-sm font-medium">Review & Send</span>
            </div>
          </div>
        </div>

        <Card className="bg-white">
          {/* Step 1: Sender Payment Method Selection */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5" />
                  <span>How would you like to send money?</span>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Choose your preferred payment method
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {SENDER_METHODS.map((method) => (
                  <div
                    key={method.id}
                    className={`p-4 border rounded-lg transition-all relative ${
                      !method.available
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                        : senderMethod === method.id
                        ? 'border-blue-500 bg-blue-50 cursor-pointer'
                        : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                    }`}
                    onClick={() => method.available && setSenderMethod(method.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <method.icon className="w-5 h-5 text-gray-600" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <div className="font-medium">{method.name}</div>
                          {!method.available && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{method.description}</div>
                      </div>
                      {senderMethod === method.id && method.available && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}
                <Button 
                  onClick={handleNextStep} 
                  disabled={!senderMethod}
                  className="w-full mt-6"
                >
                  Continue to Recipient Details
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 2: Recipient Details */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Send className="w-5 h-5" />
                  <span>Recipient Details</span>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Where should we send the money?
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Recipient's Platform</Label>
                  <Select value={recipientPlatform} onValueChange={setRecipientPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient's platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECIPIENT_PLATFORMS.map((platform) => (
                        <SelectItem 
                          key={platform.id} 
                          value={platform.id}
                          disabled={!platform.available}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{platform.name}</span>
                            {!platform.available && (
                              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full ml-2">
                                Coming Soon
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRecipientPlatform && (
                  <div className="space-y-2">
                    <Label>
                      Recipient's {selectedRecipientPlatform.identifier.split('/').map(s => 
                        s.charAt(0).toUpperCase() + s.slice(1)
                      ).join(' or ')}
                    </Label>
                    <Input
                      placeholder={selectedRecipientPlatform.placeholder}
                      value={recipientIdentifier}
                      onChange={(e) => setRecipientIdentifier(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Amount (USD)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.01"
                    min="2.50"
                  />
                  <p className="text-xs text-gray-500">Minimum: $2.50</p>
                </div>

                <div className="space-y-2">
                  <Label>Message (Optional)</Label>
                  <Textarea
                    placeholder="What's this for?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={handleNextStep}
                    disabled={!recipientPlatform || !recipientIdentifier || !amount}
                    className="flex-1"
                  >
                    Review Transfer
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Review & Confirm */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Review Transfer</span>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Please review your transfer details
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sending from:</span>
                    <span className="font-medium">{selectedSenderMethod?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sending to:</span>
                    <span className="font-medium">{selectedRecipientPlatform?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Recipient:</span>
                    <span className="font-medium">{recipientIdentifier}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform fee (1%):</span>
                    <span className="font-medium">${calculateFee().toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span>${(parseFloat(amount) + calculateFee()).toFixed(2)}</span>
                  </div>
                </div>

                {message && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Message:</p>
                    <p className="text-sm">{message}</p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Edit Details
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    className="flex-1"
                  >
                    Send Money
                    <Send className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}