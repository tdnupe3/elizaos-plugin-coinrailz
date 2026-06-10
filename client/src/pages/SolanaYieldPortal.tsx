import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import {
  TrendingUp,
  Zap,
  Shield,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface YieldRatesResponse {
  success: boolean;
  timestamp: string;
  chain: string;
  protocol: string;
  usdc: {
    apyPct: number | null;
    apyBps: number | null;
    formatted: string;
  };
  topOpportunities: any[];
  onChain: {
    depositTvlUsdc?: number;
    liquidityUsdc?: number;
  } | null;
  minDeposit: { raw: number; usdc: number };
  fees: {
    deposit: string;
    withdrawal: string;
    performance: string;
  };
  comparison: {
    solana: string;
    base: string;
    note: string;
  };
}

interface PositionResponse {
  success: boolean;
  position: {
    wallet: string;
    hasPosition: boolean;
    depositedUsdc: number;
    currentValueUsdc: number;
    protocol: string;
    chain: string;
    network: string;
    obligationAddress: string | null;
  };
  platformRecord: any | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function copyToClipboard(text: string, toast: any, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => {
    toast({ title: label, description: text.slice(0, 60) + (text.length > 60 ? "…" : "") });
  });
}

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SolanaYieldPortal() {
  const { toast } = useToast();
  const [walletInput, setWalletInput] = useState("");
  const [lookedUpWallet, setLookedUpWallet] = useState<string | null>(null);

  // Live rates
  const { data: ratesData, isLoading: ratesLoading, refetch: refetchRates, dataUpdatedAt } = useQuery<YieldRatesResponse>({
    queryKey: ["/api/solana-yield/rates"],
    refetchInterval: 5 * 60 * 1000, // 5 min
    staleTime: 2 * 60 * 1000,
  });

  // Position lookup
  const { data: positionData, isLoading: positionLoading } = useQuery<PositionResponse>({
    queryKey: [`/api/solana-yield/position/${lookedUpWallet}`],
    enabled: !!lookedUpWallet,
    retry: false,
  });

  const rates = ratesData?.success ? ratesData : null;
  const apyDisplay = rates?.usdc.formatted ?? "Fetching…";
  const tvl = rates?.onChain?.depositTvlUsdc;

  const SOLANA_APY  = rates?.usdc.apyPct;
  const BASE_APY    = 3.17;
  const multiplier  = SOLANA_APY ? (SOLANA_APY / BASE_APY).toFixed(1) : null;

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  // ── Snippet Helpers ──────────────────────────────────────────────────────────

  const depositSnippet = `// ElizaOS agent — deposit $10 USDC into Kamino (Solana)
const BASE_URL = "https://coinrailz.com";

const { transactions, feeRaw } = await fetch(\`\${BASE_URL}/api/solana-yield/deposit-tx\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet: agentWalletPublicKey, amount: 10_000_000 }) // $10 USDC
}).then(r => r.json());

// Sign & submit each tx in order
for (const { base64, description } of transactions) {
  const tx = VersionedTransaction.deserialize(Buffer.from(base64, "base64"));
  tx.sign([agentKeypair]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig);
}

// Confirm deposit
await fetch(\`\${BASE_URL}/api/solana-yield/confirm\`, {
  method: "POST",
  body: JSON.stringify({ wallet: agentWalletPublicKey, txSignature: sig })
});`;

  const positionSnippet = `// Check agent position (free)
const { position } = await fetch(
  \`https://coinrailz.com/api/solana-yield/position/\${agentWallet}\`
).then(r => r.json());

console.log("Deposited:", position.depositedUsdc, "USDC");
console.log("Current value:", position.currentValueUsdc, "USDC");
console.log("Yield earned:", (position.currentValueUsdc - position.depositedUsdc).toFixed(6), "USDC");`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">

      {/* ── Header ── */}
      <div className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white text-sm">
              ← Back
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-sm font-medium">Solana Yield Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-green-500/40 text-green-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block mr-1.5" />
              Live
            </Badge>
            <Badge variant="outline" className="border-purple-500/40 text-purple-400 text-xs">
              Kamino Lending v1
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">

        {/* ── Hero ── */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
            <Zap className="w-3 h-3" />
            AI Agent-Native — Non-Custodial — Solana
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Earn Yield on{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
              Solana USDC
            </span>
          </h1>
          <p className="text-slate-400 text-lg">
            Build unsigned VersionedTransactions to deposit USDC into Kamino Lending. Your agents sign and submit — Coin Railz never touches your keys.
          </p>
        </div>

        {/* ── Live Rate Hero ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border-purple-500/20 col-span-1 md:col-span-1">
            <CardContent className="p-6 space-y-2">
              <p className="text-slate-400 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Current Kamino APY
              </p>
              {ratesLoading ? (
                <div className="h-12 bg-slate-700/40 rounded animate-pulse" />
              ) : (
                <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                  {apyDisplay}
                </p>
              )}
              <p className="text-xs text-slate-500">
                USDC / Mainnet
                {updatedAt && <span className="ml-2">· Updated {updatedAt}</span>}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white p-0 h-auto"
                onClick={() => refetchRates()}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Refresh
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-700/30">
            <CardContent className="p-6 space-y-2">
              <p className="text-slate-400 text-sm">Kamino TVL (USDC)</p>
              {ratesLoading ? (
                <div className="h-10 bg-slate-700/40 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-white">
                  {tvl ? `$${(tvl / 1e6).toFixed(1)}M` : "—"}
                </p>
              )}
              <p className="text-xs text-slate-500">Live on-chain reserve</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-700/30">
            <CardContent className="p-6 space-y-2">
              <p className="text-slate-400 text-sm">vs Base / Aave v3</p>
              {ratesLoading ? (
                <div className="h-10 bg-slate-700/40 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-amber-400">
                  {multiplier ? `${multiplier}×` : "—"} higher
                </p>
              )}
              <p className="text-xs text-slate-500">
                Solana: {apyDisplay} · Base: {BASE_APY}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Comparison note ── */}
        {rates?.comparison.note && (
          <p className="text-center text-slate-500 text-sm">{rates.comparison.note}</p>
        )}

        {/* ── Fee & Limits strip ── */}
        <div className="flex flex-wrap gap-3 justify-center">
          {[
            { label: "Deposit Fee", val: rates?.fees.deposit ?? "0.50%" },
            { label: "Withdrawal Fee", val: rates?.fees.withdrawal ?? "0.50%" },
            { label: "Performance Fee", val: rates?.fees.performance ?? "15% of yield (v2)" },
            { label: "Min Deposit", val: `$${rates?.minDeposit.usdc ?? 5} USDC` },
            { label: "Chain", val: "Solana Mainnet" },
            { label: "Protocol", val: "Kamino Lending v1" },
          ].map(({ label, val }) => (
            <div key={label} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/30 rounded-full text-sm">
              <span className="text-slate-500">{label}:</span>
              <span className="text-white font-medium">{val}</span>
            </div>
          ))}
        </div>

        {/* ── How it works ── */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-center">How it works for agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { step: "1", title: "Request deposit tx", body: "POST /deposit-tx with your wallet and amount. Get back unsigned VersionedTransactions." },
              { step: "2", title: "Sign & submit", body: "Sign each tx with your keypair and submit to Solana. You control your private keys." },
              { step: "3", title: "Confirm", body: "Call POST /confirm with the final tx signature to register your position." },
              { step: "4", title: "Read position", body: "GET /position/:wallet anytime to see current value and yield earned. Free, no payment required." },
            ].map(({ step, title, body }) => (
              <Card key={step} className="bg-slate-900/40 border-slate-700/30">
                <CardContent className="p-5 space-y-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm">
                    {step}
                  </div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-slate-400 text-xs leading-relaxed">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Position lookup ── */}
        <Card className="bg-slate-900/40 border-slate-700/30">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Check Position (Free)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Enter Solana wallet address"
                value={walletInput}
                onChange={e => setWalletInput(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white font-mono text-sm"
              />
              <Button
                onClick={() => setLookedUpWallet(walletInput.trim())}
                disabled={!walletInput.trim()}
                className="bg-purple-600 hover:bg-purple-700 shrink-0"
              >
                Lookup
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {positionLoading && (
              <div className="h-16 bg-slate-800/50 rounded animate-pulse" />
            )}

            {positionData?.success && !positionLoading && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Has Position", val: positionData.position.hasPosition ? "Yes" : "No" },
                  { label: "Deposited", val: `${fmt(positionData.position.depositedUsdc, 4)} USDC` },
                  { label: "Current Value", val: `${fmt(positionData.position.currentValueUsdc, 4)} USDC` },
                  {
                    label: "Yield Earned",
                    val: `${fmt(positionData.position.currentValueUsdc - positionData.position.depositedUsdc, 6)} USDC`,
                  },
                ].map(({ label, val }) => (
                  <div key={label} className="p-3 bg-slate-800/60 rounded-lg">
                    <p className="text-slate-400 text-xs">{label}</p>
                    <p className="text-white font-semibold text-sm mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
            )}

            {positionData && !positionData.success && !positionLoading && (
              <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-900/20 rounded border border-red-800/30">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Failed to load position. Verify the wallet address is a valid Solana public key.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Code Snippets ── */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Agent Integration</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300 font-medium">Deposit (ElizaOS / Node.js)</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white h-7 px-2"
                  onClick={() => copyToClipboard(depositSnippet, toast, "Deposit snippet copied")}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-slate-950 border border-slate-700/40 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {depositSnippet}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300 font-medium">Read Position</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white h-7 px-2"
                  onClick={() => copyToClipboard(positionSnippet, toast, "Position snippet copied")}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-slate-950 border border-slate-700/40 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {positionSnippet}
              </pre>
            </div>
          </div>
        </div>

        {/* ── API Reference ── */}
        <Card className="bg-slate-900/40 border-slate-700/30">
          <CardHeader>
            <CardTitle className="text-base font-semibold">API Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { method: "GET",  path: "/api/solana-yield/rates",          badge: "free",  desc: "Live Kamino APY, TVL, utilization, fee schedule" },
                { method: "GET",  path: "/api/solana-yield/stats",          badge: "free",  desc: "On-chain reserve health and market summary" },
                { method: "GET",  path: "/api/solana-yield/position/:wallet", badge: "free", desc: "Agent's collateral balance and current USDC value" },
                { method: "POST", path: "/api/solana-yield/deposit-tx",     badge: "$0.10", desc: "Build unsigned VersionedTx bundle for USDC deposit" },
                { method: "POST", path: "/api/solana-yield/withdraw-tx",    badge: "free",  desc: "Build unsigned VersionedTx bundle for USDC withdrawal" },
                { method: "POST", path: "/api/solana-yield/confirm",        badge: "free",  desc: "Confirm on-chain submission, persist position record" },
                { method: "GET",  path: "/api/solana-yield/manifest",       badge: "free",  desc: "Machine-readable JSON manifest for AI agent discovery" },
              ].map(({ method, path, badge, desc }) => (
                <div key={path} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/40 transition-colors group">
                  <span className={`shrink-0 text-xs font-mono font-bold px-2 py-0.5 rounded ${method === "GET" ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"}`}>
                    {method}
                  </span>
                  <code className="text-slate-300 text-xs font-mono flex-1 break-all">{path}</code>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${badge === "free" ? "border-green-600/30 text-green-400" : "border-amber-600/30 text-amber-400"}`}
                  >
                    {badge}
                  </Badge>
                  <p className="text-slate-500 text-xs hidden md:block min-w-[200px]">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Feature Highlights ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: <Shield className="w-5 h-5 text-green-400" />,
              title: "Non-custodial",
              body: "We build the transaction, you sign it. Your private keys never leave your agent.",
            },
            {
              icon: <Zap className="w-5 h-5 text-yellow-400" />,
              title: "1 API call to deposit",
              body: "POST /deposit-tx returns a ready-to-sign VersionedTransaction. No wallet SDK required.",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-purple-400" />,
              title: "Higher yields on Solana",
              body: "Kamino USDC rates are typically 2-4× Aave on Base due to Solana's higher DeFi utilization.",
            },
          ].map(({ icon, title, body }) => (
            <Card key={title} className="bg-slate-900/40 border-slate-700/30">
              <CardContent className="p-5 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800/60 flex items-center justify-center">
                  {icon}
                </div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Links ── */}
        <div className="flex flex-wrap gap-3 justify-center pb-6">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 hover:border-slate-400"
            onClick={() => window.open("/api/solana-yield/manifest", "_blank")}
          >
            <ExternalLink className="w-3 h-3 mr-2" />
            Agent Manifest
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 hover:border-slate-400"
            onClick={() => window.open("/api/solana-yield/rates", "_blank")}
          >
            <ExternalLink className="w-3 h-3 mr-2" />
            Live Rates JSON
          </Button>
          <Link href="/yield-portal">
            <Button variant="outline" size="sm" className="border-slate-600 hover:border-slate-400">
              <ArrowRight className="w-3 h-3 mr-2" />
              Base Yield Portal (Aave)
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
