import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Zap, Clock, TrendingUp, Shield, CheckCircle, AlertCircle, Activity } from "@/lib/icons";

export default function XRPInstantSettlements() {
  const [, setLocation] = useLocation();
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

  const settlementTypes = [
    {
      id: "trade-settlement",
      title: "Trade Settlement",
      description: "Instant settlement of securities and commodity trades",
      timeTraditional: "T+2 (2 days)",
      timeXRP: "3-5 seconds",
      volume: "$2.1B daily",
      icon: TrendingUp
    },
    {
      id: "institutional-settlement",
      title: "Institutional Settlement",
      description: "On-chain settlement workflows between participating wallets",
      timeTraditional: "1-3 hours",
      timeXRP: "3-5 seconds",
      volume: "$890M daily",
      icon: Shield
    },
    {
      id: "payment-settlement",
      title: "Payment Settlement",
      description: "Instant settlement of payment transactions",
      timeTraditional: "1-3 business days",
      timeXRP: "3-5 seconds",
      volume: "$1.5B daily",
      icon: Activity
    }
  ];

  const recentSettlements = [
    { id: "ST001", type: "Trade", amount: "$2.5M", time: "3.2s", status: "completed" },
    { id: "ST002", type: "Payment", amount: "$890K", time: "4.1s", status: "completed" },
    { id: "ST003", type: "Interbank", amount: "$12.3M", time: "2.8s", status: "completed" },
    { id: "ST004", type: "Trade", amount: "$5.7M", time: "3.9s", status: "processing" },
    { id: "ST005", type: "Payment", amount: "$1.2M", time: "3.5s", status: "completed" }
  ];

  const keyBenefits = [
    {
      title: "Eliminate Counterparty Risk",
      description: "Atomic transactions ensure simultaneous exchange of assets",
      icon: Shield
    },
    {
      title: "24/7 Settlement",
      description: "No banking hours limitations, settle anytime globally",
      icon: Clock
    },
    {
      title: "Cryptographic Finality",
      description: "Immutable transaction records with mathematical certainty",
      icon: CheckCircle
    },
    {
      title: "Sub-Second Confirmations",
      description: "Typically 3-5 seconds for complete settlement",
      icon: Zap
    }
  ];

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
                  <Zap className="w-6 h-6 text-orange-600" />
                  <span>Instant Settlements</span>
                </h1>
                <p className="text-gray-600">Real-time gross settlement with cryptographic finality</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">Live Service</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Settlement Types */}
            <Card>
              <CardHeader>
                <CardTitle>Settlement Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {settlementTypes.map((type) => (
                    <div 
                      key={type.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedDemo === type.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedDemo(selectedDemo === type.id ? null : type.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <type.icon className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{type.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>Volume: {type.volume}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Traditional</div>
                          <div className="text-sm text-red-600 font-medium">{type.timeTraditional}</div>
                          <div className="text-xs text-gray-500 mt-1">XRP Ledger</div>
                          <div className="text-sm text-green-600 font-medium">{type.timeXRP}</div>
                        </div>
                      </div>
                      
                      {selectedDemo === type.id && (
                        <div className="mt-4 pt-4 border-t border-blue-200">
                          <div className="bg-white rounded-lg p-3">
                            <h4 className="font-medium text-blue-900 mb-2">Live Demo Available</h4>
                            <p className="text-sm text-blue-700 mb-3">
                              Experience {type.title.toLowerCase()} with simulated institutional data
                            </p>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                              Start Demo Settlement
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Key Benefits */}
            <Card>
              <CardHeader>
                <CardTitle>Settlement Advantages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {keyBenefits.map((benefit, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <benefit.icon className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{benefit.title}</h4>
                        <p className="text-sm text-gray-600">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Settlement Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">3.2s</div>
                    <div className="text-sm text-green-700">Avg Settlement</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">99.99%</div>
                    <div className="text-sm text-blue-700">Success Rate</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">$4.4B</div>
                    <div className="text-sm text-purple-700">Daily Volume</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">24/7</div>
                    <div className="text-sm text-orange-700">Availability</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Settlements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-4 h-4" />
                  <span>Recent Settlements</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSettlements.map((settlement) => (
                    <div key={settlement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{settlement.id}</div>
                        <div className="text-xs text-gray-600">{settlement.type}</div>
                        <div className="text-xs text-gray-900 font-medium">{settlement.amount}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-green-600 font-medium">{settlement.time}</div>
                        <div className="flex items-center space-x-1">
                          {settlement.status === 'completed' ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-yellow-500" />
                          )}
                          <span className={`text-xs capitalize ${
                            settlement.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {settlement.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3">
                  View All Settlements
                </Button>
              </CardContent>
            </Card>

            {/* Integration Guide */}
            <Card>
              <CardHeader>
                <CardTitle>Integration Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  API Documentation
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  SDK Downloads
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Sandbox Environment
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Technical Support
                </Button>
              </CardContent>
            </Card>

            {/* Regulatory Compliance */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance & Security</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>GDPR Compliant</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>SOC 2 Type II</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>ISO 27001</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>PCI DSS Level 1</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}