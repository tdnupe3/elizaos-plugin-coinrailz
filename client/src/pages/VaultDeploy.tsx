import { useState } from "react";
import { encodeAbiParameters, parseAbiParameters, encodePacked, concat, toHex } from "viem";

const FEE_RECIPIENT = "0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91";

const ADDRESSES = {
  testnet: {
    label: "Base Sepolia (testnet — free, safe to experiment)",
    chainId: "0x14A34",
    chainName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    usdc:          "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    aavePool:      "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b",
    aUsdc:         "0x96e32dE4B1d6B4bA845C7E8F9F95F5cC0b66B4a4",
    compoundComet: "0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017",
    morpho:        "0x0000000000000000000000000000000000000000",
  },
  mainnet: {
    label: "Base Mainnet (real money — do testnet first)",
    chainId: "0x2105",
    chainName: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    usdc:          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    aavePool:      "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    aUsdc:         "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
    compoundComet: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
    morpho:        "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  },
};

const ZERO = "0x0000000000000000000000000000000000000000";

type Step = "idle" | "switching" | "deploying" | "saving" | "done" | "error";

export default function VaultDeploy() {
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [step, setStep]       = useState<Step>("idle");
  const [txHash, setTxHash]   = useState("");
  const [address, setAddress] = useState("");
  const [error, setError]     = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  async function deploy() {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("MetaMask (or a browser wallet) not found. Install MetaMask from metamask.io and refresh.");
      return;
    }

    setError("");
    setStep("idle");

    try {
      // 1 — request account access
      await eth.request({ method: "eth_requestAccounts" });

      // 2 — switch / add the right network
      setStep("switching");
      const net = ADDRESSES[network];
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: net.chainId }] });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId:         net.chainId,
              chainName:       net.chainName,
              nativeCurrency:  { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls:         [net.rpcUrl],
              blockExplorerUrls: [net.blockExplorer],
            }],
          });
        } else {
          throw switchErr;
        }
      }

      // 3 — build constructor args
      // constructor(address _asset, address _feeRecipient, address _aavePool, address _aUsdc,
      //             address _compoundComet, address _morpho,
      //             MarketParams(_loanToken,_collateralToken,_oracle,_irm,_lltv), uint8 _initialProtocol)
      const constructorArgs = encodeAbiParameters(
        parseAbiParameters(
          "address, address, address, address, address, address, (address,address,address,address,uint256), uint8"
        ),
        [
          net.usdc          as `0x${string}`,
          FEE_RECIPIENT     as `0x${string}`,
          net.aavePool      as `0x${string}`,
          net.aUsdc         as `0x${string}`,
          net.compoundComet as `0x${string}`,
          net.morpho        as `0x${string}`,
          [ZERO as `0x${string}`, ZERO as `0x${string}`, ZERO as `0x${string}`, ZERO as `0x${string}`, 0n],
          0, // Protocol.AAVE
        ]
      );

      // 4 — load bytecode from the compiled artifact endpoint
      const artifactRes = await fetch("/api/yield/artifact");
      if (!artifactRes.ok) throw new Error("Could not load compiled contract artifact from server");
      const { bytecode } = await artifactRes.json();

      const deployData = (bytecode + constructorArgs.slice(2)) as `0x${string}`;

      // 5 — send the deploy transaction via MetaMask
      setStep("deploying");
      const accounts: string[] = await eth.request({ method: "eth_accounts" });
      const from = accounts[0];

      const hash: string = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from,
          data: deployData,
          gas: "0x3D0900", // 4_000_000
        }],
      });
      setTxHash(hash);

      // 6 — wait for receipt
      let receipt = null;
      for (let i = 0; i < 60 && !receipt; i++) {
        await new Promise(r => setTimeout(r, 3000));
        receipt = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] });
      }
      if (!receipt) throw new Error("Transaction sent but receipt not found after 3 minutes. Check Basescan for the tx hash above.");

      const contractAddress: string = receipt.contractAddress;
      if (!contractAddress) throw new Error("Transaction confirmed but no contract address in receipt. Check Basescan.");

      setAddress(contractAddress);

      // 7 — save to Replit env via our API
      setStep("saving");
      const saveRes = await fetch("/api/yield/save-vault-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: contractAddress, network }),
      });
      const saveJson = await saveRes.json();
      setSaveStatus(saveJson.message || "Saved");

      setStep("done");
    } catch (err: any) {
      setError(err.message || String(err));
      setStep("error");
    }
  }

  const net = ADDRESSES[network];
  const explorerBase = net.blockExplorer;

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-12 flex flex-col items-center">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold mb-2">Deploy Yield Vault</div>
          <div className="text-gray-400 text-sm">
            Deploys the compiled <code className="text-emerald-400">CoinRailzYieldVault.sol</code> contract directly from your browser wallet. No terminal needed.
          </div>
        </div>

        {/* Fee recipient info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="text-xs text-gray-500 mb-1">Platform fee wallet (hardcoded in contract)</div>
          <div className="font-mono text-emerald-400 text-sm break-all">{FEE_RECIPIENT}</div>
          <div className="text-xs text-gray-500 mt-1">This receives the 0.5% entry fee and 15% performance fee</div>
        </div>

        {/* Network selector */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 mb-2 font-medium">Select network</div>
          <div className="grid grid-cols-1 gap-3">
            {(["testnet", "mainnet"] as const).map(n => (
              <button
                key={n}
                onClick={() => setNetwork(n)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  network === n
                    ? "border-emerald-500 bg-emerald-950"
                    : "border-gray-800 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full border-2 ${network === n ? "border-emerald-400 bg-emerald-400" : "border-gray-600"}`} />
                  <span className="font-medium text-sm">{ADDRESSES[n].label}</span>
                </div>
                {n === "testnet" && (
                  <div className="text-xs text-gray-500 ml-5">Needs free testnet ETH from alchemy.com/faucets/base-sepolia</div>
                )}
                {n === "mainnet" && (
                  <div className="text-xs text-yellow-500 ml-5">⚠ Costs real ETH for gas (~$2). Make sure testnet works first.</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* What will happen */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-sm">
          <div className="font-medium mb-2 text-gray-300">What happens when you click Deploy:</div>
          <ol className="space-y-1 text-gray-400 list-decimal list-inside">
            <li>MetaMask opens — you approve the network switch to <strong className="text-white">{net.chainName}</strong></li>
            <li>MetaMask shows the deploy transaction — you confirm it</li>
            <li>Wait ~15 seconds for the block to confirm</li>
            <li>Vault address is automatically saved to your Replit environment</li>
            <li>The yield portal API immediately switches to live contract data</li>
          </ol>
        </div>

        {/* Deploy button */}
        {step === "idle" || step === "error" ? (
          <button
            onClick={deploy}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg transition-colors"
          >
            🚀 Deploy on {net.chainName}
          </button>
        ) : step === "switching" ? (
          <div className="w-full py-4 bg-gray-800 text-gray-300 font-bold rounded-xl text-lg text-center">
            ⏳ Switching to {net.chainName}…
          </div>
        ) : step === "deploying" ? (
          <div className="w-full py-4 bg-gray-800 text-gray-300 font-bold rounded-xl text-lg text-center">
            ⛏ Deploying… waiting for block confirmation
          </div>
        ) : step === "saving" ? (
          <div className="w-full py-4 bg-gray-800 text-gray-300 font-bold rounded-xl text-lg text-center">
            💾 Saving vault address…
          </div>
        ) : step === "done" ? (
          <div className="w-full py-4 bg-emerald-800 text-emerald-200 font-bold rounded-xl text-lg text-center">
            ✅ Deployed & live!
          </div>
        ) : null}

        {/* Tx hash */}
        {txHash && (
          <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Transaction hash</div>
            <a
              href={`${explorerBase}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-400 text-xs break-all hover:text-blue-300"
            >
              {txHash}
            </a>
          </div>
        )}

        {/* Contract address */}
        {address && (
          <div className="mt-4 bg-emerald-950 border border-emerald-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">✅ Vault contract address</div>
            <a
              href={`${explorerBase}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-emerald-400 text-sm break-all hover:text-emerald-300"
            >
              {address}
            </a>
            {saveStatus && (
              <div className="text-xs text-emerald-400 mt-2">💾 {saveStatus}</div>
            )}
            <div className="text-xs text-gray-400 mt-2">
              The yield portal API is now reading live contract data. Go to{" "}
              <a href="/yield-portal" className="text-emerald-400 hover:underline">/yield-portal</a> to see it.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
            <div className="font-medium mb-1">Error</div>
            <div className="font-mono text-xs break-all">{error}</div>
            {error.includes("MetaMask") && (
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-blue-400 hover:underline text-xs"
              >
                Download MetaMask →
              </a>
            )}
          </div>
        )}

        {/* Testnet faucet link */}
        {network === "testnet" && step === "idle" && (
          <div className="mt-6 text-center text-xs text-gray-500">
            Need testnet ETH?{" "}
            <a
              href="https://www.alchemy.com/faucets/base-sepolia"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Get free Base Sepolia ETH →
            </a>
          </div>
        )}

        {/* Nav back */}
        <div className="mt-8 text-center">
          <a href="/yield-portal" className="text-gray-500 text-sm hover:text-gray-300">
            ← Back to Yield Portal
          </a>
        </div>
      </div>
    </div>
  );
}
