import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield, Zap, RefreshCw, Code, Copy, CheckCircle,
  ExternalLink, AlertCircle, Activity, Lock, BarChart3, Wallet,
  ArrowRight
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProtocolRate {
  protocol: string; network: string; apyPercent: number; status: string;
}
interface RatesResponse {
  success: boolean;
  rates: { aave: ProtocolRate; compound: ProtocolRate; morpho: ProtocolRate };
  currentBest: { protocol: string; apyPercent: number };
  activeProtocol: string;
  netAPY: { currentNetApyPercent: number; breakdown: string };
}
interface StatsResponse {
  success: boolean;
  vault: { address: string; network: string; asset: string; standard: string; shareToken: string };
  stats: { tvlUsdc: string; pricePerShare: string; nextRebalanceInSec: number };
  routing: { currentProtocol: string; currentAPY: number };
}
interface PositionResponse {
  success: boolean;
  wallet: string;
  position: {
    sharesHeld: string;
    currentValueUsdc: string;
    estimatedYieldUsdc: string;
    netYieldUsdc: string;
  } | null;
}
interface DepositTxResponse {
  success: boolean;
  steps?: { step: number; action: string; to: string; data: string; value: string; gas: string; note: string }[];
  fees?: { entryFee: string; netDeposited: string; gas: string };
  error?: string;
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
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
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
          {status === 'live' ? '● Live' : '◌ Integrating'}
        </Badge>
      </div>
      <div className={`text-4xl font-bold mb-1 ${apyColor(apy)}`}>{apy > 0 ? `${apy.toFixed(2)}%` : "—"}</div>
      <div className="text-xs text-slate-400">Supply APY (gross)</div>
      {isBest && apy > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-500/20">
          <div className="text-xs text-emerald-400">Net to you after 15% performance fee</div>
          <div className="text-lg font-semibold text-emerald-300">{(apy * 0.85).toFixed(2)}%</div>
        </div>
      )}
    </div>
  );
}

// ── Yield Calculator ──────────────────────────────────────────────────────────

function YieldCalculator({ netAPY }: { netAPY: number }) {
  const [amount, setAmount] = useState("1000");
  const amountNum = parseFloat(amount) || 0;
  const afterFee = amountNum * 0.995;
  const periods = [{ label: "1 month", months: 1 }, { label: "3 months", months: 3 }, { label: "1 year", months: 12 }];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white">Yield Calculator</span>
        <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">{netAPY.toFixed(2)}% net APY</Badge>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-slate-400 text-sm">$</span>
        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          className="bg-white/5 border-white/10 text-white w-32 h-8 text-sm" placeholder="1000" min="1" />
        <span className="text-slate-400 text-sm">USDC deposited</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {periods.map(({ label, months }) => {
          const earned = afterFee * (Math.pow(1 + (netAPY / 100) / 12, months) - 1);
          return (
            <div key={label} className="rounded-lg bg-black/30 p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">{label}</div>
              <div className="text-lg font-bold text-emerald-400">+${earned.toFixed(2)}</div>
              <div className="text-xs text-slate-500">net yield</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-slate-500">
        0.5% entry fee: ${(amountNum * 0.005).toFixed(2)} → ${afterFee.toFixed(2)} earns yield · APY is variable
      </div>
    </div>
  );
}

// ── Deposit Transaction Widget ────────────────────────────────────────────────

function DepositTxWidget({ vaultAddress }: { vaultAddress: string | null }) {
  const [walletAddr, setWalletAddr] = useState("");
  const [amount, setAmount] = useState("100");
  const [result, setResult] = useState<DepositTxResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchTx() {
    if (!walletAddr.match(/^0x[0-9a-fA-F]{40}$/)) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/yield/deposit-tx?amount=${amount}&recipient=${walletAddr}`);
      setResult(await r.json());
    } finally {
      setLoading(false);
    }
  }

  const txJson = result?.steps ? JSON.stringify(result.steps, null, 2) : "";

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Code className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">Transaction Builder</span>
        <Badge className="ml-auto bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Pre-built calldata</Badge>
      </div>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Enter your wallet address and deposit amount — get back two ready-to-sign transactions.
        No ABI encoding, no viem setup required.
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Your wallet address (Base)</label>
          <Input value={walletAddr} onChange={e => setWalletAddr(e.target.value)}
            placeholder="0x..." className="bg-black/30 border-white/15 text-white font-mono text-xs h-9" />
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-400 mb-1 block">Amount (USDC)</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="bg-black/30 border-white/15 text-white h-9 text-sm" min="1" />
          </div>
          <Button onClick={fetchTx} disabled={loading || !walletAddr.match(/^0x[0-9a-fA-F]{40}$/) || !vaultAddress}
            className="bg-blue-600 hover:bg-blue-500 text-white h-9 px-4 text-sm">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <>Build Txs <ArrowRight className="w-3.5 h-3.5 ml-1" /></>}
          </Button>
        </div>
        {!vaultAddress && (
          <div className="text-xs text-yellow-500">Vault address not configured — check /api/yield/contract</div>
        )}
      </div>

      {result?.success && result.steps && (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" /> Two transactions ready. Sign and broadcast in order.
          </div>
          {result.steps.map(step => (
            <div key={step.step} className="rounded-lg bg-black/30 border border-white/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-400">{step.step}</span>
                <span className="text-xs font-medium text-white">{step.action}</span>
              </div>
              <div className="text-xs text-slate-400 font-mono space-y-1">
                <div><span className="text-slate-500">to: </span><span className="text-slate-300">{step.to}</span></div>
                <div className="flex items-start gap-1">
                  <span className="text-slate-500 shrink-0">data: </span>
                  <span className="text-slate-300 break-all">{step.data.slice(0, 42)}…</span>
                  <CopyButton text={step.data} />
                </div>
                <div><span className="text-slate-500">gas: </span><span className="text-slate-300">{step.gas}</span></div>
              </div>
              <div className="text-xs text-slate-500 mt-2 italic">{step.note}</div>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs text-slate-400 bg-black/20 rounded-lg px-3 py-2">
            <span>Entry fee: {result.fees?.entryFee} · Earning: {result.fees?.netDeposited} · Gas: {result.fees?.gas}</span>
            <CopyButton text={txJson} />
          </div>
        </div>
      )}

      {result && !result.success && (
        <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {result.error}
        </div>
      )}
    </div>
  );
}

// ── Position Checker ──────────────────────────────────────────────────────────

function PositionChecker() {
  const [wallet, setWallet] = useState("");
  const [checked, setChecked] = useState("");

  const { data, isLoading } = useQuery<PositionResponse>({
    queryKey: ["/api/yield/position", checked],
    queryFn: async () => {
      if (!checked) return { success: false, wallet: "", position: null };
      const r = await fetch(`/api/yield/position/${checked}`);
      return r.json();
    },
    enabled: !!checked,
  });

  function check() {
    if (wallet.match(/^0x[0-9a-fA-F]{40}$/)) setChecked(wallet);
  }

  const pos = data?.position;
  const hasShares = pos && parseFloat(pos.sharesHeld) > 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-white">Check Position</span>
      </div>
      <p className="text-xs text-slate-400 mb-3">Enter any wallet address to see its current vault position and accrued yield.</p>
      <div className="flex gap-2">
        <Input value={wallet} onChange={e => setWallet(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="0x wallet address" className="bg-black/30 border-white/15 text-white font-mono text-xs h-9 flex-1" />
        <Button onClick={check} disabled={isLoading || !wallet.match(/^0x[0-9a-fA-F]{40}$/)}
          variant="outline" className="border-white/20 text-white hover:bg-white/10 h-9 px-4 text-sm">
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Check"}
        </Button>
      </div>

      {pos && (
        <div className={`mt-4 rounded-lg p-4 border ${hasShares ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]"}`}>
          {hasShares ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-3">
                <CheckCircle className="w-3.5 h-3.5" /> Active position found
              </div>
              {[
                ["crUSDC Shares", pos.sharesHeld],
                ["Current Value", `$${parseFloat(pos.currentValueUsdc).toFixed(4)} USDC`],
                ["Gross Yield", `+$${parseFloat(pos.estimatedYieldUsdc).toFixed(6)} USDC`],
                ["Net Yield (after 15% fee)", `+$${parseFloat(pos.netYieldUsdc).toFixed(6)} USDC`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-mono">{value}</span>
                </div>
              ))}
              <div className="pt-2 mt-1 border-t border-white/10 text-xs text-slate-500">
                Withdraw: call <code className="bg-white/10 px-1 rounded">redeem(shares, receiver, owner)</code> on the vault contract
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">No active position for this wallet. Deposit USDC to start earning.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function YieldPortal() {
  const [codeTab, setCodeTab] = useState<"python" | "js" | "curl">("curl");

  const { data: ratesData, isLoading: ratesLoading } = useQuery<RatesResponse>({
    queryKey: ["/api/yield/rates"],
    refetchInterval: 60_000,
  });
  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ["/api/yield/stats"],
    refetchInterval: 120_000,
  });

  const rates  = ratesData?.rates;
  const best   = ratesData?.currentBest;
  const netAPY = ratesData?.netAPY?.currentNetApyPercent ?? 0;
  const stats  = statsData?.stats;
  const vault  = statsData?.vault;
  const isLive = vault?.address && vault.address !== 'deploying-soon';
  const VAULT  = isLive ? vault!.address : null;
  const USDC   = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  const curlFlow = `# 1. Discover the vault (rates, contract address, etc.)
curl https://coinrailz.com/api/yield/manifest

# 2. Get pre-built deposit transactions — just sign & broadcast
curl "https://coinrailz.com/api/yield/deposit-tx?amount=500&recipient=0xYOUR_WALLET"
# Returns: step 1 (USDC approve calldata) + step 2 (ERC-4626 deposit calldata)

# 3. Broadcast both transactions with your preferred client
# (cast, ethers.js, viem, web3.py, CDP SDK — anything works)
cast send ${USDC} --rpc-url https://mainnet.base.org --private-key $KEY \\
  "$(curl ... | jq -r '.steps[0].data')"
cast send ${VAULT ?? "0xVAULT"} --rpc-url https://mainnet.base.org --private-key $KEY \\
  "$(curl ... | jq -r '.steps[1].data')"

# 4. Check your position any time
curl https://coinrailz.com/api/yield/position/0xYOUR_WALLET

# 5. Withdraw: call redeem(shares, receiver, owner) on the vault directly`;

  const pythonFlow = `import requests
from web3 import Web3

# 1. Get pre-built transactions
resp = requests.get(
    "https://coinrailz.com/api/yield/deposit-tx",
    params={"amount": 500, "recipient": MY_WALLET}
).json()

w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
account = w3.eth.account.from_key(PRIVATE_KEY)

# 2. Sign and broadcast step 1 (USDC approve)
step1 = resp["steps"][0]
tx1 = {
    "to": step1["to"], "data": step1["data"],
    "value": 0, "gas": 70000,
    "nonce": w3.eth.get_transaction_count(MY_WALLET),
    "chainId": 8453,
    "maxFeePerGas": w3.eth.gas_price,
    "maxPriorityFeePerGas": w3.to_wei("0.001", "gwei"),
}
signed1 = account.sign_transaction(tx1)
w3.eth.wait_for_transaction_receipt(w3.eth.send_raw_transaction(signed1.raw_transaction))

# 3. Sign and broadcast step 2 (ERC-4626 deposit → receive crUSDC shares)
step2 = resp["steps"][1]
tx2 = {**tx1, "to": step2["to"], "data": step2["data"], "gas": 200000,
       "nonce": w3.eth.get_transaction_count(MY_WALLET)}
signed2 = account.sign_transaction(tx2)
w3.eth.wait_for_transaction_receipt(w3.eth.send_raw_transaction(signed2.raw_transaction))

# 4. Check position
position = requests.get(f"https://coinrailz.com/api/yield/position/{MY_WALLET}").json()
print(f"Current value: \${position['position']['currentValueUsdc']} USDC")`;

  const jsFlow = `import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(PRIVATE_KEY);
const wallet  = createWalletClient({ account, chain: base, transport: http() });
const client  = createPublicClient({ chain: base, transport: http() });

// 1. Fetch pre-built transactions — no manual ABI encoding
const { steps } = await fetch(
  \`https://coinrailz.com/api/yield/deposit-tx?amount=500&recipient=\${account.address}\`
).then(r => r.json());

// 2. Broadcast step 1: USDC approve
await client.waitForTransactionReceipt({
  hash: await wallet.sendTransaction({
    to: steps[0].to, data: steps[0].data, value: 0n,
  }),
});

// 3. Broadcast step 2: ERC-4626 deposit → crUSDC shares
const depositHash = await wallet.sendTransaction({
  to: steps[1].to, data: steps[1].data, value: 0n,
});
await client.waitForTransactionReceipt({ hash: depositHash });

// 4. Position now live — check any time
const { position } = await fetch(
  \`https://coinrailz.com/api/yield/position/\${account.address}\`
).then(r => r.json());
console.log('Earning:', position.currentValueUsdc, 'USDC');`;

  const code: Record<typeof codeTab, string> = { curl: curlFlow, python: pythonFlow, js: jsFlow };
  const langLabel: Record<typeof codeTab, string> = { curl: "bash · curl + cast", python: "python · web3.py", js: "typescript · viem" };

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-transparent to-blue-950/20 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16">
          <div className="flex items-center gap-2 mb-6">
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
              ● AI Agent native · ERC-4626
            </Badge>
            <Badge variant="outline" className="border-white/20 text-slate-400 text-xs">Base mainnet</Badge>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent leading-tight">
            USDC Yield Vault
          </h1>
          <p className="text-xl text-slate-300 mb-3 max-w-2xl">
            Deposit USDC. Earn yield. Withdraw USDC.
            Auto-routed to the highest-APY protocol across Base.
          </p>
          <p className="text-sm text-slate-500 mb-8 max-w-xl">
            Standard ERC-4626 vault. Any agent with a wallet and USDC on Base can participate.
            Call the contract directly, or use the transaction builder API to skip the ABI encoding.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6"
              onClick={() => document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Deposit USDC <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10"
              onClick={() => document.getElementById('for-agents')?.scrollIntoView({ behavior: 'smooth' })}>
              <Code className="w-4 h-4 mr-2" /> Agent Integration
            </Button>
            {VAULT && (
              <a href={`https://basescan.org/address/${VAULT}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  <ExternalLink className="w-4 h-4 mr-2" /> View on Basescan
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <div className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Current Net APY", value: netAPY > 0 ? `${netAPY.toFixed(2)}%` : "—", sub: best?.protocol ?? "loading", highlight: true },
            { label: "TVL", value: stats ? `$${parseFloat(stats.tvlUsdc).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : "$0.00", sub: "USDC on Base" },
            { label: "Entry Fee", value: "0.5%", sub: "one-time, on deposit" },
            { label: "Performance Fee", value: "15%", sub: "of yield only · 0% exit" },
          ].map(({ label, value, sub, highlight }) => (
            <div key={label}>
              <div className="text-xs text-slate-500 mb-1">{label}</div>
              <div className={`text-xl font-bold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
              <div className="text-xs text-slate-400">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">

        {/* ── Live Rates ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Live Rates</h2>
              <p className="text-sm text-slate-400 mt-1">Auto-routing picks the highest APY. Rebalances every 24h.</p>
            </div>
            <div className={`flex items-center gap-2 text-xs text-slate-500 ${ratesLoading ? '' : ''}`}>
              {ratesLoading
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching…</>
                : <><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live · updates every 60s</>
              }
            </div>
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
              <div className="text-sm font-medium text-blue-300">Auto-routing · 24h rebalance · 50bps threshold</div>
              <div className="text-xs text-slate-400 mt-1">
                Funds move to the highest-APY protocol when improvement exceeds 0.5%.
                Anyone can trigger an early rebalance by calling <code className="bg-white/10 px-1 rounded">rebalance()</code> on-chain.
              </div>
            </div>
          </div>
        </section>

        {/* ── Deposit + Position ────────────────────────────────────────── */}
        <section id="deposit">
          <h2 className="text-2xl font-bold text-white mb-2">Deposit & Position</h2>
          <p className="text-sm text-slate-400 mb-6">
            Use the transaction builder to get ready-to-sign calldata, or check any wallet's live position.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DepositTxWidget vaultAddress={VAULT} />
            <PositionChecker />
          </div>

          {/* Yield Calculator */}
          <div className="mt-6">
            <YieldCalculator netAPY={netAPY} />
          </div>
        </section>

        {/* ── Agent Integration ─────────────────────────────────────────── */}
        <section id="for-agents">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Code className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Agent Integration</h2>
              <p className="text-sm text-slate-400">Full working examples in every stack.</p>
            </div>
          </div>

          {/* Key concept box */}
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="text-sm font-semibold text-white mb-3">How it works — the three-step pattern</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: "1", label: "Discover", detail: "GET /api/yield/manifest — get vault address, current APY, all endpoints. Machine-readable JSON." },
                { step: "2", label: "Deposit", detail: "GET /api/yield/deposit-tx?amount=X&recipient=0x… — receive 2 pre-encoded transactions. Sign and broadcast." },
                { step: "3", label: "Earn & Exit", detail: "GET /api/yield/position/0xWALLET — live position. Call vault.redeem() to exit any time." },
              ].map(({ step, label, detail }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{label}</div>
                    <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Code tabs */}
          <div className="flex gap-1 mb-4 rounded-lg bg-white/5 p-1 w-fit">
            {(["curl", "python", "js"] as const).map(tab => (
              <button key={tab} onClick={() => setCodeTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${codeTab === tab ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
                {tab === "curl" ? "curl / cast" : tab === "python" ? "Python" : "TypeScript"}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <span className="text-xs text-slate-400 font-mono">{langLabel[codeTab]} — full deposit flow</span>
              <CopyButton text={code[codeTab]} />
            </div>
            <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">{code[codeTab]}</pre>
          </div>

          {/* API Reference */}
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 text-sm font-semibold text-white">API Endpoints</div>
            <div className="divide-y divide-white/5">
              {[
                { method: "GET",  path: "/api/yield/manifest",            auth: "none",   desc: "Full vault manifest: address, APY, all endpoints, agent quick-start steps." },
                { method: "GET",  path: "/api/yield/rates",               auth: "none",   desc: "Live APY from Aave v3, Compound v3, and Morpho Blue on Base. Cached 60s." },
                { method: "GET",  path: "/api/yield/stats",               auth: "none",   desc: "TVL, price per share, fee structure, routing status." },
                { method: "GET",  path: "/api/yield/deposit-tx",          auth: "none",   desc: "Pre-built ERC-4626 calldata. Params: amount (USD), recipient (0x address)." },
                { method: "GET",  path: "/api/yield/position/{wallet}",   auth: "none",   desc: "Live position for any wallet: shares, current USDC value, yield earned." },
                { method: "GET",  path: "/api/yield/contract",            auth: "none",   desc: "Full ABI (76 entries) + Basescan link. For agents integrating directly." },
              ].map(({ method, path, auth, desc }) => (
                <div key={path} className="px-5 py-3 flex items-start gap-3">
                  <Badge className={`text-[10px] shrink-0 mt-0.5 ${method === "GET" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"}`}>{method}</Badge>
                  <div className="min-w-0">
                    <code className="text-white text-xs">{path}</code>
                    <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                  </div>
                  <Badge variant="outline" className="ml-auto shrink-0 text-[10px] border-white/15 text-slate-500">{auth}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            <p className="text-xs text-slate-400">
              Machine-readable manifest at{" "}
              <a href="/api/yield/manifest" target="_blank" className="text-blue-400 hover:underline font-mono">/api/yield/manifest</a>
              {" "}· Discoverable via{" "}
              <a href="/.well-known/agent-card.json" target="_blank" className="text-blue-400 hover:underline font-mono">/.well-known/agent-card.json</a>
              {" "}and{" "}
              <a href="/.well-known/x402.json" target="_blank" className="text-blue-400 hover:underline font-mono">/.well-known/x402.json</a>
            </p>
          </div>
        </section>

        {/* ── Fee Structure ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-2">Fee Structure</h2>
          <p className="text-sm text-slate-400 mb-6">All fee parameters are on-chain with a 48-hour timelock on changes.</p>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Fee</th>
                  <th className="text-left px-5 py-3">Amount</th>
                  <th className="text-left px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-5 py-3 font-medium text-white">Entry</td><td className="px-5 py-3 text-yellow-400 font-semibold">0.5%</td><td className="px-5 py-3 text-slate-400">On deposit. Hard-capped at 2% in contract.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-white">Performance</td><td className="px-5 py-3 text-yellow-400 font-semibold">15% of yield</td><td className="px-5 py-3 text-slate-400">High-watermark. Only on actual profit. Hard-capped at 30%.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-white">Exit</td><td className="px-5 py-3 text-emerald-400 font-semibold">0%</td><td className="px-5 py-3 text-slate-400">Withdraw any time, no penalty.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-white">Rebalance</td><td className="px-5 py-3 text-emerald-400 font-semibold">0%</td><td className="px-5 py-3 text-slate-400">Protocol switches are free to depositors.</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-lg bg-slate-800/50 border border-white/10 p-4 text-xs text-slate-400">
            <strong className="text-white">Example:</strong> Deposit $10,000. Entry: $50. $9,950 earns 4.96% APY gross = $493.52/year.
            15% perf fee = $74.03. <strong className="text-emerald-400">You keep $419.49/year (~4.21% net)</strong> — deposited once, earns forever.
          </div>
        </section>

        {/* ── Security ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">Security</h2>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            {[
              { icon: <Shield className="w-4 h-4 text-emerald-400" />, label: "Admin cannot withdraw depositor principal", detail: "The vault owner has zero ability to drain depositor funds. This is enforced in the contract." },
              { icon: <Lock className="w-4 h-4 text-blue-400" />, label: "48-hour timelock on all fee changes", detail: "Any attempt to raise fees is visible on-chain 48 hours before taking effect." },
              { icon: <Zap className="w-4 h-4 text-yellow-400" />, label: "emergencyWithdraw() always available", detail: "Works regardless of vault state. Cannot be blocked or paused by the owner." },
              { icon: <CheckCircle className="w-4 h-4 text-purple-400" />, label: "Hard fee caps in contract bytecode", detail: "Entry ≤ 2%, performance ≤ 30%. Cannot be overridden." },
              { icon: <Activity className="w-4 h-4 text-orange-400" />, label: "Fully on-chain and transparent", detail: "All rebalances, fee accruals, and deposits are on Basescan." },
            ].map(({ icon, label, detail }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div>
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{detail}</div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-white/10 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-yellow-300">External audit pending</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Contract source is published on Basescan. Aave v3, Compound v3, and Morpho Blue are the underlying protocols — each has been independently audited with billions of TVL.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Vault Details ─────────────────────────────────────────────── */}
        {vault && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Vault Contract</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Address", value: vault.address !== 'deploying-soon' ? `${vault.address.slice(0, 6)}…${vault.address.slice(-4)}` : "Deploying" },
                { label: "Network", value: "Base (chainId 8453)" },
                { label: "Standard", value: "ERC-4626 (tokenized vault)" },
                { label: "Asset", value: `USDC — ${USDC.slice(0, 6)}…${USDC.slice(-4)}` },
                { label: "Share Token", value: vault.shareToken },
                { label: "Price per Share", value: stats ? `${parseFloat(stats.pricePerShare).toFixed(6)} USDC` : "1.000000 USDC" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className="text-sm font-medium text-white font-mono">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-3">
              {vault.address !== 'deploying-soon' && (
                <a href={`https://basescan.org/address/${vault.address}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
                  View contract on Basescan <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <a href="/api/yield/contract" target="_blank"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline">
                Download full ABI <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </section>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-transparent p-8 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <h2 className="text-2xl font-bold text-white mb-2">Your USDC should be earning yield</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            ERC-4626 standard. Two transactions. Done.{" "}
            {netAPY > 0 ? `$1,000 earns $${(1000 * netAPY / 100).toFixed(0)}/year at current rates.` : ""}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8"
              onClick={() => document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth' })}>
              Get Deposit Transactions
            </Button>
            <a href="/api/yield/manifest" target="_blank">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Machine-readable manifest
              </Button>
            </a>
          </div>
        </section>

      </div>

      <div className="border-t border-white/5 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-slate-600">
          <span>CoinRailz Yield Vault · ERC-4626 · Base mainnet</span>
          <span>APYs are variable. DeFi carries smart contract risk.</span>
        </div>
      </div>
    </div>
  );
}
