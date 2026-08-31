import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Key,
  Copy,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
  Zap,
  Wallet,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface APIKey {
  id: string;
  keyPrefix: string;
  name: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
  rateLimit: number;
}

export default function APIKeysPage() {
  const { toast } = useToast();
  const [keyName, setKeyName] = useState('');
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  
  // Instant API Key verification flow state
  const [txHash, setTxHash] = useState('');
  const [selectedChain, setSelectedChain] = useState<'base' | 'solana'>('base');
  const [verificationState, setVerificationState] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [instantApiKey, setInstantApiKey] = useState('');
  const [starterCredits, setStarterCredits] = useState(0);

  const { data: keysData, isLoading } = useQuery<{ keys: APIKey[] }>({
    queryKey: ['/api/api-keys'],
  });

  const generateMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest('/api/api-keys/generate', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      setNewKey(data.apiKey);
      setShowNewKeyDialog(true);
      setKeyName('');
      toast({
        title: "API Key Generated",
        description: "Copy your new API key now - it won't be shown again!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate API key",
        variant: "destructive"
      });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiRequest(`/api/api-keys/${keyId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      toast({
        title: "API Key Revoked",
        description: "The API key has been permanently revoked",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Revocation Failed",
        description: error.message || "Failed to revoke API key",
        variant: "destructive"
      });
    }
  });

  const handleGenerate = () => {
    if (!keyName.trim()) {
      toast({
        title: "Name Required",
        description: "Please provide a name for your API key",
        variant: "destructive"
      });
      return;
    }
    generateMutation.mutate(keyName);
  };

  const handleRevoke = (keyId: string) => {
    revokeMutation.mutate(keyId);
  };

  // Instant API Key verification handler
  const handleVerifyPayment = async () => {
    if (!txHash.trim()) {
      toast({
        title: "Transaction Hash Required",
        description: "Please enter your transaction hash after making payment",
        variant: "destructive"
      });
      return;
    }

    setVerificationState('verifying');
    setVerificationProgress(0);
    setVerificationMessage('Connecting to blockchain...');
    setInstantApiKey('');
    setStarterCredits(0);

    // Simulate progress during verification (backend polls for up to 30 seconds)
    const progressInterval = setInterval(() => {
      setVerificationProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 3000);

    const messages = [
      'Connecting to blockchain...',
      'Searching for transaction...',
      'Verifying payment amount...',
      'Checking token transfer...',
      'Confirming settlement...'
    ];
    let msgIndex = 0;
    const messageInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length;
      setVerificationMessage(messages[msgIndex]);
    }, 5000);

    try {
      const response = await fetch('/x402/instant-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': txHash.trim()
        }
      });

      clearInterval(progressInterval);
      clearInterval(messageInterval);

      if (response.ok) {
        const data = await response.json();
        setVerificationProgress(100);
        setVerificationState('success');
        setVerificationMessage('Payment verified successfully!');
        // Handle both snake_case (backend) and camelCase field names
        setInstantApiKey(data.api_key || data.apiKey || data.result?.api_key || data.result?.apiKey || '');
        setStarterCredits(data.starter_credits || data.starterCredits || data.result?.starter_credits || data.result?.starterCredits || 0);
        const grantedCredits = data.starter_credits || data.starterCredits || 0;
        toast({
          title: "API Key Issued!",
          description: `Your API key has been created${grantedCredits > 0 ? ` with $${grantedCredits} starter credits` : ''}`
        });
      } else if (response.status === 402) {
        // Payment required - transaction not found or invalid
        const errorData = await response.json();
        setVerificationState('error');
        setVerificationMessage(errorData.error || 'Payment not verified. Please check your transaction hash.');
        toast({
          title: "Payment Not Verified",
          description: "Transaction not found or payment amount incorrect. Please wait for confirmation and try again.",
          variant: "destructive"
        });
      } else {
        const errorData = await response.json();
        setVerificationState('error');
        setVerificationMessage(errorData.error || 'Verification failed');
        toast({
          title: "Verification Failed",
          description: errorData.error || "Please check your transaction and try again",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
      setVerificationState('error');
      setVerificationMessage(error.message || 'Network error');
      toast({
        title: "Network Error",
        description: "Could not connect to verification service. Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetVerification = () => {
    setTxHash('');
    setVerificationState('idle');
    setVerificationProgress(0);
    setVerificationMessage('');
    setInstantApiKey('');
    setStarterCredits(0);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard"
    });
  };

  const keys = (keysData?.keys || []) as APIKey[];
  const activeKeys = keys.filter(k => k.status === 'active');
  const revokedKeys = keys.filter(k => k.status === 'revoked');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        <div>
          <h1 className="text-4xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
            API Keys
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage your API keys for programmatic access to x402 services
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-active-keys">
            <CardHeader className="pb-3">
              <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                Active Keys
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
                {activeKeys.length}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Currently active</p>
            </CardContent>
          </Card>

          <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-revoked-keys">
            <CardHeader className="pb-3">
              <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                Revoked Keys
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
                {revokedKeys.length}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Inactive keys</p>
            </CardContent>
          </Card>

          <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-rate-limit">
            <CardHeader className="pb-3">
              <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                Rate Limit
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
                100
              </p>
              <p className="text-sm text-muted-foreground mt-2">Requests/minute</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:to-blue-500/20 border-emerald-500/30" data-testid="card-instant-api-key">
          <CardHeader>
            <CardTitle className="text-2xl font-['Space_Grotesk'] flex items-center gap-2">
              <Zap className="h-6 w-6 text-emerald-500" />
              Instant API Key - Pay $1 (USDC or USDT)
            </CardTitle>
            <CardDescription>
              Get an API key instantly with no account required. Pay $1 in USDC or USDT on Base or Solana and receive your key + $5 starter credits immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="instructions" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="instructions" data-testid="tab-instructions">Payment Instructions</TabsTrigger>
                <TabsTrigger value="verify" data-testid="tab-verify">Verify Payment</TabsTrigger>
              </TabsList>
              
              <TabsContent value="instructions" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="h-5 w-5 text-emerald-500" />
                      <span className="font-semibold">Step 1</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send $1 USDC or USDT to platform wallet
                    </p>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="h-5 w-5 text-blue-500" />
                      <span className="font-semibold">Step 2</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Copy your transaction hash after sending
                    </p>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-yellow-500" />
                      <span className="font-semibold">Step 3</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use "Verify Payment" tab to get your API key
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Base (EVM)</span>
                      <span className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">USDC / USDT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-background px-2 py-1.5 rounded flex-1 truncate">
                        0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText('0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91');
                          toast({ title: "Copied", description: "Base wallet address copied" });
                        }}
                        data-testid="button-copy-wallet-base"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Settlement: ~15 seconds</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Solana</span>
                      <span className="text-xs bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">USDC / USDT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-background px-2 py-1.5 rounded flex-1 truncate">
                        Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText('Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k');
                          toast({ title: "Copied", description: "Solana wallet address copied" });
                        }}
                        data-testid="button-copy-wallet-solana"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Settlement: ~2-5 seconds</p>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">API Endpoint (for programmatic access)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-background px-3 py-2 rounded flex-1">
                      POST https://coinrailz.com/x402/instant-api-key
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText('curl -X POST https://coinrailz.com/x402/instant-api-key -H "X-PAYMENT: <your-tx-hash>"');
                        toast({ title: "Copied", description: "cURL command copied to clipboard" });
                      }}
                      data-testid="button-copy-endpoint"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="verify" className="space-y-4 mt-4">
                {verificationState === 'success' && instantApiKey ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-6 w-6 text-emerald-500" />
                        <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">Payment Verified!</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Your API Key</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-sm font-mono bg-background px-3 py-2 rounded flex-1 break-all" data-testid="text-instant-api-key">
                              {instantApiKey}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(instantApiKey)}
                              data-testid="button-copy-instant-key"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {starterCredits > 0 && (
                          <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                            <DollarSign className="h-5 w-5 text-yellow-500" />
                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                              +${starterCredits} starter credits added!
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button onClick={resetVerification} variant="outline" className="w-full" data-testid="button-verify-another">
                      Verify Another Payment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tx-hash">Transaction Hash</Label>
                      <Input
                        id="tx-hash"
                        value={txHash}
                        onChange={(e) => setTxHash(e.target.value)}
                        placeholder="0x... (Base) or base58 signature (Solana)"
                        disabled={verificationState === 'verifying'}
                        data-testid="input-tx-hash"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the transaction hash from your wallet after sending $1 USDC or USDT
                      </p>
                    </div>

                    {verificationState === 'verifying' && (
                      <div className="space-y-2">
                        <Progress value={verificationProgress} className="h-2" />
                        <p className="text-sm text-center text-muted-foreground">{verificationMessage}</p>
                        <p className="text-xs text-center text-muted-foreground">
                          Verification may take up to 30 seconds for transaction confirmation
                        </p>
                      </div>
                    )}

                    {verificationState === 'error' && (
                      <div className="p-3 bg-red-500/10 dark:bg-red-500/20 rounded-lg border border-red-500/20">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                          <p className="text-sm text-red-700 dark:text-red-300">{verificationMessage}</p>
                        </div>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                          If your transaction is recent, wait 30 seconds for confirmation and try again.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleVerifyPayment}
                      disabled={verificationState === 'verifying' || !txHash.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      data-testid="button-verify-payment"
                    >
                      {verificationState === 'verifying' ? (
                        <>Verifying Payment...</>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Verify Payment & Get API Key
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg border border-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                <strong>No account required.</strong> Your API key works immediately with all 43 x402 services. Starter credits limited to one grant per wallet every 30 days.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-['Space_Grotesk']">Generate New API Key</CardTitle>
            <CardDescription>
              Already have an account? Create a new API key for programmatic access to Coin Railz services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="key-name">API Key Name</Label>
                <Input
                  id="key-name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Production Server"
                  data-testid="input-key-name"
                />
                <p className="text-xs text-muted-foreground">
                  Choose a descriptive name to identify where this key is used
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !keyName.trim()}
                  data-testid="button-generate-key"
                >
                  {generateMutation.isPending ? "Generating..." : "Generate API Key"}
                  <Key className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-500/10 dark:bg-yellow-500/20 border border-yellow-500/20 rounded-lg">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    Security Best Practices
                  </p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                    <li>Never commit API keys to version control</li>
                    <li>Rotate keys periodically for security</li>
                    <li>Use separate keys for development and production</li>
                    <li>Revoke keys immediately if compromised</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-['Space_Grotesk']">Your API Keys</CardTitle>
            <CardDescription>Manage and monitor your active API keys</CardDescription>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No API keys yet</p>
                <p className="text-sm">Generate your first API key to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wide">Name</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Key</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Last Used</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Created</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} data-testid={`row-api-key-${key.id}`}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {key.keyPrefix}••••••••••••
                        </code>
                      </TableCell>
                      <TableCell>
                        {key.status === 'active' ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                            <XCircle className="h-3 w-3 mr-1" />
                            Revoked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {key.lastUsedAt ? (
                          new Date(key.lastUsedAt).toLocaleDateString()
                        ) : (
                          <span className="text-xs">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {key.status === 'active' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-revoke-${key.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This API key will immediately stop working.
                                  Any applications using this key will lose access.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRevoke(key.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Revoke Key
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-xl font-['Space_Grotesk'] flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Quick Start Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Generate your API key above</h3>
              <p className="text-sm text-muted-foreground">
                Create a new API key and copy it immediately - it won't be shown again
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Make API calls with your key</h3>
              <p className="text-sm text-muted-foreground">
                Include your API key in the X-API-KEY header for all requests
              </p>
            </div>
            <Button variant="outline" asChild data-testid="button-view-docs">
              <a href="https://github.com/tdnupe3/coinrailz-x402-sdk" target="_blank" rel="noopener noreferrer">
                View Full Documentation
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-['Space_Grotesk']">Your New API Key</DialogTitle>
            <DialogDescription>
              ⚠️ Copy this key now - it will never be shown again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted dark:bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center justify-between gap-4">
                <code className="text-sm break-all flex-1" data-testid="text-new-api-key">
                  {newKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(newKey)}
                  data-testid="button-copy-new-key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="bg-yellow-500/10 dark:bg-yellow-500/20 p-4 rounded-lg border border-yellow-500/20">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2">
                Security Warning
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Store this key securely in your environment variables. Never commit it to version control 
                or share it publicly. If you lose it, you'll need to generate a new one.
              </p>
            </div>
            <Button
              onClick={() => setShowNewKeyDialog(false)}
              className="w-full"
              data-testid="button-close-dialog"
            >
              I've Copied My Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
