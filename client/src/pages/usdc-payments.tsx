import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Wallet, Network, Clock, ArrowRight } from "@/lib/icons";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Link } from "wouter";

export default function USDCPayments() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader /><MobileNavigation />
      <main className="max-w-6xl mx-auto px-4 py-8 pb-20">
        <section className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-8 text-white mb-8 text-center">
          <Zap className="w-10 h-10 mx-auto mb-3" />
          <h1 className="text-3xl md:text-4xl font-bold">On-Chain USDC Payments</h1>
          <p className="text-lg text-blue-100 mt-3">USDC-first payment flows for machine-payable APIs and agentic commerce.</p>
          <Badge className="mt-4 bg-white/20 text-white">x402 pay-per-call is live</Badge>
        </section>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card><CardHeader><Wallet className="w-7 h-7 text-blue-600 mb-2" /><CardTitle>User-Controlled Wallet</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Use a wallet you control to sign and submit on-chain USDC payments.</CardContent></Card>
          <Card><CardHeader><Network className="w-7 h-7 text-green-600 mb-2" /><CardTitle>Network Choice</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Supported networks and assets are shown in each x402 payment challenge.</CardContent></Card>
          <Card><CardHeader><Clock className="w-7 h-7 text-purple-600 mb-2" /><CardTitle>Network-Dependent</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Confirmation times and transaction fees vary by network conditions and wallet settings.</CardContent></Card>
        </div>
        <Card className="mb-8">
          <CardHeader><CardTitle>How It Works</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6 text-center">
            <div><b>1. Choose your wallet</b><p className="text-sm text-muted-foreground mt-2">Connect or use your own compatible wallet.</p></div>
            <div><b>2. Receive an x402 challenge</b><p className="text-sm text-muted-foreground mt-2">The service returns machine-readable USDC payment instructions.</p></div>
            <div><b>3. Pay on-chain</b><p className="text-sm text-muted-foreground mt-2">Submit the signed payment and retry with payment proof after network confirmation.</p></div>
          </CardContent>
        </Card>
        <div className="text-center"><Button size="lg" asChild><Link href="/x402-docs">Make your first x402 call <ArrowRight className="w-4 h-4 ml-2" /></Link></Button></div>
      </main>
    </div>
  );
}