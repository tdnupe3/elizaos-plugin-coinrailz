import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import FeeCalculatorWidget from '@/components/FeeCalculatorWidget';
import PaymentMethodComparison from '@/components/PaymentMethodComparison';
import { 
  Zap, 
  Clock, 
  Shield, 
  TrendingDown, 
  DollarSign, 
  Globe, 
  CheckCircle,
  ArrowRight,
  Info
} from 'lucide-react';

interface FeeStructureData {
  feeStructure: {
    xrp: {
      tiers: Array<{
        range: string;
        serviceFee: string;
        platformFee: string;
        networkFee: string;
        description: string;
      }>;
      advantages: string[];
    };
    traditional: {
      wireTransfer: {
        typical: string;
        speed: string;
        hidden: string;
      };
    };
  };
}

export default function FeeStructure() {
  const [feeData, setFeeData] = useState<FeeStructureData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeeStructure();
  }, []);

  const fetchFeeStructure = async () => {
    try {
      const response = await fetch('/api/fees/structure');
      const data = await response.json();
      if (data.success) {
        setFeeData(data);
      }
    } catch (error) {
      console.error('Error fetching fee structure:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Enhanced XRP Fee Structure</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Transparent, tiered pricing that ensures profitability while maintaining the most competitive rates for international transfers
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Production Ready
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Shield className="h-3 w-3 mr-1" />
            Funded Wallet Active
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calculator">Fee Calculator</TabsTrigger>
          <TabsTrigger value="comparison">Method Comparison</TabsTrigger>
          <TabsTrigger value="structure">Fee Tiers</TabsTrigger>
          <TabsTrigger value="advantages">Advantages</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6">
          <FeeCalculatorWidget />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <PaymentMethodComparison />
        </TabsContent>

        <TabsContent value="structure" className="space-y-6">
          {feeData && (
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                    XRP Ledger Tiered Fee Structure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {feeData.feeStructure.xrp.tiers.map((tier, index) => (
                      <Card key={index} className="relative">
                        <CardHeader>
                          <CardTitle className="text-lg">{tier.range}</CardTitle>
                          <Badge variant={index === 2 ? "default" : "outline"}>
                            {index === 0 ? "Small Transactions" : index === 1 ? "Medium Transactions" : "Large Transactions"}
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Service Fee:</span>
                              <span className="font-medium">{tier.serviceFee}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Platform Fee:</span>
                              <span className="font-medium">{tier.platformFee}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Network Fee:</span>
                              <span className="font-medium text-green-600">{tier.networkFee}</span>
                            </div>
                          </div>
                          <Separator />
                          <p className="text-xs text-muted-foreground">{tier.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">Fee Structure Benefits</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          Our tiered structure ensures profitability across all transaction sizes while maintaining XRP's competitive advantage. 
                          Small transactions include service fees to cover processing costs, while large transactions benefit from percentage-based fees.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-orange-500" />
                    Traditional Wire Transfer Costs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <h4 className="font-medium">Typical Fees</h4>
                      <p className="text-2xl font-bold text-red-600">{feeData.feeStructure.traditional.wireTransfer.typical}</p>
                      <p className="text-sm text-muted-foreground">Plus exchange rate margins</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Processing Time</h4>
                      <p className="text-2xl font-bold text-orange-600">{feeData.feeStructure.traditional.wireTransfer.speed}</p>
                      <p className="text-sm text-muted-foreground">Business days only</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Hidden Costs</h4>
                      <p className="text-sm font-medium text-red-600">{feeData.feeStructure.traditional.wireTransfer.hidden}</p>
                      <p className="text-sm text-muted-foreground">Often undisclosed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="advantages" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  XRP Ledger Advantages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feeData && (
                  <div className="space-y-3">
                    {feeData.feeStructure.xrp.advantages.map((advantage, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{advantage}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-500" />
                  Global Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">80-95%</div>
                    <div className="text-sm text-muted-foreground">Cost Savings</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">3-5s</div>
                    <div className="text-sm text-muted-foreground">Settlement</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">24/7</div>
                    <div className="text-sm text-muted-foreground">Availability</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">$0.0002</div>
                    <div className="text-sm text-muted-foreground">Network Fee</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-500" />
                Cost Comparison Examples
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">$100 Transfer</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Traditional:</span>
                        <span className="font-medium text-red-600">$25.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">XRP:</span>
                        <span className="font-medium text-green-600">$1.05</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Savings:</span>
                        <span className="text-green-600">$23.95 (95.8%)</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">$500 Transfer</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Traditional:</span>
                        <span className="font-medium text-red-600">$25.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">XRP:</span>
                        <span className="font-medium text-green-600">$2.50</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Savings:</span>
                        <span className="text-green-600">$22.50 (90.0%)</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">$1000 Transfer</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Traditional:</span>
                        <span className="font-medium text-red-600">$30.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">XRP:</span>
                        <span className="font-medium text-green-600">$5.00</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Savings:</span>
                        <span className="text-green-600">$25.00 (83.3%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center space-y-4">
            <Button size="lg" className="gap-2">
              Start Using XRP Transfers
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-sm text-muted-foreground">
              Join thousands of users already saving on international transfers
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}