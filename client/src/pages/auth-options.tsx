/**
 * Authentication Options Page
 * Shows all available sign-in methods for users
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AuthForm } from "@/components/auth-form";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";
import { Mail, Smartphone, Key, User, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function AuthOptions() {
  const [, setLocation] = useLocation();
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'replit' | 'coinbase' | null>(null);

  // If user selected email authentication, show the email form
  if (selectedMethod === 'email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => setSelectedMethod(null)}
              className="mb-4 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to sign-in options
            </Button>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <img 
                  src={coinRailzLogo} 
                  alt="Coin Railz Logo" 
                  className="w-16 h-16"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Sign In with Email</h1>
              <p className="text-gray-600 mt-2">Use your email address to access your account</p>
            </div>

            <AuthForm mode="signin" />
          </div>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Welcome to Railz Token</h1>
            <p className="text-gray-600 mt-2">Choose how you'd like to sign in</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Sign In Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email Sign-In Option */}
              <Button
                onClick={() => setSelectedMethod('email')}
                variant="outline"
                className="w-full h-14 text-left justify-start space-x-3"
              >
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">Sign in with Email</div>
                  <div className="text-sm text-gray-500">Use your email address and password</div>
                </div>
              </Button>

              <Separator className="my-4" />

              {/* Replit OAuth Option */}
              <Button
                onClick={() => window.location.href = '/api/login'}
                variant="outline"
                className="w-full h-14 text-left justify-start space-x-3"
              >
                <User className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Sign in with Replit</div>
                  <div className="text-sm text-gray-500">Use your Replit account (developers)</div>
                </div>
              </Button>

              {/* Coinbase OAuth Option */}
              <Button
                onClick={() => window.location.href = '/auth/coinbase/login'}
                variant="outline"
                className="w-full h-14 text-left justify-start space-x-3"
              >
                <Key className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium">Sign in with Coinbase</div>
                  <div className="text-sm text-gray-500">Use your Coinbase account to sign in</div>
                </div>
              </Button>

              <Separator className="my-4" />

              {/* Sign Up Option */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  Don't have an account?
                </p>
                <Button
                  onClick={() => setLocation('/signup')}
                  className="w-full"
                >
                  Create New Account
                </Button>
              </div>

              {/* Help Text */}
              <div className="text-center pt-4">
                <p className="text-xs text-gray-500">
                  Having trouble signing in? Contact support at{" "}
                  <a href="mailto:support@coinrailz.com" className="text-blue-600 hover:underline">
                    support@coinrailz.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}