import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Smartphone, Mail, CheckCircle, Clock, Copy, Key } from "@/lib/icons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface MfaMethod {
  id: number;
  type: string;
  isEnabled: boolean;
  lastUsed?: string;
  isVerified?: boolean;
  identifier?: string;
}

interface TotpSetup {
  secret: string;
  manualEntryKey: string;
  qrCode?: string;
}

export default function MfaSetup() {
  const { toast } = useToast();
  const [totpCode, setTotpCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Fetch current MFA methods
  const { data: mfaMethods = [], refetch } = useQuery<MfaMethod[]>({
    queryKey: ['/api/mfa/methods'],
  });

  // Generate TOTP secret
  const generateTotpMutation = useMutation<TotpSetup>({
    mutationFn: () => apiRequest('POST', '/api/mfa/totp/generate'),
    onSuccess: (data) => {
      setTotpSetup(data);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate authenticator setup",
        variant: "destructive",
      });
    },
  });

  // Setup TOTP
  const setupTotpMutation = useMutation({
    mutationFn: (data: { secret: string; verificationCode: string }) =>
      apiRequest('POST', '/api/mfa/totp/verify', data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Authenticator app configured successfully",
      });
      setTotpSetup(null);
      setTotpCode("");
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Invalid verification code. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Setup SMS
  const setupSmsMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; verificationCode: string }) =>
      apiRequest('POST', '/api/mfa/sms/verify', data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "SMS verification enabled successfully",
      });
      setSmsCode("");
      setPhoneNumber("");
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Invalid verification code. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send SMS code
  const sendSmsCodeMutation = useMutation({
    mutationFn: (phoneNumber: string) =>
      apiRequest('POST', '/api/mfa/sms/send', { phoneNumber }),
    onSuccess: () => {
      toast({
        title: "Code Sent",
        description: "Verification code sent to your phone",
      });
    },
  });

  // Generate backup codes
  const generateBackupCodesMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/mfa/backup-codes/generate'),
    onSuccess: (data) => {
      setBackupCodes(data.codes);
      setShowBackupCodes(true);
    },
  });

  // Disable MFA method
  const disableMfaMutation = useMutation({
    mutationFn: (methodId: number) =>
      apiRequest('DELETE', `/api/mfa/methods/${methodId}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "MFA method disabled",
      });
      refetch();
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const hasAnyMfa = mfaMethods.some((method: MfaMethod) => method.isVerified);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>
          <p className="text-gray-600">Protect your account with multi-factor authentication</p>
        </div>
        {hasAnyMfa && (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            MFA Enabled
          </Badge>
        )}
      </div>

      {/* Current MFA Methods */}
      {mfaMethods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mfaMethods.map((method: MfaMethod) => (
                <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {method.type === 'totp' && <Smartphone className="w-5 h-5 text-blue-600" />}
                    {method.type === 'sms' && <Mail className="w-5 h-5 text-green-600" />}
                    {method.type === 'backup_codes' && <Key className="w-5 h-5 text-purple-600" />}
                    <div>
                      <p className="font-medium">
                        {method.type === 'totp' && 'Authenticator App'}
                        {method.type === 'sms' && `SMS (${method.identifier})`}
                        {method.type === 'backup_codes' && 'Backup Codes'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {method.isVerified ? 'Active' : 'Setup Required'}
                        {method.lastUsed && ` • Last used: ${new Date(method.lastUsed).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disableMfaMutation.mutate(method.id)}
                    disabled={disableMfaMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup New MFA Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Security Method</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="totp" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="totp" className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4" />
                <span>Authenticator</span>
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>SMS</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center space-x-2">
                <Key className="w-4 h-4" />
                <span>Backup Codes</span>
              </TabsTrigger>
            </TabsList>

            {/* TOTP Setup */}
            <TabsContent value="totp" className="space-y-4">
              {!totpSetup ? (
                <div className="text-center py-6">
                  <Smartphone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Authenticator App</h3>
                  <p className="text-gray-600 mb-4">
                    Use Google Authenticator, Authy, or similar apps for secure verification codes
                  </p>
                  <Button 
                    onClick={() => generateTotpMutation.mutate()}
                    disabled={generateTotpMutation.isPending}
                  >
                    Setup Authenticator
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="w-48 h-48 bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                      <p className="text-sm text-gray-600">QR Code would appear here</p>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Scan with your authenticator app</p>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={totpSetup.manualEntryKey}
                        readOnly
                        className="text-center text-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(totpSetup.manualEntryKey)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="totp-code">Enter verification code</Label>
                    <Input
                      id="totp-code"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => setupTotpMutation.mutate({ 
                        secret: totpSetup.secret, 
                        verificationCode: totpCode 
                      })}
                      disabled={setupTotpMutation.isPending || totpCode.length !== 6}
                      className="flex-1"
                    >
                      Verify & Enable
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setTotpSetup(null)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* SMS Setup */}
            <TabsContent value="sms" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
                
                <Button 
                  onClick={() => sendSmsCodeMutation.mutate(phoneNumber)}
                  disabled={sendSmsCodeMutation.isPending || !phoneNumber}
                  className="w-full"
                >
                  Send Verification Code
                </Button>
                
                <div className="space-y-2">
                  <Label htmlFor="sms-code">Verification Code</Label>
                  <Input
                    id="sms-code"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                  />
                </div>
                
                <Button 
                  onClick={() => setupSmsMutation.mutate({ 
                    phoneNumber, 
                    verificationCode: smsCode 
                  })}
                  disabled={setupSmsMutation.isPending || smsCode.length !== 6}
                  className="w-full"
                >
                  Verify & Enable SMS
                </Button>
              </div>
            </TabsContent>

            {/* Backup Codes */}
            <TabsContent value="backup" className="space-y-4">
              {!showBackupCodes ? (
                <div className="text-center py-6">
                  <Key className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Backup Codes</h3>
                  <p className="text-gray-600 mb-4">
                    Generate one-time backup codes to access your account if other methods aren't available
                  </p>
                  <Button 
                    onClick={() => generateBackupCodesMutation.mutate()}
                    disabled={generateBackupCodesMutation.isPending}
                  >
                    Generate Backup Codes
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium mb-2">
                      Important: Save these codes securely
                    </p>
                    <p className="text-xs text-yellow-700">
                      Each code can only be used once. Store them in a safe place.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                        <code className="text-sm font-mono flex-1">{code}</code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(code)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setShowBackupCodes(false);
                      setBackupCodes([]);
                      refetch();
                    }}
                    className="w-full"
                  >
                    I've Saved These Codes
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}