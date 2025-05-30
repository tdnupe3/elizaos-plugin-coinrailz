import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownUp, Info } from "lucide-react";
import { useState } from "react";

const chains = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'bsc', name: 'BSC', symbol: 'BNB' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' }
];

const tokens = [
  { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin', chain: 'ethereum' },
  { symbol: 'USDT', name: 'Tether', chain: 'ethereum' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', chain: 'ethereum' },
  { symbol: 'UNI', name: 'Uniswap', chain: 'ethereum' },
  { symbol: 'MATIC', name: 'Polygon', chain: 'polygon' },
  { symbol: 'BNB', name: 'Binance Coin', chain: 'bsc' }
];

export default function SwapPage() {
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [sellToken, setSellToken] = useState('ETH');
  const [buyToken, setBuyToken] = useState('USDC');
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');

  const handleSwapTokens = () => {
    const tempToken = sellToken;
    setSellToken(buyToken);
    setBuyToken(tempToken);
    
    const tempAmount = sellAmount;
    setSellAmount(buyAmount);
    setBuyAmount(tempAmount);
  };

  const getFilteredTokens = (chainId: string) => {
    return tokens.filter(token => token.chain === chainId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">DEX Aggregator</h1>
              <p className="text-gray-600 mt-1">Swap crypto tokens across multiple chains</p>
            </div>
            <Button 
              variant="outline"
              className="bg-gray-600 border-gray-600 text-white hover:bg-gray-700"
              onClick={() => window.location.href = "/"}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>

      {/* Guest Banner */}
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Info className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 text-sm">
              You're exploring Coin Railz as a guest. Sign up to access Send Money, Buy/Sell features.
            </span>
            <Button 
              size="sm"
              onClick={() => window.location.href = "/api/login"}
              className="bg-blue-600 hover:bg-blue-700 text-white ml-auto"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </div>

      {/* Swap Interface */}
      <div className="max-w-md mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Swap Tokens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Chain Selection */}
            <div className="space-y-2">
              <Label>Select Chain</Label>
              <Select value={selectedChain} onValueChange={setSelectedChain}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {chains.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.name} ({chain.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sell Token Section */}
            <div className="space-y-2">
              <Label>You Pay</Label>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Input 
                    type="number"
                    placeholder="0.0"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Select value={sellToken} onValueChange={setSellToken}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredTokens(selectedChain).map((token) => (
                        <SelectItem key={token.symbol} value={token.symbol}>
                          {token.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-2"
                onClick={handleSwapTokens}
              >
                <ArrowDownUp className="w-4 h-4" />
              </Button>
            </div>

            {/* Buy Token Section */}
            <div className="space-y-2">
              <Label>You Receive</Label>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Input 
                    type="number"
                    placeholder="0.0"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Select value={buyToken} onValueChange={setBuyToken}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredTokens(selectedChain).map((token) => (
                        <SelectItem key={token.symbol} value={token.symbol}>
                          {token.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Swap Information */}
            <div className="bg-emerald-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-emerald-700">Exchange Rate:</span>
                <span className="text-emerald-800 font-medium">1 {sellToken} = ~1,800 {buyToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">Network Fee:</span>
                <span className="text-emerald-800">~$15.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">Slippage:</span>
                <span className="text-emerald-800">0.5%</span>
              </div>
              {sellAmount && (
                <div className="flex justify-between font-medium pt-2 border-t border-emerald-200">
                  <span className="text-emerald-800">You'll Receive:</span>
                  <span className="text-emerald-800">${(parseFloat(sellAmount) * 1800 - 15 - parseFloat(sellAmount) * 1800 * 0.0025).toFixed(2)}</span>
                </div>
              )}
              <p className="text-xs text-gray-400 pt-1">
                Coin Railz fee 0.25% included. Network fees vary.
              </p>
            </div>

            {/* Swap Button */}
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
              disabled={!sellAmount || !buyAmount}
            >
              Preview Swap
            </Button>

            {/* Guest Limitation Notice */}
            <div className="text-center text-sm text-gray-500 pt-4 border-t">
              <p>Demo mode - actual swaps require account registration</p>
              <Button 
                variant="link" 
                className="text-blue-600 p-0 h-auto"
                onClick={() => window.location.href = "/api/login"}
              >
                Create account to start trading
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Future Features */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• Multi-chain bridge functionality</p>
              <p>• Advanced trading features</p>
              <p>• Portfolio tracking</p>
              <p>• Yield farming integration</p>
            </div>
          </CardContent>
        </Card>

        {/* ISO Compliance Footer */}
        <div className="mt-6 text-center">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 inline-block">
            <p className="text-xs text-emerald-700 font-medium">
              ISO 20022 Compliant Swaps • Cross-Chain Compliance
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}