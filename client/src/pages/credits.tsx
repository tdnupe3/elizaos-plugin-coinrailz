import { CreditsDashboard } from '@/components/CreditsDashboard';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { MessageSquare, CreditCard, Key, Zap } from 'lucide-react';

export default function CreditsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Credits Dashboard */}
      <CreditsDashboard />

      {/* ChatGPT In-Chat Purchase Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold font-[Space_Grotesk] mb-4">
            Buy Credits Directly in ChatGPT
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Using our ChatGPT integration? You can now purchase credits without leaving your conversation. 
            Just say "I want to buy credits" and complete your purchase in 3 simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Step 1: Request</h3>
            <p className="text-muted-foreground text-sm">
              Tell the Coin Railz GPT "I want to buy credits" or ask about credit packages
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Step 2: Pay</h3>
            <p className="text-muted-foreground text-sm">
              Click the secure Stripe checkout link and complete your payment
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Step 3: Get API Key</h3>
            <p className="text-muted-foreground text-sm">
              Return to the chat and receive your API key instantly - ready to use
            </p>
          </Card>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Available Credit Packages</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">$10</div>
                  <div className="text-sm text-muted-foreground">100 credits</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">$25</div>
                  <div className="text-sm text-muted-foreground">250 credits</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border-2 border-blue-500">
                  <div className="text-xs text-blue-600 font-semibold mb-1">POPULAR</div>
                  <div className="text-2xl font-bold text-blue-600">$50</div>
                  <div className="text-sm text-muted-foreground">500 credits</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">$100</div>
                  <div className="text-sm text-muted-foreground">1000 credits</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                1 credit = $0.10 USD. Credits never expire and can be used across all Coin Railz services.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <a 
            href="https://chatgpt.com/g/g-6941998b61808191bf46e463667415cd-coin-railz-market-intelligence"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
            data-testid="link-try-chatgpt"
          >
            <MessageSquare className="w-5 h-5" />
            Try Coin Railz GPT
          </a>
        </div>
      </div>

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Conversion Optimization CTA */}
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h3 className="text-3xl font-bold font-[Space_Grotesk] mb-4">
          Ready to Streamline Your Payments?
        </h3>
        <p className="text-lg text-muted-foreground mb-8">
          With prepaid credits, auto-approval for payments under $100, and transparent pricing, 
          Coin Railz makes it easy for AI agents to access premium services instantly.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
            data-testid="button-get-started"
            onClick={() => navigate('/ai-agent-registration')}
          >
            Get Started
          </button>
          <button 
            className="px-8 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 font-semibold rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all"
            data-testid="button-view-services"
            onClick={() => navigate('/ai-marketplace')}
          >
            View Services
          </button>
        </div>
      </div>
    </div>
  );
}
