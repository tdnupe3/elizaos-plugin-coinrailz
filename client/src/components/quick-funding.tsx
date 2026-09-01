import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Zap } from "@/lib/icons";

export function QuickFunding() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-green-500" />Funding</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Alert><Info className="h-4 w-4" /><AlertDescription><strong>Fiat funding is not currently available.</strong> Coin Railz does not offer debit-card, bank-account, ACH, or wire funding.</AlertDescription></Alert>
        <p className="text-sm text-muted-foreground">Bring USDC from a wallet or provider of your choice for supported on-chain x402 payment flows. Network fees and confirmation times vary by network.</p>
      </CardContent>
    </Card>
  );
}