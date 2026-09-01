import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Wallet, Shield, Network } from "@/lib/icons";

export default function USDCWallets() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader /><MobileNavigation />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-lg p-8 text-white text-center">
          <Wallet className="w-10 h-10 mx-auto mb-3" /><h1 className="text-3xl font-bold">USDC Wallet Workflows</h1>
          <p className="mt-3 text-purple-100">Use a wallet you control for supported on-chain USDC payment flows.</p>
        </section>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card><CardHeader><Wallet className="w-6 h-6 text-purple-600" /><CardTitle>User-Controlled Wallets</CardTitle></CardHeader><CardContent>Review the receiving address and selected network before you submit a transfer.</CardContent></Card>
          <Card><CardHeader><Network className="w-6 h-6 text-blue-600" /><CardTitle>On-Chain Payments</CardTitle></CardHeader><CardContent>Supported networks, fees, and confirmation timing are specified by the applicable payment flow.</CardContent></Card>
          <Card><CardHeader><Shield className="w-6 h-6 text-green-600" /><CardTitle>Security Practices</CardTitle></CardHeader><CardContent>Protect wallet credentials, verify transaction details, and use trusted wallet software.</CardContent></Card>
        </div>
      </main>
    </div>
  );
}