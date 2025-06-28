import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Wallet, Send, Download, Upload, Shield, Key, Eye, EyeOff, Copy, QrCode } from "@/lib/icons";

export default function XRPWalletManagement() {
  const [, setLocation] = useLocation();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  const wallets = [
    {
      id: "primary",
      name: "Primary Wallet",
      address: "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      balance: "15,847.32",
      usdValue: "$33,890.48",
      type: "hot",
      status: "active",
      transactions: 1247
    },
    {
      id: "savings",
      name: "Savings Wallet", 
      address: "rYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
      balance: "52,103.89",
      usdValue: "$111,502.32",
      type: "cold",
      status: "active",
      transactions: 89
    },
    {
      id: "trading",
      name: "Trading Wallet",
      address: "rZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
      balance: "3,247.15",
      usdValue: "$6,949.31",
      type: "hot",
      status: "active", 
      transactions: 2891
    }
  ];

  const recentTransactions = [
    {
      id: "tx001",
      type: "received",
      amount: "+1,250.00 XRP",
      from: "rABC...DEF",
      timestamp: "2 minutes ago",
      status: "confirmed",
      fee: "0.00001 XRP"
    },
    {
      id: "tx002", 
      type: "sent",
      amount: "-500.00 XRP",
      to: "rGHI...JKL",
      timestamp: "1 hour ago",
      status: "confirmed",
      fee: "0.00001 XRP"
    },
    {
      id: "tx003",
      type: "received",
      amount: "+75.50 XRP", 
      from: "rMNO...PQR",
      timestamp: "3 hours ago",
      status: "confirmed",
      fee: "0.00001 XRP"
    }
  ];

  const securityFeatures = [
    {
      title: "Multi-Signature Support",
      description: "Require multiple signatures for enhanced security",
      enabled: true
    },
    {
      title: "Cold Storage Integration",
      description: "Connect hardware wallets for maximum security",
      enabled: true
    },
    {
      title: "Two-Factor Authentication",
      description: "Additional layer of protection for wallet access",
      enabled: true
    },
    {
      title: "Biometric Lock",
      description: "Fingerprint or face recognition for quick access",
      enabled: false
    }
  ];

  const getWalletTypeColor = (type: string) => {
    return type === 'hot' ? 'text-orange-600 bg-orange-100' : 'text-blue-600 bg-blue-100';
  };

  const getTransactionIcon = (type: string) => {
    return type === 'sent' ? Upload : Download;
  };

  const getTransactionColor = (type: string) => {
    return type === 'sent' ? 'text-red-600' : 'text-green-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/xrp-ecosystem")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to XRP Ecosystem</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                  <Wallet className="w-6 h-6 text-indigo-600" />
                  <span>Wallet Management</span>
                </h1>
                <p className="text-gray-600">Secure XRP wallet management with multi-signature support</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">Live Service</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="send">Send XRP</TabsTrigger>
            <TabsTrigger value="receive">Receive</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Wallets */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>My Wallets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {wallets.map((wallet) => (
                        <div key={wallet.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{wallet.name}</h3>
                                <p className="text-sm text-gray-600 font-mono">{wallet.address}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">{wallet.balance} XRP</div>
                              <div className="text-sm text-gray-600">{wallet.usdValue}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-4">
                              <Badge className={getWalletTypeColor(wallet.type)}>
                                {wallet.type.toUpperCase()}
                              </Badge>
                              <span className="text-gray-600">{wallet.transactions} transactions</span>
                            </div>
                            <div className="flex space-x-2">
                              <Button size="sm" variant="outline">
                                <Send className="w-3 h-3 mr-1" />
                                Send
                              </Button>
                              <Button size="sm" variant="outline">
                                <Download className="w-3 h-3 mr-1" />
                                Receive
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700">
                      <Wallet className="w-4 h-4 mr-2" />
                      Create New Wallet
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Portfolio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-indigo-600">71,198.36 XRP</div>
                      <div className="text-lg text-gray-600">$152,342.11</div>
                      <div className="text-sm text-green-600">+2.34% (24h)</div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Available:</span>
                        <span className="font-medium">71,198.36 XRP</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reserved:</span>
                        <span className="font-medium">20.00 XRP</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">In Escrow:</span>
                        <span className="font-medium">0.00 XRP</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentTransactions.slice(0, 3).map((tx) => {
                        const Icon = getTransactionIcon(tx.type);
                        return (
                          <div key={tx.id} className="flex items-center space-x-3">
                            <div className={`p-2 rounded-full ${tx.type === 'sent' ? 'bg-red-100' : 'bg-green-100'}`}>
                              <Icon className={`w-3 h-3 ${getTransactionColor(tx.type)}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium ${getTransactionColor(tx.type)}`}>
                                {tx.amount}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {tx.timestamp}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      View All Transactions
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="send">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Send className="w-5 h-5 text-indigo-600" />
                    <span>Send XRP</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="fromWallet">From Wallet</Label>
                    <select className="w-full p-2 border border-gray-200 rounded-md">
                      {wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name} - {wallet.balance} XRP
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipientAddress">Recipient Address</Label>
                    <Input
                      id="recipientAddress"
                      placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transferAmount">Amount (XRP)</Label>
                    <Input
                      id="transferAmount"
                      type="number"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                    />
                  </div>

                  {transferAmount && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <h4 className="font-medium text-indigo-900 mb-3">Transaction Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-indigo-700">Amount:</span>
                          <span className="font-medium">{transferAmount} XRP</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-indigo-700">Network Fee:</span>
                          <span className="font-medium">0.00001 XRP</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-indigo-700">USD Value:</span>
                          <span className="font-medium">${(parseFloat(transferAmount || '0') * 2.14).toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-base font-semibold text-indigo-900">
                          <span>Total:</span>
                          <span>{(parseFloat(transferAmount || '0') + 0.00001).toFixed(5)} XRP</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    disabled={!transferAmount || !recipientAddress}
                  >
                    Send XRP
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentTransactions.map((tx) => {
                      const Icon = getTransactionIcon(tx.type);
                      return (
                        <div key={tx.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-full ${tx.type === 'sent' ? 'bg-red-100' : 'bg-green-100'}`}>
                                <Icon className={`w-4 h-4 ${getTransactionColor(tx.type)}`} />
                              </div>
                              <div>
                                <div className={`font-medium ${getTransactionColor(tx.type)}`}>
                                  {tx.amount}
                                </div>
                                <div className="text-sm text-gray-600">{tx.timestamp}</div>
                              </div>
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              {tx.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500">
                            {tx.type === 'sent' ? `To: ${tx.to}` : `From: ${tx.from}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            Fee: {tx.fee}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="receive">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Download className="w-5 h-5 text-indigo-600" />
                    <span>Receive XRP</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="receiveWallet">Select Wallet</Label>
                    <select className="w-full p-2 border border-gray-200 rounded-md">
                      {wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-center space-y-4">
                    <div className="w-48 h-48 bg-gray-100 rounded-lg mx-auto flex items-center justify-center">
                      <QrCode className="w-24 h-24 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600">QR Code for Primary Wallet</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Wallet Address</Label>
                    <div className="flex space-x-2">
                      <Input
                        value="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button size="icon" variant="outline">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">Important</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Only send XRP to this address</li>
                      <li>• Minimum deposit: 20 XRP (network requirement)</li>
                      <li>• Include destination tag if required</li>
                      <li>• Transactions are irreversible</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pending Deposits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No pending deposits</p>
                    <p className="text-sm text-gray-400">Incoming transactions will appear here</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    <span>Security Settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {securityFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="font-medium">{feature.title}</h4>
                        <p className="text-sm text-gray-600">{feature.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={feature.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {feature.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <Button size="sm" variant="outline">
                          {feature.enabled ? "Configure" : "Enable"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Backup & Recovery</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Private Key</Label>
                      <div className="flex space-x-2">
                        <Input
                          type={showPrivateKey ? "text" : "password"}
                          value="••••••••••••••••••••••••••••••••"
                          readOnly
                          className="font-mono"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                        >
                          {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Recovery Seed</Label>
                      <div className="flex space-x-2">
                        <Input
                          type={showSeed ? "text" : "password"}
                          value="••••• ••••• ••••• ••••• ••••• •••••"
                          readOnly
                          className="font-mono"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setShowSeed(!showSeed)}
                        >
                          {showSeed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 mb-2">Security Warning</h4>
                    <p className="text-sm text-red-700">
                      Never share your private key or recovery seed. Store them securely offline.
                      Anyone with access to these can control your wallet.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button className="w-full" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Download Backup
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Key className="w-4 h-4 mr-2" />
                      Export Private Key
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="advanced">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newWalletName">Create New Wallet</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="newWalletName"
                        placeholder="Wallet name"
                        value={newWalletName}
                        onChange={(e) => setNewWalletName(e.target.value)}
                      />
                      <Button>Create</Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium">Network Settings</h4>
                    <div className="space-y-2">
                      <Label>Default Network Fee</Label>
                      <select className="w-full p-2 border border-gray-200 rounded-md">
                        <option value="low">Low (0.00001 XRP)</option>
                        <option value="standard">Standard (0.00012 XRP)</option>
                        <option value="high">High (0.0001 XRP)</option>
                      </select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium">Import/Export</h4>
                    <div className="space-y-2">
                      <Button className="w-full" variant="outline">
                        Import Wallet from Seed
                      </Button>
                      <Button className="w-full" variant="outline">
                        Import from Private Key
                      </Button>
                      <Button className="w-full" variant="outline">
                        Connect Hardware Wallet
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Multi-Signature Setup</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Set up multi-signature wallets for enhanced security. Require multiple 
                      signatures to authorize transactions.
                    </p>
                    
                    <div className="space-y-2">
                      <Label>Required Signatures</Label>
                      <select className="w-full p-2 border border-gray-200 rounded-md">
                        <option value="2of2">2 of 2</option>
                        <option value="2of3">2 of 3</option>
                        <option value="3of5">3 of 5</option>
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Co-signers</Label>
                      <div className="space-y-2">
                        <Input placeholder="Co-signer 1 address" />
                        <Input placeholder="Co-signer 2 address" />
                        <Button size="sm" variant="outline" className="w-full">
                          Add Co-signer
                        </Button>
                      </div>
                    </div>
                    
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                      Create Multi-Sig Wallet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}