import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Send, Bot, Repeat, USDCLogo, XRPLogo } from "@/lib/icons";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "react-i18next";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  const handleSignUp = () => {
    window.location.href = "/api/login";
  };

  const handleGuestAccess = () => {
    setLocation("/demo-dashboard");
  };

  const handleSendMoney = () => {
    setLocation("/p2p-transfer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Top Navigation Bar */}
      <div className="w-full bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img 
                src={coinRailzLogo} 
                alt="Coin Railz Logo" 
                className="w-8 h-8"
              />
              <span className="text-xl font-bold text-gray-900">Coin Railz</span>
            </div>
            <div className="flex items-center space-x-3">
              <LanguageSwitcher />
              <Button 
                onClick={handleSignIn}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
                size="sm"
              >
                {t('auth.signIn')}
              </Button>
              <Button 
                onClick={handleSignUp}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                {t('auth.signUp')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
            Global Payments Made <span className="text-blue-600">Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Cross-platform payments, cryptocurrency trading, and AI marketplace all in one platform
          </p>

          {/* Main Action Buttons */}
          <div className="space-y-4 mb-8 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                onClick={() => setLocation("/usdc-ecosystem-dashboard")}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-4 text-lg font-medium"
                size="lg"
              >
                <USDCLogo className="w-5 h-5 mr-2" />
                USDC Ecosystem
              </Button>

              <Button 
                onClick={() => setLocation("/xrp-ecosystem")}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-4 text-lg font-medium"
                size="lg"
              >
                <XRPLogo className="w-5 h-5 mr-2" />
                XRP Ecosystem
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                onClick={() => setLocation("/swap")}
                variant="outline"
                className="w-full border-purple-600 text-purple-600 hover:bg-purple-50 py-4 text-lg font-medium"
                size="lg"
              >
                <Repeat className="w-5 h-5 mr-2" />
                DEX Swap
              </Button>

              <Button 
                onClick={() => setLocation("/ai-marketplace")}
                variant="outline"
                className="w-full border-orange-600 text-orange-600 hover:bg-orange-50 py-4 text-lg font-medium"
                size="lg"
              >
                <Bot className="w-5 h-5 mr-2" />
                AI Marketplace
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <Button 
                onClick={handleSendMoney}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-medium"
                size="lg"
              >
                <Send className="w-5 h-5 mr-2" />
                Send Money
              </Button>
              <Button 
                onClick={handleGuestAccess}
                variant="outline"
                className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-50 py-4 text-lg font-medium"
                size="lg"
              >
                👁️ Demo Mode
              </Button>
            </div>
          </div>

          {/* Simple Call to Action */}
          <div className="text-center bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-gray-600 mb-6">
              Join thousands using Coin Railz for secure global payments and trading
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <Button 
                onClick={handleSignUp}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium"
                size="lg"
              >
                Create Account
              </Button>
              <Button 
                onClick={handleGuestAccess}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg font-medium"
                size="lg"
              >
                Try Demo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Coin Railz - Secure cross-platform financial services for global users
            </p>
            <p className="text-xs text-gray-500">
              Supporting both human users and autonomous AI agents worldwide
            </p>
          </div>

          {/* Legal Links */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <Link href="/docs" className="hover:text-blue-700 hover:underline transition-colors font-medium">
                  Platform Guide
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/contact-us" className="hover:text-blue-700 hover:underline transition-colors font-medium">
                  Contact Support
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/terms-of-service" className="hover:text-gray-700 hover:underline transition-colors">
                  Terms of Service
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/privacy-policy" className="hover:text-gray-700 hover:underline transition-colors">
                  Privacy Policy
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/legal-disclaimers" className="hover:text-gray-700 hover:underline transition-colors">
                  Legal Disclaimers
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}