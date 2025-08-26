
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { AIAgentManager } from "@/components/AIAgentManager";
import { PremiumUserBadge, PremiumFeatureGate } from "@/components/PremiumUserBadge";

export default function AIAgents() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-2">
              AI Agent Management
            </h1>
            <p className="text-neutral-500">
              Create and manage AI agents for automated transactions and portfolio management
            </p>
          </div>
          <PremiumUserBadge variant="compact" showCredits />
        </div>

        <PremiumFeatureGate feature="AI Agent Management" requiredTier="starter">
          <AIAgentManager />
        </PremiumFeatureGate>
      </main>
    </div>
  );
}
