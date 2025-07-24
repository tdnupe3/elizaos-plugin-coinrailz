import { useLocation } from "wouter";
import { SimpleBalanceDisplay } from "@/components/simple-balance-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "@/lib/minimal-icons";

export default function BalanceDisplay() {
  const [, setLocation] = useLocation();
  
  // Get email from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email') || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">USDC Balance Check</h1>
          <p className="text-gray-600">Real-time balance from Circle API</p>
        </div>

        {email ? (
          <div className="space-y-6">
            <SimpleBalanceDisplay userEmail={email} />
            
            <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
              <CardHeader>
                <CardTitle className="text-green-800">✅ Your Funds Are Safe</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 mb-3">
                  Your USDC balance is fetched directly from Circle's blockchain data. 
                  The Circle Balance Syncer updates every 30 seconds to ensure accuracy.
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Real-time Circle API integration</li>
                  <li>• 30-second automatic balance sync</li>
                  <li>• Authentic blockchain data</li>
                  <li>• Zero mock or fake data</li>
                </ul>
              </CardContent>
            </Card>

            <div className="text-center">
              <Button
                onClick={() => setLocation("/send-money")}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Send Money
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-600 mb-4">Please provide an email address to check balance.</p>
              <Button
                onClick={() => setLocation("/")}
                variant="outline"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}