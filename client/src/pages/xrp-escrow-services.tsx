import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, Clock, Users, AlertTriangle, CheckCircle, Lock, Calendar } from "@/lib/icons";

export default function XRPEscrowServices() {
  const [, setLocation] = useLocation();
  const [escrowAmount, setEscrowAmount] = useState("");
  const [escrowType, setEscrowType] = useState("");
  const [releaseCondition, setReleaseCondition] = useState("");

  const escrowTypes = [
    { id: "real-estate", name: "Real Estate Transaction", fee: "0.25%", timelock: "30-60 days" },
    { id: "business-sale", name: "Business Acquisition", fee: "0.15%", timelock: "60-120 days" },
    { id: "freelance", name: "Freelance Payment", fee: "1.5%", timelock: "7-30 days" },
    { id: "international", name: "International Trade", fee: "0.5%", timelock: "14-45 days" },
    { id: "legal", name: "Legal Settlement", fee: "0.3%", timelock: "30-90 days" }
  ];

  const activeEscrows = [
    { 
      id: "ESC001", 
      type: "Real Estate", 
      amount: "$1.2M", 
      status: "awaiting_conditions", 
      progress: 65,
      daysLeft: 12 
    },
    { 
      id: "ESC002", 
      type: "Business Sale", 
      amount: "$850K", 
      status: "conditions_met", 
      progress: 90,
      daysLeft: 3 
    },
    { 
      id: "ESC003", 
      type: "Legal Settlement", 
      amount: "$320K", 
      status: "in_review", 
      progress: 45,
      daysLeft: 18 
    }
  ];

  const securityFeatures = [
    {
      title: "Multi-Signature Wallets",
      description: "Require multiple parties to authorize fund release",
      icon: Lock
    },
    {
      title: "Time-Lock Conditions",
      description: "Automatic release after specified time periods",
      icon: Clock
    },
    {
      title: "Conditional Release",
      description: "Release funds when predefined conditions are met",
      icon: CheckCircle
    },
    {
      title: "Dispute Resolution",
      description: "Built-in arbitration for contested transactions",
      icon: Users
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'conditions_met': return 'text-green-600 bg-green-100';
      case 'awaiting_conditions': return 'text-yellow-600 bg-yellow-100';
      case 'in_review': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'conditions_met': return 'Ready for Release';
      case 'awaiting_conditions': return 'Awaiting Conditions';
      case 'in_review': return 'Under Review';
      default: return status;
    }
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
                  <Shield className="w-6 h-6 text-purple-600" />
                  <span>Escrow Services</span>
                </h1>
                <p className="text-gray-600">Secure automated escrow with programmable release conditions</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">Live Service</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Create Escrow</TabsTrigger>
            <TabsTrigger value="manage">Manage Escrows</TabsTrigger>
            <TabsTrigger value="features">Features & Security</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Escrow Creation Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    <span>Create New Escrow</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Escrow Type */}
                  <div className="space-y-2">
                    <Label htmlFor="escrowType">Escrow Type</Label>
                    <Select value={escrowType} onValueChange={setEscrowType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select escrow type" />
                      </SelectTrigger>
                      <SelectContent>
                        {escrowTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Escrow Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="escrowAmount">Escrow Amount (USD)</Label>
                    <Input
                      id="escrowAmount"
                      type="number"
                      placeholder="0.00"
                      value={escrowAmount}
                      onChange={(e) => setEscrowAmount(e.target.value)}
                    />
                  </div>

                  {/* Release Conditions */}
                  <div className="space-y-2">
                    <Label htmlFor="releaseCondition">Release Condition</Label>
                    <Select value={releaseCondition} onValueChange={setReleaseCondition}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select release condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both-parties">Both Parties Confirm</SelectItem>
                        <SelectItem value="time-lock">Time Lock (Automatic)</SelectItem>
                        <SelectItem value="milestone">Milestone Completion</SelectItem>
                        <SelectItem value="arbitrator">Arbitrator Decision</SelectItem>
                        <SelectItem value="multi-sig">Multi-Signature (2-of-3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Fee Calculation */}
                  {escrowAmount && escrowType && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-medium text-purple-900 mb-2">Escrow Summary</h4>
                      <div className="space-y-2 text-sm">
                        {(() => {
                          const selectedType = escrowTypes.find(t => t.id === escrowType);
                          const feePercent = parseFloat(selectedType?.fee?.replace('%', '') || '0');
                          const feeAmount = (parseFloat(escrowAmount) * feePercent / 100).toFixed(2);
                          
                          return (
                            <>
                              <div className="flex justify-between">
                                <span className="text-purple-700">Escrow Amount:</span>
                                <span className="font-medium">${parseFloat(escrowAmount).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-purple-700">Service Fee ({selectedType?.fee}):</span>
                                <span className="font-medium">${feeAmount}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-purple-700">Typical Duration:</span>
                                <span className="font-medium">{selectedType?.timelock}</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between text-base font-semibold text-purple-900">
                                <span>Total Required:</span>
                                <span>${(parseFloat(escrowAmount) + parseFloat(feeAmount)).toLocaleString()}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    disabled={!escrowAmount || !escrowType || !releaseCondition}
                  >
                    Create Escrow Account
                  </Button>
                </CardContent>
              </Card>

              {/* Escrow Process */}
              <Card>
                <CardHeader>
                  <CardTitle>How XRP Escrow Works</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium text-sm">1</div>
                      <div>
                        <h4 className="font-medium">Funds Deposited</h4>
                        <p className="text-sm text-gray-600">Buyer deposits funds into XRP Ledger escrow account</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium text-sm">2</div>
                      <div>
                        <h4 className="font-medium">Conditions Set</h4>
                        <p className="text-sm text-gray-600">Smart contract defines release conditions and timelock</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium text-sm">3</div>
                      <div>
                        <h4 className="font-medium">Service Delivered</h4>
                        <p className="text-sm text-gray-600">Seller completes agreed-upon deliverables</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium text-sm">4</div>
                      <div>
                        <h4 className="font-medium">Automatic Release</h4>
                        <p className="text-sm text-gray-600">Funds released when conditions are met or timelock expires</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-800">Important</h4>
                        <p className="text-sm text-yellow-700">
                          XRP escrow is programmable and immutable. Once created, 
                          conditions cannot be changed without all parties' consent.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="manage">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Active Escrow Accounts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {activeEscrows.map((escrow) => (
                        <div key={escrow.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="font-medium text-gray-900">{escrow.id}</h3>
                              <p className="text-sm text-gray-600">{escrow.type}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold">{escrow.amount}</div>
                              <Badge className={`text-xs ${getStatusColor(escrow.status)}`}>
                                {getStatusText(escrow.status)}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progress</span>
                              <span>{escrow.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${escrow.progress}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Days remaining: {escrow.daysLeft}</span>
                              <span>Auto-release enabled</span>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 mt-4">
                            <Button size="sm" variant="outline">View Details</Button>
                            {escrow.status === 'conditions_met' && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                Release Funds
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Escrow Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">$2.37M</div>
                        <div className="text-sm text-green-700">Total in Escrow</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">3</div>
                        <div className="text-sm text-blue-700">Active Accounts</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">98.5%</div>
                        <div className="text-sm text-purple-700">Success Rate</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule Release
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="w-4 h-4 mr-2" />
                      Add Arbitrator
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Dispute Transaction
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="features">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Security Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {securityFeatures.map((feature, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <feature.icon className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{feature.title}</h4>
                          <p className="text-sm text-gray-600">{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Use Cases</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900">Real Estate Transactions</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Secure large property purchases with automated release upon deed transfer
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        Typical amount: $500K-$5M • Duration: 30-60 days
                      </div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900">Business Acquisitions</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Facilitate M&A transactions with milestone-based fund release
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        Typical amount: $1M-$50M • Duration: 60-120 days
                      </div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900">International Trade</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Protect importers and exporters with document-based release
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        Typical amount: $50K-$2M • Duration: 14-45 days
                      </div>
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900">Freelance & Consulting</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Ensure payment for completed work with delivery confirmation
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        Typical amount: $1K-$100K • Duration: 7-30 days
                      </div>
                    </div>
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