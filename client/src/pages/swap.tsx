import React from "react";
import { useTranslation } from "react-i18next";
import { WalletConnect } from "@/components/wallet-connect";
import { TokenLogoSwapInterface } from "@/components/token-logo-swap";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavigationHeader } from "@/components/navigation-header";
import FeeCalculator from "@/components/FeeCalculator";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function SwapPage() {
  const { t } = useTranslation();
  const [swapAmount, setSwapAmount] = React.useState(0);
  const [tradingFees, setTradingFees] = React.useState<any>(null);
  
  const handleFeeCalculation = (calculation: any, breakdown: any) => {
    setTradingFees({ calculation, breakdown });
  };

  const handleSwapAmountChange = (amount: number) => {
    setSwapAmount(amount);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NavigationHeader />
      
      {/* Language Switcher in top right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <div className="container mx-auto px-4 py-8">
        {/* Guest Access Notice */}
        <Alert className="max-w-5xl mx-auto mb-6 bg-green-50 border-green-200">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Guest Access Available:</strong> Connect any Web3 wallet to start trading. No Coin Railz account required for DEX access.
          </AlertDescription>
        </Alert>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t('swap.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('swap.subtitle')} • Trading fees automatically calculated
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Wallet Connection */}
          <div className="xl:col-span-1">
            <WalletConnect className="mb-6" />
            
            {/* Trading Fee Calculator */}
            <Card className="bg-white shadow-sm border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg">Trading Fees</CardTitle>
              </CardHeader>
              <CardContent>
                <FeeCalculator
                  defaultAmount={swapAmount}
                  transactionType="crypto"
                  defaultPaymentMethod="crypto"
                  onCalculationComplete={handleFeeCalculation}
                  showCalculateButton={false}
                />
                {tradingFees && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Platform Fee:</strong> ${tradingFees.calculation.platformFee.toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Revenue-generating fee on all swaps
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Swap Interface */}
          <div className="xl:col-span-3">
            <TokenLogoSwapInterface 
              onAmountChange={handleSwapAmountChange}
              tradingFees={tradingFees}
              onSwapComplete={async (swapData) => {
                // Record trading fees in database for revenue tracking
                try {
                  await apiRequest('POST', '/api/balance/record-trading-fee', {
                    userAddress: swapData.userAddress,
                    fromToken: swapData.fromToken,
                    toToken: swapData.toToken,
                    amount: swapData.amount,
                    platformFee: tradingFees?.calculation?.platformFee || 0,
                    transactionHash: swapData.transactionHash
                  });
                  console.log('✅ Trading fees recorded successfully');
                } catch (error) {
                  console.warn('Failed to record trading fees:', error);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}