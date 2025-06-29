import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function XRPEcosystemTest() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            XRP Ecosystem Dashboard
          </h1>
          <p className="text-xl text-gray-600">
            Revolutionary financial services powered by XRP Ledger technology
          </p>
          <div className="mt-4 text-sm text-blue-600 font-medium">
            Live XRP Rate: $0.5000 USD | Platform Status: Operational
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">Cross-Border Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Send money globally in 3-5 seconds with ultra-low fees
              </p>
              <Button 
                onClick={() => setLocation('/xrp-cross-border-payments')}
                className="w-full"
              >
                Access Service
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">Liquidity Provision</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Provide liquidity and earn rewards on XRP transactions
              </p>
              <Button 
                onClick={() => setLocation('/xrp-liquidity-provision')}
                className="w-full"
              >
                Access Service
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">Wallet Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Enterprise-grade XRP wallet management and security
              </p>
              <Button 
                onClick={() => setLocation('/xrp-wallet-management')}
                className="w-full"
              >
                Access Service
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button 
            onClick={() => setLocation('/main-menu')}
            variant="outline"
          >
            Back to Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
}