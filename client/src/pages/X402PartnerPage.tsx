import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSEO } from "@/hooks/useSEO";
import { ArrowRight, Globe, Zap, Shield, BarChart3, Mail } from "lucide-react";

export default function X402PartnerPage() {
  useSEO({
    title: "x402 Ecosystem Partner | Coin Railz",
    description: "Join the x402 ecosystem. 60 services, 14 categories, 6 NASA/ESA satellite data products. Cross-promote, integrate, and grow together.",
    keywords: "x402, partner, ecosystem, AI agent payments, Coinbase Bazaar, USDC micropayments",
    ogTitle: "x402 Ecosystem Partner — Coin Railz",
    ogDescription: "60 pay-per-call APIs across 14 categories. Let's cross-promote and grow the agent economy together.",
  });

  const stats = [
    { label: "Pay-Per-Call APIs", value: "60", sub: "across 14 categories" },
    { label: "Satellite APIs", value: "6", sub: "NASA + ESA data" },
    { label: "Agents Discovered", value: "2,800+", sub: "via Bazaar indexing" },
    { label: "x402 Challenges", value: "23K+", sub: "402 responses served" },
  ];

  const offerings = [
    {
      icon: Globe,
      title: "Cross-Promotion",
      description: "Feature your x402 services in our catalog. We feature ours in yours. More discovery for both."
    },
    {
      icon: Zap,
      title: "Satellite Data APIs",
      description: "6 NASA/ESA data products your agents can consume today — fire alerts, weather imagery, vegetation, flood detection, air quality, land use."
    },
    {
      icon: Shield,
      title: "Multi-Chain Settlement",
      description: "USDC/USDT across Base, Ethereum, Polygon, Arbitrum. Same-chain settlement, no bridging required."
    },
    {
      icon: BarChart3,
      title: "Payment Routing",
      description: "Our infrastructure can route agent traffic to your services. More volume, more revenue for your endpoints."
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-4">
              x402 Ecosystem
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Let's Grow the Agent Economy Together
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Coin Railz runs 60 pay-per-call APIs on Base and Ethereum. We found your services on Bazaar and think there's an opportunity to collaborate.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-3xl font-bold text-blue-400">{stat.value}</div>
                <div className="text-sm font-medium text-white mt-1">{stat.label}</div>
                <div className="text-xs text-gray-500 mt-1">{stat.sub}</div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-center mb-8">What We Bring to the Table</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {offerings.map((item) => (
              <Card key={item.title} className="bg-white/5 border-white/10 text-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-6 h-6 text-blue-400" />
                    <CardTitle className="text-lg text-white">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-white/5 border-white/10 mb-16">
            <CardHeader className="text-center">
              <CardTitle className="text-xl text-white">Try Our APIs Right Now</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-black/30 font-mono text-sm">
                  <div className="text-gray-500 mb-2">Full service catalog:</div>
                  <a href="/api/x402/catalog" target="_blank" className="text-blue-400 hover:underline break-all">
                    coinrailz.com/api/x402/catalog
                  </a>
                </div>
                <div className="p-4 rounded-lg bg-black/30 font-mono text-sm">
                  <div className="text-gray-500 mb-2">Free satellite demo:</div>
                  <a href="/api/satellite/fire-alerts?demo=true" target="_blank" className="text-blue-400 hover:underline break-all">
                    coinrailz.com/api/satellite/fire-alerts?demo=true
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
            <Mail className="w-10 h-10 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-3">Let's Talk</h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Whether it's cross-promotion, API integration, or co-marketing — we're interested in any way we can grow the x402 ecosystem together.
            </p>
            <a href="mailto:support@coinrailz.com?subject=x402%20Partnership%20Inquiry">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Mail className="w-4 h-4 mr-2" />
                support@coinrailz.com
              </Button>
            </a>
            <div className="mt-4 flex gap-4 justify-center">
              <Link href="/x402">
                <Button variant="ghost" className="text-gray-400 hover:text-white">
                  x402 Documentation <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" className="text-gray-400 hover:text-white">
                  About Coin Railz <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
