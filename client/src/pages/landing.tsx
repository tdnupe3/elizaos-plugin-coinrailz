import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
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
    setLocation("/swap");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 sm:px-6">
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
              onClick={handleGuestAccess}
              variant="ghost"
              className="w-full text-gray-600 hover:text-gray-800 hover:bg-gray-50 py-3 text-lg font-medium"
              size="lg"
            >
              Continue as Guest
            </Button>
            <p className="text-xs text-gray-500 text-center mt-1">
              Try our crypto swap aggregator (no registration required)
            </p>
          </div>
        </div>

        {/* Footer Text */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Guest access provides limited features (DEX aggregator only)
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-4">
            <p className="text-xs text-emerald-700 font-medium">
              ISO 20022 Compliant • FATF Travel Rule • Bank-Grade Security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}