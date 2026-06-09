import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, Shield, Zap, RefreshCw, Code, Copy, CheckCircle,
  ExternalLink, AlertCircle, ChevronRight, Activity, Lock, DollarSign,
  Wallet, Key, ArrowRight, Sparkles, Clock, BarChart3
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProtocolRate {
  protocol: string; network: string; apyPercent: number; status: string;
}
interface RatesResponse {
  success: boolean; timestamp: string;
  rates: { aave: ProtocolRate; compound: ProtocolRate; morpho: ProtocolRate };
  currentBest: { protocol: string; apyPercent: number };
  activeProtocol: string;
  netAPY: { currentNetApyPercent: number; breakdown: string };
  fees: { entryFeePct: number; performanceFeePct: number; exitFeePct: number };
}
interface StatsResponse {
  success: boolean;
  vault: { address: string; network: string; asset: string; standard: string; shareToken: string };
  stats: { tvlUsdc: string; pricePerShare: string; pendingFeesUsdc: string; nextRebalanceInSec: number };
  routing: { currentProtocol: string; currentAPY: number; rebalanceInterval: string; protocols: string[] };
  fees: { entryFeePct: number; performanceFeePct: number; minHarvestUsd: number; feeTimelockHours: number };
  security: { nonCustodial: boolean; adminCanWithdrawPrincipal: boolean; emergencyExitAlways: boolean; auditStatus: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function apyColor(apy: number) {
  if (apy >= 6) return "text-green-400";
  if (apy >= 4) return "text-emerald-400";
  if (apy >= 2) return "text-yellow-400";
  return "text-slate-400";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
      title="Copy"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Yield Calculator ──────────────────────────────────────────────────────────

function YieldCalculator({ netAPY }: { netAPY: number }) {
  const [amount, setAmount] = useState("1000");
  const periods = [
    { label: "1 month",  months: 1 },
    { label: "3 months", months: 3 },
    { label: "1 year",   months: 12 },
  ];
  const amountNum = parseFloat(amount) || 0;
  const afterEntryFee = amountNum * 0.995;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white">Yield Calculator</span>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs ml-auto">
          {netAPY.toFixed(2)}% net APY
        </Badge>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-slate-400 text-sm">$</span>
        <Input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="bg-white/5 border-white/10 text-white w-36 h-8 text-sm"
          placeholder="1000"
          min="1"
        />
        <span className="text-slate-400 text-sm">USDC deposited</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {periods.map(({ label, months }) => {
          const rate = netAPY / 100;
          const earned = afterEntryFee * (Math.pow(1 + rate / 12, months) - 1);
          return (
            <div key={label} className="rounded-lg bg-black/30 p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">{label}</div>
              <div className="text-lg font-bold text-emerald-400">
                +${earned.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500">net yield</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-slate-500">
        Entry fee: ${(amountNum * 0.005).toFixed(2)} · ${afterEntryFee.toFixed(2)} earns yield · APY variable
      </div>
    </div>
  );
}

// ── Protocol Card ─────────────────────────────────────────────────────────────

function ProtocolCard({ name, apy, isBest, status }: { name: string; apy: number; isBest: boolean; status: string }) {
  const logos: Record<string, string> = { "Aave v3": "🔷", "Compound v3": "🔵", "Morpho Blue": "🟣" };
  return (
    <div className={`relative rounded-xl border p-5 transition-all ${
      isBest ? "border-emerald-500/60 bg-emerald-500/5 shadow-lg shadow-emerald-500/10" : "border-white/10 bg-white/5 hover:border-white/20"
    }`}>
      {isBest && (
        <div className="absolute -top-3 left-4">
          <Badge className="bg-emerald-500 text-black text-xs font-bold px-2 py-0.5">⚡ AUTO-SELECTED</Badge>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{logos[name] || "🔶"}</span>
          <div>
            <div className="font-semibold text-white">{name}</div>
            <div className="text-xs text-slate-400">Base mainnet</div>
          </div>
        </div>
        <Badge variant="outline" className={`text-xs ${status === 'live' ? 'border-green-500/40 text-green-400' : 'border-yellow-500/40 text-yellow-400'}`}>
          {status === 'live' ? '● Live' : '◌ Soon'}
        </Badge>
      </div>
      <div className={`text-4xl font-bold mb-1 ${apyColor(apy)}`}>
        {apy > 0 ? `${apy.toFixed(2)}%` : "—"}
      </div>
      <div className="text-xs text-slate-400">Supply APY (gross)</div>
      {isBest && apy > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-500/20">
          <div className="text-xs text-emerald-400">Net to depositor after 15% perf fee</div>
          <div className="text-lg font-semibold text-emerald-300">{(apy * 0.85).toFixed(2)}%</div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function YieldPortal() {
  const [agentTab, setAgentTab] = useState<"api-key" | "wallet" | "security">("api-key");
  const [depositInput, setDepositInput] = useState("50");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [depositResult, setDepositResult] = useState<any>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);

  const { data: ratesData, isLoading: ratesLoading } = useQuery<RatesResponse>({
    queryKey: ["/api/yield/rates"],
    refetchInterval: 60_000,
  });

  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ["/api/yield/stats"],
    refetchInterval: 120_000,
  });

  const rates    = ratesData?.rates;
  const best     = ratesData?.currentBest;
  const netAPY   = ratesData?.netAPY?.currentNetApyPercent ?? 0;
  const stats    = statsData?.stats;
  const vault    = statsData?.vault;
  const isLive   = vault?.address && vault.address !== 'deploying-soon';
  const VAULT_ADDR = isLive ? vault!.address : null;

  // ── Live demo deposit ─────────────────────────────────────────────────────
  async function handleLiveDeposit() {
    if (!apiKeyInput.trim()) {
      setDepositError("Paste your API key above first.");
      return;
    }
    const amount = parseFloat(depositInput);
    if (isNaN(amount) || amount < 1) {
      setDepositError("Minimum deposit is $1.00");
      return;
    }
    setIsDepositing(true);
    setDepositError(null);
    setDepositResult(null);
    try {
      const resp = await fetch("/api/yield/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKeyInput.trim() },
        body: JSON.stringify({ amount }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setDepositError(data.error || "Deposit failed.");
      } else {
        setDepositResult(data);
      }
    } catch (e: any) {
      setDepositError(e.message);
    } finally {
      setIsDepositing(false);
    }
  }

  const curlSnippet = `# 1. Check live APY (no auth required)
curl https://coinrailz.com/api/yield/rates

# 2. Deposit $50 into the vault (deducts from your credits)
curl -X POST https://coinrailz.com/api/yield/deposit \\
  -H "X-API-KEY: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 50}'

# 3. Check your position (live, real-time)
curl https://coinrailz.com/api/yield/my-position \\
  -H "X-API-KEY: YOUR_KEY"

# 4. Withdraw anytime (credits restored + yield)
curl -X POST https://coinrailz.com/api/yield/withdraw \\
  -H "X-API-KEY: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 50}'`;

  const viemSnippet = `import { createWalletClient, parseUnits } from 'viem';

const VAULT = '${VAULT_ADDR || "0x86e2508ca0de34530dc847645f60f0d46d95176a"}';
const USDC  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// OR: get pre-built calldata from API (no viem needed)
// GET /api/yield/deposit-tx?amount=100&recipient=0xYOUR_WALLET

// Step 1: Approve vault to spend USDC
await walletClient.writeContract({
  address: USDC,
  abi: [{ name:'approve', type:'function',
    inputs:[{type:'address'},{type:'uint256'}], outputs:[{type:'bool'}] }],
  functionName: 'approve',
  args: [VAULT, parseUnits('100', 6)],
});

// Step 2: Deposit — receive crUSDC shares
await walletClient.writeContract({
  address: VAULT,
  abi: [{ name:'deposit', type:'function',
    inputs:[{type:'uint256'},{type:'address'}], outputs:[{type:'uint256'}] }],
  functionName: 'deposit',
  args: [parseUnits('100', 6), walletAddress],
});

// Or use ethers.js, wagmi, cast — anything that can write ERC-4626`;

  const securityPoints = [
    { icon: <Shield className="w-4 h-4 text-emerald-400" />, label: "Non-custodial on-chain vault", detail: "The ERC-4626 vault contract cannot be drained by admin. emergencyWithdraw() always works." },
    { icon: <Lock className="w-4 h-4 text-blue-400" />, label: "48h fee timelock", detail: "Any fee increase is visible on-chain 48 hours before taking effect. Hard caps enforced in contract." },
    { icon: <Zap className="w-4 h-4 text-yellow-400" />, label: "Emergency exit always open", detail: "The vault's emergencyWithdraw() cannot be blocked by the owner. Your funds are always reachable." },
    { icon: <CheckCircle className="w-4 h-4 text-purple-400" />, label: "Hard fee caps in contract", detail: "Entry fee hard-capped at 2%. Performance fee hard-capped at 30%. Cannot be changed by governance." },
    { icon: <Activity className="w-4 h-4 text-orange-400" />, label: "On-chain transparency", detail: "All rebalances, harvests, and fee changes are emitted as events on Basescan." },
  ];

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-transparent to-blue-950/20 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16">
          <div className="flex items-center gap-2 mb-6">
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
              ● First mover — AI Agent native yield
            </Badge>
            <Badge variant="outline" className="border-white/20 text-slate-400 text-xs">
              Base mainnet · ERC-4626
            </Badge>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent leading-tight">
            AI Agent Yield Portal
          </h1>
          <p className="text-xl text-slate-300 mb-3 max-w-2xl">
            Your idle USDC earns yield autonomously. No human required. No custody.
            Auto-routed to the highest-APY protocol across Base.
          </p>
          <p className="text-sm text-slate-500 mb-8 max-w-xl">
            One API call puts your credits to work. Earn {netAPY > 0 ? `${netAPY.toFixed(2)}%` : "~4%"} net APY on idle balances.
            No wallet required. No gas. No blockchain knowledge.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6"
              onClick={() => document.getElementById('quick-start')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Sparkles className="w-4 h-4 mr-2" /> Start Earning Now
            </Button>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => document.getElementById('for-agents')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Code className="w-4 h-4 mr-2" /> Full API Docs
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Best APY (gross)", value: best ? `${best.apyPercent.toFixed(2)}%` : "—", sub: best?.protocol ?? "loading" },
            { label: "TVL", value: stats ? `$${parseFloat(stats.tvlUsdc).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : "$0.00", sub: "USDC on Base" },
            { label: "Entry Fee", value: "0.5%", sub: "one-time, on deposit" },
            { label: "Performance Fee", value: "15%", sub: "of yield earned only" },
          ].map(({ label, value, sub }) => (
            <div key={label}>
              <div className="text-xs text-slate-500 mb-1">{label}</div>
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-400">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">

        {/* ── QUICK START ─────────────────────────────────────────────────── */}
        <section id="quick-start">
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 via-black/50 to-blue-950/30 overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-emerald-500/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25">
                  <Key className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Start earning in 30 seconds</h2>
                  <p className="text-sm text-slate-400">No wallet. No gas. Just your existing CoinRailz API key.</p>
                </div>
                <Badge className="ml-auto bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                  Recommended for agents
                </Badge>
              </div>
            </div>

            {/* Two-path layout */}
            <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/10">

              {/* Left: Interactive demo */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400">1</div>
                  <span className="text-sm font-medium text-white">Try it live — paste your API key</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Your CoinRailz API key</label>
                    <Input
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder="cr_live_..."
                      className="bg-black/40 border-white/15 text-white font-mono text-xs h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Amount to deposit (USD)</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={depositInput}
                        onChange={e => setDepositInput(e.target.value)}
                        className="bg-black/40 border-white/15 text-white h-9 w-28"
                        min="1"
                      />
                      {["10", "50", "100"].map(v => (
                        <button key={v} onClick={() => setDepositInput(v)}
                          className={`px-3 py-1 rounded text-xs border transition-all ${depositInput === v ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-white/10 text-slate-400 hover:border-white/25"}`}>
                          ${v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {netAPY > 0 && parseFloat(depositInput) > 0 && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
                      ${(parseFloat(depositInput) * 0.995).toFixed(2)} earns yield ·{" "}
                      <strong>+${(parseFloat(depositInput) * 0.995 * netAPY / 100).toFixed(2)}/year</strong> at {netAPY.toFixed(2)}% net APY
                    </div>
                  )}

                  <Button
                    onClick={handleLiveDeposit}
                    disabled={isDepositing}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold h-10"
                  >
                    {isDepositing ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Depositing…</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Deposit ${depositInput || "0"} & Start Earning</>
                    )}
                  </Button>

                  {depositError && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {depositError}
                    </div>
                  )}

                  {depositResult && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-xs space-y-1">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                        <CheckCircle className="w-4 h-4" /> Earning yield now!
                      </div>
                      <div className="text-slate-300">{depositResult.message}</div>
                      <div className="pt-2 text-slate-400 font-mono">
                        <span className="text-slate-500">Protocol: </span>{depositResult.protocol}<br />
                        <span className="text-slate-500">Net APY: </span>{depositResult.netAPY?.toFixed(2)}%<br />
                        <span className="text-slate-500">Check position: </span>GET /api/yield/my-position
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: What happens + steps */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-400">?</div>
                  <span className="text-sm font-medium text-white">How does this work?</span>
                </div>

                <div className="space-y-4 text-sm">
                  {[
                    { icon: "💰", title: "Credits → Vault", desc: "Your CoinRailz credits are deducted and the equivalent USDC is deployed into the highest-APY protocol on Base." },
                    { icon: "📈", title: "Yield accrues daily", desc: "The vault rebalances every 24h. Your position value grows automatically. No action needed from you." },
                    { icon: "🏦", title: "Withdraw anytime", desc: "POST /api/yield/withdraw returns your credits + earned yield (minus 15% performance fee on profit)." },
                    { icon: "🔒", title: "What's the custody model?", desc: "Your yield account is server-tracked, backed by the platform's on-chain ERC-4626 vault position. The vault itself is non-custodial on Base." },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <span className="text-lg shrink-0 mt-0.5">{icon}</span>
                      <div>
                        <div className="font-medium text-white text-sm">{title}</div>
                        <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs text-slate-500 mb-2">Don't have an API key?</div>
                  <a href="/api/credits/free-trial" target="_blank">
                    <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 text-xs h-8">
                      Get free $5 trial key <ExternalLink className="w-3 h-3 ml-1.5" />
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            {/* Yield calculator */}
            <div className="px-6 pb-6">
              <YieldCalculator netAPY={netAPY} />
            </div>
          </div>
        </section>

        {/* Live Protocol Rates */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Live Yield Rates</h2>
              <p className="text-sm text-slate-400 mt-1">Auto-routing selects the best daily. All on Base mainnet.</p>
            </div>
            {ratesLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching live rates…
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live · updates every 60s
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rates ? (
              <>
                <ProtocolCard name="Aave v3"     apy={rates.aave.apyPercent}     isBest={best?.protocol === "Aave v3"}     status={rates.aave.status} />
                <ProtocolCard name="Compound v3" apy={rates.compound.apyPercent} isBest={best?.protocol === "Compound v3"} status={rates.compound.status} />
                <ProtocolCard name="Morpho Blue" apy={rates.morpho.apyPercent}   isBest={best?.protocol === "Morpho Blue"} status={rates.morpho.status} />
              </>
            ) : (
              [1, 2, 3].map(i => <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-5 animate-pulse h-40" />)
            )}
          </div>

          <div className="mt-4 rounded-lg bg-blue-500/5 border border-blue-500/20 p-4 flex gap-3">
            <RefreshCw className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-blue-300">Auto-routing runs every 24 hours</div>
              <div className="text-xs text-slate-400 mt-1">
                The vault checks all three protocols daily. If a better yield exists (≥0.5% improvement), it moves all funds automatically.
                Anyone can trigger an early rebalance by calling <code className="bg-white/10 px-1 rounded text-xs">rebalance()</code> on-chain.
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Deposit USDC (or credits)", desc: "API key agents: POST /api/yield/deposit. Wallet agents: Approve + deposit via ERC-4626. 0.5% entry fee either way.", color: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/30" },
              { step: "2", title: "Earn Yield Autonomously", desc: "Vault routes to highest APY across Aave v3, Compound v3, and Morpho Blue on Base. Rebalances daily — no action required.", color: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30" },
              { step: "3", title: "Withdraw Anytime", desc: "Redeem via API or ERC-4626 redeem(). You get principal + 85% of yield. No exit fee. No minimum holding period.", color: "from-purple-500/20 to-purple-500/5", border: "border-purple-500/30" },
            ].map(({ step, title, desc, color, border }) => (
              <div key={step} className={`rounded-xl border ${border} bg-gradient-to-br ${color} p-5`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-4 ${border} border bg-black/30`}>{step}</div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Fee Structure */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-2">Fee Structure</h2>
          <p className="text-sm text-slate-400 mb-6">All fee parameters are on-chain with a 48-hour timelock on changes.</p>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Fee Type</th>
                  <th className="text-left px-5 py-3">Amount</th>
                  <th className="text-left px-5 py-3">When Charged</th>
                  <th className="text-left px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-5 py-3 font-medium text-white">Entry fee</td><td className="px-5 py-3 text-yellow-400 font-semibold">0.5%</td><td className="px-5 py-3 text-slate-300">On every deposit</td><td className="px-5 py-3 text-slate-400">Hard-capped at 2% in contract.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-white">Performance fee</td><td className="px-5 py-3 text-yellow-400 font-semibold">15% of yield</td><td className="px-5 py-3 text-slate-300">On yield only</td><td className="px-5 py-3 text-slate-400">High-watermark. Only charged when you profit. Hard-capped at 30%.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-white">Exit fee</td><td className="px-5 py-3 text-emerald-400 font-semibold">0%</td><td className="px-5 py-3 text-slate-300">Never</td><td className="px-5 py-3 text-slate-400">No friction on withdrawals.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-white">Switch fee</td><td className="px-5 py-3 text-emerald-400 font-semibold">0%</td><td className="px-5 py-3 text-slate-300">Never</td><td className="px-5 py-3 text-slate-400">Rebalancing is free.</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-lg bg-slate-800/50 border border-white/10 p-4">
            <div className="text-xs text-slate-400">
              <strong className="text-white">Example:</strong> Deposit $10,000 USDC. Entry fee: $50. $9,950 earns 5% APY = $497.50/year.
              Coin Railz takes 15% = $74.63. <strong className="text-emerald-400">You keep $422.87/year (~4.25% net APY)</strong> — fully autonomous.
            </div>
          </div>
        </section>

        {/* For AI Agents — Full API Reference */}
        <section id="for-agents">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Code className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Full Agent API Reference</h2>
              <p className="text-sm text-slate-400">Both paths fully documented. Pick the one that suits your architecture.</p>
            </div>
          </div>

          <div className="flex gap-1 mb-4 rounded-lg bg-white/5 p-1 w-fit">
            {([["api-key", "API Key Path (easy)"], ["wallet", "Wallet Path (direct)"], ["security", "Security"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAgentTab(key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${agentTab === key ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {agentTab === "api-key" && (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-300 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><strong>No wallet required.</strong> Uses your existing CoinRailz API key and credit balance. Platform manages the on-chain vault interaction for you.</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">bash — complete flow</span>
                  <CopyButton text={curlSnippet} />
                </div>
                <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">{curlSnippet}</pre>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  { method: "POST", path: "/api/yield/deposit", auth: "X-API-KEY", body: '{"amount": 50}', desc: "Deduct credits, record position. Returns confirmation + APY." },
                  { method: "GET",  path: "/api/yield/my-position", auth: "X-API-KEY", body: "—", desc: "Live position: current value, yield earned, net withdrawable." },
                  { method: "POST", path: "/api/yield/withdraw", auth: "X-API-KEY", body: '{"amount": 50}', desc: "Partial or full withdrawal. Credits restored + yield." },
                  { method: "GET",  path: "/api/yield/rates", auth: "none", body: "—", desc: "Live APY from all three protocols. No auth required." },
                ].map(({ method, path, auth, body, desc }) => (
                  <div key={path} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-[10px] ${method === "GET" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"}`}>{method}</Badge>
                      <code className="text-white text-xs">{path}</code>
                    </div>
                    <div className="text-slate-500 mb-1">Auth: <span className="text-slate-400">{auth}</span> · Body: <span className="font-mono text-slate-400">{body}</span></div>
                    <div className="text-slate-400">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agentTab === "wallet" && (
            <div className="space-y-3">
              <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-4 py-3 text-xs text-blue-300 flex items-start gap-2">
                <Wallet className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><strong>Direct on-chain ownership.</strong> Your wallet holds crUSDC shares directly. No platform intermediary. Standard ERC-4626 compatible with any wallet or protocol.</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">typescript · viem / ethers / wagmi</span>
                  <CopyButton text={viemSnippet} />
                </div>
                <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">{viemSnippet}</pre>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400 space-y-2">
                <div><strong className="text-white">Pre-built calldata API:</strong> Don't want to encode transactions yourself?</div>
                <code className="block bg-black/30 rounded px-3 py-2 font-mono text-slate-300">
                  GET /api/yield/deposit-tx?amount=100&recipient=0xYOUR_WALLET
                </code>
                <div>Returns two ready-to-broadcast transactions (approve + deposit). Just sign and send.</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-medium text-white mb-1">Vault contract</div>
                  {VAULT_ADDR ? (
                    <a href={`https://basescan.org/address/${VAULT_ADDR}`} target="_blank" className="text-blue-400 hover:underline font-mono break-all">
                      {VAULT_ADDR}
                    </a>
                  ) : (
                    <span className="text-slate-500">Contract address at /api/yield/contract</span>
                  )}
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-medium text-white mb-1">USDC on Base</div>
                  <code className="text-slate-400 text-xs break-all">0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code>
                </div>
              </div>
            </div>
          )}

          {agentTab === "security" && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              {securityPoints.map(({ icon, label, detail }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{icon}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{detail}</div>
                  </div>
                </div>
              ))}
              <Separator className="bg-white/10 my-2" />
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-yellow-300">API-key yield accounts</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    API-key deposits are tracked server-side and backed by the platform's on-chain vault position. This is a custodial arrangement — your credits are at platform risk. Wallet-path deposits are fully non-custodial.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-orange-300">Audit status</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    External audit pending. Contract source published on Basescan. All protocol interactions use Aave v3, Compound v3, and Morpho — individually audited protocols with billions in TVL.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            <p className="text-xs text-slate-400">
              Machine-readable manifest at{" "}
              <a href="/api/yield/manifest" target="_blank" className="text-blue-400 hover:underline font-mono">/api/yield/manifest</a>
              {" "}· Discoverable via{" "}
              <a href="/.well-known/x402.json" target="_blank" className="text-blue-400 hover:underline font-mono">/.well-known/x402.json</a>
            </p>
          </div>
        </section>

        {/* Vault Details */}
        {vault && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Vault Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Network", value: "Base" },
                { label: "Standard", value: vault.standard },
                { label: "Asset", value: vault.asset },
                { label: "Share Token", value: vault.shareToken },
                { label: "Contract", value: vault.address !== 'deploying-soon' ? `${vault.address.slice(0, 6)}…${vault.address.slice(-4)}` : "Deploying" },
                { label: "Price per Share", value: stats ? `${parseFloat(stats.pricePerShare).toFixed(6)} USDC` : "1.000000 USDC" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className="text-sm font-medium text-white font-mono">{value}</div>
                </div>
              ))}
            </div>
            {vault.address !== 'deploying-soon' && (
              <a href={`https://basescan.org/address/${vault.address}`} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
                View on Basescan <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </section>
        )}

        {/* CTA */}
        <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-transparent p-8 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <h2 className="text-2xl font-bold text-white mb-2">Put your idle credits to work</h2>
          <p className="text-slate-400 text-sm mb-2 max-w-md mx-auto">
            Every credit balance sitting idle is earning 0%. One API call changes that.
          </p>
          <p className="text-slate-500 text-xs mb-6 max-w-sm mx-auto">
            {netAPY > 0 ? `At ${netAPY.toFixed(2)}% net APY, $1,000 idle earns $${(1000 * netAPY / 100).toFixed(0)}/year.` : ""}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8"
              onClick={() => document.getElementById('quick-start')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Sparkles className="w-4 h-4 mr-2" /> Start Earning
            </Button>
            <a href="/api/yield/manifest" target="_blank">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Machine-readable JSON
              </Button>
            </a>
          </div>
        </section>

      </div>

      <div className="border-t border-white/5 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-slate-600">
          <span>Coin Railz Yield Portal — USDC yield on Base</span>
          <span>APYs are variable. DeFi carries smart contract risk. API-key deposits are custodial.</span>
        </div>
      </div>
    </div>
  );
}
