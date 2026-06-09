import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Zap, RefreshCw, Code, Copy, CheckCircle,
  ExternalLink, AlertCircle, Activity, Lock, BarChart3,
  ArrowRight, ChevronRight, TrendingUp
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RatesResponse {
  success: boolean;
  rates: { aave: { apyPercent: number; status: string }; compound: { apyPercent: number; status: string }; morpho: { apyPercent: number; status: string } };
  currentBest: { protocol: string; apyPercent: number };
  netAPY: { currentNetApyPercent: number };
}
interface StatsResponse {
  success: boolean;
  vault: { address: string; network: string; shareToken: string };
  stats: { tvlUsdc: string; pricePerShare: string };
  routing: { currentProtocol: string; currentAPY: number };
}
interface PresetsResponse {
  success: boolean;
  presets: { amount_usd: number; entry_fee_usd: number; net_deposited_usd: number; est_net_yield_yr: number; est_net_yield_mo: number }[];
  net_apy_pct: number;
  fee_structure: { entry: string; performance: string; exit: string };
}
interface DepositTxResponse {
  success: boolean;
  amount_usd?: number;
  steps?: { step: number; action: string; to: string; data: string; value: string; gas: string; note: string }[];
  fee_breakdown?: { entry_fee_usd: number; net_deposited_usd: number; est_net_yield_yr: number; gas_estimate: string };
  error?: string;
  presets?: number[];
}
interface PositionResponse {
  success: boolean;
  position: { sharesHeld: string; currentValueUsdc: string; netYieldUsdc: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRESETS = [10, 50, 100, 250, 1000];
const VAULT   = '0x86e2508ca0de34530dc847645f60f0d46d95176a';
const USDC    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const NET_APY = 4.22;

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all">
      {ok ? <><CheckCircle className="w-3 h-3 text-green-400" />{label ? " Copied" : ""}</> : <><Copy className="w-3 h-3" />{label ? ` ${label}` : ""}</>}
    </button>
  );
}

// ── Deposit Widget ─────────────────────────────────────────────────────────────

function DepositWidget({ presets }: { presets: PresetsResponse['presets'] }) {
  const [selected, setSelected]   = useState<number | null>(null);
  const [custom, setCustom]       = useState("");
  const [wallet, setWallet]       = useState("");
  const [isCustom, setIsCustom]   = useState(false);
  const [txResult, setTxResult]   = useState<DepositTxResponse | null>(null);
  const [loading, setLoading]     = useState(false);

  const amount     = isCustom ? parseFloat(custom) || 0 : (selected ?? 0);
  const isValidWallet = /^0x[0-9a-fA-F]{40}$/.test(wallet);
  const presetInfo = presets.find(p => p.amount_usd === selected);

  // Auto-fetch when preset + wallet are both ready
  useEffect(() => {
    if (!isCustom && selected && isValidWallet) {
      fetchTx(selected, wallet);
    } else {
      setTxResult(null);
    }
  }, [selected, wallet, isCustom]);

  async function fetchTx(amt: number, recipient: string) {
    setLoading(true);
    setTxResult(null);
    try {
      const r = await fetch(`/api/yield/deposit-tx?preset=${amt}&recipient=${recipient}`);
      setTxResult(await r.json());
    } catch {
      setTxResult({ success: false, error: 'Network error. Try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomTx() {
    if (!isValidWallet || amount < 10) return;
    await fetchTx(amount, wallet);
  }

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/30 to-black/40 p-6">
      {/* Amount presets */}
      <div className="mb-5">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-3 font-medium">Select amount</div>
        <div className="grid grid-cols-5 gap-2 mb-2">
          {PRESETS.map(p => (
            <button key={p}
              onClick={() => { setSelected(p); setIsCustom(false); setTxResult(null); }}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                !isCustom && selected === p
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 scale-105'
                  : 'bg-white/5 text-white border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/10'
              }`}>
              ${p < 1000 ? p : '1k'}
            </button>
          ))}
        </div>
        <button onClick={() => { setIsCustom(true); setSelected(null); setTxResult(null); }}
          className={`w-full py-2 rounded-xl text-sm transition-all border ${
            isCustom ? 'border-emerald-500/40 bg-emerald-500/10 text-white' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
          }`}>
          {isCustom ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-slate-400">$</span>
              <input autoFocus type="number" value={custom} onChange={e => setCustom(e.target.value)}
                placeholder="Enter amount (min $10)"
                className="bg-transparent text-center text-white outline-none w-40 placeholder:text-slate-600"
                min="10" max="50000" />
            </div>
          ) : "Custom amount"}
        </button>
      </div>

      {/* Wallet */}
      <div className="mb-4">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">Your Base wallet address</div>
        <Input value={wallet} onChange={e => { setWallet(e.target.value); setTxResult(null); }}
          placeholder="0x..."
          className={`bg-black/30 border font-mono text-sm h-10 text-white placeholder:text-slate-600 ${
            wallet && !isValidWallet ? 'border-red-500/40' : 'border-white/15 focus:border-emerald-500/40'
          }`} />
        {wallet && !isValidWallet && <p className="text-xs text-red-400 mt-1">Must be a valid 0x Base wallet address</p>}
      </div>

      {/* Fee preview — shown when amount is selected */}
      {amount > 0 && (
        <div className="mb-4 rounded-xl bg-black/30 border border-white/8 p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Deposit amount</span>
            <span className="text-white font-medium">${amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Entry fee (0.5%)</span>
            <span className="text-yellow-400">−${(amount * 0.005).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs border-t border-white/8 pt-1.5">
            <span className="text-slate-400">Earning yield on</span>
            <span className="text-white font-medium">${(amount * 0.995).toLocaleString()}</span>
          </div>
          {presetInfo && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Est. net yield / year</span>
                <span className="text-emerald-400 font-semibold">+${presetInfo.est_net_yield_yr.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Est. net yield / month</span>
                <span className="text-emerald-300">+${presetInfo.est_net_yield_mo.toFixed(3)}</span>
              </div>
            </>
          )}
          {!presetInfo && amount >= 10 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Est. net yield / year</span>
              <span className="text-emerald-400 font-semibold">+${(amount * 0.995 * NET_APY / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Est. gas</span>
            <span className="text-slate-400">≈ $0.01 on Base</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Performance fee</span>
            <span className="text-slate-400">15% of yield only · never on principal</span>
          </div>
        </div>
      )}

      {/* Custom amount submit */}
      {isCustom && (
        <Button onClick={fetchCustomTx} disabled={loading || !isValidWallet || amount < 10}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold mb-4 h-11">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Building transactions…</> : <>Get Deposit Transactions <ArrowRight className="w-4 h-4 ml-1" /></>}
        </Button>
      )}

      {/* Auto-fetch indicator */}
      {!isCustom && selected && isValidWallet && loading && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 mb-3 justify-center">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Building transactions…
        </div>
      )}

      {/* Wallet prompt */}
      {!isCustom && selected && !wallet && (
        <div className="text-center text-xs text-slate-400 py-2">
          ↑ Enter your wallet address to get the deposit transactions
        </div>
      )}

      {/* Transactions */}
      {txResult?.success && txResult.steps && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" /> Two transactions ready. Sign and broadcast in order.
          </div>
          {txResult.steps.map(step => (
            <div key={step.step} className="rounded-xl bg-black/40 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">{step.step}</span>
                  <span className="text-xs font-medium text-white">{step.action}</span>
                </div>
                <CopyBtn text={step.data} label="data" />
              </div>
              <div className="text-xs font-mono text-slate-400 space-y-0.5">
                <div><span className="text-slate-500">to: </span>{step.to.slice(0, 8)}…{step.to.slice(-4)}</div>
                <div><span className="text-slate-500">data: </span>{step.data.slice(0, 20)}…</div>
              </div>
              <div className="text-xs text-slate-600 mt-1.5 italic">{step.note}</div>
            </div>
          ))}
          <div className="text-xs text-slate-500 text-center pt-1">
            After both confirm → <a href={`/api/yield/position/${wallet}`} target="_blank" className="text-emerald-400 hover:underline">check your position ↗</a>
          </div>
        </div>
      )}

      {txResult && !txResult.success && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
          {txResult.error}
          {txResult.presets && <div className="mt-1 text-slate-400">Available presets: ${txResult.presets.join(', $')}</div>}
        </div>
      )}
    </div>
  );
}

// ── Protocol Card ──────────────────────────────────────────────────────────────

function ProtocolCard({ name, apy, isBest, status }: { name: string; apy: number; isBest: boolean; status: string }) {
  const logo: Record<string, string> = { "Aave v3": "🔷", "Compound v3": "🔵", "Morpho Blue": "🟣" };
  return (
    <div className={`rounded-xl border p-4 ${isBest ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/8 bg-white/[0.02]'}`}>
      {isBest && <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">⚡ Auto-selected</div>}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{logo[name] ?? '🔶'}</span>
        <div>
          <div className="text-sm font-semibold text-white">{name}</div>
          <div className="text-xs text-slate-500">Base mainnet</div>
        </div>
        <Badge variant="outline" className={`ml-auto text-[10px] ${status === 'live' ? 'border-green-500/30 text-green-400' : 'border-yellow-500/30 text-yellow-400'}`}>
          {status === 'live' ? '● live' : '◌ soon'}
        </Badge>
      </div>
      <div className={`text-3xl font-bold ${isBest ? 'text-emerald-400' : 'text-slate-400'}`}>
        {apy > 0 ? `${apy.toFixed(2)}%` : '—'}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">Gross APY</div>
      {isBest && apy > 0 && (
        <div className="mt-2 pt-2 border-t border-emerald-500/15 flex justify-between text-xs">
          <span className="text-slate-400">Net to you</span>
          <span className="text-emerald-300 font-semibold">{(apy * 0.85).toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function YieldPortal() {
  const [posWallet, setPosWallet]   = useState("");
  const [posChecked, setPosChecked] = useState("");

  const { data: rates, isLoading: ratesLoading } = useQuery<RatesResponse>({
    queryKey: ['/api/yield/rates'],
    refetchInterval: 60_000,
  });
  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ['/api/yield/stats'],
    refetchInterval: 120_000,
  });
  const { data: presetsData } = useQuery<PresetsResponse>({
    queryKey: ['/api/yield/presets'],
  });
  const { data: posData, isLoading: posLoading } = useQuery<PositionResponse>({
    queryKey: ['/api/yield/position', posChecked],
    queryFn: async () => {
      if (!posChecked) return { success: false, position: null };
      return fetch(`/api/yield/position/${posChecked}`).then(r => r.json());
    },
    enabled: !!posChecked,
  });

  const netAPY   = rates?.netAPY?.currentNetApyPercent ?? 0;
  const best     = rates?.currentBest;
  const ratesObj = rates?.rates;
  const tvl      = stats?.stats?.tvlUsdc ? `$${parseFloat(stats.stats.tvlUsdc).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$2.05';

  const pos = posData?.position;

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">● ERC-4626 · Base mainnet</Badge>
            <Badge variant="outline" className="border-white/15 text-slate-400 text-xs">AI Agent native</Badge>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3 text-white">USDC Yield Vault</h1>
              <p className="text-slate-400 text-lg max-w-lg">
                Deposit USDC on Base. Earn yield. Withdraw USDC + yield any time.
                Auto-routed to the highest-APY protocol. Standard ERC-4626.
              </p>
            </div>
            {/* Live stat strip */}
            <div className="flex gap-8 shrink-0">
              {[
                { label: 'Current Net APY', value: netAPY > 0 ? `${netAPY.toFixed(2)}%` : '4.22%', hi: true },
                { label: 'TVL', value: tvl },
                { label: 'Protocol', value: best?.protocol ?? 'Morpho Blue' },
              ].map(({ label, value, hi }) => (
                <div key={label} className="text-right">
                  <div className={`text-2xl font-bold ${hi ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-14">

        {/* ── Main: deposit widget + sidebar ────────────────────────────── */}
        <section id="deposit" className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Deposit widget (3 cols) */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">Deposit Now</span>
              <span className="text-xs text-slate-500 ml-1">· Select preset → enter wallet → get 2 transactions</span>
            </div>
            <DepositWidget presets={presetsData?.presets ?? []} />
          </div>

          {/* Info sidebar (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* How it works */}
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-3">How it works</div>
              {[
                { n: '1', label: 'Pick an amount', detail: 'Click a preset or enter custom. $10 minimum.' },
                { n: '2', label: 'Enter your wallet', detail: 'Your Base wallet address. You keep full custody.' },
                { n: '3', label: 'Sign 2 transactions', detail: 'Approve USDC spend, then deposit. ~$0.01 gas.' },
                { n: '4', label: 'Earn automatically', detail: 'crUSDC shares accrue yield. Redeem any time.' },
              ].map(({ n, label, detail }) => (
                <div key={n} className="flex gap-3 mb-3 last:mb-0">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0 mt-0.5">{n}</div>
                  <div>
                    <div className="text-xs font-medium text-white">{label}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Fee structure */}
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Fee Structure</div>
              {[
                { label: 'Entry fee', value: '0.5%', note: 'One-time, on deposit' },
                { label: 'Performance fee', value: '15%', note: 'Of yield only — never on principal' },
                { label: 'Exit fee', value: '0%', note: 'Withdraw any time, no cost' },
              ].map(({ label, value, note }) => (
                <div key={label} className="flex justify-between items-start mb-2 last:mb-0">
                  <div>
                    <div className="text-xs font-medium text-white">{label}</div>
                    <div className="text-xs text-slate-500">{note}</div>
                  </div>
                  <span className={`text-sm font-bold ${value === '0%' ? 'text-emerald-400' : 'text-yellow-400'}`}>{value}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-white/8 text-xs text-slate-500">
                Fee caps hard-coded in contract bytecode: entry ≤ 2%, performance ≤ 30%.
                <strong className="text-slate-400"> Cannot be overridden.</strong>
              </div>
            </div>

            {/* Security summary */}
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Security</div>
              {[
                { icon: <Shield className="w-3 h-3 text-emerald-400" />, text: 'Admin cannot drain depositor principal' },
                { icon: <Lock className="w-3 h-3 text-blue-400" />, text: '48h timelock on any fee changes' },
                { icon: <Zap className="w-3 h-3 text-yellow-400" />, text: 'emergencyWithdraw() always available' },
                { icon: <Activity className="w-3 h-3 text-purple-400" />, text: '$10 min · $50k max per transaction' },
                { icon: <CheckCircle className="w-3 h-3 text-emerald-400" />, text: '5 rate-limit per wallet per 10 min' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 last:mb-0">
                  {icon} {text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Agent Quick Start ─────────────────────────────────────────── */}
        <section id="for-agents">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Code className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">For AI Agents</h2>
              <p className="text-sm text-slate-400">Two API calls. Two transactions. Done.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { step: '1', title: 'Discover', color: 'blue', detail: 'GET /api/yield/presets → see all amounts, APY, and fee breakdown. No auth required.' },
              { step: '2', title: 'Get Transactions', color: 'emerald', detail: 'GET /api/yield/deposit-tx?preset=100&recipient=0xYOUR_WALLET → 2 ready-to-sign transactions.' },
              { step: '3', title: 'Sign & Earn', color: 'purple', detail: 'Broadcast tx1 (approve), wait for confirm, broadcast tx2 (deposit). Position live immediately.' },
            ].map(({ step, title, color, detail }) => (
              <div key={step} className={`rounded-xl border p-4 bg-${color}-500/5 border-${color}-500/20`}>
                <div className={`text-xs font-bold text-${color}-400 uppercase tracking-wider mb-1`}>Step {step}</div>
                <div className="text-sm font-semibold text-white mb-1">{title}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{detail}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-white/[0.02]">
              <span className="text-xs text-slate-400 font-mono">python — complete agent flow</span>
              <CopyBtn text={`import requests\n\n# 1. Pick a preset and build transactions\nr = requests.get('https://coinrailz.com/api/yield/deposit-tx',\n    params={'preset': 100, 'recipient': MY_WALLET}).json()\n\n# 2. Sign and broadcast step 1 (USDC approve)\n# step 2 (ERC-4626 deposit) — broadcast after step 1 confirms\nfor step in r['steps']:\n    tx = build_and_sign_tx(step['to'], step['data'], MY_PRIVATE_KEY)\n    broadcast_and_wait(tx)\n\n# 3. Your position is now live\npos = requests.get(f'https://coinrailz.com/api/yield/position/{MY_WALLET}').json()\nprint(f"Earning: \${pos['position']['currentValueUsdc']} USDC")`} label="Copy" />
            </div>
            <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed">{`import requests

# 1. Pick a preset and build transactions (no auth, no wallet-connect)
r = requests.get('https://coinrailz.com/api/yield/deposit-tx',
    params={'preset': 100, 'recipient': MY_WALLET}).json()

# r['steps'][0] = USDC approve calldata
# r['steps'][1] = ERC-4626 deposit calldata
# r['fee_breakdown'] = { entry_fee_usd: 0.5, net_deposited_usd: 99.5, est_net_yield_yr: 4.19 }

# 2. Sign and broadcast in order (web3.py / CDP AgentKit / viem / cast — anything works)
for step in r['steps']:
    tx = {
        'to': step['to'], 'data': step['data'],
        'value': 0, 'chainId': 8453,
        'nonce': w3.eth.get_transaction_count(MY_WALLET),
        'maxFeePerGas': w3.eth.gas_price,
    }
    receipt = w3.eth.wait_for_transaction_receipt(
        w3.eth.send_raw_transaction(account.sign_transaction(tx).raw_transaction)
    )

# 3. Position is live — check any time
pos = requests.get(f'https://coinrailz.com/api/yield/position/{MY_WALLET}').json()
print(f"Deposited. Current value: ${'{'}pos['position']['currentValueUsdc']{'}'} USDC")`}
            </pre>
          </div>

          {/* API endpoint table */}
          <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 text-xs font-semibold text-white">API Reference — all public, no auth</div>
            <div className="divide-y divide-white/5">
              {[
                { method: 'GET', path: '/api/yield/presets',            desc: 'All presets with APY preview and fee breakdown for each amount.' },
                { method: 'GET', path: '/api/yield/deposit-tx',         desc: '?preset=100&recipient=0x… → 2 ready-to-sign transactions + fee breakdown.' },
                { method: 'GET', path: '/api/yield/position/{wallet}',  desc: 'Live position: shares, current USDC value, yield earned.' },
                { method: 'GET', path: '/api/yield/rates',              desc: 'Live APY from Aave v3, Compound v3, Morpho Blue. Cached 60s.' },
                { method: 'GET', path: '/api/yield/manifest',           desc: 'Machine-readable vault manifest for agent discovery.' },
                { method: 'GET', path: '/api/yield/contract',           desc: 'Full ABI (76 entries) + Basescan link.' },
              ].map(({ method, path, desc }) => (
                <div key={path} className="px-4 py-3 flex items-start gap-3">
                  <Badge className="text-[10px] shrink-0 mt-0.5 bg-blue-500/20 text-blue-300">{method}</Badge>
                  <div>
                    <code className="text-white text-xs">{path}</code>
                    <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live Rates ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Live Protocol Rates</h2>
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              {ratesLoading
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> fetching…</>
                : <><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> live · 60s</>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ratesObj ? (
              <>
                <ProtocolCard name="Aave v3"     apy={ratesObj.aave.apyPercent}     isBest={best?.protocol === 'Aave v3'}     status={ratesObj.aave.status} />
                <ProtocolCard name="Compound v3" apy={ratesObj.compound.apyPercent} isBest={best?.protocol === 'Compound v3'} status={ratesObj.compound.status} />
                <ProtocolCard name="Morpho Blue" apy={ratesObj.morpho.apyPercent}   isBest={best?.protocol === 'Morpho Blue'} status={ratesObj.morpho.status} />
              </>
            ) : [1,2,3].map(i => <div key={i} className="rounded-xl border border-white/8 bg-white/5 h-36 animate-pulse" />)}
          </div>
          <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-slate-400">
            <strong className="text-white">Auto-routing:</strong> Vault moves to highest-APY protocol when improvement exceeds 0.5% (50bps). Rebalances every 24h. Zero cost to depositors.
          </div>
        </section>

        {/* ── Position Checker ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Check Any Position</h2>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 max-w-2xl">
            <div className="flex gap-2 mb-4">
              <Input value={posWallet} onChange={e => { setPosWallet(e.target.value); if (posChecked) setPosChecked(''); }}
                onKeyDown={e => e.key === 'Enter' && posWallet.match(/^0x[0-9a-fA-F]{40}$/) && setPosChecked(posWallet)}
                placeholder="0x wallet address"
                className="bg-black/30 border-white/15 text-white font-mono text-xs h-9 flex-1" />
              <Button onClick={() => { if (posWallet.match(/^0x[0-9a-fA-F]{40}$/)) setPosChecked(posWallet); }}
                disabled={posLoading || !posWallet.match(/^0x[0-9a-fA-F]{40}$/)}
                variant="outline" className="border-white/15 text-white hover:bg-white/10 h-9 px-4 text-sm shrink-0">
                {posLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Check'}
              </Button>
            </div>

            {posChecked && pos && (
              <div className={`rounded-lg p-4 border ${parseFloat(pos.sharesHeld) > 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/8 bg-white/[0.02]'}`}>
                {parseFloat(pos.sharesHeld) > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Active position
                    </div>
                    {[
                      ['crUSDC Shares', pos.sharesHeld],
                      ['Current Value', `$${parseFloat(pos.currentValueUsdc).toFixed(4)} USDC`],
                      ['Net Yield Earned', `+$${parseFloat(pos.netYieldUsdc).toFixed(6)} USDC`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-slate-400">{k}</span>
                        <span className="text-white font-mono">{v}</span>
                      </div>
                    ))}
                    <div className="text-xs text-slate-500 pt-1">
                      To withdraw: call <code className="bg-white/10 px-1 rounded">redeem(shares, receiver, owner)</code> on the vault
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">No active position. Deposit USDC above to start earning.</div>
                )}
              </div>
            )}

            {posChecked && !posData?.success && !posLoading && (
              <div className="text-xs text-red-400">Could not fetch position. Try again.</div>
            )}
          </div>
        </section>

        {/* ── Exploit Mitigations ───────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-white mb-2">Security & Exploit Mitigations</h2>
          <p className="text-sm text-slate-400 mb-5">These protections are enforced in contract bytecode and at the API level.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: <Shield className="w-4 h-4 text-emerald-400" />,
                title: 'Principal isolation',
                body: 'Admin has zero ability to withdraw depositor funds. Vault owner can only trigger rebalances between whitelisted protocols (Aave, Compound, Morpho). Hardcoded in bytecode.',
              },
              {
                icon: <Activity className="w-4 h-4 text-blue-400" />,
                title: 'Deposit limits & rate limiting',
                body: '$10 minimum deposit prevents dust/spam attacks. $50,000 maximum per transaction prevents single-deposit share-price manipulation. API enforces 5 req/wallet/10min.',
              },
              {
                icon: <Lock className="w-4 h-4 text-purple-400" />,
                title: '48-hour fee timelock',
                body: 'Any attempt to raise fees above current levels requires a 48-hour on-chain delay. You can see it coming and exit before it takes effect. Hard caps: entry ≤ 2%, performance ≤ 30%.',
              },
              {
                icon: <Zap className="w-4 h-4 text-yellow-400" />,
                title: 'MEV / sandwich attack risk',
                body: 'Base uses a single sequencer (no competitive mempool), which eliminates most sandwich attacks. On-chain deposit() uses exact amounts — no price oracle to manipulate during the tx.',
              },
              {
                icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
                title: 'Emergency exit always works',
                body: 'emergencyWithdraw() function cannot be paused or blocked by the owner. Works regardless of vault state. Returns USDC directly from the underlying protocol.',
              },
              {
                icon: <AlertCircle className="w-4 h-4 text-orange-400" />,
                title: 'Smart contract risk (disclosed)',
                body: 'The vault contract has not yet been externally audited. Aave, Compound, and Morpho Blue (the underlying protocols) each have billions in TVL and independent audits. Deposit only what you can afford to lose.',
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  {icon}
                  <span className="text-sm font-semibold text-white">{title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Vault Details ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-5">
            {[
              ['Vault Address', `${VAULT.slice(0,8)}…${VAULT.slice(-4)}`],
              ['Network', 'Base (chainId 8453)'],
              ['Standard', 'ERC-4626 tokenized vault'],
              ['Share Token', stats?.vault?.shareToken ?? 'crUSDC'],
              ['Asset', 'USDC (USD Coin)'],
              ['Asset Address', `${USDC.slice(0,8)}…${USDC.slice(-4)}`],
              ['Min Deposit', '$10 USDC'],
              ['Max Deposit', '$50,000 USDC per tx'],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-slate-500 mb-0.5">{k}</div>
                <div className="text-white font-mono">{v}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            <a href={`https://basescan.org/address/${VAULT}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
              Basescan <ExternalLink className="w-3 h-3" />
            </a>
            <a href="/api/yield/contract" target="_blank"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
              Download ABI <ExternalLink className="w-3 h-3" />
            </a>
            <a href="/api/yield/manifest" target="_blank"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
              Agent manifest <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

      </div>

      <div className="border-t border-white/5 mt-4">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-slate-600">
          <span>CoinRailz Yield Vault · ERC-4626 · Base mainnet</span>
          <span>APYs are variable. DeFi carries smart contract risk.</span>
        </div>
      </div>
    </div>
  );
}
