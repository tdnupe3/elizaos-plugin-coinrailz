import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Globe, Info } from "@/lib/icons";
import { Link } from "wouter";

export default function USDCCrossBorder() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-6 w-6" />USDC Cross-Border Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription><strong>Not currently available.</strong> Coin Railz does not currently provide cross-border remittance, foreign-exchange conversion, bank delivery, or cash-out services.</AlertDescription>
            </Alert>
            <p className="text-muted-foreground">We are USDC-first and interested in future integrations that could expand agentic payment workflows. Today, Coin Railz supports on-chain USDC pay-per-call flows; network confirmation times and transaction fees depend on the selected network.</p>
            <Button asChild variant="outline"><Link href="/usdc-payments">Explore on-chain USDC payments</Link></Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}