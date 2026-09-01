import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Documentation() {
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Coin Railz Developer Documentation</h1>
      <Card><CardHeader><CardTitle>USDC-First x402 Payments</CardTitle></CardHeader><CardContent>Coin Railz supports x402 pay-per-call APIs using on-chain USDC payments. A service returns a machine-readable payment challenge; your wallet signs and submits the required on-chain payment before retrying with proof.</CardContent></Card>
      <Card><CardHeader><CardTitle>Wallet Tooling</CardTitle></CardHeader><CardContent>Use a wallet you control for on-chain transactions. Current agent tooling includes Coinbase CDP and AgentKit. Network availability, confirmation timing, and fees depend on the payment challenge and selected network.</CardContent></Card>
      <Card><CardHeader><CardTitle>Getting Started</CardTitle></CardHeader><CardContent>Review the x402 payment documentation and service catalog for current supported payment instructions. Coin Railz does not provide legal, banking, custody, or fiat on/off-ramp services.</CardContent></Card>
    </main>
  );
}