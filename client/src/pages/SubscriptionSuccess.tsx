import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ArrowRight, Zap } from 'lucide-react';
import { Link } from 'wouter';

export default function SubscriptionSuccess() {
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const session = urlParams.get('session_id');
    if (session) {
      setSessionId(session);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          
          {/* Success Icon */}
          <div className="mb-8">
            <div className="mx-auto w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
              <Check className="w-12 h-12 text-green-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              🎉 Welcome to CryptoJoiner Pro!
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Your subscription is now active. Start joining crypto Telegram groups automatically!
            </p>
          </div>

          {/* Success Card */}
          <Card className="bg-white/10 backdrop-blur-md border-gray-600 text-white mb-8">
            <CardHeader>
              <CardTitle className="text-2xl text-green-400">Payment Successful!</CardTitle>
              <CardDescription className="text-gray-300">
                {sessionId && `Session ID: ${sessionId.substring(0, 20)}...`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* What's Next */}
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-4 text-center">🚀 What's Next?</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <span>Get your Telegram API credentials from <a href="https://my.telegram.org" target="_blank" className="text-blue-400 underline">my.telegram.org</a></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <span>Visit your CryptoJoiner Pro dashboard to start</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <span>Add your crypto group URLs and click "Start Auto-Joining"</span>
                  </div>
                </div>
              </div>

              {/* Features Reminder */}
              <div className="bg-green-500/20 border border-green-400 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-green-400">Your Pro Features:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-400" />
                    <span>Unlimited group joining</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-400" />
                    <span>Anti-ban protection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-400" />
                    <span>Session management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-400" />
                    <span>24/7 support</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auto-joiner">
                  <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 w-full sm:w-auto">
                    <Zap size={20} className="mr-2" />
                    Start Auto-Joining Now
                  </Button>
                </Link>
                
                <Link href="/">
                  <Button variant="outline" className="border-gray-400 text-white hover:bg-white/10 px-8 py-3 w-full sm:w-auto">
                    <ArrowRight size={20} className="mr-2" />
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Support Info */}
          <div className="text-gray-300 text-center">
            <p className="mb-2">Need help getting started?</p>
            <p>Contact support: <a href="mailto:support@coinrailz.com" className="text-blue-400 underline">support@coinrailz.com</a></p>
            <p className="text-sm mt-4">You can manage your subscription anytime from your account settings.</p>
          </div>
        </div>
      </div>
    </div>
  );
}