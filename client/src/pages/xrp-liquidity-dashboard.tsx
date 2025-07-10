import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Droplets,
  Calculator,
  AlertTriangle,
  Target,
  Clock,
  Shield,
  Zap,
  BarChart3,
  PieChart,
  Activity
} from "@/lib/icons";

interface LiquidityPool {
  id: string;
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  reserveA: number;
  reserveB: number;
  totalLiquidity: number;
  apy: number;
  volume24h: number;
  fees24h: number;
  myLiquidity: number;
  myShare: number;
  impermanentLoss: number;
  status: 'active' | 'inactive' | 'new';
}

interface UserPosition {
  poolId: string;
  tokenA: string;
  tokenB: string;
  symbolA: string;
  symbolB: string;
  liquidityTokens: number;
  valueUSD: number;
  dailyEarnings: number;
  totalEarnings: number;
  impermanentLoss: number;
  entryPrice: number;
  currentPrice: number;
}

export default function XRPLiquidityDashboard() {
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [selectedPool, setSelectedPool] = useState<LiquidityPool | null>(null);
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [isRemovingLiquidity, setIsRemovingLiquidity] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [dailyEarnings, setDailyEarnings] = useState(0);

  const mockPools: LiquidityPool[] = [
    {
      id: 'xrp-usd',
      tokenA: 'XRP',
      tokenB: 'USD',
      symbolA: 'XRP',
      symbolB: 'USD',
      reserveA: 1000000,
      reserveB: 2250000,
      totalLiquidity: 5000000,
      apy: 12.5,
      volume24h: 125000,
      fees24h: 375,
      myLiquidity: 1000,
      myShare: 0.02,
      impermanentLoss: -2.3,
      status: 'active'
    },
    {
      id: 'xrp-btc',
      tokenA: 'XRP',
      tokenB: 'BTC',
      symbolA: 'XRP',
      symbolB: 'BTC',
      reserveA: 2000000,
      reserveB: 45,
      totalLiquidity: 2800000,
      apy: 18.7,
      volume24h: 85000,
      fees24h: 255,
      myLiquidity: 0,
      myShare: 0,
      impermanentLoss: 0,
      status: 'active'
    },
    {
      id: 'solo-xrp',
      tokenA: 'SOLO',
      tokenB: 'XRP',
      symbolA: 'SOLO',
      symbolB: 'XRP',
      reserveA: 500000,
      reserveB: 160000,
      totalLiquidity: 280000,
      apy: 24.3,
      volume24h: 25000,
      fees24h: 75,
      myLiquidity: 500,
      myShare: 0.18,
      impermanentLoss: 1.8,
      status: 'active'
    }
  ];

  const mockPositions: UserPosition[] = [
    {
      poolId: 'xrp-usd',
      tokenA: 'XRP',
      tokenB: 'USD',
      symbolA: 'XRP',
      symbolB: 'USD',
      liquidityTokens: 1000,
      valueUSD: 1000,
      dailyEarnings: 0.34,
      totalEarnings: 125.50,
      impermanentLoss: -23.00,
      entryPrice: 2.12,
      currentPrice: 2.25
    },
    {
      poolId: 'solo-xrp',
      tokenA: 'SOLO',
      tokenB: 'XRP',
      symbolA: 'SOLO',
      symbolB: 'XRP',
      liquidityTokens: 500,
      valueUSD: 500,
      dailyEarnings: 0.33,
      totalEarnings: 89.75,
      impermanentLoss: 9.00,
      entryPrice: 0.30,
      currentPrice: 0.32
    }
  ];

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setPools(mockPools);
      setPositions(mockPositions);
      
      // Calculate totals
      const totalVal = mockPositions.reduce((sum, pos) => sum + pos.valueUSD, 0);
      const totalEarn = mockPositions.reduce((sum, pos) => sum + pos.totalEarnings, 0);
      const dailyEarn = mockPositions.reduce((sum, pos) => sum + pos.dailyEarnings, 0);
      
      setTotalValue(totalVal);
      setTotalEarnings(totalEarn);
      setDailyEarnings(dailyEarn);
    }, 1000);
  }, []);

  const handleAddLiquidity = async () => {
    if (!selectedPool || !liquidityAmount) return;
    
    setIsAddingLiquidity(true);
    try {
      // Simulate adding liquidity
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update pool data
      const amount = parseFloat(liquidityAmount);
      const updatedPools = pools.map(pool => 
        pool.id === selectedPool.id 
          ? { ...pool, myLiquidity: pool.myLiquidity + amount, totalLiquidity: pool.totalLiquidity + amount }
          : pool
      );
      setPools(updatedPools);
      
      // Create new position or update existing
      const existingPosition = positions.find(pos => pos.poolId === selectedPool.id);
      if (existingPosition) {
        const updatedPositions = positions.map(pos => 
          pos.poolId === selectedPool.id 
            ? { ...pos, liquidityTokens: pos.liquidityTokens + amount, valueUSD: pos.valueUSD + amount }
            : pos
        );
        setPositions(updatedPositions);
      } else {
        const newPosition: UserPosition = {
          poolId: selectedPool.id,
          tokenA: selectedPool.tokenA,
          tokenB: selectedPool.tokenB,
          symbolA: selectedPool.symbolA,
          symbolB: selectedPool.symbolB,
          liquidityTokens: amount,
          valueUSD: amount,
          dailyEarnings: amount * (selectedPool.apy / 365 / 100),
          totalEarnings: 0,
          impermanentLoss: 0,
          entryPrice: selectedPool.tokenA === 'XRP' ? 2.25 : 0.32,
          currentPrice: selectedPool.tokenA === 'XRP' ? 2.25 : 0.32
        };
        setPositions([...positions, newPosition]);
      }
      
      setLiquidityAmount('');
      alert('Liquidity added successfully!');
      
    } catch (error) {
      alert('Error adding liquidity');
    } finally {
      setIsAddingLiquidity(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!selectedPool || !liquidityAmount) return;
    
    setIsRemovingLiquidity(true);
    try {
      // Simulate removing liquidity
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const amount = parseFloat(liquidityAmount);
      
      // Update pool data
      const updatedPools = pools.map(pool => 
        pool.id === selectedPool.id 
          ? { ...pool, myLiquidity: Math.max(0, pool.myLiquidity - amount), totalLiquidity: Math.max(0, pool.totalLiquidity - amount) }
          : pool
      );
      setPools(updatedPools);
      
      // Update positions
      const updatedPositions = positions.map(pos => 
        pos.poolId === selectedPool.id 
          ? { ...pos, liquidityTokens: Math.max(0, pos.liquidityTokens - amount), valueUSD: Math.max(0, pos.valueUSD - amount) }
          : pos
      ).filter(pos => pos.liquidityTokens > 0);
      setPositions(updatedPositions);
      
      setLiquidityAmount('');
      alert('Liquidity removed successfully!');
      
    } catch (error) {
      alert('Error removing liquidity');
    } finally {
      setIsRemovingLiquidity(false);
    }
  };

  const getAPYColor = (apy: number) => {
    if (apy >= 20) return 'text-green-600';
    if (apy >= 10) return 'text-blue-600';
    return 'text-gray-600';
  };

  const getImpermanentLossColor = (loss: number) => {
    if (loss < -5) return 'text-red-600';
    if (loss < 0) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">XRP Liquidity Dashboard</h1>
                <p className="text-gray-600 mt-2">Provide liquidity and earn rewards on XRP pairs</p>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="bg-blue-50 text-blue-800">
                  <Droplets className="w-4 h-4 mr-1" />
                  {pools.length} Pools
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-800">
                  <Shield className="w-4 h-4 mr-1" />
                  Protected
                </Badge>
              </div>
            </div>
          </div>

          {/* Portfolio Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Across all pools</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Daily Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${dailyEarnings.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Last 24 hours</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">${totalEarnings.toFixed(2)}</div>
                <div className="text-sm text-gray-600">All time</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <PieChart className="w-5 h-5 mr-2" />
                  Active Pools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{positions.length}</div>
                <div className="text-sm text-gray-600">Providing liquidity</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="pools" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pools">All Pools</TabsTrigger>
              <TabsTrigger value="positions">My Positions</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="pools" className="space-y-6">
              {/* Available Pools */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {pools.map(pool => (
                  <Card key={pool.id} className={`cursor-pointer transition-all ${
                    selectedPool?.id === pool.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                  }`} onClick={() => setSelectedPool(pool)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{pool.symbolA}/{pool.symbolB}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className={`${getAPYColor(pool.apy)} border-current`}>
                            {pool.apy.toFixed(1)}% APY
                          </Badge>
                          <Badge variant={pool.status === 'active' ? 'default' : 'secondary'}>
                            {pool.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Total Liquidity</div>
                          <div className="font-medium">${pool.totalLiquidity.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">24h Volume</div>
                          <div className="font-medium">${pool.volume24h.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">24h Fees</div>
                          <div className="font-medium">${pool.fees24h.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">My Liquidity</div>
                          <div className="font-medium">${pool.myLiquidity.toFixed(2)}</div>
                        </div>
                      </div>
                      
                      {pool.myLiquidity > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span>Pool Share</span>
                            <span className="font-medium">{pool.myShare.toFixed(2)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span>Impermanent Loss</span>
                            <span className={`font-medium ${getImpermanentLossColor(pool.impermanentLoss)}`}>
                              {pool.impermanentLoss > 0 ? '+' : ''}{pool.impermanentLoss.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Liquidity Actions */}
              {selectedPool && (
                <Card>
                  <CardHeader>
                    <CardTitle>Manage Liquidity - {selectedPool.symbolA}/{selectedPool.symbolB}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Add Liquidity */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-green-600 flex items-center">
                          <Plus className="w-5 h-5 mr-2" />
                          Add Liquidity
                        </h3>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Amount (USD)</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={liquidityAmount}
                            onChange={(e) => setLiquidityAmount(e.target.value)}
                            placeholder="Enter amount"
                          />
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-sm">
                          <div className="flex justify-between">
                            <span>Expected APY</span>
                            <span className="font-medium">{selectedPool.apy.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span>Daily Earnings</span>
                            <span className="font-medium">
                              ${liquidityAmount ? (parseFloat(liquidityAmount) * selectedPool.apy / 365 / 100).toFixed(4) : '0.0000'}
                            </span>
                          </div>
                        </div>
                        <Button 
                          onClick={handleAddLiquidity}
                          disabled={isAddingLiquidity || !liquidityAmount}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {isAddingLiquidity ? (
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Adding...
                            </div>
                          ) : (
                            'Add Liquidity'
                          )}
                        </Button>
                      </div>

                      {/* Remove Liquidity */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-red-600 flex items-center">
                          <Minus className="w-5 h-5 mr-2" />
                          Remove Liquidity
                        </h3>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Amount (USD)</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={liquidityAmount}
                            onChange={(e) => setLiquidityAmount(e.target.value)}
                            placeholder="Enter amount"
                          />
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg text-sm">
                          <div className="flex justify-between">
                            <span>Available to Remove</span>
                            <span className="font-medium">${selectedPool.myLiquidity.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span>Current IL</span>
                            <span className={`font-medium ${getImpermanentLossColor(selectedPool.impermanentLoss)}`}>
                              {selectedPool.impermanentLoss > 0 ? '+' : ''}{selectedPool.impermanentLoss.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                        <Button 
                          onClick={handleRemoveLiquidity}
                          disabled={isRemovingLiquidity || !liquidityAmount || selectedPool.myLiquidity === 0}
                          variant="destructive"
                          className="w-full"
                        >
                          {isRemovingLiquidity ? (
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Removing...
                            </div>
                          ) : (
                            'Remove Liquidity'
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="positions" className="space-y-6">
              {/* My Positions */}
              <div className="space-y-4">
                {positions.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Droplets className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Positions</h3>
                      <p className="text-gray-500">Start providing liquidity to earn rewards</p>
                    </CardContent>
                  </Card>
                ) : (
                  positions.map(position => (
                    <Card key={position.poolId}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                              {position.symbolA.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{position.symbolA}/{position.symbolB}</h3>
                              <p className="text-sm text-gray-600">{position.liquidityTokens.toFixed(2)} LP tokens</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${position.valueUSD.toFixed(2)}</div>
                            <div className="text-sm text-gray-600">Current Value</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Daily Earnings</div>
                            <div className="font-medium text-green-600">${position.dailyEarnings.toFixed(4)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Total Earnings</div>
                            <div className="font-medium text-blue-600">${position.totalEarnings.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Impermanent Loss</div>
                            <div className={`font-medium ${getImpermanentLossColor(position.impermanentLoss)}`}>
                              {position.impermanentLoss > 0 ? '+' : ''}${position.impermanentLoss.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">Entry Price</div>
                            <div className="font-medium">${position.entryPrice.toFixed(4)}</div>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span>Performance</span>
                            <span className={`font-medium ${
                              position.totalEarnings + position.impermanentLoss > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ${(position.totalEarnings + position.impermanentLoss).toFixed(2)}
                            </span>
                          </div>
                          <Progress 
                            value={Math.abs(position.totalEarnings + position.impermanentLoss) / position.valueUSD * 100} 
                            className="mt-2"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Analytics Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Earnings Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">This Week</span>
                        <span className="font-medium text-green-600">${(dailyEarnings * 7).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">This Month</span>
                        <span className="font-medium text-blue-600">${(dailyEarnings * 30).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Projected Annual</span>
                        <span className="font-medium text-purple-600">${(dailyEarnings * 365).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Risk Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Impermanent Loss Risk</span>
                        <Badge variant="outline" className="text-orange-600 border-orange-600">Medium</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Liquidity Risk</span>
                        <Badge variant="outline" className="text-green-600 border-green-600">Low</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Smart Contract Risk</span>
                        <Badge variant="outline" className="text-green-600 border-green-600">Low</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Strategy Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    Strategy Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800">Diversification Opportunity</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Consider adding liquidity to XRP/BTC pool for higher APY (18.7%) and portfolio diversification.
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-800">Optimal Pool Balance</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Your current allocation is well-balanced. Consider increasing position sizes to maximize earnings.
                      </p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-semibold text-orange-800">Impermanent Loss Alert</h4>
                      <p className="text-sm text-orange-700 mt-1">
                        Monitor SOLO/XRP position closely due to higher volatility. Consider setting stop-loss at -10%.
                      </p>
                    </div>
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