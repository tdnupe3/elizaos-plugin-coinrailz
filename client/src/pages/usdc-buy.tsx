import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DollarSign, Info } from "@/lib/icons";
import { Link } from "wouter";

export default function USDCBuy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-6 w-6" />Buy USDC</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <Alert><Info className="h-4 w-4" /><AlertDescription><strong>Fiat on-ramp unavailable.</strong> Coin Railz does not currently offer card, ACH, wire, or other fiat-to-USDC purchase services.</AlertDescription></Alert>
            <p className="text-muted-foreground">Coin Railz is USDC-first for on-chain, machine-payable API access. Bring USDC from a provider or wallet of your choice, then use it for supported x402 pay-per-call flows.</p>
            <Button asChild variant="outline"><Link href="/usdc-payments">Learn about USDC payments</Link></Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}