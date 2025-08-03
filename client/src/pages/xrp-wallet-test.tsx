import React from 'react';
import { XRPWalletManager } from '@/components/XRPWalletManager';
import { NavigationHeader } from '@/components/navigation-header';

export default function XRPWalletTest() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <NavigationHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">XRP Wallet Testing</h1>
            <p className="text-gray-600">
              Test complete XRP wallet functionality: creation, import, balance checking, and payments
            </p>
          </div>
          
          <XRPWalletManager />
        </div>
      </div>
    </div>
  );
}