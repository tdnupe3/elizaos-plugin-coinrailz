import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Shield, 
  Clock, 
  DollarSign,
  BarChart3,
  Brain,
  Zap,
  Star
} from "@/lib/icons";

interface CryptoSignalsService {
  agentName: string;
  description: string;
  stats: {
    accuracy: number;
    totalSignals: number;
    avgReturn: number;
    followers: number;
  };
  services: AgentService[];
}

interface CryptoSignal {
  symbol: string;
  action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  priceTarget: number;
  stopLoss: number;
  timeframe: string;
  reasoning: string[];
  technicalScore: number;
  sentimentScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: string;
}

interface AgentService {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  deliveryTime: string;
  includes: string[];
}

export default function CryptoSignalsAgent() {
  const [selectedSymbol, setSelectedSymbol] = useState("bitcoin");
  const [selectedTimeframe, setSelectedTimeframe] = useState("4H");
  const [purchasedSignal, setPurchasedSignal] = useState<any>(null);
  const { toast } = useToast();

  // Fetch agent services
  const { data: agentData, isLoading: servicesLoading } = useQuery<{ services: CryptoSignalsService }>({
    queryKey: ['/api/crypto-signals/services'],
  });

  // Fetch live signal
  const { data: liveSignalData, isLoading: signalLoading, refetch: refetchSignal } = useQuery({
    queryKey: ['/api/crypto-signals/live', selectedSymbol, selectedTimeframe],
    queryFn: () => apiRequest('GET', `/api/crypto-signals/live/${selectedSymbol}?timeframe=${selectedTimeframe}`).then(res => res.json()),
  });

  // Purchase service mutation
  const purchaseServiceMutation = useMutation({
    mutationFn: async ({ serviceId, parameters }: { serviceId: string; parameters: any }) => {
      const response = await apiRequest('POST', '/api/crypto-signals/purchase', {
        serviceId,
        parameters
      });
      return response.json();
    },
    onSuccess: (data) => {
      setPurchasedSignal(data.deliverable);
      toast({
        title: "Signal Generated",
        description: "Your crypto trading signal has been generated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to generate signal",
        variant: "destructive",
      });
    }
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'STRONG_BUY': return 'bg-green-600';
      case 'BUY': return 'bg-green-500';
      case 'HOLD': return 'bg-yellow-500';
      case 'SELL': return 'bg-red-500';
      case 'STRONG_SELL': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  if (servicesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const agent = agentData?.services;
  const signal = liveSignalData?.signal;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Agent Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Brain className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">{agent?.agentName}</h1>
          <Badge variant="secondary" className="ml-2">
            <Star className="h-3 w-3 mr-1" />
            First Agent
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {agent?.description}
        </p>
        
        {/* Agent Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{agent?.stats?.accuracy}%</div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{agent?.stats?.totalSignals}</div>
            <div className="text-sm text-muted-foreground">Total Signals</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{agent?.stats?.avgReturn}%</div>
            <div className="text-sm text-muted-foreground">Avg Return</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{agent?.stats?.followers}</div>
            <div className="text-sm text-muted-foreground">Followers</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="live-signals" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="live-signals">Live Signals</TabsTrigger>
          <TabsTrigger value="services">Services & Pricing</TabsTrigger>
          <TabsTrigger value="analysis">Market Analysis</TabsTrigger>
        </TabsList>

        {/* Live Signals Tab */}
        <TabsContent value="live-signals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Live Trading Signal</span>
              </CardTitle>
              <CardDescription>
                Real-time cryptocurrency trading signals with technical and sentiment analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Cryptocurrency</label>
                  <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bitcoin">Bitcoin (BTC)</SelectItem>
                      <SelectItem value="ethereum">Ethereum (ETH)</SelectItem>
                      <SelectItem value="cardano">Cardano (ADA)</SelectItem>
                      <SelectItem value="solana">Solana (SOL)</SelectItem>
                      <SelectItem value="chainlink">Chainlink (LINK)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Timeframe</label>
                  <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1H">1 Hour</SelectItem>
                      <SelectItem value="4H">4 Hours</SelectItem>
                      <SelectItem value="1D">1 Day</SelectItem>
                      <SelectItem value="1W">1 Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={() => refetchSignal()} 
                disabled={signalLoading}
                className="w-full"
              >
                {signalLoading ? 'Generating Signal...' : 'Generate Free Signal'}
              </Button>

              {signal && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge className={getActionColor(signal.action)}>
                        {signal.action}
                      </Badge>
                      <span className="font-medium">{signal.symbol.toUpperCase()}</span>
                      <Badge variant="outline">{signal.timeframe}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{signal.confidence}% Confidence</div>
                      <div className={`text-sm ${getRiskColor(signal.riskLevel)}`}>
                        {signal.riskLevel} Risk
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <Target className="h-5 w-5 mx-auto mb-2 text-green-600" />
                      <div className="text-sm text-muted-foreground">Price Target</div>
                      <div className="font-bold">{formatPrice(signal.priceTarget)}</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <Shield className="h-5 w-5 mx-auto mb-2 text-red-600" />
                      <div className="text-sm text-muted-foreground">Stop Loss</div>
                      <div className="font-bold">{formatPrice(signal.stopLoss)}</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <Clock className="h-5 w-5 mx-auto mb-2 text-blue-600" />
                      <div className="text-sm text-muted-foreground">Generated</div>
                      <div className="font-bold">{new Date(signal.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Analysis Reasoning:</h4>
                    <ul className="space-y-1">
                      {signal.reasoning.map((reason: string, index: number) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start">
                          <span className="mr-2">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-sm text-muted-foreground">Technical Score</div>
                      <div className="text-lg font-bold">{signal.technicalScore}/100</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Sentiment Score</div>
                      <div className="text-lg font-bold">{signal.sentimentScore}/100</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {agent?.services?.map((service: AgentService) => (
              <Card key={service.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        ${service.price}
                      </div>
                      <div className="text-sm text-muted-foreground">{service.currency}</div>
                    </div>
                  </div>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>Delivery: {service.deliveryTime}</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Includes:</h4>
                    <ul className="space-y-1">
                      {service.includes.map((item, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-center">
                          <span className="mr-2">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    onClick={() => purchaseServiceMutation.mutate({
                      serviceId: service.id,
                      parameters: { symbol: selectedSymbol, timeframe: selectedTimeframe }
                    })}
                    disabled={purchaseServiceMutation.isPending}
                    className="w-full"
                  >
                    {purchaseServiceMutation.isPending ? 'Processing...' : `Purchase for $${service.price}`}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Purchase Result */}
          {purchasedSignal && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Service Delivered Successfully!</CardTitle>
                <CardDescription>Your premium crypto signal has been generated</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-white p-4 rounded border overflow-auto">
                  {JSON.stringify(purchasedSignal, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Daily Market Analysis</span>
                </CardTitle>
                <CardDescription>
                  Comprehensive analysis of top 10 cryptocurrencies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-green-600">$35</div>
                  <div className="text-sm text-muted-foreground">USDT</div>
                  <Button className="w-full">Get Daily Analysis</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Weekly Market Outlook</span>
                </CardTitle>
                <CardDescription>
                  In-depth weekly analysis with portfolio optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-blue-600">$75</div>
                  <div className="text-sm text-muted-foreground">USDT</div>
                  <Button className="w-full">Get Weekly Outlook</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}