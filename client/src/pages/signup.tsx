/**
 * Sign Up Page
 */

import { AuthForm } from "@/components/auth-form";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";

export default function SignUp() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src={coinRailzLogo} 
                alt="Coin Railz Logo" 
                className="w-16 h-16"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Join Coin Railz</h1>
            <p className="text-gray-600 mt-2">Create your account to start sending money and trading crypto</p>
          </div>

          <AuthForm mode="signup" />
        </div>
      </div>
    </div>
  );
}