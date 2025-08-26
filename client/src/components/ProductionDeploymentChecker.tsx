import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Database, 
  CreditCard,
  Mail,
  Shield,
  Globe,
  Rocket
} from 'lucide-react';

interface SystemCheck {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'checking';
  icon: React.ComponentType<any>;
  critical: boolean;
  details?: string;
}

export function ProductionDeploymentChecker() {
  const [checks, setChecks] = useState<SystemCheck[]>([
    {
      id: 'database',
      name: 'Database Connection',
      description: 'PostgreSQL database connectivity and schema validation',
      status: 'checking',
      icon: Database,
      critical: true
    },
    {
      id: 'payments',
      name: 'Payment Processing',
      description: 'Stripe integration and payment intent generation',
      status: 'checking',
      icon: CreditCard,
      critical: true
    },
    {
      id: 'email',
      name: 'Email Service',
      description: 'SendGrid email service configuration',
      status: 'checking',
      icon: Mail,
      critical: false
    },
    {
      id: 'auth',
      name: 'Authentication',
      description: 'Replit OAuth and session management',
      status: 'checking',
      icon: Shield,
      critical: true
    },
    {
      id: 'marketplace',
      name: 'Marketplace API',
      description: 'AI marketplace services and order management',
      status: 'checking',
      icon: Globe,
      critical: true
    },
    {
      id: 'agents',
      name: 'Agent System',
      description: 'Agent registration and commission tracking',
      status: 'checking',
      icon: Rocket,
      critical: false
    }
  ]);

  const [overallStatus, setOverallStatus] = useState<'checking' | 'ready' | 'issues'>('checking');
  const [completionPercentage, setCompletionPercentage] = useState(0);

  useEffect(() => {
    runSystemChecks();
  }, []);

  const runSystemChecks = async () => {
    const updatedChecks = [...checks];

    // Database check
    try {
      const response = await fetch('/api/marketplace/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        updatedChecks[0].status = data.success ? 'passed' : 'failed';
        updatedChecks[0].details = data.success 
          ? `${data.data.totalOrders} orders, $${data.data.totalRevenue} revenue`
          : 'Database query failed';
      } else {
        updatedChecks[0].status = 'failed';
        updatedChecks[0].details = 'API endpoint not accessible';
      }
    } catch (error) {
      updatedChecks[0].status = 'failed';
      updatedChecks[0].details = 'Connection failed';
    }

    // Payment system check
    try {
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1, orderId: 'test', serviceId: 'test' })
      });
      if (response.ok) {
        const data = await response.json();
        updatedChecks[1].status = data.clientSecret ? 'passed' : 'failed';
        updatedChecks[1].details = data.clientSecret 
          ? 'Payment intent generation successful'
          : 'No client secret returned';
      } else {
        updatedChecks[1].status = 'failed';
        updatedChecks[1].details = 'Payment API not responding';
      }
    } catch (error) {
      updatedChecks[1].status = 'failed';
      updatedChecks[1].details = 'Stripe integration failed';
    }

    // Email service check - Make API call to backend to check status
    try {
      const response = await fetch('/api/health/email');
      if (response.ok) {
        const data = await response.json();
        updatedChecks[2].status = data.configured ? 'passed' : 'warning';
        updatedChecks[2].details = data.configured 
          ? 'SendGrid API key configured'
          : 'SendGrid API key not set (emails will be simulated)';
      } else {
        updatedChecks[2].status = 'warning';
        updatedChecks[2].details = 'Cannot verify email configuration';
      }
    } catch (error) {
      updatedChecks[2].status = 'warning';
      updatedChecks[2].details = 'Cannot verify email configuration';
    }

    // Auth system check
    try {
      const response = await fetch('/api/auth/user');
      updatedChecks[3].status = response.status === 401 ? 'passed' : 'warning';
      updatedChecks[3].details = response.status === 401 
        ? 'Authentication system responding correctly'
        : 'Unexpected auth response';
    } catch (error) {
      updatedChecks[3].status = 'failed';
      updatedChecks[3].details = 'Auth system not responding';
    }

    // Marketplace API check
    try {
      const response = await fetch('/api/marketplace/dashboard/recent-orders');
      if (response.ok) {
        const data = await response.json();
        updatedChecks[4].status = data.success ? 'passed' : 'failed';
        updatedChecks[4].details = data.success 
          ? `${data.orders?.length || 0} recent orders found`
          : 'Marketplace API error';
      } else {
        updatedChecks[4].status = 'failed';
        updatedChecks[4].details = 'Marketplace API not accessible';
      }
    } catch (error) {
      updatedChecks[4].status = 'failed';
      updatedChecks[4].details = 'Marketplace connection failed';
    }

    // Agent system check
    try {
      const response = await fetch('/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Agent', email: 'test@test.com', specialties: ['test'] })
      });
      updatedChecks[5].status = response.ok ? 'passed' : 'warning';
      updatedChecks[5].details = response.ok 
        ? 'Agent registration system operational'
        : 'Agent system needs configuration';
    } catch (error) {
      updatedChecks[5].status = 'warning';
      updatedChecks[5].details = 'Agent system not fully configured';
    }

    setChecks(updatedChecks);

    // Calculate overall status
    const criticalIssues = updatedChecks.filter(check => check.critical && check.status === 'failed');
    const completedChecks = updatedChecks.filter(check => check.status !== 'checking');
    const passedChecks = updatedChecks.filter(check => check.status === 'passed');

    setCompletionPercentage((completedChecks.length / updatedChecks.length) * 100);

    if (criticalIssues.length > 0) {
      setOverallStatus('issues');
    } else if (completedChecks.length === updatedChecks.length) {
      setOverallStatus('ready');
    } else {
      setOverallStatus('checking');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string, critical: boolean) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
      case 'failed':
        return <Badge className={`${critical ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {critical ? 'Critical' : 'Issue'}
        </Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Checking</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Production Deployment Status</CardTitle>
            <p className="text-gray-600 mt-2">System readiness verification for Coin Railz platform</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{Math.round(completionPercentage)}%</div>
            <div className="text-sm text-gray-500">Complete</div>
          </div>
        </div>
        <Progress value={completionPercentage} className="mt-4" />
      </CardHeader>

      <CardContent className="space-y-4">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <div key={check.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(check.status)}
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium">{check.name}</h3>
                  <p className="text-sm text-gray-600">{check.description}</p>
                  {check.details && (
                    <p className="text-xs text-gray-500 mt-1">{check.details}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(check.status, check.critical)}
                {check.critical && (
                  <Badge variant="outline" className="text-xs">Required</Badge>
                )}
              </div>
            </div>
          );
        })}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">
                {overallStatus === 'ready' && '🚀 Ready for Production Deployment'}
                {overallStatus === 'issues' && '⚠️ Critical Issues Need Resolution'}
                {overallStatus === 'checking' && '🔍 System Check in Progress'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {overallStatus === 'ready' && 'All critical systems are operational. Platform ready for deployment.'}
                {overallStatus === 'issues' && 'Critical components have issues that must be resolved before deployment.'}
                {overallStatus === 'checking' && 'Running comprehensive system validation...'}
              </p>
            </div>
            <Button 
              onClick={runSystemChecks}
              variant={overallStatus === 'ready' ? 'default' : 'outline'}
              disabled={overallStatus === 'checking'}
            >
              {overallStatus === 'checking' ? 'Checking...' : 'Recheck Systems'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}