import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, Shield, Zap, RefreshCw, Code, Copy, CheckCircle,
  ExternalLink, AlertCircle, ChevronRight, Activity, Lock, DollarSign
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProtocolRate {
  protocol: string;
  network: string;
  apyPercent: number;
  status: string;
}

interface RatesResponse {
  success: boolean;
  timestamp: string;
  rates: { aave: ProtocolRate; compound: ProtocolRate; morpho: ProtocolRate };
  currentBest: { protocol: string; apyPercent: number };
  netAPY: { description: string; exampleAt5Pct: string };
  fees: { entryFeePct: number; performanceFeePct: number; exitFeePct: number; switchFeePct: number };
}

interface StatsResponse {
  success: boolean;
  vault: { address: string; network: string; asset: string; standard: string; shareToken: string };
  stats: { tvlUsdc: string; pricePerShare: string; pendingFeesUsdc: string; nextRebalanceInSec: number };
  routing: { currentProtocol: string; currentAPY: number; rebalanceInterval: string; protocols: string[] };
  fees: { entryFeePct: number; performanceFeePct: number; minHarvestUsd: number; feeTimelockHours: number };
  security: { nonCustodial: boolean; adminCanWithdrawPrincipal: boolean; emergencyExitAlways: boolean; feeChangeTimelock: string; auditStatus: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function apyColor(apy: number): string {
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

// ── Protocol Card ─────────────────────────────────────────────────────────────

function ProtocolCard({
  name, apy, isBest, status
}: { name: string; apy: number; isBest: boolean; status: string }) {
  const logos: Record<string, string> = {
    "Aave v3":     "🔷",
    "Compound v3": "🔵",
    "Morpho Blue": "🟣",
  };

  return (
    <div className={`relative rounded-xl border p-5 transition-all ${
      isBest
        ? "border-emerald-500/60 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
        : "border-white/10 bg-white/5 hover:border-white/20"
    }`}>
      {isBest && (
        <div className="absolute -top-3 left-4">
          <Badge className="bg-emerald-500 text-black text-xs font-bold px-2 py-0.5">
            ⚡ AUTO-SELECTED
          </Badge>
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
  const [agentTab, setAgentTab] = useState<"api" | "contract" | "security">("api");

  const { data: ratesData, isLoading: ratesLoading } = useQuery<RatesResponse>({
    queryKey: ["/api/yield/rates"],
    refetchInterval: 60_000,
  });

  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ["/api/yield/stats"],
    refetchInterval: 120_000,
  });

  const rates = ratesData?.rates;
  const best  = ratesData?.currentBest;
  const stats = statsData?.stats;
  const vault = statsData?.vault;
  const isLive = vault?.address && vault.address !== 'deploying-soon';

  const apiSnippet = `# Check live APYs
curl https://coinrailz.com/api/yield/rates

# Your position  
curl https://coinrailz.com/api/yield/position/YOUR_WALLET

# Vault stats + contract address
curl https://coinrailz.com/api/yield/contract`;

  const viemSnippet = `import { createWalletClient, parseUnits } from 'viem';

const VAULT = '${isLive ? vault!.address : "0x_VAULT_ADDRESS_AFTER_DEPLOY"}';
const USDC  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Step 1: Approve vault to spend USDC
await walletClient.writeContract({
  address: USDC,
  abi: [{ name:'approve', type:'function',
    inputs:[{type:'address'},{type:'uint256'}],
    outputs:[{type:'bool'}] }],
  functionName: 'approve',
  args: [VAULT, parseUnits('100', 6)], // $100 USDC
});

// Step 2: Deposit — receive crUSDC shares
await walletClient.writeContract({
  address: VAULT,
  abi: [{ name:'deposit', type:'function',
    inputs:[{type:'uint256'},{type:'address'}],
    outputs:[{type:'uint256'}] }],
  functionName: 'deposit',
  args: [parseUnits('100', 6), walletAddress],
});`;

  const securityPoints = [
    { icon: <Shield className="w-4 h-4 text-emerald-400" />, label: "Non-custodial", detail: "Admin cannot withdraw depositor principal. Ever." },
    { icon: <Lock className="w-4 h-4 text-blue-400" />, label: "48h fee timelock", detail: "Fee changes are visible on-chain 48 hours before taking effect." },
    { icon: <Zap className="w-4 h-4 text-yellow-400" />, label: "Emergency exit always open", detail: "emergencyWithdraw() works regardless of vault state." },
    { icon: <CheckCircle className="w-4 h-4 text-purple-400" />, label: "Hard fee caps", detail: "Entry fee hard-capped at 2%. Performance fee hard-capped at 30%." },
    { icon: <Activity className="w-4 h-4 text-orange-400" />, label: "On-chain transparency", detail: "All rebalances, harvests, and fee changes emitted as events on Basescan." },
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
            Built for AI agents with wallets. Deposit once, earn continuously.
            Coin Railz takes 15% of yield as a fee — your vault, your keys.
          </p>

          <div className="flex flex-wrap gap-3">
            {isLive ? (
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6">
                Connect Wallet & Deposit <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold px-6 cursor-default" disabled>
                Deploying to Base Sepolia… <Activity className="w-4 h-4 ml-1 animate-pulse" />
              </Button>
            )}
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => document.getElementById('for-agents')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Code className="w-4 h-4 mr-2" /> For AI Agents
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
              [1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-5 animate-pulse h-40" />
              ))
            )}
          </div>

          {/* Routing explanation */}
          <div className="mt-4 rounded-lg bg-blue-500/5 border border-blue-500/20 p-4 flex gap-3">
            <RefreshCw className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-blue-300">Auto-routing runs every 24 hours</div>
              <div className="text-xs text-slate-400 mt-1">
                The vault checks all three protocols daily. If a better yield exists (≥0.5% improvement),
                it moves all funds automatically. You do nothing — the vault rebalances itself.
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
              {
                step: "1",
                title: "Deposit USDC",
                desc: "Send USDC to the vault on Base. 0.5% entry fee is taken immediately. You receive crUSDC shares representing your position.",
                color: "from-blue-500/20 to-blue-500/5",
                border: "border-blue-500/30",
              },
              {
                step: "2",
                title: "Earn Yield Autonomously",
                desc: "The vault deposits your USDC to whichever protocol (Aave, Compound, Morpho) has the highest APY. Rebalances daily — no action required.",
                color: "from-emerald-500/20 to-emerald-500/5",
                border: "border-emerald-500/30",
              },
              {
                step: "3",
                title: "Withdraw Anytime",
                desc: "Redeem your crUSDC shares for USDC at any time. 15% of your earned yield goes to Coin Railz. No exit fee. No lock-up.",
                color: "from-purple-500/20 to-purple-500/5",
                border: "border-purple-500/30",
              },
            ].map(({ step, title, desc, color, border }) => (
              <div key={step} className={`rounded-xl border ${border} bg-gradient-to-br ${color} p-5`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-4 ${border} border bg-black/30`}>
                  {step}
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Fee Breakdown */}
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
                <tr>
                  <td className="px-5 py-3 font-medium text-white">Entry fee</td>
                  <td className="px-5 py-3 text-yellow-400 font-semibold">0.5%</td>
                  <td className="px-5 py-3 text-slate-300">On every deposit</td>
                  <td className="px-5 py-3 text-slate-400">Sent to Coin Railz immediately. Hard-capped at 2%.</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-medium text-white">Performance fee</td>
                  <td className="px-5 py-3 text-yellow-400 font-semibold">15% of yield</td>
                  <td className="px-5 py-3 text-slate-300">Accrued on yield only</td>
                  <td className="px-5 py-3 text-slate-400">High-watermark. Harvested when accumulated fees exceed $5. Hard-capped at 30%.</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-medium text-white">Exit fee</td>
                  <td className="px-5 py-3 text-emerald-400 font-semibold">0%</td>
                  <td className="px-5 py-3 text-slate-300">Never</td>
                  <td className="px-5 py-3 text-slate-400">No friction on withdrawals.</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-medium text-white">Switch fee</td>
                  <td className="px-5 py-3 text-emerald-400 font-semibold">0%</td>
                  <td className="px-5 py-3 text-slate-300">Never</td>
                  <td className="px-5 py-3 text-slate-400">Rebalancing is automatic. Agents never pay to switch protocols.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-lg bg-slate-800/50 border border-white/10 p-4">
            <div className="text-xs text-slate-400">
              <strong className="text-white">Example:</strong> You deposit $10,000 USDC. Entry fee: $50 (0.5%). $9,950 earns 5% APY = $497.50/year.
              Coin Railz takes 15% = $74.63/year. <strong className="text-emerald-400">You keep $422.87/year (~4.25% net APY)</strong> — fully autonomous.
            </div>
          </div>
        </section>

        {/* For AI Agents */}
        <section id="for-agents">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Code className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">For AI Agents</h2>
              <p className="text-sm text-slate-400">Interact directly via API or ERC-4626 contract. No human in the loop.</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 rounded-lg bg-white/5 p-1 w-fit">
            {([["api", "REST API"], ["contract", "Contract (viem)"], ["security", "Security"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAgentTab(key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  agentTab === key ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {agentTab === "api" && (
            <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                <span className="text-xs text-slate-400 font-mono">bash</span>
                <CopyButton text={apiSnippet} />
              </div>
              <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">
                {apiSnippet}
              </pre>
            </div>
          )}

          {agentTab === "contract" && (
            <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                <span className="text-xs text-slate-400 font-mono">typescript · viem</span>
                <CopyButton text={viemSnippet} />
              </div>
              <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">
                {viemSnippet}
              </pre>
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
                  <div className="text-sm font-medium text-yellow-300">Audit status</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    External audit pending. Contract source code published on Basescan at deployment.
                    All protocol interactions use Aave v3, Compound v3, and Morpho — individually audited protocols with billions in TVL.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Machine-readable JSON notice */}
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            <p className="text-xs text-slate-400">
              Machine-readable manifest available at{" "}
              <a href="/api/yield/manifest" target="_blank" className="text-blue-400 hover:underline font-mono">
                /api/yield/manifest
              </a>
              {" "}· Discoverable via{" "}
              <a href="/.well-known/x402.json" target="_blank" className="text-blue-400 hover:underline font-mono">
                /.well-known/x402.json
              </a>
            </p>
          </div>
        </section>

        {/* Vault Info */}
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
              <a
                href={`https://basescan.org/address/${vault.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline"
              >
                View on Basescan <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </section>
        )}

        {/* CTA */}
        <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-transparent p-8 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <h2 className="text-2xl font-bold text-white mb-2">Ready to earn yield autonomously?</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            Your USDC works for you 24/7 with no human in the loop.
            The first yield portal built specifically for AI agents.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {isLive ? (
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8">
                Deposit USDC Now
              </Button>
            ) : (
              <Button className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold px-8" disabled>
                Contract Deploying — Check Back Soon
              </Button>
            )}
            <a href="/api/yield/manifest" target="_blank">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Machine-readable JSON
              </Button>
            </a>
          </div>
        </section>

      </div>

      {/* Footer note */}
      <div className="border-t border-white/5 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-slate-600">
          <span>Coin Railz Yield Portal — Non-custodial USDC yield on Base</span>
          <span>APYs are variable and not guaranteed. DeFi carries smart contract risk.</span>
        </div>
      </div>
    </div>
  );
}
