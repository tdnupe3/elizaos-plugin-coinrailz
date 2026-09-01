import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Globe, Clock, DollarSign, Shield, Zap, CheckCircle } from "@/lib/icons";

export default function XRPCrossBorderPayments() {
  const [, setLocation] = useLocation();
  const [fromAmount, setFromAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("EUR");
  const [recipientCountry, setRecipientCountry] = useState("");

  const exchangeRate = 0.92; // EUR/USD
  const xrpFee = 0.12; // XRP
  const estimatedTime = "3-5 seconds";

  const toAmount = fromAmount ? (parseFloat(fromAmount) * exchangeRate).toFixed(2) : "";

  const supportedCurrencies = [
    { code: "USD", name: "US Dollar", flag: "🇺🇸" },
    { code: "EUR", name: "Euro", flag: "🇪🇺" },
    { code: "GBP", name: "British Pound", flag: "🇬🇧" },
    { code: "JPY", name: "Japanese Yen", flag: "🇯🇵" },
    { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦" },
    { code: "AUD", name: "Australian Dollar", flag: "🇦🇺" },
    { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬" },
    { code: "MXN", name: "Mexican Peso", flag: "🇲🇽" }
  ];

  const benefits = [
    { icon: Clock, title: "3-5 Second Settlement", description: "Fastest international transfers" },
    { icon: DollarSign, title: "Ultra-Low Fees", description: "95% cheaper than traditional banks" },
    { icon: Shield, title: "On-Chain Security", description: "Cryptographic transaction validation" },
    { icon: Globe, title: "Global Coverage", description: "200+ countries and territories" }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/xrp-ecosystem")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to XRP Ecosystem</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                  <Globe className="w-6 h-6 text-blue-600" />
                  <span>Cross-Border Payments</span>
                </h1>
                <p className="text-gray-600">Ultra-fast international money transfers powered by XRP Ledger</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">Live Service</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Transfer Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <span>Send Money Internationally</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* From Amount */}
              <div className="space-y-2">
                <Label htmlFor="fromAmount">You Send</Label>
                <div className="flex space-x-2">
                  <Input
                    id="fromAmount"
                    type="number"
                    placeholder="0.00"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={fromCurrency} onValueChange={setFromCurrency}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedCurrencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.flag} {currency.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* To Amount */}
              <div className="space-y-2">
                <Label htmlFor="toAmount">Recipient Gets</Label>
                <div className="flex space-x-2">
                  <Input
                    id="toAmount"
                    value={toAmount}
                    readOnly
                    className="flex-1 bg-gray-50"
                  />
                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedCurrencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.flag} {currency.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Recipient Country */}
              <div className="space-y-2">
                <Label htmlFor="recipientCountry">Recipient Country</Label>
                <Select value={recipientCountry} onValueChange={setRecipientCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">🇺🇸 United States</SelectItem>
                    <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                    <SelectItem value="FR">🇫🇷 France</SelectItem>
                    <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                    <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                    <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                    <SelectItem value="SG">🇸🇬 Singapore</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction Summary */}
              {fromAmount && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-blue-900">Transaction Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Exchange Rate:</span>
                      <span className="font-medium">1 {fromCurrency} = {exchangeRate} {toCurrency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">XRP Network Fee:</span>
                      <span className="font-medium">{xrpFee} XRP (~$0.12)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Estimated Time:</span>
                      <span className="font-medium text-green-600">{estimatedTime}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-base font-semibold text-blue-900">
                      <span>Total Cost:</span>
                      <span>{fromAmount} {fromCurrency} + {xrpFee} XRP</span>
                    </div>
                  </div>
                </div>
              )}

              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!fromAmount || !recipientCountry}
              >
                Continue to Recipient Details
              </Button>
            </CardContent>
          </Card>

          {/* Benefits & Features */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Why Choose XRP Cross-Border Payments?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <benefit.icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{benefit.title}</h4>
                        <p className="text-sm text-gray-600">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supported Corridors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">🇺🇸 USA → 🇪🇺 Europe</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600">3s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">🇺🇸 USA → 🇯🇵 Japan</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600">4s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">🇪🇺 Europe → 🇸🇬 Singapore</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600">5s</span>
                    </div>
                  </div>
                  <div className="text-center pt-2">
                    <Button variant="outline" size="sm">
                      View All 200+ Corridors
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Traditional vs XRP Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-700 border-b pb-2">
                    <div>Feature</div>
                    <div>Traditional Banks</div>
                    <div>XRP Ledger</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="font-medium">Settlement Time</div>
                    <div className="text-red-600">3-5 business days</div>
                    <div className="text-green-600 font-medium">3-5 seconds</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="font-medium">Transfer Fee</div>
                    <div className="text-red-600">$15-50</div>
                    <div className="text-green-600 font-medium">~$0.12</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="font-medium">Exchange Rate</div>
                    <div className="text-red-600">2-4% markup</div>
                    <div className="text-green-600 font-medium">Real-time rates</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="font-medium">Transparency</div>
                    <div className="text-red-600">Hidden fees</div>
                    <div className="text-green-600 font-medium">Full transparency</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}