import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, ArrowLeft, Info, Calculator } from "@/lib/icons";
import { useLocation } from "wouter";
import { WalletConnect } from "@/components/wallet-connect";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cryptoTransferSchema, type CryptoTransferRequest } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Multi-chain crypto networks with commission structure
const supportedNetworks = [
  { 
    id: 'ethereum', 
    name: 'Ethereum', 
    symbol: 'ETH', 
    color: 'bg-blue-500',
    commissionRate: 0.0025,
    minTransfer: 0.001,
    avgGasFee: 0.005
  },
  { 
    id: 'bitcoin', 
    name: 'Bitcoin', 
    symbol: 'BTC', 
    color: 'bg-orange-500',
    commissionRate: 0.0025,
    minTransfer: 0.00001,
    avgGasFee: 0.0001
  },
  { 
    id: 'solana', 
    name: 'Solana', 
    symbol: 'SOL', 
    color: 'bg-purple-600',
    commissionRate: 0.0025,
    minTransfer: 0.01,
    avgGasFee: 0.00025
  },
  { 
    id: 'polygon', 
    name: 'Polygon', 
    symbol: 'MATIC', 
    color: 'bg-purple-500',
    commissionRate: 0.0025,
    minTransfer: 0.1,
    avgGasFee: 0.001
  },
  { 
    id: 'bsc', 
    name: 'Binance Smart Chain', 
    symbol: 'BNB', 
    color: 'bg-yellow-500',
    commissionRate: 0.0025,
    minTransfer: 0.001,
    avgGasFee: 0.0005
  },
  { 
    id: 'xrp', 
    name: 'XRP Ledger', 
    symbol: 'XRP', 
    color: 'bg-gray-700',
    commissionRate: 0.0025,
    minTransfer: 1,
    avgGasFee: 0.00001
  },
  { 
    id: 'cardano', 
    name: 'Cardano', 
    symbol: 'ADA', 
    color: 'bg-blue-700',
    commissionRate: 0.0025,
    minTransfer: 1,
    avgGasFee: 0.17
  },
];

const cryptoTokens = [
  { symbol: 'ETH', name: 'Ethereum', networks: ['ethereum'] },
  { symbol: 'BTC', name: 'Bitcoin', networks: ['bitcoin'] },
  { symbol: 'SOL', name: 'Solana', networks: ['solana'] },
  { symbol: 'MATIC', name: 'Polygon', networks: ['polygon'] },
  { symbol: 'BNB', name: 'Binance Coin', networks: ['bsc'] },
  { symbol: 'XRP', name: 'XRP', networks: ['xrp'] },
  { symbol: 'ADA', name: 'Cardano', networks: ['cardano'] },
  { symbol: 'USDC', name: 'USD Coin', networks: ['ethereum', 'polygon', 'solana'] },
  { symbol: 'USDT', name: 'Tether', networks: ['ethereum', 'polygon', 'bsc'] },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', networks: ['ethereum'] },
];

export default function CryptoTransferPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [calculatedFees, setCalculatedFees] = useState({ commission: 0, gasFee: 0, total: 0 });

  const form = useForm<CryptoTransferRequest>({
    resolver: zodResolver(cryptoTransferSchema),
    defaultValues: {
      toWalletAddress: '',
      cryptoSymbol: '',
      amount: '',
      blockchainNetwork: '',
      message: '',
    },
  });

  const watchAmount = form.watch('amount');
  const watchNetwork = form.watch('blockchainNetwork');

  // Calculate fees when amount or network changes
  useEffect(() => {
    if (watchAmount && watchNetwork) {
      const amount = parseFloat(watchAmount);
      const network = supportedNetworks.find(n => n.id === watchNetwork);
      if (network && amount > 0) {
        const commission = amount * network.commissionRate;
        const gasFee = network.avgGasFee;
        const total = commission + gasFee;
        setCalculatedFees({ commission, gasFee, total });
      }
    }
  }, [watchAmount, watchNetwork]);

  const getFilteredTokens = (networkId: string) => {
    return cryptoTokens.filter(token => 
      token.networks.includes(networkId)
    );
  };

  const onSubmit = async (data: CryptoTransferRequest) => {
    try {
      const network = supportedNetworks.find(n => n.id === data.blockchainNetwork);
      if (!network) {
        toast({
          title: "Error",
          description: "Invalid network selected",
          variant: "destructive",
        });
        return;
      }

      const amount = parseFloat(data.amount);
      if (amount < network.minTransfer) {
        toast({
          title: "Transfer Amount Too Small",
          description: `Minimum transfer amount for ${network.name} is ${network.minTransfer} ${network.symbol}`,
          variant: "destructive",
        });
        return;
      }

      // Simulate crypto transfer API call
      console.log('Initiating crypto transfer:', {
        ...data,
        commission: calculatedFees.commission,
        gasFee: calculatedFees.gasFee,
        netAmount: amount - calculatedFees.total,
      });

      toast({
        title: "Transfer Initiated",
        description: `Your ${data.cryptoSymbol} transfer has been submitted to the ${network.name} network. Transaction will be confirmed shortly.`,
      });

      form.reset();
      setCalculatedFees({ commission: 0, gasFee: 0, total: 0 });
    } catch (error) {
      toast({
        title: "Transfer Failed",
        description: "Unable to process crypto transfer. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLocation('/demo')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Send Crypto</h1>
                <p className="text-sm text-gray-600">Multi-chain cryptocurrency transfers with 0.25% commission</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Wallet Connect */}
          <div className="lg:col-span-1">
            <WalletConnect />
          </div>

          {/* Transfer Form */}
          <div className="lg:col-span-2">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Send className="w-5 h-5" />
                  <span>Crypto Transfer</span>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Send cryptocurrency across multiple blockchain networks
                </p>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Network Selection */}
                    <FormField
                      control={form.control}
                      name="blockchainNetwork"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Blockchain Network</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedNetwork(value);
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select blockchain network" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {supportedNetworks.map((network) => (
                                <SelectItem key={network.id} value={network.id}>
                                  <div className="flex items-center space-x-2">
                                    <div className={`w-3 h-3 ${network.color} rounded-full`}></div>
                                    <span>{network.name} ({network.symbol})</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Cryptocurrency Selection */}
                    <FormField
                      control={form.control}
                      name="cryptoSymbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cryptocurrency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select cryptocurrency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {selectedNetwork && getFilteredTokens(selectedNetwork).map((token) => (
                                <SelectItem key={token.symbol} value={token.symbol}>
                                  {token.symbol} - {token.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Recipient Address */}
                    <FormField
                      control={form.control}
                      name="toWalletAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient Wallet Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter recipient's wallet address"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Amount */}
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="any"
                              placeholder="Enter amount to send"
                              {...field}
                            />
                          </FormControl>
                          {selectedNetwork && (
                            <p className="text-sm text-gray-500">
                              Minimum: {supportedNetworks.find(n => n.id === selectedNetwork)?.minTransfer} {supportedNetworks.find(n => n.id === selectedNetwork)?.symbol}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Message */}
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Add a note for the recipient"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Fee Calculation */}
                    {watchAmount && watchNetwork && calculatedFees.total > 0 && (
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <Calculator className="w-4 h-4 text-blue-600" />
                            <h4 className="font-medium text-blue-900">Transaction Fees</h4>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Platform Commission (0.25%):</span>
                              <span>{calculatedFees.commission.toFixed(8)} {form.watch('cryptoSymbol')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Network Gas Fee:</span>
                              <span>{calculatedFees.gasFee.toFixed(8)} {supportedNetworks.find(n => n.id === watchNetwork)?.symbol}</span>
                            </div>
                            <div className="border-t border-blue-200 pt-2 flex justify-between font-medium">
                              <span>You will receive:</span>
                              <span>{(parseFloat(watchAmount) - calculatedFees.commission).toFixed(8)} {form.watch('cryptoSymbol')}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Button type="submit" className="w-full">
                      <Send className="w-4 h-4 mr-2" />
                      Send Crypto
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Network Information */}
            <Card className="mt-6 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Info className="w-5 h-5" />
                  <span>Supported Networks</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supportedNetworks.map((network) => (
                    <div key={network.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 ${network.color} rounded-full`}></div>
                        <div>
                          <p className="font-medium">{network.name}</p>
                          <p className="text-sm text-gray-500">Min: {network.minTransfer} {network.symbol}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        0.25% fee
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}