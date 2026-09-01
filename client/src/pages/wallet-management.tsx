import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Shield } from "@/lib/icons";

export default function WalletManagement() {
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallet Management</h1>
      <Card><CardHeader><CardTitle className="flex gap-2 items-center"><Wallet className="w-5 h-5" />On-Chain Wallet Workflows</CardTitle></CardHeader><CardContent>Use a wallet you control for supported USDC and on-chain payment workflows. Always verify the destination address, network, amount, and network fee before signing a transaction.</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex gap-2 items-center"><Shield className="w-5 h-5" />Security Notice</CardTitle></CardHeader><CardContent>Coin Railz does not provide custody, deposit insurance, bank settlement, or fiat funding and withdrawal services. Protect your wallet credentials and use trusted wallet software.</CardContent></Card>
    </main>
  );
}