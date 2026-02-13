import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import {
  ArrowLeft,
  Globe,
  Zap,
  Users,
  Link2,
  TrendingUp,
  Shield,
  ExternalLink,
  Calendar,
  Target,
  Loader2,
  CheckCircle,
  AlertCircle,
  Coins
} from "lucide-react";

interface EvidencePack {
  meetingDate: string;
  daysUntil: number;
  platform: {
    name: string;
    tagline: string;
    x402Services: number;
    chainsSupported: number;
    chainNames: string[];
    tokensSupported: string[];
    protocols: string[];
  };
  outreach: {
    onChainBaseMessages: number;
    directApiSuccesses: number;
    uniqueAgentsContacted: number;
    elizaOSAgentsDiscovered: number;
    lunaSuccessTx: any;
    recentOnChainTxs: any[];
    channels: string[];
    platformBreakdown: any[];
  };
  circleEcosystem: {
    campaign: any;
    targets: Array<{
      name: string;
      type: string;
      status: string;
      channels: string[];
      notes: string;
    }>;
    ecosystemSignals: string[];
  };
  pilots: {
    checkoutSessions: any;
    creditTiers: Array<{
      name: string;
      credits: number;
      price: number;
    }>;
  };
  narrative: {
    positioning: string;
    circleAlignment: string;
    traction: string;
    ask: string;
  };
}

export default function CircleEvidencePage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<EvidencePack | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useSEO({
    title: "Circle Partnership Evidence Pack | Coin Railz",
    description: "Evidence pack for Circle partnership meeting"
  });

  useEffect(() => {
    fetch("/api/circle-evidence/metrics")
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.evidencePack);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center text-white">
        <p>Failed to load evidence pack</p>
      </div>
    );
  }

  const statusColor = (s: string) => {
    if (s === "success" || s === "sent" || s === "identified") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (s.includes("probed") || s.includes("attempted")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex-1" />
          <Badge className="bg-blue-600/30 text-blue-300 border-blue-500/40 text-sm px-3 py-1">
            <Calendar className="w-3 h-3 mr-1" />
            Meeting: {data.meetingDate} ({data.daysUntil} days)
          </Badge>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-full px-4 py-1.5 mb-4">
            <Coins className="w-4 h-4 text-blue-400" />
            <span className="text-blue-300 text-sm font-medium">Circle Partnership Evidence Pack</span>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {data.platform.name}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">{data.platform.tagline}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{data.platform.x402Services}</div>
              <div className="text-sm text-gray-400 mt-1">x402 Services</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-cyan-400">{data.platform.chainsSupported}</div>
              <div className="text-sm text-gray-400 mt-1">Chains Supported</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{data.outreach.onChainBaseMessages}</div>
              <div className="text-sm text-gray-400 mt-1">On-Chain Messages</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">{data.outreach.uniqueAgentsContacted}</div>
              <div className="text-sm text-gray-400 mt-1">Agents Contacted</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-900/60 border-blue-500/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <Target className="w-5 h-5" /> Narrative for Circle
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Positioning</h3>
              <p className="text-white">{data.narrative.positioning}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Circle Alignment</h3>
              <p className="text-white">{data.narrative.circleAlignment}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Traction</h3>
              <p className="text-white">{data.narrative.traction}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Partnership Ask</h3>
              <p className="text-white">{data.narrative.ask}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-400">
                <Globe className="w-5 h-5" /> Multi-Channel Outreach
              </CardTitle>
              <CardDescription className="text-gray-400">
                Evidence of active ecosystem engagement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-gray-300">On-Chain Base Messages</span>
                <span className="font-bold text-green-400">{data.outreach.onChainBaseMessages}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-gray-300">Direct API Successes</span>
                <span className="font-bold text-blue-400">{data.outreach.directApiSuccesses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-gray-300">ElizaOS Agents Found</span>
                <span className="font-bold text-purple-400">{data.outreach.elizaOSAgentsDiscovered}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-300">Active Channels</span>
                <span className="font-bold text-cyan-400">{data.outreach.channels.length}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {data.outreach.channels.map((ch, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-gray-600 text-gray-300">{ch}</Badge>
                ))}
              </div>
              {data.outreach.lunaSuccessTx && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-medium text-sm">Verified On-Chain Success</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Luna Virtuals - {new Date(data.outreach.lunaSuccessTx.created_at).toLocaleDateString()}
                  </p>
                  {data.outreach.lunaSuccessTx.url && (
                    <a href={data.outreach.lunaSuccessTx.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1">
                      <ExternalLink className="w-3 h-3" /> View on BaseScan
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                <Users className="w-5 h-5" /> Circle Ecosystem Targets
              </CardTitle>
              <CardDescription className="text-gray-400">
                High-value targets identified for Circle partnership
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.circleEcosystem.targets.map((t, i) => (
                <div key={i} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">{t.name}</span>
                    <Badge className={`text-xs ${statusColor(t.status)}`}>{t.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{t.type}</p>
                  <p className="text-xs text-gray-300">{t.notes}</p>
                  <div className="flex gap-1 mt-2">
                    {t.channels.map((ch, j) => (
                      <Badge key={j} variant="outline" className="text-xs border-gray-600 text-gray-400">{ch}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-400">
                <Shield className="w-5 h-5" /> Platform Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Supported Chains</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.platform.chainNames.map((c, i) => (
                      <Badge key={i} className="bg-blue-500/20 text-blue-300 border-blue-500/30">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Tokens</h4>
                  <div className="flex gap-2">
                    {data.platform.tokensSupported.map((t, i) => (
                      <Badge key={i} className="bg-green-500/20 text-green-300 border-green-500/30">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Protocols</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.platform.protocols.map((p, i) => (
                      <Badge key={i} className="bg-purple-500/20 text-purple-300 border-purple-500/30">{p}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-400">
                <TrendingUp className="w-5 h-5" /> Ecosystem Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.circleEcosystem.ecosystemSignals.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-gray-800/50 rounded">
                    <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-300">{s}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-900/60 border-gray-700/50 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Zap className="w-5 h-5" /> Pilot Credit Packages
            </CardTitle>
            <CardDescription className="text-gray-400">
              Available for purchase at coinrailz.com/pilots/buy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.pilots.creditTiers.map((tier, i) => (
                <div key={i} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 text-center">
                  <div className="text-lg font-bold text-white">${tier.price.toLocaleString()}</div>
                  <div className="text-sm text-gray-400 mt-1">{tier.credits.toLocaleString()} credits</div>
                  <div className="text-xs text-gray-500 mt-1">{tier.name}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {data.outreach.recentOnChainTxs.length > 0 && (
          <Card className="bg-gray-900/60 border-gray-700/50 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Link2 className="w-5 h-5" /> Recent On-Chain Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.outreach.recentOnChainTxs.slice(0, 5).map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-sm">
                    <span className="text-gray-300 font-mono text-xs truncate max-w-[200px]">{tx.target}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">{new Date(tx.created_at).toLocaleDateString()}</span>
                      {tx.url && (
                        <a href={tx.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-gray-500 text-sm pb-8">
          Generated {new Date().toLocaleDateString()} | coinrailz.com
        </div>
      </div>
    </div>
  );
}
