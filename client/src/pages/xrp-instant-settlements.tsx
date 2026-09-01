import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Zap, Clock, Shield } from "@/lib/icons";
import { useLocation } from "wouter";

export default function XRPInstantSettlements() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => setLocation("/xrp-ecosystem")}><ArrowLeft className="w-4 h-4 mr-2" />Back to XRP Ecosystem</Button>
        <section className="mt-6 text-center"><Zap className="w-10 h-10 mx-auto text-orange-600 mb-3" /><h1 className="text-3xl font-bold">XRP Ledger Transfer Workflows</h1><p className="mt-3 text-gray-600">Explore on-chain XRP Ledger transfer and payment concepts for developer workflows.</p></section>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card><CardHeader><Clock className="w-6 h-6 text-orange-600" /><CardTitle>Network Confirmation</CardTitle></CardHeader><CardContent>Confirmation timing depends on network conditions and transaction details.</CardContent></Card>
          <Card><CardHeader><Shield className="w-6 h-6 text-orange-600" /><CardTitle>On-Chain Records</CardTitle></CardHeader><CardContent>Blockchain transaction records can support transparent technical verification.</CardContent></Card>
          <Card><CardHeader><Zap className="w-6 h-6 text-orange-600" /><CardTitle>Developer Focus</CardTitle></CardHeader><CardContent>Use user-controlled wallets and review transaction parameters before submitting payments.</CardContent></Card>
        </div>
      </main>
    </div>
  );
}