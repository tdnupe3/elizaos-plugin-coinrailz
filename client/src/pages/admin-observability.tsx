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
import { Activity, TrendingUp, Zap, Clock, Lock } from "lucide-react";

interface ObservabilityData {
  ok: boolean;
  window_days: number;
  generated_at: string;
  x402: {
    total_interactions: number;
    paid_count: number;
    payment_required: number;
    success_count: number;
    revenue_usd: string;
    avg_payment_usd: string;
    conversion_rate: string;
  };
  top_services: Array<{ service: string; hits: number; paid: number }>;
  top_endpoints: Array<{
    endpoint: string;
    hits: number;
    avg_ms: number;
    ok_count: number;
    error_count: number;
  }>;
  payment_intents: {
    by_status: Array<{ status: string; network: string; count: number; total_usd: string }>;
    recent: Array<{
      id: string;
      service: string;
      payer: string;
      amount_usd: string;
      status: string;
      network: string;
      created_at: string;
    }>;
  };
}

async function fetchObservability(adminKey: string, days: number): Promise<ObservabilityData> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminKey) headers["x-admin-key"] = adminKey;

  const res = await fetch(`/api/admin/observability?days=${days}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export default function AdminObservabilityPage() {
  const [adminKey, setAdminKey] = useState("");
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const { data, isLoading, error, refetch } = useQuery<ObservabilityData, Error>({
    queryKey: ["/api/admin/observability", submittedKey, days],
    queryFn: () => fetchObservability(submittedKey ?? "", days),
    enabled: submittedKey !== null,
    retry: false,
    refetchInterval: 60_000,
  });

  function handleLoad() {
    setSubmittedKey(adminKey);
  }

  const statusColor = (status: string) => {
    if (status === "completed" || status === "confirmed") return "default";
    if (status === "pending") return "secondary";
    return "destructive";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-400" />
              Observability Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Real-time platform telemetry — x402 interactions, endpoint hits, payment intents
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
              value={days}
              onChange={e => setDays(Number(e.target.value))}
            >
              <option value={1}>Last 24h</option>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={submittedKey === null}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Auth gate */}
        {submittedKey === null && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-6">
                <Lock className="w-10 h-10 text-gray-500" />
                <p className="text-gray-400 text-sm">
                  Enter your admin key (X-Admin-Key), or leave blank if running in dev mode.
                </p>
                <div className="flex gap-3 w-full max-w-sm">
                  <Input
                    type="password"
                    placeholder="Admin key (optional in dev)"
                    value={adminKey}
                    onChange={e => setAdminKey(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLoad()}
                    className="bg-gray-800 border-gray-700 text-gray-100"
                  />
                  <Button onClick={handleLoad}>Load</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && (
          <Card className="bg-red-950 border-red-800">
            <CardContent className="pt-6">
              <p className="text-red-300 text-sm font-medium">Error: {error.message}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => { setSubmittedKey(null); setAdminKey(""); }}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Data */}
        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    Total Interactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">
                    {data.x402.total_interactions.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">last {data.window_days}d</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wide flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-emerald-400">
                    ${Number(data.x402.revenue_usd).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">USDC collected</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wide flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Conversion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-400">
                    {data.x402.conversion_rate}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {data.x402.paid_count} paid of {data.x402.total_interactions}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wide flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Avg Payment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-purple-400">
                    ${Number(data.x402.avg_payment_usd).toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">per paid call</p>
                </CardContent>
              </Card>
            </div>

            {/* Top services + endpoints side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top services */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-sm text-gray-200">Top x402 Services (by hits)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400 text-xs">Service</TableHead>
                        <TableHead className="text-gray-400 text-xs text-right">Hits</TableHead>
                        <TableHead className="text-gray-400 text-xs text-right">Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_services.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-gray-500 text-sm py-6">
                            No service data in this window
                          </TableCell>
                        </TableRow>
                      ) : data.top_services.map((s) => (
                        <TableRow key={s.service} className="border-gray-800">
                          <TableCell className="text-gray-200 text-sm font-mono py-2">
                            {s.service}
                          </TableCell>
                          <TableCell className="text-right text-gray-300 text-sm py-2">
                            {s.hits.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <Badge variant={s.paid > 0 ? "default" : "secondary"} className="text-xs">
                              {s.paid}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Top endpoints */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-sm text-gray-200">Top Endpoints (by hits)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400 text-xs">Endpoint</TableHead>
                        <TableHead className="text-gray-400 text-xs text-right">Hits</TableHead>
                        <TableHead className="text-gray-400 text-xs text-right">Avg ms</TableHead>
                        <TableHead className="text-gray-400 text-xs text-right">Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_endpoints.map((e) => (
                        <TableRow key={e.endpoint} className="border-gray-800">
                          <TableCell className="text-gray-200 text-xs font-mono py-2 max-w-[180px] truncate">
                            {e.endpoint}
                          </TableCell>
                          <TableCell className="text-right text-gray-300 text-sm py-2">
                            {e.hits.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-gray-400 text-sm py-2">
                            {e.avg_ms}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {e.error_count > 0
                              ? <Badge variant="destructive" className="text-xs">{e.error_count}</Badge>
                              : <span className="text-gray-600 text-xs">—</span>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Payment intents */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* By status */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-sm text-gray-200">Payment Intents by Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.payment_intents.by_status.length === 0 ? (
                    <p className="text-gray-500 text-sm">No payment intents in this window</p>
                  ) : data.payment_intents.by_status.map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={statusColor(s.status)} className="text-xs capitalize">
                          {s.status}
                        </Badge>
                        <span className="text-gray-500 text-xs">{s.network}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-200 text-sm font-medium">{s.count}</span>
                        <span className="text-gray-500 text-xs ml-2">${s.total_usd}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent payment intents */}
              <Card className="bg-gray-900 border-gray-800 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm text-gray-200">Recent Payment Intents</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400 text-xs">Service</TableHead>
                        <TableHead className="text-gray-400 text-xs">Network</TableHead>
                        <TableHead className="text-gray-400 text-xs text-right">Amount</TableHead>
                        <TableHead className="text-gray-400 text-xs">Status</TableHead>
                        <TableHead className="text-gray-400 text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.payment_intents.recent.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-500 text-sm py-6">
                            No payment intents in this window
                          </TableCell>
                        </TableRow>
                      ) : data.payment_intents.recent.map((p) => (
                        <TableRow key={p.id} className="border-gray-800">
                          <TableCell className="text-gray-200 text-xs font-mono py-2">
                            {p.service ?? "—"}
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs py-2">
                            {p.network}
                          </TableCell>
                          <TableCell className="text-right text-emerald-400 text-xs py-2">
                            ${p.amount_usd}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant={statusColor(p.status)} className="text-xs capitalize">
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-500 text-xs py-2">
                            {new Date(p.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <p className="text-gray-600 text-xs text-right">
              Generated {new Date(data.generated_at).toLocaleString()} · Auto-refreshes every 60s
            </p>
          </>
        )}
      </div>
    </div>
  );
}
