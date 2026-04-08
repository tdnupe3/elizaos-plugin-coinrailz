import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  Copy,
  Terminal,
  Zap,
  Shield,
  Globe,
  ArrowRight,
  ExternalLink,
  Key,
  CreditCard,
  Cpu,
} from "lucide-react";

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative group my-3">
      {label && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-mono">{label}</div>
      )}
      <pre className="bg-zinc-900 dark:bg-zinc-950 text-green-400 text-sm rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-700 hover:bg-zinc-600 text-white rounded p-1.5"
        title="Copy to clipboard"
      >
        {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
      {n}
    </div>
  );
}

export default function McpIntegrationPage() {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://coinrailz.com";

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/">
              <span className="text-blue-600 hover:underline text-sm">Coin Railz</span>
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">MCP Integration Guide</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <Cpu className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              MCP Integration Guide
            </h1>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg max-w-2xl">
            Building an MCP server or agent framework that calls Coin Railz services? Get paid
            access in under 60 seconds — no crypto wallet required.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="secondary">60 Services</Badge>
            <Badge variant="secondary">8 Blockchains</Badge>
            <Badge variant="secondary">x402 Compatible</Badge>
            <Badge variant="secondary">WebMCP Manifest</Badge>
            <Badge variant="secondary">Free Trial Key</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">

        {/* TL;DR Banner */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="p-6">
            <div className="flex gap-3 items-start">
              <Zap className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white mb-1">
                  TL;DR — Skip the crypto, get access now
                </p>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                  If you&apos;re stuck on the x402 payment step, use{" "}
                  <strong>Path A below</strong>: one GET request returns a free{" "}
                  <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">
                    cr_live_...
                  </code>{" "}
                  API key with $5 in credits. Pass it as{" "}
                  <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">
                    X-API-KEY
                  </code>{" "}
                  on any endpoint. Done.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Path A */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Path A — API Key Credits
            </h2>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
              Recommended
            </Badge>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            No crypto wallet. No on-chain transaction. No account creation. A free $5 trial key
            works on all 60 services and is available immediately.
          </p>

          <div className="space-y-6">
            {/* Step 1 */}
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <StepNumber n={1} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                      Get your free trial key
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                      One GET request. No auth required. Returns instantly. Save the key — shown
                      once only.
                    </p>
                    <CopyBlock
                      label="shell"
                      code={`curl ${baseUrl}/api/m2m/credits/trial`}
                    />
                    <CopyBlock
                      label="response"
                      code={`{
  "apiKey": "cr_live_xxxxxxxxxxxxxxxxxxxx",
  "credits": 5,
  "expiresIn": "7 days",
  "note": "SAVE this key — returned once only"
}`}
                    />
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2">
                      <Shield className="w-3 h-3" />
                      Rate-limited to 1 trial per IP per 7 days. Save the key immediately.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <StepNumber n={2} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                      Call any service with your key
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                      Pass <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">X-API-KEY</code>{" "}
                      on any <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/x402/*</code>{" "}
                      endpoint. The server returns billing headers on every response.
                    </p>
                    <CopyBlock
                      label="shell — gas price oracle"
                      code={`curl -X POST ${baseUrl}/x402/gas-price-oracle \\
  -H 'X-API-KEY: cr_live_xxxxxxxxxxxxxxxxxxxx' \\
  -H 'Content-Type: application/json' \\
  -d '{}'`}
                    />
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          header: "X-Credits-Used",
                          desc: "Credits charged for this call",
                        },
                        {
                          header: "X-Credits-Remaining",
                          desc: "Your balance after this call",
                        },
                        {
                          header: "X-Recharge-Url",
                          desc: "Link to buy more credits",
                        },
                      ].map((h) => (
                        <div
                          key={h.header}
                          className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800"
                        >
                          <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-1">
                            {h.header}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {h.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                        View the full service catalog:
                      </p>
                      <CopyBlock
                        label="shell"
                        code={`curl ${baseUrl}/x402/catalog`}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <StepNumber n={3} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                      Buy more credits when trial runs out
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                      Stripe hosted checkout. Pay by card. API key is auto-provisioned in ~60s after
                      payment. No crypto needed.
                    </p>
                    <CopyBlock
                      label="shell"
                      code={`curl -X POST ${baseUrl}/api/m2m/credits/checkout/session \\
  -H 'Content-Type: application/json' \\
  -d '{"amount": 25}'`}
                    />
                    <CopyBlock
                      label="response"
                      code={`{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_live_..."
}`}
                    />
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      {[
                        { usd: "$5", calls: "~80–100 calls" },
                        { usd: "$10", calls: "~200 calls" },
                        { usd: "$25", calls: "~500 calls", rec: true },
                        { usd: "$100", calls: "~2,000 calls" },
                      ].map((t) => (
                        <div
                          key={t.usd}
                          className={`rounded-lg p-3 border text-center ${
                            t.rec
                              ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                          }`}
                        >
                          <div className="font-bold text-zinc-900 dark:text-white">{t.usd}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.calls}</div>
                          {t.rec && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              recommended
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Path B */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Path B — Native x402 On-Chain USDC
            </h2>
            <Badge variant="outline">For crypto-native agents</Badge>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Standard x402 protocol (EIP-7615). Call the endpoint, receive a 402 challenge,
            construct a USDC payment header, retry. Supported on Base, Ethereum, Polygon,
            Arbitrum, and Solana.
          </p>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <StepNumber n={1} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                      Call the endpoint — receive 402 challenge
                    </h3>
                    <CopyBlock
                      label="shell"
                      code={`curl -X POST ${baseUrl}/x402/gas-price-oracle \\
  -H 'Content-Type: application/json' \\
  -d '{}'`}
                    />
                    <p className="text-sm text-zinc-500 mt-2">
                      Returns{" "}
                      <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">
                        HTTP 402
                      </code>{" "}
                      with a{" "}
                      <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">
                        WWW-Authenticate: Payment ...
                      </code>{" "}
                      header and a JSON body describing the exact USDC amount, chain, and recipient
                      address.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <StepNumber n={2} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                      Parse challenge and construct payment header
                    </h3>
                    <p className="text-sm text-zinc-500 mb-3">
                      Use the official x402 SDK or Dexter to handle the payment flow:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <a
                        href="https://github.com/coinbase/x402"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        <Terminal className="w-4 h-4 text-zinc-600" />
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-white">
                            x402 SDK (TypeScript)
                          </div>
                          <div className="text-xs text-zinc-500">
                            npm install x402
                          </div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-zinc-400 ml-auto" />
                      </a>
                      <a
                        href="https://dexter.cash"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        <Shield className="w-4 h-4 text-zinc-600" />
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-white">
                            Dexter Facilitator
                          </div>
                          <div className="text-xs text-zinc-500">dexter.cash</div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-zinc-400 ml-auto" />
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <StepNumber n={3} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                      Retry with payment header
                    </h3>
                    <CopyBlock
                      label="shell"
                      code={`curl -X POST ${baseUrl}/x402/gas-price-oracle \\
  -H 'Content-Type: application/json' \\
  -H 'X-Payment: <base64-encoded-payment-payload>' \\
  -d '{}'`}
                    />
                    <p className="text-sm text-zinc-500 mt-2">
                      On success the server returns{" "}
                      <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">
                        HTTP 200
                      </code>{" "}
                      with the service response and an{" "}
                      <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">
                        X-Payment-Response
                      </code>{" "}
                      confirmation header.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Service Discovery */}
        <section>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            Service Discovery
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                label: "MCP Services List",
                url: "/mcp/services",
                desc: "MCP-formatted service list with schemas and pricing",
                icon: <Cpu className="w-4 h-4" />,
              },
              {
                label: "x402 Catalog",
                url: "/x402/catalog",
                desc: "Full catalog of 60 x402-compatible services",
                icon: <Globe className="w-4 h-4" />,
              },
              {
                label: "OpenAPI 3.1 Spec",
                url: "/openapi.json",
                desc: "Machine-readable API spec for LangChain / httpx auto-config",
                icon: <Terminal className="w-4 h-4" />,
              },
              {
                label: "WebMCP Manifest",
                url: "/.well-known/webmcp.json",
                desc: "WebMCP protocol manifest for MCP client auto-discovery",
                icon: <Key className="w-4 h-4" />,
              },
              {
                label: "Agent Card (A2A v0.3)",
                url: "/.well-known/agent-card.json",
                desc: "Google A2A compliant agent card with 60 skills",
                icon: <Shield className="w-4 h-4" />,
              },
              {
                label: "AWI Manifest",
                url: "/.well-known/awi.json",
                desc: "Agent Web Interface discovery manifest",
                icon: <Zap className="w-4 h-4" />,
              },
            ].map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <div className="text-blue-600 mt-0.5">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">
                    {item.label}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {item.desc}
                  </div>
                  <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1 truncate">
                    {item.url}
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-1" />
              </a>
            ))}
          </div>
        </section>

        <Separator />

        {/* Support + CTA */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  Get started now
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Free $5 trial key — instant access to all 60 services. No account, no crypto.
                </p>
                <a
                  href="/api/m2m/credits/trial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Get free trial key
                  <ArrowRight className="w-4 h-4" />
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Need help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Stuck on payment integration? Email us. We work directly with MCP developers
                  and can provide sandbox credits and design partner support.
                </p>
                <a
                  href="mailto:support@coinrailz.com"
                  className="inline-flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  support@coinrailz.com
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </CardContent>
            </Card>
          </div>
        </section>

      </div>
    </div>
  );
}
