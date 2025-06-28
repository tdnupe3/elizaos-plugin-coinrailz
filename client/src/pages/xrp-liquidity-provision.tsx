import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, Droplets, DollarSign, BarChart3, Zap, AlertTriangle, Info } from "@/lib/icons";

export default function XRPLiquidityProvision() {
  const [, setLocation] = useLocation();
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [selectedPool, setSelectedPool] = useState("");
  const [stakingPeriod, setStakingPeriod] = useState("");

  const liquidityPools = [
    {
      id: "xrp-usd",
      name: "XRP/USD",
      totalValue: "$45.2M",
      apy: "12.5%",
      volume24h: "$2.1M",
      fees24h: "$8,420",
      risk: "Low"
    },
    {
      id: "xrp-eur",
      name: "XRP/EUR", 
      totalValue: "$28.7M",
      apy: "11.8%",
      volume24h: "$1.3M",
      fees24h: "$5,220",
      risk: "Low"
    },
    {
      id: "xrp-btc",
      name: "XRP/BTC",
      totalValue: "$52.1M",
      apy: "15.2%",
      volume24h: "$3.8M",
      fees24h: "$15,320",
      risk: "Medium"
    },
    {
      id: "xrp-eth",
      name: "XRP/ETH",
      totalValue: "$38.9M",
      apy: "13.7%",
      volume24h: "$2.7M",
      fees24h: "$10,890",
      risk: "Medium"
    }
  ];

  const myPositions = [
    {
      pool: "XRP/USD",
      amount: "$12,500",
      earned: "$1,562.50",
      apy: "12.5%",
      duration: "45 days",
      status: "active"
    },
    {
      pool: "XRP/BTC",
      amount: "$8,750",
      earned: "$332.19",
      apy: "15.2%",
      duration: "12 days",
      status: "active"
    }
  ];

  const stakingOptions = [
    { period: "flexible", label: "Flexible (No Lock)", apy: "8.5%", minAmount: "$100" },
    { period: "30d", label: "30 Days", apy: "11.2%", minAmount: "$500" },
    { period: "90d", label: "90 Days", apy: "13.8%", minAmount: "$1,000" },
    { period: "180d", label: "180 Days", apy: "16.5%", minAmount: "$5,000" },
    { period: "365d", label: "1 Year", apy: "19.2%", minAmount: "$10,000" }
  ];

  const benefits = [
    {
      title: "Automated Market Making",
      description: "Earn fees from every transaction in the pool",
      icon: Zap
    },
    {
      title: "Compound Interest",
      description: "Fees automatically reinvested for exponential growth",
      icon: TrendingUp
    },
    {
      title: "Low Impermanent Loss",
      description: "XRP's stability reduces risk compared to volatile pairs",
      icon: Droplets
    },
    {
      title: "Real-time Analytics",
      description: "Track performance with detailed profit/loss reporting",
      icon: BarChart3
    }
  ];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-600 bg-green-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'High': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

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
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  <span>Liquidity Provision</span>
                </h1>
                <p className="text-gray-600">Earn passive income by providing liquidity to XRP trading pairs</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">Live Service</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="pools" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pools">Available Pools</TabsTrigger>
            <TabsTrigger value="provide">Provide Liquidity</TabsTrigger>
            <TabsTrigger value="positions">My Positions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="pools">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Active Liquidity Pools</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {liquidityPools.map((pool) => (
                        <div key={pool.id} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <Droplets className="w-5 h-5 text-green-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">{pool.name}</h3>
                                <p className="text-sm text-gray-600">Total Value: {pool.totalValue}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600">{pool.apy}</div>
                              <div className="text-sm text-gray-500">APY</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">24h Volume:</span>
                              <div className="font-medium">{pool.volume24h}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">24h Fees:</span>
                              <div className="font-medium">{pool.fees24h}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Risk Level:</span>
                              <Badge className={`text-xs ${getRiskColor(pool.risk)}`}>
                                {pool.risk}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 mt-4">
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => setSelectedPool(pool.id)}
                            >
                              Provide Liquidity
                            </Button>
                            <Button size="sm" variant="outline">
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Pool Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">$164.9M</div>
                        <div className="text-sm text-green-700">Total Liquidity</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">13.4%</div>
                        <div className="text-sm text-blue-700">Average APY</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">$9.9M</div>
                        <div className="text-sm text-purple-700">24h Volume</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Liquidity Benefits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {benefits.map((benefit, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <benefit.icon className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 text-sm">{benefit.title}</h4>
                            <p className="text-xs text-gray-600">{benefit.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="provide">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Droplets className="w-5 h-5 text-green-600" />
                    <span>Add Liquidity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="selectedPool">Select Pool</Label>
                    <Select value={selectedPool} onValueChange={setSelectedPool}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a liquidity pool" />
                      </SelectTrigger>
                      <SelectContent>
                        {liquidityPools.map((pool) => (
                          <SelectItem key={pool.id} value={pool.id}>
                            {pool.name} - {pool.apy} APY
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="liquidityAmount">Liquidity Amount (USD)</Label>
                    <Input
                      id="liquidityAmount"
                      type="number"
                      placeholder="0.00"
                      value={liquidityAmount}
                      onChange={(e) => setLiquidityAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stakingPeriod">Staking Period</Label>
                    <Select value={stakingPeriod} onValueChange={setStakingPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select staking duration" />
                      </SelectTrigger>
                      <SelectContent>
                        {stakingOptions.map((option) => (
                          <SelectItem key={option.period} value={option.period}>
                            {option.label} - {option.apy} APY (Min: {option.minAmount})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {liquidityAmount && selectedPool && stakingPeriod && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-3">Liquidity Projection</h4>
                      <div className="space-y-2 text-sm">
                        {(() => {
                          const pool = liquidityPools.find(p => p.id === selectedPool);
                          const staking = stakingOptions.find(s => s.period === stakingPeriod);
                          const amount = parseFloat(liquidityAmount);
                          const apy = parseFloat(staking?.apy?.replace('%', '') || '0') / 100;
                          const dailyEarnings = (amount * apy) / 365;
                          const monthlyEarnings = dailyEarnings * 30;
                          
                          return (
                            <>
                              <div className="flex justify-between">
                                <span className="text-green-700">Pool:</span>
                                <span className="font-medium">{pool?.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-700">Investment:</span>
                                <span className="font-medium">${amount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-700">APY:</span>
                                <span className="font-medium">{staking?.apy}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-700">Daily Earnings:</span>
                                <span className="font-medium">${dailyEarnings.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-700">Monthly Earnings:</span>
                                <span className="font-medium">${monthlyEarnings.toFixed(2)}</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between text-base font-semibold text-green-900">
                                <span>Annual Earnings:</span>
                                <span>${(amount * apy).toFixed(2)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={!liquidityAmount || !selectedPool || !stakingPeriod}
                  >
                    Provide Liquidity
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Important Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-800">How Liquidity Provision Works</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          You provide assets to trading pools and earn fees from every transaction. 
                          Your earnings come from trading fees and potential token appreciation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-800">Impermanent Loss Risk</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          When token prices diverge significantly, you may experience impermanent loss. 
                          XRP pairs typically have lower risk due to reduced volatility.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Key Features:</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                        <span>Automatic compounding of earnings</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                        <span>Withdraw liquidity anytime (except locked periods)</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                        <span>Real-time profit/loss tracking</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                        <span>Insurance coverage up to $100K per position</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="positions">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Active Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {myPositions.map((position, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{position.pool}</h3>
                            <p className="text-sm text-gray-600">Active for {position.duration}</p>
                          </div>
                          <Badge className="bg-green-100 text-green-800">
                            {position.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Amount:</span>
                            <div className="font-medium">{position.amount}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Earned:</span>
                            <div className="font-medium text-green-600">{position.earned}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Current APY:</span>
                            <div className="font-medium">{position.apy}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Status:</span>
                            <div className="font-medium capitalize">{position.status}</div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2 mt-4">
                          <Button size="sm" variant="outline">
                            Add Liquidity
                          </Button>
                          <Button size="sm" variant="outline">
                            Withdraw
                          </Button>
                          <Button size="sm" variant="outline">
                            Claim Rewards
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-600">$21,250</div>
                        <div className="text-sm text-green-700">Total Invested</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">$1,894.69</div>
                        <div className="text-sm text-blue-700">Total Earned</div>
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">13.8%</div>
                      <div className="text-sm text-purple-700">Average APY</div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Next Reward:</span>
                        <span className="font-medium">In 2 hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Est. Daily Earnings:</span>
                        <span className="font-medium">$7.82</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monthly Projection:</span>
                        <span className="font-medium">$234.60</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">Performance Chart</p>
                        <p className="text-xs text-gray-400">Interactive chart showing earnings over time</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div>
                        <div className="font-semibold text-green-600">+8.9%</div>
                        <div className="text-gray-600">7 Days</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">+13.2%</div>
                        <div className="text-gray-600">30 Days</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">+28.7%</div>
                        <div className="text-gray-600">90 Days</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pool Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {liquidityPools.slice(0, 3).map((pool, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{pool.name}</div>
                          <div className="text-sm text-gray-600">{pool.totalValue}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">{pool.apy}</div>
                          <div className="text-xs text-gray-500">APY</div>
                        </div>
                      </div>
                    ))}
                    
                    <Button variant="outline" className="w-full" size="sm">
                      View All Pools
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}