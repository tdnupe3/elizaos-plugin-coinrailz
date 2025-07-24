import React from "react";
import { useTranslation } from "react-i18next";
import { WalletConnect } from "@/components/wallet-connect";
import { TokenLogoSwapInterface } from "@/components/token-logo-swap";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavigationHeader } from "@/components/navigation-header";

export default function SwapPage() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NavigationHeader />
      
      {/* Language Switcher in top right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t('swap.title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('swap.subtitle')}
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