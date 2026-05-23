import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Target,
  TrendingUp,
  Users,
  Zap,
  ExternalLink,
  RefreshCw,
  Filter,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface Operator {
  domain: string;
  wallet: string;
  url: string;
  avgPrice: number | null;
  serviceCount: number;
  networks: string[];
  description: string;
  probeStatus: number | null;
  reachability: string | null;
  buyerScore: number;
  likelyPureProvider: boolean;
  cluster: string;
  discoveredAt: string;
}

interface ClusterSummary {
  cluster: string;
  total: number;
  buyers: number;
  strongLeads: number;
  liveEndpoints: number;
}

interface BuyerAnalysisData {
  ok: boolean;
  totalOperators: number;
  totalDomains: number;
  buyerLeads: number;
  strongLeads: number;
  confirmedPayers: number;
  clusters: ClusterSummary[];
  operators: Operator[];
  generatedAt: string;
}

const CLUSTER_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  "questflow-swarm":       { label: "Questflow Swarm",        color: "bg-purple-500/20 text-purple-300 border-purple-500/30",  desc: "AI agent orchestration platform — multi-agent workflows consuming APIs" },
  "intelligence-analytics":{ label: "Intelligence & Analytics",color: "bg-blue-500/20 text-blue-300 border-blue-500/30",       desc: "Market signals, predictions, research agents — need raw data feeds" },
  "defi-trading":          { label: "DeFi / Trading",          color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", desc: "Trading bots, DEX agents, portfolio tools — high data dependency" },
  "nation-fun-agents":     { label: "Nation.fun Agents",       color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", desc: "Autonomous agents on nation.fun — registered, live, on Base" },
  "security-risk":         { label: "Security / Risk",         color: "bg-red-500/20 text-red-300 border-red-500/30",          desc: "Smart contract audits, risk scoring — need on-chain data" },
  "prediction-markets":    { label: "Prediction Markets",      color: "bg-orange-500/20 text-orange-300 border-orange-500/30", desc: "Sports betting, odds arbitrage — potential market data buyers" },
  "web-data":              { label: "Web / Search",            color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",       desc: "Web search, crawlers — peers rather than buyers" },
  "ai-media":              { label: "AI Media / Creative",     color: "bg-pink-500/20 text-pink-300 border-pink-500/30",       desc: "Image/video generation — less likely to need our services" },
  "other":                 { label: "Other",                   color: "bg-gray-500/20 text-gray-300 border-gray-500/30",       desc: "Unclassified operators" },
};

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 55) return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (score >= 40) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  return "bg-gray-500/20 text-gray-400 border-gray-500/30";
};

const SERVICE_MATCH: Record<string, string[]> = {
  "questflow-swarm":        ["AI Inference", "Market Data", "Token Analytics"],
  "intelligence-analytics": ["Market Data", "Token Analytics", "Satellite Data", "Prediction Markets"],
  "defi-trading":           ["DEX Aggregation", "Token Analytics", "Market Data", "Smart Contract Audit"],
  "nation-fun-agents":      ["Market Data", "Weather Data", "AI Inference", "Token Analytics"],
  "security-risk":          ["Smart Contract Audit", "Token Analytics", "On-Chain Data"],
  "prediction-markets":     ["Prediction Markets", "Market Data"],
  "web-data":               ["AI Inference", "Market Data"],
  "ai-media":               ["AI Inference"],
  "other":                  ["Market Data"],
};

type SortKey = "buyerScore" | "avgPrice" | "serviceCount" | "domain" | "discoveredAt";

export default function BuyerAnalysis() {
  const [selectedCluster, setSelectedCluster] = useState("all");
  const [minScore, setMinScore] = useState(40);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("buyerScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error, refetch, isFetching } = useQuery<BuyerAnalysisData>({
    queryKey: ["/api/discovery/buyer-analysis"],
    staleTime: 5 * 60 * 1000,
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="ml-1 text-gray-600">↕</span>;
    return sortDir === "desc"
      ? <ChevronDown className="ml-1 h-3 w-3 inline text-blue-400" />
      : <ChevronUp   className="ml-1 h-3 w-3 inline text-blue-400" />;
  };

  const filteredOps = (data?.operators ?? [])
    .filter(op => {
      if (selectedCluster !== "all" && op.cluster !== selectedCluster) return false;
      if (op.buyerScore < minScore) return false;
      if (search) {
        const q = search.toLowerCase();
        return op.domain.toLowerCase().includes(q) ||
               op.description.toLowerCase().includes(q) ||
               op.wallet.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "buyerScore":   av = a.buyerScore;     bv = b.buyerScore;     break;
        case "avgPrice":     av = a.avgPrice ?? 0;  bv = b.avgPrice ?? 0;  break;
        case "serviceCount": av = a.serviceCount;   bv = b.serviceCount;   break;
        case "domain":       av = a.domain;         bv = b.domain;         return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        case "discoveredAt": av = a.discoveredAt;   bv = b.discoveredAt;   break;
        default:             av = 0;                bv = 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const totalClusters = data?.clusters ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-emerald-400" />
              Bazaar Buyer Analysis
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {data
                ? `${data.totalOperators} unique operators across ${data.totalDomains} domains — scored for likelihood to buy Coin Railz services`
                : "Scoring 607 x402-Bazaar operators for buyer intent…"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-gray-700 text-gray-300 hover:text-white shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Honest context banner */}
        <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-4 text-sm text-amber-200">
          <strong className="text-amber-300">What this is:</strong> Buyer score derived from operator metadata —
          service focus, price range, description keywords, multi-chain presence, and live endpoint status.
          {" "}<strong>0 Bazaar wallets have ever paid us</strong> — these are cold leads ranked by fit, not confirmed buyers.
          Scores do not guarantee purchase intent.
        </div>

        {error && (
          <Card className="bg-red-950 border-red-800">
            <CardContent className="pt-4">
              <p className="text-red-300 text-sm">Error: {(error as Error).message}</p>
            </CardContent>
          </Card>
        )}

        {/* KPI strip */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Operators",  value: data.totalOperators, icon: Users,      color: "text-blue-400" },
              { label: "Potential Buyers", value: data.buyerLeads,     icon: TrendingUp, color: "text-emerald-400" },
              { label: "Strong Leads (≥55)",value: data.strongLeads,   icon: Target,     color: "text-yellow-400" },
              { label: "Confirmed Payers", value: data.confirmedPayers,icon: Zap,        color: "text-purple-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wide flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 px-4">
                  <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Cluster breakdown */}
        {data && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Buyer Clusters
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {totalClusters.map(c => {
                const meta = CLUSTER_LABELS[c.cluster] ?? { label: c.cluster, color: "bg-gray-500/20 text-gray-300 border-gray-500/30", desc: "" };
                const matches = SERVICE_MATCH[c.cluster] ?? [];
                const isActive = selectedCluster === c.cluster;
                return (
                  <button
                    key={c.cluster}
                    onClick={() => setSelectedCluster(isActive ? "all" : c.cluster)}
                    className={`text-left p-4 rounded-lg border transition-all ${meta.color} ${isActive ? "ring-2 ring-white/20" : "hover:ring-1 hover:ring-white/10"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{meta.label}</span>
                      <span className="text-xs opacity-70">{c.strongLeads} strong leads</span>
                    </div>
                    <p className="text-xs opacity-60 mb-2 leading-relaxed">{meta.desc}</p>
                    <div className="flex gap-3 text-xs">
                      <span>{c.buyers} buyers</span>
                      <span>·</span>
                      <span>{c.total} total</span>
                    </div>
                    {matches.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {matches.map(m => (
                          <span key={m} className="text-xs bg-black/20 px-1.5 py-0.5 rounded">
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        {data && (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-400">Min score:</span>
              {[0, 40, 55, 70].map(s => (
                <button
                  key={s}
                  onClick={() => setMinScore(s)}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    minScore === s
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  {s === 0 ? "All" : `≥${s}`}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search domain, description, wallet…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-100 text-sm h-8"
              />
            </div>
            {(selectedCluster !== "all" || search) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSelectedCluster("all"); setSearch(""); }}
                className="text-gray-400 hover:text-white h-8 text-xs"
              >
                Clear filters
              </Button>
            )}
            <span className="text-xs text-gray-500 ml-auto">
              Showing {filteredOps.length} operators
            </span>
          </div>
        )}

        {/* Operator table */}
        {data && filteredOps.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead
                        className="text-gray-400 cursor-pointer hover:text-white select-none"
                        onClick={() => toggleSort("domain")}
                      >
                        Domain <SortIcon k="domain" />
                      </TableHead>
                      <TableHead className="text-gray-400 max-w-xs">Description</TableHead>
                      <TableHead className="text-gray-400">Cluster</TableHead>
                      <TableHead
                        className="text-gray-400 cursor-pointer hover:text-white select-none text-right"
                        onClick={() => toggleSort("buyerScore")}
                      >
                        Score <SortIcon k="buyerScore" />
                      </TableHead>
                      <TableHead
                        className="text-gray-400 cursor-pointer hover:text-white select-none text-right"
                        onClick={() => toggleSort("avgPrice")}
                      >
                        Avg Price <SortIcon k="avgPrice" />
                      </TableHead>
                      <TableHead className="text-gray-400">Networks</TableHead>
                      <TableHead
                        className="text-gray-400 cursor-pointer hover:text-white select-none text-right"
                        onClick={() => toggleSort("discoveredAt")}
                      >
                        Discovered <SortIcon k="discoveredAt" />
                      </TableHead>
                      <TableHead className="text-gray-400 w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOps.map((op, idx) => {
                      const clusterMeta = CLUSTER_LABELS[op.cluster] ?? CLUSTER_LABELS["other"];
                      const networksShort = (op.networks ?? [])
                        .map((n: string) => {
                          if (n.includes("8453") || n === "base") return "Base";
                          if (n.includes("137") || n === "polygon") return "Polygon";
                          if (n.includes("42161") || n === "arbitrum") return "Arbitrum";
                          if (n.includes("solana") || n === "solana") return "SOL";
                          if (n.includes("1187947933")) return "SKALE";
                          if (n.includes("keeta")) return "Keeta";
                          if (n === "base-sepolia") return "Base-Test";
                          if (n.includes("eip155:1")) return "ETH";
                          return n.split(":")[0];
                        })
                        .filter((v, i, a) => a.indexOf(v) === i);

                      return (
                        <TableRow key={`${op.wallet}-${idx}`} className="border-gray-800 hover:bg-gray-800/50">
                          <TableCell className="font-mono text-xs text-gray-300 max-w-[180px] truncate">
                            {op.domain}
                          </TableCell>
                          <TableCell className="text-xs text-gray-400 max-w-xs">
                            <p className="line-clamp-2 leading-relaxed">
                              {op.description || <span className="text-gray-600 italic">No description</span>}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${clusterMeta.color} border`}>
                              {clusterMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={`text-xs font-bold ${SCORE_COLOR(op.buyerScore)} border`}>
                              {op.buyerScore}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-gray-400 tabular-nums">
                            {op.avgPrice !== null ? `$${op.avgPrice.toFixed(4)}` : <span className="text-gray-600">—</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {networksShort.slice(0, 3).map(n => (
                                <span key={n} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                                  {n}
                                </span>
                              ))}
                              {networksShort.length > 3 && (
                                <span className="text-xs text-gray-600">+{networksShort.length - 3}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-gray-500 tabular-nums">
                            {op.discoveredAt ? new Date(op.discoveredAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            <a
                              href={`https://${op.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-600 hover:text-blue-400 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {data && filteredOps.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No operators match the current filters.</p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3 text-gray-400"
              onClick={() => { setSelectedCluster("all"); setMinScore(0); setSearch(""); }}
            >
              Reset filters
            </Button>
          </div>
        )}

        {/* Footer note */}
        {data && (
          <p className="text-xs text-gray-600 text-center pb-4">
            Generated {new Date(data.generatedAt).toLocaleString()} · Scores are heuristic-based, not predictive · {data.totalOperators} operators from x402-Bazaar corpus
          </p>
        )}
      </div>
    </div>
  );
}
