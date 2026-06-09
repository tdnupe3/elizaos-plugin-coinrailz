import { useState, useEffect } from "react";

const NETWORKS = {
  testnet: {
    label: "Base Sepolia (testnet — free)",
    chainName: "Base Sepolia",
    blockExplorer: "https://sepolia.basescan.org",
    faucetUrl: "https://www.alchemy.com/faucets/base-sepolia",
  },
  mainnet: {
    label: "Base Mainnet (real money)",
    chainName: "Base",
    blockExplorer: "https://basescan.org",
    faucetUrl: null,
  },
};

const FEE_RECIPIENT = "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";

type Step = "idle" | "deploying" | "done" | "error";

interface WalletInfo {
  address: string;
  balance: string;
  hasEnough: boolean;
}

export default function VaultDeploy() {
  const [network, setNetwork]     = useState<"testnet" | "mainnet">("testnet");
  const [step, setStep]           = useState<Step>("idle");
  const [txHash, setTxHash]       = useState("");
  const [address, setAddress]     = useState("");
  const [error, setError]         = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [wallet, setWallet]       = useState<WalletInfo | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError]     = useState("");

  async function loadWallet(net: "testnet" | "mainnet") {
    setWalletLoading(true);
    setWalletError("");
    setWallet(null);
    try {
      const res = await fetch(`/api/yield/server-wallet?network=${net}`);
      const data = await res.json();
      if (data.success) {
        setWallet({ address: data.address, balance: data.balance, hasEnough: data.hasEnough });
      } else {
        setWalletError(data.error || "Failed to load server wallet info");
      }
    } catch (e: any) {
      setWalletError(e.message || "Network error");
    } finally {
      setWalletLoading(false);
    }
  }

  useEffect(() => { loadWallet(network); }, [network]);

  async function deploy() {
    setError("");
    setStatusMsg("");
    setStep("deploying");
    setStatusMsg("Sending deployment transaction to Base Sepolia… (takes ~15–30 seconds)");

    try {
      const res = await fetch("/api/yield/server-deploy", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ network }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Deployment failed");
      }

      setTxHash(data.txHash);
      setAddress(data.address);
      setStep("done");
      setStatusMsg("");
      // Refresh wallet balance
      loadWallet(network);
    } catch (err: any) {
      setError(err.message || String(err));
      setStep("error");
    }
  }

  const net = NETWORKS[network];
  const isDeploying = step === "deploying";

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-xl">

        <div className="mb-8 text-center">
          <div className="text-3xl font-bold mb-2">Deploy Yield Vault</div>
          <div className="text-gray-400 text-sm">
            Deploys <code className="text-emerald-400">CoinRailzYieldVault</code> from the server — no browser wallet needed.
          </div>
        </div>

        {/* Fee recipient info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="text-xs text-gray-500 mb-1">Platform fee wallet (baked into contract on deploy)</div>
          <div className="font-mono text-emerald-400 text-sm break-all">{FEE_RECIPIENT}</div>
          <div className="text-xs text-gray-500 mt-1">Receives 0.5% entry fee + 15% performance fee</div>
        </div>

        {/* Network selector */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 mb-2 font-medium">Select network</div>
          <div className="grid grid-cols-1 gap-3">
            {(["testnet", "mainnet"] as const).map(n => (
              <button
                key={n}
                onClick={() => { if (!isDeploying && step !== "done") setNetwork(n); }}
                className={`text-left p-4 rounded-xl border transition-all ${
                  network === n
                    ? "border-emerald-500 bg-emerald-950"
                    : "border-gray-800 bg-gray-900 hover:border-gray-600"
                } ${isDeploying || step === "done" ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    network === n ? "border-emerald-400 bg-emerald-400" : "border-gray-600"
                  }`} />
                  <span className="font-medium text-sm">{NETWORKS[n].label}</span>
                </div>
                {n === "testnet" && (
                  <div className="text-xs text-gray-500 ml-5">Safe to test — uses free testnet ETH</div>
                )}
                {n === "mainnet" && (
                  <div className="text-xs text-yellow-500 ml-5">⚠ Uses real ETH for gas (~$2–5). Deploy testnet first.</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Server wallet info box */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="text-sm font-medium text-gray-300 mb-3">Server wallet</div>

          {walletLoading && (
            <div className="text-gray-400 text-sm animate-pulse">Loading wallet info…</div>
          )}

          {walletError && (
            <div className="text-red-400 text-sm">{walletError}</div>
          )}

          {wallet && !walletLoading && (
            <>
              <div className="mb-2">
                <div className="text-xs text-gray-500 mb-1">Address (deployer &amp; owner)</div>
                <div className="font-mono text-blue-400 text-xs break-all">{wallet.address}</div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 mb-1">ETH balance</div>
                  <div className={`font-mono text-sm font-semibold ${wallet.hasEnough ? "text-emerald-400" : "text-red-400"}`}>
                    {wallet.balance} ETH
                  </div>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full ${wallet.hasEnough ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"}`}>
                  {wallet.hasEnough ? "✓ Ready" : "⚠ Needs ETH"}
                </div>
              </div>

              {!wallet.hasEnough && network === "testnet" && (
                <div className="mt-3 p-3 bg-yellow-950 border border-yellow-900 rounded-lg">
                  <div className="text-xs text-yellow-300 font-medium mb-2">Fund the server wallet with free testnet ETH:</div>
                  <ol className="text-xs text-yellow-400 list-decimal list-inside space-y-1">
                    <li>
                      Go to{" "}
                      <a href={NETWORKS.testnet.faucetUrl!} target="_blank" rel="noopener noreferrer"
                         className="text-blue-400 underline">Alchemy Base Sepolia Faucet</a>
                    </li>
                    <li>Paste this address: <code className="bg-yellow-900 px-1 rounded break-all">{wallet.address}</code></li>
                    <li>Request testnet ETH (free), then click Refresh below</li>
                  </ol>
                  <button
                    onClick={() => loadWallet(network)}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    ↻ Refresh balance
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Status message while deploying */}
        {statusMsg && isDeploying && (
          <div className="mb-4 bg-blue-950 border border-blue-800 rounded-xl p-3 text-blue-300 text-sm flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            {statusMsg}
          </div>
        )}

        {/* Deploy button */}
        {step !== "done" && (
          <button
            onClick={deploy}
            disabled={isDeploying || walletLoading || !wallet?.hasEnough}
            className={`w-full py-4 font-bold rounded-xl text-lg transition-colors ${
              isDeploying
                ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                : !wallet?.hasEnough || walletLoading
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            }`}
          >
            {isDeploying
              ? "⏳ Deploying…"
              : !wallet?.hasEnough
                ? "⚠ Fund server wallet first"
                : `🚀 Deploy on ${net.chainName}`}
          </button>
        )}

        {/* Tx hash */}
        {txHash && (
          <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Transaction</div>
            <a href={`${net.blockExplorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
               className="font-mono text-blue-400 text-xs break-all hover:text-blue-300">
              {txHash}
            </a>
          </div>
        )}

        {/* Success */}
        {step === "done" && address && (
          <div className="mt-4 bg-emerald-950 border border-emerald-800 rounded-xl p-5">
            <div className="text-emerald-300 font-bold text-lg mb-1">✅ Vault deployed!</div>
            <div className="text-xs text-gray-400 mb-2">Contract address</div>
            <a href={`${net.blockExplorer}/address/${address}`} target="_blank" rel="noopener noreferrer"
               className="font-mono text-emerald-400 text-sm break-all hover:text-emerald-300 block mb-4">
              {address}
            </a>

            <div className="bg-emerald-900 rounded-lg p-3 text-xs text-emerald-200">
              <div className="font-semibold mb-2">Make this permanent (persists across restarts):</div>
              <ol className="list-decimal list-inside space-y-1 text-emerald-300">
                <li>Click the 🔒 lock icon in the Replit left sidebar</li>
                <li>Add secret — Key: <code className="bg-emerald-800 px-1 rounded">YIELD_VAULT_ADDRESS</code></li>
                <li>Value: <code className="bg-emerald-800 px-1 rounded break-all">{address}</code></li>
                <li>Restart the workflow</li>
              </ol>
            </div>

            <button
              onClick={() => {
                navigator.clipboard?.writeText(address).catch(() => {});
              }}
              className="mt-3 text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              📋 Copy address
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-xl p-4 text-red-300">
            <div className="font-medium mb-1 text-sm">Error</div>
            <div className="font-mono text-xs break-all whitespace-pre-wrap">{error}</div>
            <button
              onClick={() => { setError(""); setStep("idle"); }}
              className="mt-3 text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Dismiss &amp; retry
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/yield-portal" className="text-gray-500 text-sm hover:text-gray-300">← Back to Yield Portal</a>
        </div>
      </div>
    </div>
  );
}
