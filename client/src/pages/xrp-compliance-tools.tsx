import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, FileText, Search, AlertTriangle, ArrowLeft, Download } from "@/lib/icons";
import { useLocation } from "wouter";

export default function XRPComplianceTools() {
  const [, setLocation] = useLocation();
  const [address, setAddress] = useState("");
  const [reportType, setReportType] = useState("aml");

  const handleGenerateReport = () => {
    console.log("Generating compliance report:", { address, reportType });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/xrp-ecosystem")}
            className="text-red-600 hover:text-red-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to XRP Ecosystem
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            XRP Compliance Tools
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Informational XRP wallet and transaction risk signals for technical review
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Compliance Analysis */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <Search className="w-6 h-6" />
                Address Risk Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="address">XRP Address</Label>
                <Input
                  id="address"
                  placeholder="rN7n7otEqVEej9RYJ7xUd3JFfk5H889f5A"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="text-lg font-mono"
                />
              </div>

              <div>
                <Label htmlFor="reportType">Analysis Type</Label>
                <select 
                  id="reportType"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                >
                  <option value="aml">Transaction Risk Signals</option>
                  <option value="kyc">Identity-Related Data Signals</option>
                  <option value="sanctions">Sanctions-Related Data Signals</option>
                  <option value="full">Technical Risk Summary</option>
                </select>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-semibold text-red-800 mb-2">Risk Indicators</h4>
                <ul className="text-sm space-y-1">
                  <li>• Sanctioned addresses detection</li>
                  <li>• High-risk jurisdiction analysis</li>
                  <li>• Suspicious transaction patterns</li>
                  <li>• Exchange compliance status</li>
                </ul>
              </div>

              <Button 
                onClick={handleGenerateReport}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                Analyze Address
              </Button>
            </CardContent>
          </Card>

          {/* Compliance Dashboard */}
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <FileText className="w-6 h-6" />
                Compliance Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">Monthly AML Report</h4>
                    <p className="text-sm text-gray-600">December 2025</p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Complete</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span>Transactions Analyzed:</span>
                  <span className="font-medium">1,247</span>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">KYC Verification Status</h4>
                    <p className="text-sm text-gray-600">Real-time</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Active</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Verified Users:</span>
                    <span className="font-medium">892</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Review:</span>
                    <span className="font-medium text-orange-600">23</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-3 w-full">
                  View Dashboard
                </Button>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">Risk Alert Summary</h4>
                    <p className="text-sm text-gray-600">Last 7 days</p>
                  </div>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">3 Alerts</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>High Risk:</span>
                    <span className="font-medium text-red-600">1</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medium Risk:</span>
                    <span className="font-medium text-orange-600">2</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-3 w-full">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Review Alerts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="p-6">
              <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">AML Monitoring</h3>
              <p className="text-gray-600">
                Real-time anti-money laundering detection with advanced pattern recognition
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <FileText className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Regulatory Reporting</h3>
              <p className="text-gray-600">
                Informational risk and compliance signals for technical review; not legal advice or regulatory reporting
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Search className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Transaction Screening</h3>
              <p className="text-gray-600">
                Comprehensive screening against sanctions lists and risk databases
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}