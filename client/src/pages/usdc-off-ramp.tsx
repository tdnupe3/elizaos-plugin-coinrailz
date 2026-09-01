import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign, 
  CreditCard, 
  Building2, 
  ShoppingCart, 
  Zap,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Info
} from "@/lib/icons";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface OffRampOption {
  id: string;
  name: string;
  icon: any;
  description: string;
  fee: string;
  time: string;
  minAmount: number;
  maxAmount: number;
  available: boolean;
  highlight?: boolean;
}

const offRampOptions: OffRampOption[] = [
  {
    id: 'bank-deposit',
    name: 'Bank Deposit (ACH)',
    icon: Building2,
    description: 'Direct deposit to your bank account - Coming Soon',
    fee: '0.5% + $1.00',
    time: '1-2 business days',
    minAmount: 25,
    maxAmount: 25000,
    available: false,
    highlight: false
  },
  {
    id: 'debit-card',
    name: 'Instant Debit Card',
    icon: CreditCard,
    description: 'Instant cash to your debit card - Coming Soon',
    fee: '1.5% + $2.50',
    time: '30 seconds',
    minAmount: 10,
    maxAmount: 2500,
    available: false
  },
  {
    id: 'cash-pickup',
    name: 'Cash Pickup',
    icon: DollarSign,
    description: 'Pick up cash at locations worldwide - Coming Soon',
    fee: '2.0% + $5.00',
    time: '15 minutes',
    minAmount: 20,
    maxAmount: 2000,
    available: false
  },
  {
    id: 'gift-cards',
    name: 'Gift Cards',
    icon: ShoppingCart,
    description: 'Digital gift cards for shopping - Coming Soon',
    fee: '1.0% discount',
    time: 'Instant',
    minAmount: 5,
    maxAmount: 500,
    available: false
  }
];

export default function USDCOffRamp() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [bankDetails, setBankDetails] = useState({
    accountNumber: '',
    routingNumber: '',
    accountName: ''
  });
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expiryDate: '',
    cardName: ''
  });
  const [selectedGiftCard, setSelectedGiftCard] = useState<string>('');

  // Fetch user's USDC balance
  const { data: usdcBalance, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ['/api/user/circle/balance'],
    enabled: !!user
  });

  const offRampMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/usdc/off-ramp", data);
    },
    onSuccess: () => {
      toast({
        title: "Off-Ramp Initiated",
        description: "Your USDC conversion has been started successfully!"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Off-Ramp Failed",
        description: error.message || "Unable to process off-ramp",
        variant: "destructive"
      });
    }
  });

  const selectedOption = offRampOptions.find(opt => opt.id === selectedMethod);
  const amountNum = parseFloat(amount) || 0;
  const fees = selectedOption ? calculateFees(amountNum, selectedOption) : 0;
  const netAmount = amountNum - fees;

  function calculateFees(amount: number, option: OffRampOption): number {
    if (option.id === 'bank-deposit') return amount * 0.005 + 1.00;
    if (option.id === 'debit-card') return amount * 0.015 + 2.50;
    if (option.id === 'cash-pickup') return amount * 0.02 + 5.00;
    if (option.id === 'gift-cards') return amount * -0.01; // 1% discount
    return 0;
  }

  const handleOffRamp = () => {
    if (!selectedOption || !amount) return;

    const offRampData = {
      method: selectedMethod,
      amount: amountNum,
      fees: fees,
      netAmount: netAmount,
      ...(selectedMethod === 'bank-deposit' && { bankDetails }),
      ...(selectedMethod === 'debit-card' && { cardDetails }),
      ...(selectedMethod === 'gift-cards' && { giftCard: selectedGiftCard })
    };

    offRampMutation.mutate(offRampData);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to convert USDC</CardDescription>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">USDC Off-Ramp</h1>
              <p className="text-gray-600">
                Convert your USDC to cash, bank deposits, or gift cards
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/wallet-management">
                <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                Back to Wallets
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Off-Ramp Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* USDC Balance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2 text-blue-600" />
                  Available USDC Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  ${balanceLoading ? "Loading..." : (usdcBalance?.balance || '0.00')}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Available for conversion to cash
                </p>
              </CardContent>
            </Card>

            {/* Off-Ramp Methods */}
            <Card>
              <CardHeader>
                <CardTitle>Choose Conversion Method</CardTitle>
                <CardDescription>Select how you want to receive your money</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {offRampOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-colors relative
                      ${selectedMethod === option.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : option.highlight 
                          ? 'border-green-500 bg-green-50 hover:border-green-600' 
                          : 'border-gray-200 hover:border-gray-300'
                      }
                      ${!option.available ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => {/* Coming soon */}}
                  >
                    {option.highlight && (
                      <Badge className="absolute -top-2 -right-2 bg-green-500">
                        Recommended
                      </Badge>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <option.icon className="h-6 w-6 text-gray-600" />
                        <div>
                          <h3 className="font-medium">{option.name}</h3>
                          <p className="text-sm text-gray-500">{option.description}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-blue-600">Fee: {option.fee}</span>
                            <span className="text-xs text-green-600">Time: {option.time}</span>
                            <span className="text-xs text-gray-500">
                              ${option.minAmount} - ${option.maxAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {selectedMethod === option.id && (
                        <CheckCircle className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Amount Input */}
            {selectedMethod && (
              <Card>
                <CardHeader>
                  <CardTitle>Enter Amount</CardTitle>
                  <CardDescription>
                    How much USDC would you like to convert?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (USD)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min={selectedOption?.minAmount}
                      max={selectedOption?.maxAmount}
                    />
                    {selectedOption && (
                      <p className="text-sm text-gray-500">
                        Min: ${selectedOption.minAmount} | Max: ${selectedOption.maxAmount.toLocaleString()}
                      </p>
                    )}
                  </div>

                  {amountNum > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>USDC Amount:</span>
                        <span className="font-medium">${amountNum.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>
                          {selectedOption?.id === 'gift-cards' ? 'Bonus:' : 'Fee:'}
                        </span>
                        <span className={`font-medium ${selectedOption?.id === 'gift-cards' ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedOption?.id === 'gift-cards' ? '+' : '-'}${Math.abs(fees).toFixed(2)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-base font-semibold">
                        <span>You Receive:</span>
                        <span className="text-green-600">${netAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Method-Specific Details */}
            {selectedMethod === 'bank-deposit' && (
              <Card>
                <CardHeader>
                  <CardTitle>Bank Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="accountName">Account Name</Label>
                      <Input
                        id="accountName"
                        placeholder="John Smith"
                        value={bankDetails.accountName}
                        onChange={(e) => setBankDetails({...bankDetails, accountName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        placeholder="123456789"
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="routingNumber">Routing Number</Label>
                    <Input
                      id="routingNumber"
                      placeholder="021000021"
                      value={bankDetails.routingNumber}
                      onChange={(e) => setBankDetails({...bankDetails, routingNumber: e.target.value})}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedMethod === 'debit-card' && (
              <Card>
                <CardHeader>
                  <CardTitle>Debit Card Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={cardDetails.cardNumber}
                      onChange={(e) => setCardDetails({...cardDetails, cardNumber: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiryDate">Expiry Date</Label>
                      <Input
                        id="expiryDate"
                        placeholder="MM/YY"
                        value={cardDetails.expiryDate}
                        onChange={(e) => setCardDetails({...cardDetails, expiryDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardName">Name on Card</Label>
                      <Input
                        id="cardName"
                        placeholder="John Smith"
                        value={cardDetails.cardName}
                        onChange={(e) => setCardDetails({...cardDetails, cardName: e.target.value})}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedMethod === 'gift-cards' && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Gift Card</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedGiftCard} onValueChange={setSelectedGiftCard}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a retailer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amazon">🛒 Amazon Gift Card</SelectItem>
                      <SelectItem value="walmart">🛍️ Walmart Gift Card</SelectItem>
                      <SelectItem value="target">🎯 Target Gift Card</SelectItem>
                      <SelectItem value="starbucks">☕ Starbucks Gift Card</SelectItem>
                      <SelectItem value="uber">🚗 Uber Gift Card</SelectItem>
                      <SelectItem value="netflix">🎬 Netflix Gift Card</SelectItem>
                      <SelectItem value="spotify">🎵 Spotify Gift Card</SelectItem>
                      <SelectItem value="steam">🎮 Steam Gift Card</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-green-600 mt-2">
                    💡 Get 1% bonus value when converting to gift cards!
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Coming Soon Notice */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Coming Soon!</strong><br />
                USDC off-ramp features are currently being integrated with our banking partners. 
                In the meantime, you can send USDC to other users via P2P transfers or convert to other cryptocurrencies.
              </AlertDescription>
            </Alert>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            {/* Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  Why Use USDC Off-Ramp?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Low Fees</p>
                    <p className="text-xs text-gray-500">0.5% - 2.0% vs traditional 3-8%</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Fast Processing</p>
                    <p className="text-xs text-gray-500">30 seconds to 2 business days</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Multiple Options</p>
                    <p className="text-xs text-gray-500">Banks, cards, cash, gift cards</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Secure & Compliant</p>
                    <p className="text-xs text-gray-500">Encrypted transaction workflows</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Processing Times */}
            <Card>
              <CardHeader>
                <CardTitle>Processing Times</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Instant Debit</span>
                  <Badge variant="outline" className="text-green-600">30 seconds</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Gift Cards</span>
                  <Badge variant="outline" className="text-green-600">Instant</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cash Pickup</span>
                  <Badge variant="outline" className="text-blue-600">15 minutes</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Bank Deposit</span>
                  <Badge variant="outline" className="text-orange-600">1-2 days</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Support */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="h-5 w-5 mr-2 text-blue-600" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  Our support team is available 24/7 to help with your conversion.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}