import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Globe, 
  DollarSign, 
  Zap, 
  CheckCircle,
  ArrowRight,
  Clock,
  Shield,
  TrendingDown,
  MapPin,
  AlertCircle
} from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  exchangeRate: number;
  processingTime: string;
  available: boolean;
}

export default function USDCCrossBorder() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [recipientDetails, setRecipientDetails] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    bankAccount: "",
    iban: ""
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch USDC balance
  const { data: usdcBalance, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ['/api/user/circle/balance'],
    enabled: !!user
  });

  // Supported countries for cross-border payments
  const countries: Country[] = [
    { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", exchangeRate: 0.79, processingTime: "2-5 seconds", available: true },
    { code: "EU", name: "European Union", flag: "🇪🇺", currency: "EUR", exchangeRate: 0.92, processingTime: "2-5 seconds", available: true },
    { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", exchangeRate: 1.35, processingTime: "2-5 seconds", available: true },
    { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", exchangeRate: 1.52, processingTime: "2-5 seconds", available: true },
    { code: "JP", name: "Japan", flag: "🇯🇵", currency: "JPY", exchangeRate: 148.5, processingTime: "2-5 seconds", available: true },
    { code: "SG", name: "Singapore", flag: "🇸🇬", currency: "SGD", exchangeRate: 1.34, processingTime: "2-5 seconds", available: true },
    { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", exchangeRate: 18.2, processingTime: "2-5 seconds", available: true },
    { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", exchangeRate: 5.1, processingTime: "2-5 seconds", available: true },
    { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", exchangeRate: 83.1, processingTime: "2-5 seconds", available: true },
    { code: "KR", name: "South Korea", flag: "🇰🇷", currency: "KRW", exchangeRate: 1320, processingTime: "2-5 seconds", available: true },
    { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP", exchangeRate: 56.2, processingTime: "2-5 seconds", available: true },
    { code: "TH", name: "Thailand", flag: "🇹🇭", currency: "THB", exchangeRate: 35.8, processingTime: "2-5 seconds", available: true }
  ];

  const selectedCountryData = countries.find(c => c.code === selectedCountry);

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) < 25) {
      alert("Minimum transfer amount is $25 USD");
      return;
    }

    if (!selectedCountry || !recipientDetails.name || !recipientDetails.email) {
      alert("Please fill in all required recipient details");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Simulate cross-border USDC transfer
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // In production, this would integrate with Circle's cross-border APIs
      // and local payment rails for the destination country
      
      const localAmount = parseFloat(amount) * (selectedCountryData?.exchangeRate || 1);
      alert(`Successfully sent $${amount} USD (${localAmount.toFixed(2)} ${selectedCountryData?.currency}) to ${recipientDetails.name}!`);
      
      setAmount("");
      setSelectedCountry("");
      setRecipientDetails({
        name: "",
        phone: "",
        email: "",
        address: "",
        bankAccount: "",
        iban: ""
      });
    } catch (error) {
      console.error('Transfer failed:', error);
      alert("Transfer failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateFees = (amount: string) => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return { fee: 0, total: 0, localAmount: 0 };

    const fee = amt * 0.0075; // 0.75% fee
    const total = amt + fee;
    const localAmount = amt * (selectedCountryData?.exchangeRate || 1);

    return { fee, total, localAmount };
  };

  const fees = calculateFees(amount);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                USDC Cross-Border Payments
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Send money globally with instant settlement and ultra-low fees
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Transfer Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="h-5 w-5 mr-2" />
                  Send Money Globally
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Amount and Country Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (USD)</Label>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="25"
                        className="pl-8"
                      />
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Minimum: $25 USD
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="country">Destination Country</Label>
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            <div className="flex items-center">
                              <span className="mr-2">{country.flag}</span>
                              <span>{country.name}</span>
                              <Badge variant="outline" className="ml-2">
                                {country.currency}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Recipient Details */}
                <div>
                  <Label className="text-base font-medium">Recipient Details</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label htmlFor="recipientName">Full Name *</Label>
                      <Input
                        id="recipientName"
                        placeholder="Enter recipient's full name"
                        value={recipientDetails.name}
                        onChange={(e) => setRecipientDetails({...recipientDetails, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipientEmail">Email Address *</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        placeholder="Enter recipient's email"
                        value={recipientDetails.email}
                        onChange={(e) => setRecipientDetails({...recipientDetails, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipientPhone">Phone Number</Label>
                      <Input
                        id="recipientPhone"
                        placeholder="Enter phone number"
                        value={recipientDetails.phone}
                        onChange={(e) => setRecipientDetails({...recipientDetails, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipientBank">Bank Account/IBAN</Label>
                      <Input
                        id="recipientBank"
                        placeholder="Enter bank details"
                        value={recipientDetails.bankAccount}
                        onChange={(e) => setRecipientDetails({...recipientDetails, bankAccount: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Transfer Summary */}
                {amount && parseFloat(amount) > 0 && selectedCountryData && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium mb-3">Transfer Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Send Amount:</span>
                        <span>${parseFloat(amount).toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transfer Fee (0.75%):</span>
                        <span>${fees.fee.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Exchange Rate:</span>
                        <span>1 USD = {selectedCountryData.exchangeRate} {selectedCountryData.currency}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total Cost:</span>
                        <span>${fees.total.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between font-medium text-green-600">
                        <span>Recipient Gets:</span>
                        <span>{fees.localAmount.toFixed(2)} {selectedCountryData.currency}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <Button 
                  onClick={handleTransfer}
                  disabled={!amount || parseFloat(amount) < 25 || !selectedCountry || !recipientDetails.name || !recipientDetails.email || isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    "Processing Transfer..."
                  ) : (
                    <>
                      Send ${amount || "0"} USD
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* USDC Balance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  USDC Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {balanceLoading ? "Loading..." : `$${usdcBalance?.balance || '0.00'}`}
                </div>
                <p className="text-sm text-gray-500">Available for transfers</p>
              </CardContent>
            </Card>

            {/* Transfer Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  Why Choose USDC?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <Clock className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="text-sm font-medium">Instant Settlement</div>
                      <div className="text-xs text-gray-500">2-5 seconds vs 3-5 business days</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <TrendingDown className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="text-sm font-medium">Ultra-Low Fees</div>
                      <div className="text-xs text-gray-500">0.75% vs 5-8% traditional banks</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="text-sm font-medium">Global Reach</div>
                      <div className="text-xs text-gray-500">150+ countries supported</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Shield className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="text-sm font-medium">Fully Regulated</div>
                      <div className="text-xs text-gray-500">Circle compliance standards</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Supported Countries */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="h-5 w-5 mr-2" />
                  Supported Countries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {countries.map((country) => (
                    <div key={country.code} className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <span className="mr-2">{country.flag}</span>
                        <span>{country.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {country.currency}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/usdc-buy">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Buy USDC
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/p2p-transfer">
                      <Zap className="h-4 w-4 mr-2" />
                      Domestic Transfer
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/usdc-ecosystem-dashboard">
                      <Globe className="h-4 w-4 mr-2" />
                      USDC Hub
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}