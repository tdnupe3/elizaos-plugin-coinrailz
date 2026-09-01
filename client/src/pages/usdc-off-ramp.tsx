import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowRight, Info } from "@/lib/icons";
import { Link } from "wouter";

export default function USDCOffRamp() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <Card>
          <CardHeader><CardTitle>USDC Off-Ramp</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <Alert><Info className="h-4 w-4" /><AlertDescription><strong>Off-ramp unavailable.</strong> Coin Railz does not currently convert USDC to cash, bank deposits, debit-card payouts, gift cards, or other fiat withdrawal methods.</AlertDescription></Alert>
            <p className="text-muted-foreground">We are enthusiastic about USDC-native agent payments and may evaluate future integrations as the roadmap develops. For now, use a wallet or provider of your choice for any conversion outside Coin Railz.</p>
            <Button asChild variant="outline"><Link href="/usdc-payments">View USDC payment information <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}