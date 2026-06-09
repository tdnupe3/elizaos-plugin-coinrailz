import { useState, useEffect, useCallback } from "react";

const MAINNET_VAULT   = "0xf8f67d6422fc60114a11ada3dca297ab6a255a29";
const BASESCAN_VAULT  = `https://basescan.org/address/${MAINNET_VAULT}`;
const BASESCAN_TX     = (h: string) => `https://basescan.org/tx/${h}`;
const FEE_RECIPIENT   = "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";

interface VaultStats {
  tvlUsdc: string;
  pricePerShare: string;
  pendingFeesUsdc: string;
  depositFeePct: number;
  performanceFeePct: number;
  nextRebalanceInSec: number;
}
interface Rates { bestProtocol: string; bestAPY: number; aaveAPY: number; compoundAPY: number; }
interface PlatformBalance {
  wallet: string;
  balances: { usdcAvailable: string; vaultShares: string; vaultValueUsdc: string };
  vault_stats: { tvlUsdc: string; pricePerShare: string; activeProtocol: string };
}

function fmtSec(s: number) {
  if (s <= 0) return "ready now";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function VaultDashboard() {
  const [adminKey, setAdminKey]         = useState("");
  const [authed, setAuthed]             = useState(false);
  const [stats, setStats]               = useState<VaultStats | null>(null);
  const [rates, setRates]               = useState<Rates | null>(null);
  const [balance, setBalance]           = useState<PlatformBalance | null>(null);
  const [loading, setLoading]           = useState(false);
  const [balLoading, setBalLoading]     = useState(false);

  const [depositAmt, setDepositAmt]     = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [actionMsg, setActionMsg]       = useState<{ ok: boolean; msg: string; tx?: string } | null>(null);
  const [actionPending, setActionPending] = useState(false);

  // Testnet deploy state (kept for future redeploys)
  const [showDeploy, setShowDeploy]     = useState(false);
  const [deployStep, setDeployStep]     = useState<"idle"|"deploying"|"done"|"error">("idle");
  const [deployTx, setDeployTx]         = useState("");
  const [deployAddr, setDeployAddr]     = useState("");
  const [deployErr, setDeployErr]       = useState("");

  async function loadPublicStats() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        fetch("/api/yield/stats").then(x => x.json()),
        fetch("/api/yield/rates").then(x => x.json()),
      ]);
      if (s.success) setStats(s.stats);
      if (r.success) setRates({
        bestProtocol: r.currentBest.protocol,
        bestAPY:      r.currentBest.apyPercent,
        aaveAPY:      r.rates.aave.apyPercent,
        compoundAPY:  r.rates.compound.apyPercent,
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadPlatformBalance(key: string) {
    setBalLoading(true);
    try {
      const res = await fetch("/api/yield/platform-balance", {
        headers: { "x-admin-key": key },
      });
      const data = await res.json();
      if (data.success) { setBalance(data); setAuthed(true); }
      else setActionMsg({ ok: false, msg: data.error || "Auth failed" });
    } finally {
      setBalLoading(false);
    }
  }

  useEffect(() => { loadPublicStats(); }, []);

  async function doAction(endpoint: string, body: object) {
    setActionPending(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/yield/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ ok: true, msg: `Success! tx: ${data.txHash?.slice(0,10)}...`, tx: data.txHash });
        await Promise.all([loadPublicStats(), loadPlatformBalance(adminKey)]);
      } else {
        setActionMsg({ ok: false, msg: data.error || "Action failed" });
      }
    } catch (e: any) {
      setActionMsg({ ok: false, msg: e.message });
    } finally {
      setActionPending(false);
    }
  }

  async function deployTestnet() {
    setDeployStep("deploying");
    setDeployErr("");
    try {
      const res = await fetch("/api/yield/server-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: "testnet" }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setDeployTx(d.txHash);
      setDeployAddr(d.address);
      setDeployStep("done");
    } catch (e: any) {
      setDeployErr(e.message);
      setDeployStep("error");
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-900/40 border border-emerald-700 rounded-full px-4 py-1.5 text-emerald-300 text-xs font-medium mb-4">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live on Base Mainnet
          </div>
          <h1 className="text-3xl font-bold mb-2">CoinRailz Yield Vault</h1>
          <p className="text-gray-400 text-sm">crUSDC · ERC-4626 · Auto-routes to highest APY</p>
        </div>

        {/* Live vault address */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">CONTRACT</span>
            <a href={BASESCAN_VAULT} target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-400 hover:text-blue-300">View on Basescan ↗</a>
          </div>
          <div className="font-mono text-emerald-400 text-sm break-all">{MAINNET_VAULT}</div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span>Fee recipient: <span className="text-gray-400 font-mono">{FEE_RECIPIENT.slice(0,10)}…</span></span>
            <span>Asset: <span className="text-gray-400">USDC</span></span>
            <span>Network: <span className="text-gray-400">Base</span></span>
          </div>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "TVL",          value: loading ? "…" : `$${stats?.tvlUsdc ?? "0"}`,        sub: "USDC deposited" },
            { label: "Best APY",     value: loading ? "…" : `${rates?.bestAPY ?? "–"}%`,       sub: rates?.bestProtocol ?? "–" },
            { label: "Price/Share",  value: loading ? "…" : `$${stats?.pricePerShare ?? "1"}`, sub: "crUSDC → USDC" },
            { label: "Next Rebalance", value: loading ? "…" : fmtSec(stats?.nextRebalanceInSec ?? 0), sub: "auto-routes" },
          ].map(c => (
            <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{c.label}</div>
              <div className="text-xl font-bold text-white">{c.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* APY breakdown */}
        {rates && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
            <div className="text-xs text-gray-500 font-medium mb-3">LIVE PROTOCOL RATES</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: "Aave v3",      apy: rates.aaveAPY,    best: rates.bestProtocol === "Aave v3" },
                { name: "Compound v3",  apy: rates.compoundAPY, best: rates.bestProtocol === "Compound v3" },
                { name: "Morpho Blue",  apy: 0,                best: false },
              ].map(p => (
                <div key={p.name} className={`rounded-lg p-3 border ${p.best ? "border-emerald-600 bg-emerald-950" : "border-gray-700 bg-gray-800"}`}>
                  <div className="text-xs text-gray-400 mb-1">{p.name}</div>
                  <div className={`text-lg font-bold ${p.best ? "text-emerald-300" : "text-white"}`}>{p.apy}%</div>
                  {p.best && <div className="text-xs text-emerald-400 mt-0.5">● active</div>}
                  {!p.best && p.apy === 0 && <div className="text-xs text-gray-500 mt-0.5">integrating</div>}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Net APY to depositor after 15% performance fee: <span className="text-emerald-400 font-medium">{rates ? `${(rates.bestAPY * 0.85).toFixed(2)}%` : "–"}</span>
            </div>
          </div>
        )}

        {/* Fees */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="text-xs text-gray-500 font-medium mb-3">FEE STRUCTURE</div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Entry", val: `${stats?.depositFeePct ?? 0.5}%` },
              { label: "Performance", val: `${stats?.performanceFeePct ?? 15}%` },
              { label: "Exit", val: "0%" },
              { label: "Switch", val: "0%" },
            ].map(f => (
              <div key={f.label} className="bg-gray-800 rounded-lg p-2">
                <div className="text-white font-bold text-sm">{f.val}</div>
                <div className="text-xs text-gray-500">{f.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
          <div className="text-sm font-medium text-gray-300 mb-4">Platform Admin</div>

          {!authed ? (
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Admin key"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadPlatformBalance(adminKey)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => loadPlatformBalance(adminKey)}
                disabled={balLoading || !adminKey}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
              >
                {balLoading ? "…" : "Unlock"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Server wallet balance */}
              {balance && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-2 font-medium">SERVER WALLET</div>
                  <div className="font-mono text-blue-400 text-xs mb-3 break-all">{balance.wallet}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-gray-500">USDC Available</div>
                      <div className="text-white font-semibold">${balance.balances.usdcAvailable}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Vault Shares</div>
                      <div className="text-white font-semibold">{balance.balances.vaultShares} crUSDC</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Vault Value</div>
                      <div className="text-emerald-400 font-semibold">${balance.balances.vaultValueUsdc}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    TVL: <span className="text-white">${balance.vault_stats.tvlUsdc}</span> ·
                    Protocol: <span className="text-emerald-400">{balance.vault_stats.activeProtocol}</span> ·
                    Price: <span className="text-white">${balance.vault_stats.pricePerShare}</span>
                  </div>
                </div>
              )}

              {/* Deposit */}
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium">SEED VAULT (deposit server USDC)</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="USDC amount, e.g. 10.00"
                    value={depositAmt}
                    onChange={e => setDepositAmt(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => doAction("platform-deposit", { amountUsdc: depositAmt })}
                    disabled={actionPending || !depositAmt}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {actionPending ? "…" : "Deposit"}
                  </button>
                </div>
              </div>

              {/* Withdraw */}
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium">REDEEM SHARES (withdraw to USDC)</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Shares (crUSDC), e.g. 9.95"
                    value={withdrawShares}
                    onChange={e => setWithdrawShares(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => doAction("platform-withdraw", { shares: withdrawShares })}
                    disabled={actionPending || !withdrawShares}
                    className="px-4 py-2 bg-orange-800 hover:bg-orange-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {actionPending ? "…" : "Redeem"}
                  </button>
                </div>
              </div>

              {/* Rebalance / Harvest */}
              <div className="flex gap-2">
                <button
                  onClick={() => doAction("platform-rebalance", {})}
                  disabled={actionPending}
                  className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
                >
                  {actionPending ? "…" : "↺ Rebalance"}
                </button>
                <button
                  onClick={() => doAction("platform-harvest", {})}
                  disabled={actionPending}
                  className="flex-1 py-2 bg-purple-900 hover:bg-purple-800 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
                >
                  {actionPending ? "…" : "🌾 Harvest Fees"}
                </button>
                <button
                  onClick={() => loadPlatformBalance(adminKey)}
                  disabled={balLoading}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg disabled:opacity-50 transition-colors"
                  title="Refresh balances"
                >
                  ↻
                </button>
              </div>

              {/* Action feedback */}
              {actionMsg && (
                <div className={`rounded-xl p-3 text-sm ${actionMsg.ok ? "bg-emerald-950 border border-emerald-800 text-emerald-300" : "bg-red-950 border border-red-800 text-red-300"}`}>
                  {actionMsg.msg}
                  {actionMsg.tx && (
                    <a href={BASESCAN_TX(actionMsg.tx)} target="_blank" rel="noopener noreferrer"
                       className="ml-2 text-blue-400 hover:text-blue-300 text-xs">view tx ↗</a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agent integration reference */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <div className="text-xs text-gray-500 font-medium mb-3">AGENT INTEGRATION (ERC-4626)</div>
          <div className="space-y-1 text-xs font-mono">
            <div className="text-gray-400">{"// 1. Approve vault"}</div>
            <div className="text-blue-300">USDC.approve(<span className="text-emerald-400">{MAINNET_VAULT.slice(0,10)}…</span>, amount)</div>
            <div className="text-gray-400 mt-2">{"// 2. Deposit"}</div>
            <div className="text-blue-300">vault.deposit(amount, receiver) → crUSDC shares</div>
            <div className="text-gray-400 mt-2">{"// 3. Withdraw (no fee, no lock)"}</div>
            <div className="text-blue-300">vault.redeem(shares, receiver, owner) → USDC</div>
          </div>
          <div className="mt-3 flex gap-3">
            <a href="/api/yield/contract" target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-400 hover:text-blue-300">Full ABI + guide ↗</a>
            <a href="/api/yield/stats" target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-400 hover:text-blue-300">Live stats JSON ↗</a>
            <a href="/api/yield/manifest" target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-400 hover:text-blue-300">Machine manifest ↗</a>
          </div>
        </div>

        {/* Testnet redeploy */}
        <div className="mb-5">
          <button
            onClick={() => setShowDeploy(!showDeploy)}
            className="text-xs text-gray-500 hover:text-gray-300 underline"
          >
            {showDeploy ? "▲ Hide testnet tools" : "▼ Deploy testnet vault (for testing)"}
          </button>

          {showDeploy && (
            <div className="mt-3 bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="text-sm text-gray-400 mb-3">Deploys a fresh vault on Base Sepolia using the server wallet.</div>
              {deployStep === "idle" && (
                <button
                  onClick={deployTestnet}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                  🧪 Deploy testnet vault
                </button>
              )}
              {deployStep === "deploying" && (
                <div className="flex items-center gap-2 text-blue-300 text-sm">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Deploying…
                </div>
              )}
              {deployStep === "done" && (
                <div className="text-emerald-300 text-sm">
                  ✅ <a href={`https://sepolia.basescan.org/address/${deployAddr}`} target="_blank" rel="noopener noreferrer"
                         className="underline">{deployAddr}</a>
                  {" "}<a href={`https://sepolia.basescan.org/tx/${deployTx}`} target="_blank" rel="noopener noreferrer"
                         className="text-blue-400 underline">tx ↗</a>
                </div>
              )}
              {deployStep === "error" && (
                <div className="text-red-300 text-sm">
                  ❌ {deployErr}
                  <button onClick={() => setDeployStep("idle")} className="ml-2 text-xs underline">retry</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center">
          <a href="/yield-portal" className="text-gray-500 text-sm hover:text-gray-300">← Yield Portal</a>
        </div>
      </div>
    </div>
  );
}
