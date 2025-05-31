import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Send, Wallet, AlertCircle, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import TransactionFlowOrchestrator from "@/components/TransactionFlowOrchestrator";

const DEMO_CRYPTO_HOLDINGS = {
  BTC: { name: "Bitcoin", balance: "0.05673421", symbol: "₿", network: "Bitcoin", fee: "0.00015000" },
  ETH: { name: "Ethereum", balance: "1.23456789", symbol: "Ξ", network: "Ethereum", fee: "0.00210000" },
  ADA: { name: "Cardano", balance: "2847.50000000", symbol: "₳", network: "Cardano", fee: "0.17000000" },
  SOL: { name: "Solana", balance: "15.75000000", symbol: "◎", network: "Solana", fee: "0.00025000" },
  USDC: { name: "USD Coin", balance: "500.00000000", symbol: "$", network: "Ethereum", fee: "0.00250000" }
};

const TRANSFER_STATUSES = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  CONFIRMED: { label: "Confirmed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800", icon: AlertCircle }
};

export default function DemoCryptoTransfer() {
  const [, setLocation] = useLocation();
  const [selectedCrypto, setSelectedCrypto] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferStatus, setTransferStatus] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [transfers, setTransfers] = useState([
    {
      id: 1,
      crypto: "BTC",
      amount: "0.01000000",
      recipient: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      status: "CONFIRMED",
      hash: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      date: "2025-01-30",
      network: "Bitcoin"
    },
    {
      id: 2,
      crypto: "ETH",
      amount: "0.25000000",
      recipient: "0x742d35Cc6634C0532925a3b8D403d...559e7",
      status: "PENDING",
      hash: "0xf86c85af2c4b36c72f986b67a9d5e9f8c4b1e2f3a4d5c6b7e8f90a1b2c3d4e5f6",
      date: "2025-01-30",
      network: "Ethereum"
    }
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTransferStatus("PENDING");

    // Simulate blockchain processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Generate mock transaction hash
    const mockHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    setTransactionHash(mockHash);

    // Add to transfers
    const newTransfer = {
      id: transfers.length + 1,
      crypto: selectedCrypto,
      amount: amount,
      recipient: recipientAddress,
      status: "CONFIRMED",
      hash: mockHash,
      date: new Date().toISOString().split('T')[0],
      network: DEMO_CRYPTO_HOLDINGS[selectedCrypto as keyof typeof DEMO_CRYPTO_HOLDINGS]?.network || ""
    };

    setTransfers(prev => [newTransfer, ...prev]);
    setTransferStatus("CONFIRMED");
    setIsSubmitting(false);

    // Reset form after 5 seconds
    setTimeout(() => {
      setTransferStatus("");
      setTransactionHash("");
      setAmount("");
      setRecipientAddress("");
      setMemo("");
      setSelectedCrypto("");
    }, 5000);
  };

  const getNetworkFee = () => {
    if (!selectedCrypto) return "0.00000000";
    return DEMO_CRYPTO_HOLDINGS[selectedCrypto as keyof typeof DEMO_CRYPTO_HOLDINGS]?.fee || "0.00000000";
  };

  const validateAddress = (address: string, crypto: string) => {
    if (!address || !crypto) return true;
    
    const patterns = {
      BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
      ETH: /^0x[a-fA-F0-9]{40}$/,
      ADA: /^addr1[a-z0-9]+$/,
      SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      USDC: /^0x[a-fA-F0-9]{40}$/
    };

    return patterns[crypto as keyof typeof patterns]?.test(address) || false;
  };

  const isValidTransfer = () => {
    if (!selectedCrypto || !recipientAddress || !amount) return false;
    if (!validateAddress(recipientAddress, selectedCrypto)) return false;
    
    const balance = parseFloat(DEMO_CRYPTO_HOLDINGS[selectedCrypto as keyof typeof DEMO_CRYPTO_HOLDINGS]?.balance || "0");
    const transferAmount = parseFloat(amount);
    const fee = parseFloat(getNetworkFee());
    
    return transferAmount > 0 && (transferAmount + fee) <= balance;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/demo-dashboard")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transfer Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Send className="w-5 h-5" />
                <span>Send Cryptocurrency</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Cryptocurrency</Label>
                  <Select value={selectedCrypto} onValueChange={setSelectedCrypto} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose crypto to send" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEMO_CRYPTO_HOLDINGS).map(([symbol, data]) => (
                        <SelectItem key={symbol} value={symbol}>
                          <div className="flex justify-between w-full items-center">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-blue-600">{data.symbol}</span>
                              <span>{data.name}</span>
                            </div>
                            <span className="text-sm text-gray-500">{data.balance}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Recipient Address</Label>
                  <Input
                    placeholder="Enter wallet address"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className={`${recipientAddress && !validateAddress(recipientAddress, selectedCrypto) ? 'border-red-500' : ''}`}
                    required
                  />
                  {recipientAddress && !validateAddress(recipientAddress, selectedCrypto) && (
                    <p className="text-sm text-red-600">Invalid address format for {selectedCrypto}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    placeholder="0.00000000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.00000001"
                    min="0.00000001"
                    required
                  />
                  {selectedCrypto && (
                    <div className="text-sm text-gray-600">
                      Available: {DEMO_CRYPTO_HOLDINGS[selectedCrypto as keyof typeof DEMO_CRYPTO_HOLDINGS]?.balance || "0"} {selectedCrypto}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Memo (Optional)</Label>
                  <Input
                    placeholder="Transaction note"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    maxLength={100}
                  />
                </div>

                {selectedCrypto && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Network:</span>
                      <span className="font-medium">{DEMO_CRYPTO_HOLDINGS[selectedCrypto as keyof typeof DEMO_CRYPTO_HOLDINGS]?.network}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Network Fee:</span>
                      <span className="font-medium">{getNetworkFee()} {selectedCrypto}</span>
                    </div>
                    {amount && (
                      <div className="flex justify-between text-sm font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>{(parseFloat(amount) + parseFloat(getNetworkFee())).toFixed(8)} {selectedCrypto}</span>
                      </div>
                    )}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!isValidTransfer() || isSubmitting}
                >
                  {isSubmitting ? "Processing..." : "Send Cryptocurrency"}
                </Button>
              </form>

              {transferStatus && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {transferStatus === "PENDING" && "Transaction submitted to blockchain..."}
                    {transferStatus === "CONFIRMED" && (
                      <div className="space-y-2">
                        <div>Transfer confirmed!</div>
                        {transactionHash && (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs">Hash:</span>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{transactionHash.substring(0, 20)}...</code>
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Transfer History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wallet className="w-5 h-5" />
                <span>Recent Transfers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transfers.map((transfer) => {
                  const StatusIcon = TRANSFER_STATUSES[transfer.status as keyof typeof TRANSFER_STATUSES].icon;
                  return (
                    <div key={transfer.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-blue-600">
                            {DEMO_CRYPTO_HOLDINGS[transfer.crypto as keyof typeof DEMO_CRYPTO_HOLDINGS]?.symbol}
                          </span>
                          <span className="font-medium">{transfer.crypto}</span>
                        </div>
                        <Badge className={TRANSFER_STATUSES[transfer.status as keyof typeof TRANSFER_STATUSES].color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {TRANSFER_STATUSES[transfer.status as keyof typeof TRANSFER_STATUSES].label}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount:</span>
                          <span className="font-medium">{transfer.amount} {transfer.crypto}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">To:</span>
                          <span className="font-mono text-xs">{transfer.recipient.substring(0, 20)}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Network:</span>
                          <span>{transfer.network}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Date:</span>
                          <span>{transfer.date}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>Hash:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded">{transfer.hash.substring(0, 16)}...</code>
                        <Button variant="ghost" size="sm" className="h-auto p-1">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}