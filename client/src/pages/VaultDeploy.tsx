import { useState } from "react";

const NETWORKS = {
  testnet: {
    label: "Base Sepolia (testnet — free, safe to test)",
    chainId: "0x14A34",
    chainName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    faucetUrl: "https://www.alchemy.com/faucets/base-sepolia",
  },
  mainnet: {
    label: "Base Mainnet (real money — do testnet first)",
    chainId: "0x2105",
    chainName: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    faucetUrl: null,
  },
};

const FEE_RECIPIENT = "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";

type Step = "idle" | "switching" | "simulating" | "deploying" | "waiting" | "saving" | "done" | "error";

export default function VaultDeploy() {
  const [network, setNetwork]     = useState<"testnet" | "mainnet">("testnet");
  const [step, setStep]           = useState<Step>("idle");
  const [txHash, setTxHash]       = useState("");
  const [address, setAddress]     = useState("");
  const [saveMsg, setSaveMsg]     = useState("");
  const [error, setError]         = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  async function deploy() {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("No browser wallet found. Install MetaMask from metamask.io and refresh.");
      setStep("error");
      return;
    }

    setError("");
    setStatusMsg("");
    setStep("idle");

    try {
      // ── 1. Request accounts ───────────────────────────────────────────────
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts?.length || !accounts[0]) {
        throw new Error("No wallet accounts found. Please unlock MetaMask and try again.");
      }
      const fromAddress: string = accounts[0];

      // ── 2. Switch network ─────────────────────────────────────────────────
      setStep("switching");
      const net = NETWORKS[network];
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: net.chainId }],
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: net.chainId, chainName: net.chainName,
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [net.rpcUrl], blockExplorerUrls: [net.blockExplorer],
            }],
          });
        } else {
          throw switchErr;
        }
      }

      // ── 3. Fetch deploy data from server ──────────────────────────────────
      setStep("simulating");
      setStatusMsg("Fetching contract bytecode from server…");
      const dataRes = await fetch(`/api/yield/deploy-data?network=${network}`);
      const data = await dataRes.json();
      if (!data.success) throw new Error(data.error || "Server failed to build deployment data");

      // ── 4. Pre-flight simulation via MetaMask provider ────────────────────
      // Uses MetaMask's own RPC (Infura/Alchemy) — no CORS / rate-limit issues.
      // If the constructor would revert, MetaMask throws here BEFORE showing the
      // confirm popup, so we catch the real reason without spending any gas.
      setStatusMsg("Running pre-flight gas estimate (MetaMask)…");
      let gasEstimate = "0x3D0900"; // 4 M fallback
      try {
        const est: string = await eth.request({
          method: "eth_estimateGas",
          params: [{ from: fromAddress, data: data.deployHex, value: "0x0" }],
        });
        const buffered = Math.ceil(parseInt(est, 16) * 1.2);
        gasEstimate = "0x" + buffered.toString(16);
        setStatusMsg(`Pre-flight passed — gas ~${parseInt(est, 16).toLocaleString()}. Opening MetaMask…`);
      } catch (estErr: any) {
        const msg: string = estErr.message || "";
        // Only abort if this looks like a genuine constructor revert
        if (msg.toLowerCase().includes("revert") || msg.toLowerCase().includes("execution")) {
          throw new Error(`Constructor would revert: ${msg}`);
        }
        // Any other estimate error (provider error, etc.) — proceed with fallback gas
        setStatusMsg(`Gas estimate unavailable (${msg.slice(0, 60)}). Proceeding with fallback gas…`);
      }

      // ── 5. Capture nonce → compute predicted contract address ─────────────
      // Must happen BEFORE eth_sendTransaction so we can recover if MetaMask
      // throws its v12 bug after the tx is already broadcast.
      let predictedAddress = "";
      try {
        const nonceHex: string = await eth.request({
          method: "eth_getTransactionCount",
          params: [fromAddress, "latest"],
        });
        const nonce = parseInt(nonceHex, 16);
        const predRes = await fetch(`/api/yield/predict-address?from=${fromAddress}&nonce=${nonce}`);
        const predData = await predRes.json();
        if (predData.success) predictedAddress = predData.contractAddress;
      } catch { /* best-effort */ }

      // ── 6. Send deploy transaction via MetaMask ───────────────────────────
      setStep("deploying");
      let hash = "";
      try {
        hash = await eth.request({
          method: "eth_sendTransaction",
          params: [{ from: fromAddress, data: data.deployHex, gas: gasEstimate, value: "0x0" }],
        });
        setTxHash(hash);
      } catch (sendErr: any) {
        const msg: string = sendErr.message || "";

        // ── MetaMask v12 known bug ──────────────────────────────────────────
        // MetaMask crashes reading `receipt.to.length` on deployment receipts
        // (receipt.to === null for CREATE txs). The tx was already broadcast.
        // Recovery: poll eth_getCode at the predicted address via MetaMask's
        // own provider — no direct RPC fetch needed.
        if (msg.includes("reading 'length'") && predictedAddress) {
          setStep("waiting");
          setStatusMsg(
            `MetaMask internal error (v12 bug on contract deployments). ` +
            `Checking on-chain for your contract — please wait…`
          );

          let found = false;
          for (let i = 0; i < 40 && !found; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
              const code: string = await eth.request({
                method: "eth_getCode",
                params: [predictedAddress, "latest"],
              });
              if (code && code !== "0x" && code !== "0x0" && code.length > 4) {
                found = true;
              }
            } catch { /* ignore individual poll failures */ }
          }

          if (found) {
            setAddress(predictedAddress);
            setError("");
            setStatusMsg("Contract deployed! MetaMask error was a false alarm — saving address…");
            setStep("saving");
            const saveRes = await fetch("/api/yield/save-vault-address", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: predictedAddress, network }),
            });
            const saveJson = await saveRes.json();
            setSaveMsg(saveJson.message || "Saved");
            setStep("done");
            return;
          }

          // Not found after 2 min → show actionable message
          throw new Error(
            `Transaction was sent but contract not found at ${predictedAddress} after 2 minutes. ` +
            `Open ${net.blockExplorer}/address/${fromAddress} in a new tab — ` +
            `if a contract appears there, copy the address and add it as YIELD_VAULT_ADDRESS in Replit Secrets.`
          );
        }

        // User rejected or genuine MetaMask error
        if (sendErr.code === 4001) {
          throw new Error("Transaction rejected in MetaMask. Click Deploy to try again.");
        }
        throw sendErr;
      }

      // ── 7. Wait for receipt ───────────────────────────────────────────────
      // Reached only if eth_sendTransaction returned a hash without throwing.
      setStep("waiting");
      setStatusMsg("Transaction broadcast. Waiting for block confirmation (~15s)…");
      let receipt: any = null;
      for (let i = 0; i < 60 && !receipt; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          receipt = await eth.request({
            method: "eth_getTransactionReceipt",
            params: [hash],
          });
        } catch { /* ignore */ }
      }
      if (!receipt) {
        throw new Error(
          `Tx sent (${hash}) but receipt not found after 3 minutes. ` +
          `Check ${net.blockExplorer}/tx/${hash}`
        );
      }

      const contractAddress: string = receipt.contractAddress;
      if (!contractAddress) {
        throw new Error(
          `Transaction confirmed but no contract address in receipt. ` +
          `The deployment may have reverted on-chain. Check ${net.blockExplorer}/tx/${hash}`
        );
      }
      setAddress(contractAddress);

      // ── 8. Save to server env ─────────────────────────────────────────────
      setStep("saving");
      const saveRes = await fetch("/api/yield/save-vault-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: contractAddress, network }),
      });
      const saveJson = await saveRes.json();
      setSaveMsg(saveJson.message || "Saved");
      setStep("done");

    } catch (err: any) {
      setError(err.message || String(err));
      setStep("error");
    }
  }

  const net = NETWORKS[network];
  const isWorking = ["switching", "simulating", "deploying", "waiting", "saving"].includes(step);

  const stepLabel: Record<Step, string> = {
    idle:       `🚀 Deploy on ${net.chainName}`,
    switching:  `⏳ Switching to ${net.chainName}…`,
    simulating: "🔍 Running pre-flight check…",
    deploying:  "⏳ Confirm in MetaMask…",
    waiting:    "⛏ Waiting for confirmation…",
    saving:     "💾 Saving vault address…",
    done:       "✅ Deployed & live!",
    error:      `🚀 Try Again on ${net.chainName}`,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-xl">

        <div className="mb-8 text-center">
          <div className="text-3xl font-bold mb-2">Deploy Yield Vault</div>
          <div className="text-gray-400 text-sm">
            Deploys <code className="text-emerald-400">CoinRailzYieldVault</code> directly from your browser wallet.
          </div>
        </div>

        {/* Fee recipient */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="text-xs text-gray-500 mb-1">Platform fee wallet (locked into contract on deploy)</div>
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
                onClick={() => { if (!isWorking) setNetwork(n); }}
                className={`text-left p-4 rounded-xl border transition-all ${
                  network === n
                    ? "border-emerald-500 bg-emerald-950"
                    : "border-gray-800 bg-gray-900 hover:border-gray-600"
                } ${isWorking ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    network === n ? "border-emerald-400 bg-emerald-400" : "border-gray-600"
                  }`} />
                  <span className="font-medium text-sm">{NETWORKS[n].label}</span>
                </div>
                {n === "testnet" && (
                  <div className="text-xs text-gray-500 ml-5">
                    Free testnet ETH →{" "}
                    <a href={NETWORKS.testnet.faucetUrl!} target="_blank" rel="noopener noreferrer"
                       className="text-blue-400 hover:underline" onClick={e => e.stopPropagation()}>
                      alchemy.com/faucets/base-sepolia
                    </a>
                  </div>
                )}
                {n === "mainnet" && (
                  <div className="text-xs text-yellow-500 ml-5">⚠ Real ETH for gas (~$2–5). Deploy testnet first.</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* What happens */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-sm">
          <div className="font-medium mb-2 text-gray-300">What happens when you click Deploy:</div>
          <ol className="space-y-1 text-gray-400 list-decimal list-inside">
            <li>Runs a gas estimate via MetaMask (catches constructor errors before gas is spent)</li>
            <li>MetaMask opens — confirm switching to <strong className="text-white">{net.chainName}</strong> if needed</li>
            <li>MetaMask shows the deploy transaction — confirm it</li>
            <li>The page polls on-chain until the contract appears (~15s)</li>
            <li>Vault address auto-saved — portal goes live</li>
          </ol>
          <div className="mt-3 p-2 bg-blue-950 border border-blue-900 rounded-lg text-blue-300 text-xs">
            ℹ️ MetaMask v12 sometimes shows a <em>"Transaction failed"</em> Chrome notification after you confirm — 
            <strong> ignore it and keep this tab open.</strong> The page detects your deployed contract on-chain automatically.
          </div>
        </div>

        {/* Status message */}
        {statusMsg && isWorking && (
          <div className="mb-4 bg-blue-950 border border-blue-800 rounded-xl p-3 text-blue-300 text-xs">
            {statusMsg}
          </div>
        )}

        {/* Deploy button */}
        <button
          onClick={deploy}
          disabled={isWorking}
          className={`w-full py-4 font-bold rounded-xl text-lg transition-colors ${
            step === "done"
              ? "bg-emerald-800 text-emerald-200 cursor-default"
              : isWorking
                ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
          }`}
        >
          {stepLabel[step]}
        </button>

        {/* Tx hash */}
        {txHash && (
          <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Transaction hash</div>
            <a href={`${net.blockExplorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
               className="font-mono text-blue-400 text-xs break-all hover:text-blue-300">
              {txHash}
            </a>
          </div>
        )}

        {/* Contract address */}
        {address && (
          <div className="mt-4 bg-emerald-950 border border-emerald-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">✅ Vault contract address</div>
            <a href={`${net.blockExplorer}/address/${address}`} target="_blank" rel="noopener noreferrer"
               className="font-mono text-emerald-400 text-sm break-all hover:text-emerald-300">
              {address}
            </a>
            {saveMsg && <div className="text-xs text-emerald-400 mt-2">💾 {saveMsg}</div>}
            <div className="mt-3 bg-emerald-900 rounded-lg p-3 text-xs text-emerald-200">
              <div className="font-medium mb-1">To make this permanent across restarts:</div>
              <ol className="list-decimal list-inside space-y-1 text-emerald-300">
                <li>Click the 🔒 lock icon in the Replit left sidebar</li>
                <li>Add secret: Key = <code className="bg-emerald-800 px-1 rounded">YIELD_VAULT_ADDRESS</code></li>
                <li>Value = <code className="bg-emerald-800 px-1 rounded break-all">{address}</code></li>
                <li>Restart the workflow</li>
              </ol>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
            <div className="font-medium mb-1">Error</div>
            <div className="font-mono text-xs break-all whitespace-pre-wrap">{error}</div>
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/yield-portal" className="text-gray-500 text-sm hover:text-gray-300">← Back to Yield Portal</a>
        </div>
      </div>
    </div>
  );
}
