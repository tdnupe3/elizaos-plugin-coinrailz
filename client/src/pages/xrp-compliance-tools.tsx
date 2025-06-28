import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, FileText, AlertTriangle, CheckCircle, Download, Upload, Search, Clock } from "@/lib/icons";

export default function XRPComplianceTools() {
  const [, setLocation] = useLocation();
  const [searchAddress, setSearchAddress] = useState("");
  const [reportType, setReportType] = useState("");
  const [dateRange, setDateRange] = useState("");

  const complianceChecks = [
    {
      id: "kyc",
      title: "KYC Verification",
      description: "Know Your Customer compliance verification",
      status: "active",
      lastUpdate: "2 hours ago",
      coverage: "98.7%"
    },
    {
      id: "aml",
      title: "AML Monitoring",
      description: "Anti-Money Laundering transaction monitoring", 
      status: "active",
      lastUpdate: "15 minutes ago",
      coverage: "99.2%"
    },
    {
      id: "sanctions",
      title: "Sanctions Screening",
      description: "Real-time sanctions list screening",
      status: "active", 
      lastUpdate: "5 minutes ago",
      coverage: "100%"
    },
    {
      id: "pep",
      title: "PEP Screening",
      description: "Politically Exposed Persons monitoring",
      status: "active",
      lastUpdate: "1 hour ago", 
      coverage: "97.3%"
    }
  ];

  const recentAlerts = [
    {
      id: "alert001",
      type: "high",
      title: "Suspicious Transaction Pattern",
      description: "Multiple large transactions from rABC...DEF",
      timestamp: "5 minutes ago",
      status: "investigating"
    },
    {
      id: "alert002", 
      type: "medium",
      title: "New High-Risk Jurisdiction",
      description: "Transaction from sanctioned country detected",
      timestamp: "2 hours ago",
      status: "resolved"
    },
    {
      id: "alert003",
      type: "low",
      title: "KYC Document Expiring",
      description: "Customer ID expires in 30 days",
      timestamp: "1 day ago",
      status: "pending"
    }
  ];

  const reportTypes = [
    { id: "sar", name: "Suspicious Activity Report (SAR)" },
    { id: "ctr", name: "Currency Transaction Report (CTR)" },
    { id: "fbar", name: "Foreign Bank Account Report (FBAR)" },
    { id: "audit", name: "Compliance Audit Report" },
    { id: "kyc-summary", name: "KYC Summary Report" }
  ];

  const regulations = [
    {
      jurisdiction: "United States",
      regulations: ["BSA", "PATRIOT Act", "FinCEN", "OFAC"],
      compliance: "100%",
      lastAudit: "March 2025"
    },
    {
      jurisdiction: "European Union", 
      regulations: ["AMLD5", "GDPR", "MiCA", "PSD2"],
      compliance: "98.5%",
      lastAudit: "February 2025"
    },
    {
      jurisdiction: "United Kingdom",
      regulations: ["MLR 2017", "FCA Rules", "POCA", "FSMA"],
      compliance: "99.2%", 
      lastAudit: "January 2025"
    },
    {
      jurisdiction: "Japan",
      regulations: ["JFSA", "AMLCFT", "FATF", "PSA"],
      compliance: "97.8%",
      lastAudit: "December 2024"
    }
  ];

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'text-green-600 bg-green-100';
      case 'investigating': return 'text-orange-600 bg-orange-100';
      case 'pending': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
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
                  <Shield className="w-6 h-6 text-red-600" />
                  <span>Compliance Tools</span>
                </h1>
                <p className="text-gray-600">Regulatory compliance and risk management for XRP transactions</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">Live Service</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="monitoring" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="screening">Screening</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
            <TabsTrigger value="regulations">Regulations</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="monitoring">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {complianceChecks.map((check) => (
                        <div key={check.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-5 h-5 text-green-500" />
                              <h3 className="font-semibold">{check.title}</h3>
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              {check.status}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-3">{check.description}</p>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Coverage:</span>
                              <span className="font-medium">{check.coverage}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Last Update:</span>
                              <span className="font-medium">{check.lastUpdate}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Compliance Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentAlerts.map((alert) => (
                        <div key={alert.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <AlertTriangle className={`w-5 h-5 ${alert.type === 'high' ? 'text-red-500' : alert.type === 'medium' ? 'text-yellow-500' : 'text-blue-500'}`} />
                              <div>
                                <h4 className="font-medium">{alert.title}</h4>
                                <p className="text-sm text-gray-600">{alert.description}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className={getAlertColor(alert.type)}>
                                {alert.type.toUpperCase()}
                              </Badge>
                              <div className="text-xs text-gray-500 mt-1">{alert.timestamp}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Badge className={getStatusColor(alert.status)}>
                              {alert.status}
                            </Badge>
                            <div className="flex space-x-2">
                              <Button size="sm" variant="outline">
                                View Details
                              </Button>
                              {alert.status === 'investigating' && (
                                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                                  Take Action
                                </Button>
                              )}
                            </div>
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
                    <CardTitle>Compliance Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center space-y-4">
                      <div className="text-4xl font-bold text-green-600">98.8%</div>
                      <div className="text-sm text-gray-600">Overall Compliance</div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div className="bg-green-600 h-3 rounded-full" style={{ width: '98.8%' }}></div>
                      </div>
                      
                      <div className="text-xs text-green-600">
                        +0.3% from last month
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Risk Score:</span>
                        <span className="font-medium text-green-600">Low</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Audit:</span>
                        <span className="font-medium">March 2025</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Next Review:</span>
                        <span className="font-medium">June 2025</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full justify-start" variant="outline">
                      <FileText className="w-4 h-4 mr-2" />
                      Generate SAR Report
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <Search className="w-4 h-4 mr-2" />
                      Screen Address
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Export Audit Log
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Documents
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="screening">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Search className="w-5 h-5 text-red-600" />
                    <span>Address Screening</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="searchAddress">XRP Address</Label>
                    <Input
                      id="searchAddress"
                      placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                    />
                  </div>

                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700"
                    disabled={!searchAddress}
                  >
                    Screen Address
                  </Button>

                  {searchAddress && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-3">Screening Results</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-700">Sanctions Check:</span>
                          <span className="font-medium text-green-600">✓ Clear</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">PEP Check:</span>
                          <span className="font-medium text-green-600">✓ Clear</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Risk Level:</span>
                          <span className="font-medium text-green-600">Low</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Last Activity:</span>
                          <span className="font-medium">2 hours ago</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Screening Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">24,892</div>
                        <div className="text-sm text-blue-700">Addresses Screened</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">3</div>
                        <div className="text-sm text-red-700">Sanctions Hits</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">127</div>
                        <div className="text-sm text-yellow-700">High Risk</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">99.87%</div>
                        <div className="text-sm text-green-700">Clear Rate</div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <h4 className="font-medium">Recent Screening Activity</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Last 24 hours:</span>
                          <span className="font-medium">1,247 screens</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">This week:</span>
                          <span className="font-medium">8,932 screens</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">This month:</span>
                          <span className="font-medium">34,567 screens</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reporting">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-red-600" />
                    <span>Generate Reports</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="reportType">Report Type</Label>
                    <select 
                      id="reportType"
                      className="w-full p-2 border border-gray-200 rounded-md"
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                    >
                      <option value="">Select report type</option>
                      {reportTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateRange">Date Range</Label>
                    <select 
                      id="dateRange"
                      className="w-full p-2 border border-gray-200 rounded-md"
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                    >
                      <option value="">Select date range</option>
                      <option value="last-7-days">Last 7 days</option>
                      <option value="last-30-days">Last 30 days</option>
                      <option value="last-90-days">Last 90 days</option>
                      <option value="last-year">Last year</option>
                      <option value="custom">Custom range</option>
                    </select>
                  </div>

                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700"
                    disabled={!reportType || !dateRange}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Report Features</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Automated regulatory filing</li>
                      <li>• Customizable report templates</li>
                      <li>• Real-time data aggregation</li>
                      <li>• Digital signature support</li>
                      <li>• Secure encrypted delivery</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Report History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium">Monthly SAR Report</h4>
                          <p className="text-sm text-gray-600">March 2025</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          Submitted
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        Generated: March 31, 2025 • Size: 2.4 MB
                      </div>
                      <Button size="sm" variant="outline" className="mt-2">
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium">Quarterly Audit Report</h4>
                          <p className="text-sm text-gray-600">Q1 2025</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800">
                          Processing
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        Started: March 28, 2025 • Est. completion: April 5, 2025
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium">KYC Summary Report</h4>
                          <p className="text-sm text-gray-600">February 2025</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          Delivered
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        Generated: February 28, 2025 • Size: 1.8 MB
                      </div>
                      <Button size="sm" variant="outline" className="mt-2">
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="regulations">
            <Card>
              <CardHeader>
                <CardTitle>Regulatory Compliance by Jurisdiction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {regulations.map((reg, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{reg.jurisdiction}</h3>
                          <p className="text-sm text-gray-600">Last audit: {reg.lastAudit}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">{reg.compliance}</div>
                          <div className="text-sm text-gray-600">Compliance</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Applicable Regulations:</h4>
                        <div className="flex flex-wrap gap-2">
                          {reg.regulations.map((regulation, regIndex) => (
                            <Badge key={regIndex} variant="outline">
                              {regulation}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: reg.compliance }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-red-600" />
                    <span>Audit Trail</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <div className="font-medium">Compliance Report Generated</div>
                      <div className="text-sm text-gray-600">SAR report for March 2025 submitted to FinCEN</div>
                      <div className="text-xs text-gray-500">March 31, 2025 14:30 UTC</div>
                    </div>
                    
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <div className="font-medium">High-Risk Transaction Flagged</div>
                      <div className="text-sm text-gray-600">Transaction rABC...DEF exceeded threshold</div>
                      <div className="text-xs text-gray-500">March 30, 2025 09:15 UTC</div>
                    </div>
                    
                    <div className="border-l-4 border-green-500 pl-4">
                      <div className="font-medium">KYC Verification Completed</div>
                      <div className="text-sm text-gray-600">Customer ID verification successful</div>
                      <div className="text-xs text-gray-500">March 29, 2025 16:45 UTC</div>
                    </div>
                    
                    <div className="border-l-4 border-red-500 pl-4">
                      <div className="font-medium">Sanctions Hit Detected</div>
                      <div className="text-sm text-gray-600">Address matched OFAC sanctions list</div>
                      <div className="text-xs text-gray-500">March 28, 2025 11:20 UTC</div>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full mt-4">
                    View Complete Audit Log
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Audit Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">15,247</div>
                        <div className="text-sm text-blue-700">Total Events</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-xl font-bold text-red-600">23</div>
                        <div className="text-sm text-red-700">Critical Events</div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <h4 className="font-medium">Event Categories</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Transactions:</span>
                          <span className="font-medium">12,893</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">KYC Events:</span>
                          <span className="font-medium">1,247</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Compliance Checks:</span>
                          <span className="font-medium">892</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Reports:</span>
                          <span className="font-medium">215</span>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="text-center">
                      <Button className="bg-red-600 hover:bg-red-700">
                        <Download className="w-4 h-4 mr-2" />
                        Export Audit Log
                      </Button>
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