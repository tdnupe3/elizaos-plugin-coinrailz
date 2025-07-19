import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  Bank, 
  Zap, 
  Shield,
  Clock,
  CheckCircle,
  ArrowRight
} from "@/lib/icons";

export function QuickFunding() {
  const [amount, setAmount] = useState("50");
  const [fundingMethod, setFundingMethod] = useState("debit_card");

  const quickAmounts = ['25', '50', '100', '250'];
  
  const debitCardFee = parseFloat(amount) * 0.029; // 2.9%
  const aclFee = parseFloat(amount) * 0.005; // 0.5%

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-500" />
          Add Money
        </CardTitle>
        <p className="text-sm text-gray-600">
          Fund your wallet instantly and start using the platform
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Amount Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">How much would you like to add?</label>
          
          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((quickAmount) => (
              <Button
                key={quickAmount}
                variant={amount === quickAmount ? "default" : "outline"}
                size="sm"
                onClick={() => setAmount(quickAmount)}
                className="relative"
              >
                ${quickAmount}
                {quickAmount === '50' && (
                  <Badge className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1">
                    Popular
                  </Badge>
                )}
              </Button>
            ))}
          </div>
          
          {/* Custom Amount */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              $
            </span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="pl-8 text-lg font-semibold"
            />
          </div>
        </div>

        {/* Funding Method */}
        <Tabs value={fundingMethod} onValueChange={setFundingMethod} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="debit_card" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Debit Card
            </TabsTrigger>
            <TabsTrigger value="ach" className="flex items-center gap-2">
              <Bank className="w-4 h-4" />
              Bank Account
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="debit_card" className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold">Instant funding</span>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Ready in seconds
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-semibold">${amount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing fee (2.9%):</span>
                  <span>${debitCardFee.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total charge:</span>
                  <span>${(parseFloat(amount) + debitCardFee).toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <Button className="w-full h-12 text-lg font-semibold" disabled>
              Coming Soon - Direct Card Purchase
            </Button>
            <p className="text-xs text-center text-gray-500 mt-2">
              Fiat onramp integration in development
            </p>
          </TabsContent>
          
          <TabsContent value="ach" className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bank className="w-4 h-4 text-green-500" />
                  <span className="font-semibold">Bank transfer</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Lowest fees
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-semibold">${amount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing fee (0.5%):</span>
                  <span>${aclFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-orange-600">
                  <span>Arrives in:</span>
                  <span>1-2 business days</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total charge:</span>
                  <span>${(parseFloat(amount) + aclFee).toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <Button className="w-full h-12 text-lg font-semibold" disabled>
              Coming Soon - Bank Transfer
            </Button>
            <p className="text-xs text-center text-gray-500 mt-2">
              Direct USDC purchase in development
            </p>
          </TabsContent>
        </Tabs>

        {/* Security & Benefits */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-center text-xs">
            <div className="space-y-1">
              <Shield className="w-5 h-5 mx-auto text-green-500" />
              <div className="text-gray-600">
                <div className="font-semibold">FDIC Insured</div>
                <div>Bank security</div>
              </div>
            </div>
            <div className="space-y-1">
              <CheckCircle className="w-5 h-5 mx-auto text-blue-500" />
              <div className="text-gray-600">
                <div className="font-semibold">Instant trading</div>
                <div>Available immediately</div>
              </div>
            </div>
            <div className="space-y-1">
              <Zap className="w-5 h-5 mx-auto text-purple-500" />
              <div className="text-gray-600">
                <div className="font-semibold">Global access</div>
                <div>Send anywhere</div>
              </div>
            </div>
          </div>
          
          {/* Welcome bonus callout */}
          {parseFloat(amount) >= 50 && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  $
                </div>
                <div>
                  <div className="font-semibold text-purple-800">Welcome bonus!</div>
                  <div className="text-purple-600">Get 1% back on your first $50+ deposit</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-2">
            Need help with funding?
          </div>
          <Button variant="ghost" size="sm" className="text-blue-500 text-xs">
            View funding guide <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}