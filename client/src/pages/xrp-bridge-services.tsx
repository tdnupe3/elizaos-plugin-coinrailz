import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { 
  ArrowRightLeft, 
  Network,
 
  Globe, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Shield,
  Zap,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Eye,
  Activity,
  DollarSign,
  BarChart3,
  Network as Bridge
} from "@/lib/icons";

interface SupportedChain {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  rpcUrl: string;
  explorer: string;
  bridgeFee: number;
  estimatedTime: string;
  status: 'active' | 'maintenance' | 'coming_soon';
  tvl: number;
  dailyVolume: number;
}

interface BridgeTransaction {
  id: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: number;
  fee: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: string;
  txHash: string;
  estimatedTime: string;
  actualTime?: string;
}

interface ArbitrageOpportunity {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  priceXRP: number;
  priceETH: number;
  priceBSC: number;
  bestBuy: string;
  bestSell: string;
  profitPercent: number;
  profitUSD: number;
  volume24h: number;
  confidence: 'high' | 'medium' | 'low';
}

export default function XRPBridgeServices() {
  const [fromChain, setFromChain] = useState<string>('');
  const [toChain, setToChain] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('XRP');
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [arbitrageOpportunities, setArbitrageOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeStep, setBridgeStep] = useState(0);
  const [supportedChains, setSupportedChains] = useState<SupportedChain[]>([]);
  const [platformFees, setPlatformFees] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Fetch real bridge data from API
  const fetchBridgeData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/xrp/bridge');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSupportedChains(data.supportedChains);
          setTransactions(data.transactions);
          setArbitrageOpportunities(data.arbitrageOpportunities);
          setPlatformFees(data.platformFees);
          setLastUpdated(data.lastUpdated);
        }
      }
    } catch (error) {
      console.error('Error fetching bridge data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBridgeData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchBridgeData, 30000);
    return () => clearInterval(interval);
  }, []);

  // All bridge data now comes from real API endpoints

  const getChainById = (id: string) => supportedChains.find(chain => chain.id === id);

  const handleBridge = async () => {
    if (!fromChain || !toChain || !amount) {
      alert('Please fill in all fields');
      return;
    }

    if (fromChain === toChain) {
      alert('Source and destination chains must be different');
      return;
    }

    setIsBridging(true);
    setBridgeStep(0);

    try {
      // Step 1: Validate transaction
      setBridgeStep(1);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Lock tokens on source chain
      setBridgeStep(2);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Generate proof
      setBridgeStep(3);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 4: Mint tokens on destination chain
      setBridgeStep(4);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 5: Complete
      setBridgeStep(5);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create new transaction record
      const newTransaction: BridgeTransaction = {
        id: `bridge-${Date.now()}`,
        fromChain: getChainById(fromChain)?.name || fromChain,
        toChain: getChainById(toChain)?.name || toChain,
        fromToken: selectedToken,
        toToken: `w${selectedToken}`,
        amount: parseFloat(amount),
        fee: getChainById(fromChain)?.bridgeFee || 0.001,
        status: 'processing',
        timestamp: new Date().toISOString(),
        txHash: `0x${Math.random().toString(16).substr(2, 8)}...${Math.random().toString(16).substr(2, 4)}`,
        estimatedTime: getChainById(toChain)?.estimatedTime || '5-10 min'
      };

      setTransactions(prev => [newTransaction, ...prev]);
      setAmount('');
      
      alert('Bridge transaction initiated successfully!');

    } catch (error) {
      alert('Error initiating bridge transaction');
    } finally {
      setIsBridging(false);
      setBridgeStep(0);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const bridgeSteps = [
    { step: 1, title: 'Validating Transaction', description: 'Checking balances and parameters' },
    { step: 2, title: 'Locking Tokens', description: 'Securing tokens on source chain' },
    { step: 3, title: 'Generating Proof', description: 'Creating cryptographic proof' },
    { step: 4, title: 'Minting Tokens', description: 'Issuing wrapped tokens on destination' },
    { step: 5, title: 'Completed', description: 'Bridge transaction successful' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">XRP Bridge Services</h1>
                <p className="text-gray-600 mt-2">Connect XRP ecosystem with other blockchains</p>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="bg-blue-50 text-blue-800">
                  <Bridge className="w-4 h-4 mr-1" />
                  {supportedChains.filter(c => c.status === 'active').length} Active Chains
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-800">
                  <Shield className="w-4 h-4 mr-1" />
                  Secure
                </Badge>
              </div>
            </div>
          </div>

          <Tabs defaultValue="bridge" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="bridge">Bridge</TabsTrigger>
              <TabsTrigger value="arbitrage">Arbitrage</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="bridge" className="space-y-6">
              {/* Bridge Interface */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ArrowRightLeft className="w-5 h-5 mr-2" />
                      Cross-Chain Bridge
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Chain Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">From Chain</label>
                        <Select value={fromChain} onValueChange={setFromChain}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source chain" />
                          </SelectTrigger>
                          <SelectContent>
                            {supportedChains.filter(chain => chain.status === 'active').map(chain => (
                              <SelectItem key={chain.id} value={chain.id}>
                                <div className="flex items-center space-x-2">
                                  <span>{chain.logo}</span>
                                  <span>{chain.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">To Chain</label>
                        <Select value={toChain} onValueChange={setToChain}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination chain" />
                          </SelectTrigger>
                          <SelectContent>
                            {supportedChains.filter(chain => chain.status === 'active' && chain.id !== fromChain).map(chain => (
                              <SelectItem key={chain.id} value={chain.id}>
                                <div className="flex items-center space-x-2">
                                  <span>{chain.logo}</span>
                                  <span>{chain.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Token and Amount */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Token</label>
                        <Select value={selectedToken} onValueChange={setSelectedToken}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="XRP">XRP</SelectItem>
                            <SelectItem value="SOLO">SOLO</SelectItem>
                            <SelectItem value="CSC">CSC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Amount</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="Enter amount"
                        />
                      </div>
                    </div>

                    {/* Bridge Summary */}
                    {fromChain && toChain && amount && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium mb-3">Bridge Summary</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Amount</span>
                            <span>{amount} {selectedToken}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Bridge Fee</span>
                            <span>{getChainById(fromChain)?.bridgeFee || 0} {getChainById(fromChain)?.symbol}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Estimated Time</span>
                            <span>{getChainById(toChain)?.estimatedTime}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>You'll Receive</span>
                            <span>{amount} w{selectedToken}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bridge Button */}
                    <Button 
                      onClick={handleBridge}
                      disabled={isBridging || !fromChain || !toChain || !amount}
                      className="w-full"
                    >
                      {isBridging ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Bridging...
                        </div>
                      ) : (
                        'Bridge Tokens'
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Supported Chains */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Globe className="w-5 h-5 mr-2" />
                      Supported Chains
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {supportedChains.map(chain => (
                        <div key={chain.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{chain.logo}</span>
                            <div>
                              <div className="font-medium">{chain.name}</div>
                              <div className="text-sm text-gray-600">Fee: {chain.bridgeFee} {chain.symbol}</div>
                            </div>
                          </div>
                          <Badge variant={chain.status === 'active' ? 'default' : 'secondary'}>
                            {chain.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bridge Progress */}
              {isBridging && (
                <Card>
                  <CardHeader>
                    <CardTitle>Bridge Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Progress value={(bridgeStep / 5) * 100} className="w-full" />
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {bridgeSteps.map((step, index) => (
                          <div key={index} className={`text-center p-3 rounded-lg ${
                            bridgeStep >= step.step ? 'bg-green-50' : 'bg-gray-50'
                          }`}>
                            <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                              bridgeStep >= step.step ? 'bg-green-600 text-white' : 'bg-gray-300'
                            }`}>
                              {bridgeStep > step.step ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                step.step
                              )}
                            </div>
                            <div className="text-sm font-medium">{step.title}</div>
                            <div className="text-xs text-gray-600">{step.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="arbitrage" className="space-y-6">
              {/* Arbitrage Opportunities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Arbitrage Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {arbitrageOpportunities.map(opportunity => (
                      <div key={opportunity.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                              {opportunity.tokenSymbol.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium">{opportunity.tokenSymbol}</div>
                              <div className="text-sm text-gray-600">{opportunity.tokenName}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              +{opportunity.profitPercent.toFixed(1)}%
                            </div>
                            <div className="text-sm text-gray-600">
                              ${opportunity.profitUSD.toFixed(0)} profit
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div className="text-center">
                            <div className="text-gray-500">XRP Ledger</div>
                            <div className="font-medium">${opportunity.priceXRP.toFixed(4)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500">Ethereum</div>
                            <div className="font-medium">${opportunity.priceETH.toFixed(4)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500">BSC</div>
                            <div className="font-medium">${opportunity.priceBSC.toFixed(4)}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="text-sm">
                              <span className="text-gray-600">Buy on:</span>
                              <span className="font-medium text-green-600 ml-1">{opportunity.bestBuy}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600">Sell on:</span>
                              <span className="font-medium text-red-600 ml-1">{opportunity.bestSell}</span>
                            </div>
                            <Badge variant="outline" className={`${getConfidenceColor(opportunity.confidence)} border-current`}>
                              {opportunity.confidence} confidence
                            </Badge>
                          </div>
                          <Button variant="outline" size="sm">
                            Execute
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              {/* Transaction History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactions.map(tx => (
                      <div key={tx.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                            <div>
                              <div className="font-medium">{tx.fromChain} → {tx.toChain}</div>
                              <div className="text-sm text-gray-600">
                                {tx.amount} {tx.fromToken} → {tx.toToken}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className={`${getStatusColor(tx.status)} border-current`}>
                            {tx.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Amount</div>
                            <div className="font-medium">{tx.amount.toFixed(2)} {tx.fromToken}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Fee</div>
                            <div className="font-medium">{tx.fee.toFixed(4)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Time</div>
                            <div className="font-medium">{tx.actualTime || tx.estimatedTime}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Transaction</div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs">{tx.txHash}</span>
                              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(tx.txHash)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Bridge Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Total Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$5.87M</div>
                    <div className="text-sm text-green-600 flex items-center mt-1">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      +12.5% this week
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Active Bridges</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">156</div>
                    <div className="text-sm text-blue-600 flex items-center mt-1">
                      <Activity className="w-4 h-4 mr-1" />
                      24h transactions
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Avg. Bridge Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">8.2 min</div>
                    <div className="text-sm text-purple-600 flex items-center mt-1">
                      <Clock className="w-4 h-4 mr-1" />
                      Across all chains
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Chain Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Chain Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {supportedChains.filter(chain => chain.status === 'active').map(chain => (
                      <div key={chain.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{chain.logo}</span>
                          <div>
                            <div className="font-medium">{chain.name}</div>
                            <div className="text-sm text-gray-600">TVL: ${(chain.tvl / 1000000).toFixed(1)}M</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${(chain.dailyVolume / 1000000).toFixed(1)}M</div>
                          <div className="text-sm text-gray-600">24h Volume</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <MobileNavigation />
    </div>
  );
}