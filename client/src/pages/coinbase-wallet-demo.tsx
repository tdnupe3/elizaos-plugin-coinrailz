/**
 * Coinbase Wallet Demo Page
 * Direct access to Coinbase DeFi wallet features without authentication
 */

import { NavigationHeader } from '@/components/navigation-header';
import CoinbaseDefiWallet from '@/components/CoinbaseDefiWallet';

export default function CoinbaseWalletDemo() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Coinbase Wallet Integration
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Connect your Coinbase self-custody wallet for advanced DeFi features
          </p>
        </div>

        <CoinbaseDefiWallet />
      </div>
    </div>
  );
}