import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import CoinbaseCDPWallet from '@/components/CoinbaseCDPWallet';
import { NavigationHeader } from '@/components/navigation-header';

export default function CDPWalletPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to login if not authenticated
      window.location.href = '/api/login';
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Coinbase Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Professional crypto wallet powered by Coinbase infrastructure
          </p>
        </div>

        <CoinbaseCDPWallet />
      </div>
    </div>
  );
}