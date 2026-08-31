import React, { useState, useEffect, useCallback } from 'react';
// Note: react-plaid-link will be imported once Plaid is configured
// import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, CheckCircle, AlertCircle } from '@/lib/minimal-icons-clean';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ConnectedAccount {
  accountId: string;
  name: string;
  type: string;
  subtype: string;
  balance: {
    available: number | null;
    current: number | null;
    currency: string | null;
  };
}

interface PlaidLinkComponentProps {
  onAccountConnected?: (accounts: ConnectedAccount[]) => void;
}

export function PlaidLinkComponent({ onAccountConnected }: PlaidLinkComponentProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create link token
  const createLinkToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest('POST', '/api/plaid/create-link-token', {});
      setLinkToken(response.link_token);
    } catch (error: any) {
      console.error('Error creating link token:', error);
      setError(error.message || 'Failed to initialize bank connection');
      toast({
        title: "Connection Error",
        description: "Unable to initialize bank linking. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Exchange public token for access token
  const onSuccess = useCallback(async (publicToken: string, metadata: any) => {
    try {
      setLoading(true);
      
      const response = await apiRequest('POST', '/api/plaid/exchange-token', {
        public_token: publicToken
      });

      if (response.success) {
        setAccessToken(response.access_token);
        
        // Fetch account information
        const accountsResponse = await apiRequest('/api/plaid/accounts', {
          headers: {
            'x-access-token': response.access_token
          }
        });
        
        setConnectedAccounts(accountsResponse.accounts);
        onAccountConnected?.(accountsResponse.accounts);
        
        toast({
          title: "Bank Account Connected",
          description: `Successfully connected ${metadata.institution.name}`,
        });
      }
    } catch (error: any) {
      console.error('Error connecting account:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect bank account",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [onAccountConnected, toast]);

  const onExit = useCallback((error: any, metadata: any) => {
    if (error) {
      console.error('Plaid Link error:', error);
      toast({
        title: "Connection Cancelled",
        description: "Bank account connection was cancelled",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Temporary demo implementation until Plaid is configured
  const open = () => {
    // Simulate Plaid Link flow
    console.log('Simulating Plaid Link with token:', linkToken);
    
    // Simulate successful connection after delay
    setTimeout(() => {
      const simulatedPublicToken = `public_sandbox_${Date.now()}`;
      const simulatedMetadata = {
        institution: { name: 'Demo Bank' },
        accounts: [{ id: 'demo_account', name: 'Checking Account' }]
      };
      onSuccess(simulatedPublicToken, simulatedMetadata);
    }, 2000);
  };
  
  const ready = linkToken !== null;

  // Initialize link token on mount
  useEffect(() => {
    if (user && !linkToken && !loading) {
      createLinkToken();
    }
  }, [user, linkToken, loading, createLinkToken]);

  const handleTransfer = async (accountId: string, amount: number) => {
    try {
      setLoading(true);
      
      const response = await apiRequest('/api/plaid/transfer', {
        method: 'POST',
        headers: {
          'x-access-token': accessToken!
        },
        body: {
          account_id: accountId,
          amount
        }
      });

      if (response.success) {
        toast({
          title: "Transfer Initiated",
          description: `$${amount} transfer initiated. Settlement expected in 2-3 business days.`,
        });
      }
    } catch (error: any) {
      console.error('Error initiating transfer:', error);
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to initiate transfer",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={createLinkToken}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Bank Account Connection
          </CardTitle>
          <CardDescription>
            Connect your bank account for instant USD funding and ACH transfers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectedAccounts.length === 0 ? (
            <Button
              onClick={() => open()}
              disabled={!ready || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Connect Bank Account
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Bank Account Connected</span>
              </div>
              
              {connectedAccounts.map((account) => (
                <Card key={account.accountId} className="border border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{account.name}</div>
                        <div className="text-sm text-gray-600 capitalize">
                          {account.subtype} • {account.type}
                        </div>
                        {account.balance.available && (
                          <div className="text-sm text-green-600 font-medium">
                            Available: ${account.balance.available.toLocaleString()}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-green-600">
                        Connected
                      </Badge>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => handleTransfer(account.accountId, 100)}
                      disabled={loading}
                    >
                      Test $100 Transfer
                    </Button>
                  </CardContent>
                </Card>
              ))}
              
              <Button
                variant="outline"
                onClick={() => open()}
                disabled={!ready || loading}
                className="w-full"
              >
                Connect Another Account
              </Button>
            </div>
          )}
          
          <Alert>
            <AlertDescription className="text-xs">
              <strong>Secure Connection:</strong> Plaid uses bank-level security. 
              Your login credentials are encrypted and never stored by Coin Railz.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}