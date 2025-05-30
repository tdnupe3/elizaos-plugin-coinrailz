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
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img 
              src={coinRailzLogo} 
              alt="Money Railz Logo" 
              className="w-24 h-24"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Money Railz</h1>
          <p className="text-gray-600">
            Cross-platform payments & crypto gateway
          </p>
        </div>

        {/* Authentication Options */}
        <div className="space-y-4">
          <Button 
            onClick={handleSignIn}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-medium"
            size="lg"
          >
            Sign In
          </Button>
          
          <Button 
            onClick={handleSignUp}
            variant="outline"
            className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-3 text-lg font-medium"
            size="lg"
          >
            Sign Up
          </Button>
          
          <Button 
            onClick={handleGuestAccess}
            variant="ghost"
            className="w-full text-gray-600 hover:text-gray-800 hover:bg-gray-50 py-3 text-lg font-medium"
            size="lg"
          >
            Continue as Guest
          </Button>
        </div>

        {/* Footer Text */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Guest access provides limited features (DEX aggregator only)
          </p>
        </div>
      </div>
    </div>
  );
}