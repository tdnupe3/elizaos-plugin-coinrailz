import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Shield
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

  const { data: keysData, isLoading } = useQuery({
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

        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-['Space_Grotesk']">Generate New API Key</CardTitle>
            <CardDescription>
              Create a new API key for programmatic access to Coin Railz services
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
