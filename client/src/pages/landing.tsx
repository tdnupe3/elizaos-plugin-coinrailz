import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Footer } from "@/components/Footer";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  const handleSignUp = () => {
    window.location.href = "/api/login";
  };

  const handleGuestAccess = () => {
    setLocation("/demo");
  };

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md mx-auto">
          {/* Logo and Title */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <img 
                src={coinRailzLogo} 
                alt="Coin Railz Logo" 
                className="w-24 h-24"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Coin Railz</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Cross-platform payments & crypto gateway
            </p>
          </div>

        {/* Authentication Options */}
        <div className="space-y-6">
          <div>
            <Button 
              onClick={handleSignIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-medium"
              size="lg"
            >
              Sign In
            </Button>
            <p className="text-xs text-gray-500 text-center mt-1">
              Access your account and full features
            </p>
          </div>
          
          <div>
            <Button 
              onClick={handleSignUp}
              variant="outline"
              className="w-full bg-gray-600 border-gray-600 text-white hover:bg-gray-700 py-3 text-lg font-medium"
              size="lg"
            >
              Sign Up
            </Button>
            <p className="text-xs text-gray-500 text-center mt-1">
              Send money, buy/sell crypto, earn referral bonuses
            </p>
          </div>
          
          <div>
            <Button 
              onClick={() => setLocation("/swap")}
              variant="ghost"
              className="w-full text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-3 text-lg font-medium border border-blue-200"
              size="lg"
            >
              Continue as Guest
            </Button>
            <p className="text-xs text-blue-600 text-center mt-1 font-medium">
              Access DEX aggregator instantly (no registration required)
            </p>
          </div>
          
          <div>
            <Button 
              onClick={handleGuestAccess}
              variant="ghost"
              className="w-full text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 py-3 text-lg font-medium border border-emerald-200"
              size="lg"
            >
              Try Demo Mode
            </Button>
            <p className="text-xs text-emerald-600 text-center mt-1 font-medium">
              Test all features with demo data (no registration required)
            </p>
          </div>
        </div>

        {/* Footer Text */}
        <div className="text-center mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm text-purple-800 font-medium mb-2">Guest Access:</p>
              <div className="text-xs text-purple-700 space-y-1">
                <p>• DEX aggregator for crypto swaps</p>
                <p>• Real-time price comparisons</p>
                <p>• Multi-chain support</p>
                <p>• No registration required</p>
              </div>
            </div>
            
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-sm text-emerald-800 font-medium mb-2">Demo Mode:</p>
              <div className="text-xs text-emerald-700 space-y-1">
                <p>• Complete platform testing</p>
                <p>• Digital wallet with sample funds</p>
                <p>• Send money & crypto transactions</p>
                <p>• All features with demo data</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-700 font-medium">
              ISO 20022 Compliant • FATF Travel Rule • Bank-Grade Security
            </p>
          </div>
        </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}