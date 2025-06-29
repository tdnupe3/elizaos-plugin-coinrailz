import React from "react";
import { WalletConnect } from "@/components/wallet-connect";
import { RealSwapInterface } from "@/components/real-swap-interface";

export default function SwapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Multi-Wallet DEX Aggregator
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Execute real blockchain transactions with live 1inch API quotes.
            Connect any of 5 supported wallets for optimal EVM trading experience.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Wallet Connection */}
          <div>
            <WalletConnect className="mb-6" />
          </div>

          {/* Real Swap Interface */}
          <div className="lg:col-span-2">
            <RealSwapInterface />
          </div>
        </div>
      </div>
    </div>
  );
}