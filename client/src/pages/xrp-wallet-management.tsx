import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Shield, Users, Key, ArrowLeft, Copy } from "@/lib/icons";
import { useLocation } from "wouter";

export default function XRPWalletManagement() {
  const [, setLocation] = useLocation();
  const [walletName, setWalletName] = useState("");
  const [signers, setSigners] = useState("2");

  const handleCreateWallet = () => {
    console.log("Creating XRP wallet:", { walletName, signers });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/xrp-ecosystem")}
            className="text-green-600 hover:text-green-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to XRP Ecosystem
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            XRP Wallet Management
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Professional XRP wallet solutions with multi-signature security and enterprise custody features
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Wallet Creation */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Wallet className="w-6 h-6" />
                Create Multi-Sig Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="walletName">Wallet Name</Label>
                <Input
                  id="walletName"
                  placeholder="Corporate Treasury"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  className="text-lg"
                />
              </div>

              <div>
                <Label htmlFor="signers">Required Signatures</Label>
                <select 
                  id="signers"
                  value={signers}
                  onChange={(e) => setSigners(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                >
                  <option value="1">1 of 1 (Single Signature)</option>
                  <option value="2">2 of 3 (Multi-Signature)</option>
                  <option value="3">3 of 5 (Enterprise)</option>
                  <option value="5">5 of 7 (Institutional)</option>
                </select>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Security Features</h4>
                <ul className="text-sm space-y-1">
                  <li>• Hardware wallet integration</li>
                  <li>• Time-locked transactions</li>
                  <li>• Spending limits and controls</li>
                  <li>• Audit trail and compliance</li>
                </ul>
              </div>

              <Button 
                onClick={handleCreateWallet}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                Create Secure Wallet
              </Button>
            </CardContent>
          </Card>

          {/* Existing Wallets */}
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Key className="w-6 h-6" />
                Your XRP Wallets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">Primary Wallet</h4>
                    <p className="text-sm text-gray-600">rN7n...8kL2</p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Balance:</span>
                  <span className="font-medium">1,250 XRP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Security:</span>
                  <span className="text-blue-600">2 of 3 Multi-Sig</span>
                </div>
                <Button variant="outline" size="sm" className="mt-2 w-full">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Address
                </Button>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">Treasury Wallet</h4>
                    <p className="text-sm text-gray-600">rX9m...3nP5</p>
                  </div>
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">Pending</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Balance:</span>
                  <span className="font-medium">10,000 XRP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Security:</span>
                  <span className="text-blue-600">3 of 5 Multi-Sig</span>
                </div>
                <Button variant="outline" size="sm" className="mt-2 w-full">
                  View Details
                </Button>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">Escrow Wallet</h4>
                    <p className="text-sm text-gray-600">rK4j...7bM1</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Locked</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Balance:</span>
                  <span className="font-medium">5,500 XRP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Release:</span>
                  <span className="text-orange-600">7 days</span>
                </div>
                <Button variant="outline" size="sm" className="mt-2 w-full">
                  Manage Escrow
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="p-6">
              <Shield className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Multi-Signature Security</h3>
              <p className="text-gray-600">
                Require multiple signatures for transactions, preventing unauthorized access
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Users className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Team Management</h3>
              <p className="text-gray-600">
                Assign roles and permissions to team members with granular access controls
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Key className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Hardware Integration</h3>
              <p className="text-gray-600">
                Support for Ledger, Trezor, and other hardware wallets for maximum security
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}