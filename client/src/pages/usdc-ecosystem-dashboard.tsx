import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Link } from "wouter";

export default function USDCEcosystemDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader /><MobileNavigation />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white text-center mb-8">
          <h1 className="text-3xl font-bold">USDC Ecosystem Dashboard</h1>
          <p className="mt-3 text-blue-100">USDC-first, on-chain payment tooling for agentic commerce.</p>
          <Badge className="mt-4 bg-white/20 text-white">x402 pay-per-call is live</Badge>
        </section>
        <div className="grid md:grid-cols-3 gap-6">
          <Card><CardHeader><CardTitle>On-Chain USDC Payments</CardTitle></CardHeader><CardContent>Use a wallet you control to complete supported x402 pay-per-call transactions. Confirmation time and network fees vary by network.</CardContent></Card>
          <Card><CardHeader><CardTitle>Current Wallet Tooling</CardTitle></CardHeader><CardContent>Coin Railz’s current agent tooling uses Coinbase CDP and AgentKit, alongside user-controlled wallet workflows.</CardContent></Card>
          <Card><CardHeader><CardTitle>Roadmap</CardTitle></CardHeader><CardContent>We are enthusiastic about USDC and interested in deeper ecosystem integrations as product requirements develop.</CardContent></Card>
        </div>
        <p className="mt-8 text-center"><Link className="text-blue-600 underline" href="/x402-docs">Read the x402 payment documentation</Link></p>
      </main>
    </div>
  );
}