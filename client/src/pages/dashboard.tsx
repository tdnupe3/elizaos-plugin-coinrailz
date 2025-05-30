import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { BalanceCards } from "@/components/balance-cards";
import { SendMoneyForm } from "@/components/send-money-form";
import { RecentActivity } from "@/components/recent-activity";
import { CryptoHoldings } from "@/components/crypto-holdings";
import { SecurityBanner } from "@/components/security-banner";
import { AdBanner } from "@/components/ad-banner";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-2">
            Welcome back, {user?.firstName || "User"}!
          </h1>
          <p className="text-neutral-500">Manage your payments and crypto portfolio</p>
        </div>

        <BalanceCards />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <SendMoneyForm />
          </div>
          
          <div className="space-y-6">
            <RecentActivity />
            <CryptoHoldings />
          </div>
        </div>

        <SecurityBanner />
      </main>
      
      <AdBanner position="bottom" />
    </div>
  );
}
