import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "@/lib/icons";

export default function FundsManagement() {
  return (
    <div className="container mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader><CardTitle>Funds Management</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert><Info className="h-4 w-4" /><AlertDescription><strong>Bank funding and withdrawals are unavailable.</strong> Coin Railz does not currently accept bank, ACH, wire, card, or fiat deposits, and does not provide bank withdrawals or settlement services.</AlertDescription></Alert>
          <p className="text-muted-foreground">Coin Railz focuses on USDC-first, on-chain pay-per-call access. Wallet balances and payment availability are determined by the applicable product flow and network.</p>
        </CardContent>
      </Card>
    </div>
  );
}