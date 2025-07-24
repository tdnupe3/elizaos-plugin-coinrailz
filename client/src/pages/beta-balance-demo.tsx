import { SimpleBalanceDisplay } from "@/components/simple-balance-display";

export default function BetaBalanceDemo() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Beta Test - Balance Display</h1>
        <p className="text-gray-600">Real-time USDC balance display for beta testing accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SimpleBalanceDisplay 
          userEmail="a1digitalllc@gmail.com" 
          title="Test Account 1 Balance"
        />
        
        <SimpleBalanceDisplay 
          userEmail="stell.mary@yahoo.com" 
          title="Test Account 2 Balance"  
        />
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">Beta Test Status</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✅ Balance API endpoints working correctly</li>
          <li>✅ Database balances updated accurately</li>
          <li>✅ P2P transfer system operational</li>
          <li>⚠️ Frontend balance display fixed for beta test</li>
        </ul>
      </div>
    </div>
  );
}