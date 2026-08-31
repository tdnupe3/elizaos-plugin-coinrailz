import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Shield, AlertTriangle, Lock, Eye, FileText,
  CheckCircle, XCircle, Clock, Activity,
  Key, Globe, Smartphone, Mail, Database
} from "@/lib/icons";

interface SecurityEvent {
  id: string;
  type: 'login' | 'transaction' | 'account_change' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'resolved' | 'investigating' | 'open';
}

interface SecuritySetting {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'authentication' | 'monitoring' | 'transactions' | 'data';
  icon: React.ReactNode;
}

export default function SecurityDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: securityEvents, isLoading: eventsLoading } = useQuery<SecurityEvent[]>({
    queryKey: ['/api/security/events'],
    enabled: isAuthenticated,
  });

  const { data: securityStatus } = useQuery({
    queryKey: ['/api/security/status'],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>([
    {
      id: 'two_factor',
      name: 'Two-Factor Authentication',
      description: 'Require SMS or authenticator app for login',
      enabled: true,
      category: 'authentication',
      icon: <Smartphone className="w-5 h-5" />
    },
    {
      id: 'email_notifications',
      name: 'Security Email Alerts',
      description: 'Get notified of security events via email',
      enabled: true,
      category: 'monitoring',
      icon: <Mail className="w-5 h-5" />
    },
    {
      id: 'transaction_limits',
      name: 'Transaction Limits',
      description: 'Enforce daily/monthly transaction limits',
      enabled: true,
      category: 'transactions',
      icon: <Lock className="w-5 h-5" />
    },
    {
      id: 'ip_monitoring',
      name: 'IP Address Monitoring',
      description: 'Monitor logins from unusual locations',
      enabled: true,
      category: 'monitoring',
      icon: <Globe className="w-5 h-5" />
    },
    {
      id: 'session_timeout',
      name: 'Auto Logout',
      description: 'Automatically logout after inactivity',
      enabled: true,
      category: 'authentication',
      icon: <Clock className="w-5 h-5" />
    },
    {
      id: 'data_encryption',
      name: 'Enhanced Encryption',
      description: 'Additional encryption for sensitive data',
      enabled: true,
      category: 'data',
      icon: <Database className="w-5 h-5" />
    }
  ]);

  const events: SecurityEvent[] = securityEvents || [
    {
      id: '1',
      type: 'login',
      severity: 'low',
      description: 'Successful login from new device',
      timestamp: new Date().toISOString(),
      ipAddress: '192.168.1.100',
      userAgent: 'Chrome/91.0',
      status: 'resolved'
    },
    {
      id: '2', 
      type: 'transaction',
      severity: 'medium',
      description: 'Large transaction attempted',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'resolved'
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'investigating': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'open': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const toggleSetting = (settingId: string) => {
    setSecuritySettings(prev => 
      prev.map(setting => 
        setting.id === settingId 
          ? { ...setting, enabled: !setting.enabled }
          : setting
      )
    );
  };

  const securityScore = Math.round(
    (securitySettings.filter(s => s.enabled).length / securitySettings.length) * 100
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">Security Access Required</h2>
            <p className="text-gray-600 mb-4">
              Please sign in to access security dashboard.
            </p>
            <Button onClick={() => window.location.href = "/api/login"}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Security Center</h1>
              <p className="text-gray-600">Monitor and manage platform security</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={securityScore >= 80 ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                Security Score: {securityScore}%
              </Badge>
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Audit Log
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="events">Security Events</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Security Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Security Score</p>
                      <p className="text-2xl font-bold text-green-600">{securityScore}%</p>
                    </div>
                    <Shield className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Threats</p>
                      <p className="text-2xl font-bold text-red-600">
                        {events.filter(e => e.status === 'open').length}
                      </p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Protected Features</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {securitySettings.filter(s => s.enabled).length}
                      </p>
                    </div>
                    <Lock className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Recent Events</p>
                      <p className="text-2xl font-bold text-purple-600">{events.length}</p>
                    </div>
                    <Activity className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Security Status Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Security Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Authentication</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Secure</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Data Encryption</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Network Security</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Protected</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium">Compliance Audit</span>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Due Soon</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Recent Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {events.slice(0, 4).map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(event.status)}
                        <div>
                          <p className="text-sm font-medium">{event.description}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No recent security events</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Security Event Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(event.status)}
                        <div>
                          <h3 className="font-medium">{event.description}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>{new Date(event.timestamp).toLocaleString()}</span>
                            {event.ipAddress && <span>IP: {event.ipAddress}</span>}
                            {event.userAgent && <span>{event.userAgent}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                        <Button variant="outline" size="sm">
                          Details
                        </Button>
                      </div>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No security events recorded</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {['authentication', 'monitoring', 'transactions', 'data'].map((category) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category} Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {securitySettings
                    .filter(setting => setting.category === category)
                    .map((setting) => (
                      <div key={setting.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {setting.icon}
                          </div>
                          <div>
                            <h3 className="font-medium">{setting.name}</h3>
                            <p className="text-sm text-gray-600">{setting.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={setting.enabled}
                          onCheckedChange={() => toggleSetting(setting.id)}
                        />
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Security Reports
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Download Security Audit Report
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Export Event Log (CSV)
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Compliance Report
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Risk Assessment Summary
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full">
                    <Shield className="w-4 h-4 mr-2" />
                    Run Security Scan
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Lock className="w-4 h-4 mr-2" />
                    Force Password Reset
                  </Button>
                  <Button variant="outline" className="w-full">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Review Suspicious Activity
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Activity className="w-4 h-4 mr-2" />
                    Update Security Policies
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}