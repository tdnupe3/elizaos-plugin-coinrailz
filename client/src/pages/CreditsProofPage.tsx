import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, FileText, DollarSign, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

interface ProofTransaction {
  id: string;
  type: string;
  amount: number;
  source: string;
  description: string;
  createdAt: string;
  idempotencyKey?: string;
}

interface CreditsProof {
  ownerType: string;
  ownerId: string;
  currentBalance: number;
  totalDeposits: number;
  totalDeductions: number;
  transactionCount: number;
  transactions: ProofTransaction[];
}

export default function CreditsProofPage() {
  const [, setLocation] = useLocation();
  const [ownerType, setOwnerType] = useState<string>("iot_account");
  const [ownerId, setOwnerId] = useState<string>("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  useSEO({
    title: "Credits Ledger Proof | Balance Verification | Coin Railz",
    description: "View detailed credits balance breakdown with full transaction history and audit trail.",
    keywords: "credits proof, balance verification, transaction history, audit trail, IoT billing proof",
    canonical: "https://coinrailz.com/credits/proof",
    ogTitle: "Credits Ledger Proof | Coin Railz",
    ogDescription: "Complete balance breakdown with deposits, deductions, and transaction history.",
    twitterTitle: "Credits Ledger Proof | Coin Railz",
    twitterDescription: "View credits balance proof with full audit trail.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "WebApplication",
      "name": "Coin Railz Credits Proof",
      "description": "Credits ledger proof and balance verification tool",
      "url": "https://coinrailz.com/credits/proof",
      "applicationCategory": "FinanceApplication"
    }
  });

  const { data: proofData, isLoading, error, refetch } = useQuery<CreditsProof>({
    queryKey: ['/api/credits/unified/proof', ownerType, ownerId],
    queryFn: async () => {
      if (!ownerId) throw new Error("Owner ID required");
      const response = await fetch(`/api/credits/unified/proof/${ownerType}/${ownerId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch proof");
      }
      return response.json();
    },
    enabled: searchTriggered && !!ownerId,
    retry: false
  });

  const handleSearch = () => {
    if (ownerId) {
      setSearchTriggered(true);
      refetch();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/iot/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Credits Ledger Proof</h1>
          <p className="text-slate-600">View complete balance breakdown with audit trail</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Look Up Account
            </CardTitle>
            <CardDescription>Enter owner details to view credits proof</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Select value={ownerType} onValueChange={setOwnerType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Owner Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iot_account">IoT Account</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Owner ID (e.g., acc_abc123)"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Button onClick={handleSearch} disabled={!ownerId || isLoading}>
                {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                {isLoading ? "Loading..." : "View Proof"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{(error as Error).message}</p>
            </CardContent>
          </Card>
        )}

        {proofData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Current Balance</p>
                      <p className="text-2xl font-bold text-emerald-600">{formatCurrency(proofData.currentBalance)}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Deposits</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(proofData.totalDeposits)}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Total Deductions</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(proofData.totalDeductions)}</p>
                    </div>
                    <TrendingDown className="w-8 h-8 text-red-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Transactions</p>
                      <p className="text-2xl font-bold text-slate-700">{proofData.transactionCount}</p>
                    </div>
                    <FileText className="w-8 h-8 text-slate-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Complete audit trail of all credits movements</CardDescription>
              </CardHeader>
              <CardContent>
                {proofData.transactions && proofData.transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proofData.transactions.map((tx, idx) => (
                        <TableRow key={tx.id || idx}>
                          <TableCell className="text-sm text-slate-500">
                            {formatDate(tx.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.type === 'deposit' ? 'default' : 'secondary'}>
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{tx.source}</TableCell>
                          <TableCell className="text-sm text-slate-600">{tx.description}</TableCell>
                          <TableCell className={`text-right font-mono ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-slate-500 py-8">No transactions found for this account.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!searchTriggered && !proofData && (
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">Enter Account Details</h3>
                <p className="text-slate-500">Select owner type and enter the owner ID to view credits proof</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
