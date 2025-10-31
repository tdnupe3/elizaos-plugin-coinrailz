import { CreditsDashboard } from '@/components/CreditsDashboard';
import { TestimonialsSection } from '@/components/TestimonialsSection';
import { useLocation } from 'wouter';

export default function CreditsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Credits Dashboard */}
      <CreditsDashboard />

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
