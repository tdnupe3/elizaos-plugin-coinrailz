import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, CheckCircle, Zap, Globe, Bot, Network, AlertTriangle, TrendingUp, DollarSign, Lock } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const EU_FEATURES = [
  {
    icon: Shield,
    title: "USDC-First by Design",
    desc: "All 60+ services settle in USDC — the only major stablecoin with full MiCA/EMT authorization via Circle EEA. No USDT exposure. No regulatory risk."
  },
  {
    icon: CheckCircle,
    title: "Circle EEA Authorization",
    desc: "USDC is issued by Circle Internet Financial Europe, a fully authorized e-money institution under EU law. Your agents pay with MiCA-compliant rails, not banned tokens."
  },
  {
    icon: Globe,
    title: "EU DePIN & IoT Ready",
    desc: "Pay-per-call IoT data, device registries, and DePIN settlement — all in USDC on Base. Deploy EU-based machine networks without stablecoin compliance risk."
  },
  {
    icon: Bot,
    title: "AI Agent Commerce",
    desc: "60+ x402 microservices payable by any A2A-protocol agent. Satellite data, DeFi analytics, AI inference — agent-to-agent commerce that regulators can work with."
  },
  {
    icon: Network,
    title: "Multi-Chain, MiCA-Safe",
    desc: "Base (EVM) and Solana — both settling in USDC. No algorithmic stablecoins, no USDT fallback. Every payment path is MiCA-safe by construction."
  },
  {
    icon: Lock,
    title: "Built for Compliance Teams",
    desc: "OpenAPI 3.1 spec, full audit trail, on-chain settlement proofs, and CAIP-2 chain identifiers. Everything your compliance team needs to approve deployment."
  }
];

const USDT_IMPACTS = [
  { number: "$17.5B", label: "USDT delisted from EU exchanges" },
  { number: "27", label: "EU countries affected by MiCA enforcement" },
  { number: "Dec 2024", label: "MiCA fully in force — USDT banned" },
  { number: "0", label: "USDT exposure in Coin Railz services" }
];

const USE_CASES = [
  {
    title: "EU AI Agent Platforms",
    description: "If your AI agents operate in the EU and previously used USDT for on-chain settlements, switch to Coin Railz's USDC-settled x402 rails. No code changes — just a different payment endpoint.",
    badge: "🤖 AI Agents"
  },
  {
    title: "DePIN & IoT Networks",
    description: "Machine networks deployed across EU member states need MiCA-compliant micro-settlement. Our device payment infrastructure handles per-call billing in USDC with full audit trails.",
    badge: "🔧 IoT / DePIN"
  },
  {
    title: "Satellite & Environmental Data",
    description: "EU environmental monitoring agencies and climate tech companies: pay for NASA, ESA, and OpenAQ data via USDC x402. No API keys, no USDT, full regulatory clarity.",
    badge: "🛰️ Data Services"
  },
  {
    title: "Enterprise Crypto Treasuries",
    description: "If your treasury held USDT for operational liquidity and needs to rotate into MiCA-compliant alternatives, Coin Railz accepts USDC from any Base or Solana wallet — no signup required.",
    badge: "🏦 Enterprise"
  }
];

export default function MicaCompliancePage() {
  useSEO({
    title: "MiCA-Compliant Payment Infrastructure for EU AI Agents | Coin Railz",
    description: "USDT banned from EU exchanges. Coin Railz is USDC-first — fully MiCA-compliant payment rails for AI agents, IoT networks, and DePIN projects operating in the European Union.",
    keywords: ["MiCA compliant", "USDC EU", "AI agent payments EU", "DePIN MiCA", "stablecoin compliance", "USDT alternative EU"],
    openGraph: {
      title: "MiCA-Native AI Agent Payment Infrastructure | Coin Railz",
      description: "USDT is banned in the EU. Coin Railz was USDC-first from day one. 60+ x402 microservices, MiCA-compliant by design.",
      type: "website"
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.06),transparent_60%)] pointer-events-none" />

      <nav className="border-b border-slate-800/50 px-6 py-4 flex items-center justify-between relative z-10">
        <Link href="/">
          <span className="text-xl font-bold text-white cursor-pointer">Coin Railz</span>
        </Link>
        <div className="flex items-center gap-3">
          <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-sm px-3 py-1">
            ✓ MiCA Compliant
          </Badge>
          <Link href="/x402">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white">
              Browse Services
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative z-10 px-6 pt-20 pb-16 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2 text-sm text-amber-400 mb-8">
          <AlertTriangle className="w-4 h-4" />
          USDT delisted from all EU exchanges — $17.5B affected
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <Badge className="bg-green-500/20 text-green-300 border border-green-500/40 text-base px-4 py-1.5 font-medium">
            ✓ MiCA-Native from Day One
          </Badge>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          The EU Banned USDT.
          <br />
          <span className="text-green-400">We Were Already USDC.</span>
        </h1>

        <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          MiCA's full enforcement delisted Tether from every EU-regulated exchange.
          Coin Railz has been USDC-first since launch — 60+ x402 microservices for AI agents,
          IoT networks, and DePIN projects, all settling in MiCA-authorized stablecoins.
          No migration needed. No regulatory exposure.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/x402">
            <Button size="lg" className="bg-green-600 hover:bg-green-500 text-white font-semibold px-8 w-full sm:w-auto">
              <Zap className="w-5 h-5 mr-2" />
              Browse 60+ MiCA-Compliant Services
            </Button>
          </Link>
          <Link href="/developers">
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 px-8 w-full sm:w-auto">
              API Documentation
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {USDT_IMPACTS.map((stat) => (
            <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
              <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.number}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Why MiCA Compliance Matters for Agents</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            MiCA Title V prohibits EU-licensed exchanges and custodians from offering unauthorized stablecoins.
            Any AI agent or automated system settling in USDT faces growing legal exposure in the EU.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {EU_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="bg-slate-800/30 border-slate-700/50 hover:border-green-500/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-green-400" />
                  </div>
                  <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Who Is Switching to Coin Railz?</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            EU operators who need USDC-settled payment rails, not USDT exposure.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {USE_CASES.map((uc) => (
            <Card key={uc.title} className="bg-slate-800/30 border-slate-700/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                    {uc.badge}
                  </Badge>
                </div>
                <CardTitle className="text-white text-lg">{uc.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm leading-relaxed">{uc.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-green-950/60 to-emerald-950/60 border border-green-800/40 rounded-2xl p-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Shield className="w-8 h-8 text-green-400" />
            <span className="text-2xl font-bold text-white">MiCA-Ready in 60 Seconds</span>
          </div>
          <p className="text-slate-300 max-w-2xl mx-auto mb-8 text-lg">
            Your AI agents can start making MiCA-compliant x402 payments immediately.
            No signup, no USDT, no regulatory risk. $0.05 USDC first call on Base.
          </p>
          <div className="bg-slate-900/60 rounded-xl p-5 max-w-2xl mx-auto mb-8 text-left font-mono text-sm">
            <div className="text-slate-500 mb-2"># First MiCA-compliant agent payment</div>
            <div className="text-green-400">GET https://coinrailz.com/x402/first-call</div>
            <div className="text-slate-500 mt-2"># Pay $0.05 USDC on Base via x402 — no API key</div>
            <div className="text-slate-500"># Returns live multi-chain payment routing data</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/x402">
              <Button size="lg" className="bg-green-600 hover:bg-green-500 text-white font-semibold px-8 w-full sm:w-auto">
                <TrendingUp className="w-5 h-5 mr-2" />
                Explore All 60+ Services
              </Button>
            </Link>
            <Link href="/mcp-integration-guide">
              <Button size="lg" variant="outline" className="border-green-700 text-green-300 hover:bg-green-950/50 px-8 w-full sm:w-auto">
                MCP Integration Guide
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 py-12 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-slate-400 text-sm">
              © 2026 Coin Railz. USDC settlement on Base and Solana.
              Circle EEA authorized — MiCA EMT compliant.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/x402"><span className="text-slate-400 hover:text-white cursor-pointer">Services</span></Link>
            <Link href="/developers"><span className="text-slate-400 hover:text-white cursor-pointer">Developers</span></Link>
            <Link href="/"><span className="text-slate-400 hover:text-white cursor-pointer">Home</span></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
