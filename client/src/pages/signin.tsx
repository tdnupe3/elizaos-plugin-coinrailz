/**
 * Sign In Page
 */

import { AuthForm } from "@/components/auth-form";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";

export default function SignIn() {
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
            <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-600 mt-2">Sign in to your Coin Railz account</p>
          </div>

          <AuthForm mode="signin" />
        </div>
      </div>
    </div>
  );
}