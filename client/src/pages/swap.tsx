import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownUp, Info } from "lucide-react";
import { WalletConnect } from "@/components/wallet-connect";
import { useState } from "react";

const chains = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'bsc', name: 'BSC', symbol: 'BNB' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' }
];

const tokens = [
  { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin', chain: 'ethereum' },
  { symbol: 'USDT', name: 'Tether', chain: 'ethereum' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', chain: 'ethereum' },
  { symbol: 'UNI', name: 'Uniswap', chain: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', chain: 'solana' },
  { symbol: 'USDC', name: 'USD Coin', chain: 'solana' },
  { symbol: 'RAY', name: 'Raydium', chain: 'solana' },
  { symbol: 'MATIC', name: 'Polygon', chain: 'polygon' },
  { symbol: 'BNB', name: 'Binance Coin', chain: 'bsc' },
  { symbol: 'AVAX', name: 'Avalanche', chain: 'avalanche' },
  { symbol: 'ADA', name: 'Cardano', chain: 'cardano' },
  { symbol: 'DOT', name: 'Polkadot', chain: 'polkadot' }
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
    <div className="min-h-screen bg-gray-200">
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

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Wallet Connect */}
          <div className="lg:col-span-1">
            <WalletConnect />
          </div>
          
          {/* Swap Interface */}
          <div className="lg:col-span-2">
            <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-center">Swap Tokens</CardTitle>
            <p className="text-sm text-gray-600 text-center mt-2">
              Find the best rates across multiple decentralized exchanges
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Instructional Banner */}
            <div className="bg-emerald-50 rounded-lg p-4 space-y-2 text-sm">
              <h4 className="font-medium text-emerald-900">How DEX Aggregation Works:</h4>
              <ul className="text-emerald-800 space-y-1">
                <li>• We search multiple decentralized exchanges (Uniswap, SushiSwap, 1inch)</li>
                <li>• Compare rates and find you the best price</li>
                <li>• Execute trades with minimal slippage and gas fees</li>
                <li>• All trades happen directly from your wallet</li>
              </ul>
            </div>

            {/* Chain Selection */}
            <div className="space-y-2">
              <Label>Select Chain</Label>
              <p className="text-xs text-gray-500">Choose the blockchain network for your swap</p>
              <Select value={selectedChain} onValueChange={setSelectedChain}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="Try selecting Ethereum" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {chains.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id} className="bg-white hover:bg-gray-100">
                      {chain.name} ({chain.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sell Token Section */}
            <div className="space-y-2">
              <Label>You Pay</Label>
              <p className="text-xs text-gray-500">Enter the amount you want to swap</p>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Input 
                    type="number"
                    placeholder="Try entering 1.0"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    className="bg-white border-gray-300"
                  />
                </div>
                <div className="w-32">
                  <Select value={sellToken} onValueChange={setSellToken}>
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {getFilteredTokens(selectedChain).map((token) => (
                        <SelectItem key={token.symbol} value={token.symbol} className="bg-white hover:bg-gray-100">
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
                className="rounded-full border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:border-gray-300 focus:ring-gray-200"
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
                    className="bg-white border-gray-300"
                  />
                </div>
                <div className="w-32">
                  <Select value={buyToken} onValueChange={setBuyToken}>
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {getFilteredTokens(selectedChain).map((token) => (
                        <SelectItem key={token.symbol} value={token.symbol} className="bg-white hover:bg-gray-100">
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
          </div>
        </div>

        {/* Future Features */}
        <div className="max-w-md mx-auto mt-6">
          <Card className="bg-white">
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
    </div>
  );
}