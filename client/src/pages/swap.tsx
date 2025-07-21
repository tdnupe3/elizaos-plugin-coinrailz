import React from "react";
import { WalletConnect } from "@/components/wallet-connect";
import { TokenLogoSwapInterface } from "@/components/token-logo-swap";

export default function SwapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Crypto Swap
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Trade cryptocurrencies instantly with the best rates across multiple exchanges.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Wallet Connection */}
          <div>
            <WalletConnect className="mb-6" />
          </div>

          {/* Simple Swap Interface */}
          <div className="lg:col-span-2">
            <TokenLogoSwapInterface />
          </div>
        </div>
      </div>
    </div>
  );
}