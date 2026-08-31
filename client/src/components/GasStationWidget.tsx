import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, DollarSign, Clock, Shield } from '@/lib/icons';
import { useQuery } from '@tanstack/react-query';

interface GasStationWidgetProps {
  userWalletId?: string;
  blockchain?: string;
}
interface GasStatsResponse {
  success: boolean;
  stats: {
    totalTransactions: number;
    totalGasFeesSponsored: number;
    totalUSDCCollected: number;
    totalPlatformFees: number;
  };
}
interface SupportedChainsResponse {
  success: boolean;
  chains: string[];
}

export function GasStationWidget({ userWalletId, blockchain = 'ETH' }: GasStationWidgetProps) {
  const [estimating, setEstimating] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<any>(null);

  // Fetch gas station stats
  const { data: gasStats } = useQuery<GasStatsResponse>({
    queryKey: ['/api/gas-station/stats'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch supported chains
  const { data: supportedChains } = useQuery<SupportedChainsResponse>({
    queryKey: ['/api/gas-station/supported-chains']
  });

  const handleEstimateGas = async () => {
    if (!userWalletId) return;
    
    setEstimating(true);
    try {
      const response = await fetch('/api/gas-station/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blockchain,
          to: '0x742d35Cc6634C0532925a3b8D591d3d8C2C7D7b',
          data: '0x',
          value: '0'
        })
      });

      if (response.ok) {
        const result = await response.json();
        setGasEstimate(result.estimate);
      }
    } catch (error) {
      console.error('Gas estimation failed:', error);
    } finally {
      setEstimating(false);
    }
  };

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center text-blue-700">
          <Zap className="h-5 w-5 mr-2" />
          USDC Gas Station
          <Badge className="ml-2 bg-green-100 text-green-800">5% Revenue Share</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Feature Description */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold mb-2 text-gray-900">Pay Gas Fees with USDC</h3>
            <p className="text-sm text-gray-600 mb-3">
              No need to hold native tokens! Pay all gas fees with USDC across multiple blockchains.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 mr-1 text-blue-500" />
                <span>Instant execution</span>
              </div>
              <div className="flex items-center text-sm">
                <Shield className="h-4 w-4 mr-1 text-green-500" />
                <span>Secure & reliable</span>
              </div>
              <div className="flex items-center text-sm">
                <DollarSign className="h-4 w-4 mr-1 text-purple-500" />
                <span>5% platform fee</span>
              </div>
              <div className="flex items-center text-sm">
                <Zap className="h-4 w-4 mr-1 text-orange-500" />
                <span>Multi-chain support</span>
              </div>
            </div>
          </div>

          {/* Supported Chains */}
          {supportedChains?.success && (
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold mb-2 text-gray-900">Supported Networks</h3>
              <div className="flex flex-wrap gap-2">
                {supportedChains.chains.map((chain: string) => (
                  <Badge key={chain} variant="outline" className="text-xs">
                    {chain}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Gas Estimate */}
          {gasEstimate && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h3 className="font-semibold mb-2 text-gray-900">Gas Estimate</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Gas Fee (USDC):</span>
                  <span className="font-mono">${gasEstimate.gasFeeUSDC}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee:</span>
                  <span className="font-mono">${gasEstimate.platformFee}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span className="font-mono">${gasEstimate.totalUSDC}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleEstimateGas}
              disabled={estimating || !userWalletId}
              className="flex-1"
              variant="outline"
            >
              {estimating ? 'Estimating...' : 'Estimate Gas'}
            </Button>
            
            {gasEstimate && (
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!userWalletId}
              >
                Use USDC Gas
              </Button>
            )}
          </div>

          {/* Stats */}
          {gasStats?.success && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Platform Stats</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Total Transactions:</span>
                  <div className="font-mono font-semibold">{gasStats.stats.totalTransactions}</div>
                </div>
                <div>
                  <span className="text-gray-600">Gas Sponsored:</span>
                  <div className="font-mono font-semibold">{gasStats.stats.totalGasFeesSponsored} ETH</div>
                </div>
                <div>
                  <span className="text-gray-600">USDC Collected:</span>
                  <div className="font-mono font-semibold">${gasStats.stats.totalUSDCCollected}</div>
                </div>
                <div>
                  <span className="text-gray-600">Platform Revenue:</span>
                  <div className="font-mono font-semibold">${gasStats.stats.totalPlatformFees}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default GasStationWidget;