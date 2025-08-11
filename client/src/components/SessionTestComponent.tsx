import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function SessionTestComponent() {
  const { isAuthenticated, user, refreshSession, authProvider, isLoading } = useAuth();
  const [sessionData, setSessionData] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const checkSessionHealth = async () => {
    setTestLoading(true);
    try {
      const response = await fetch('/api/auth/session-check');
      const data = await response.json();
      setSessionData(data);
    } catch (error) {
      console.error('Session check failed:', error);
      setSessionData({ error: error });
    } finally {
      setTestLoading(false);
    }
  };

  const testCoinbaseLogin = () => {
    window.location.href = '/auth/coinbase/login';
  };

  const testReplitLogin = () => {
    window.location.href = '/api/login';
  };

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Session Persistence Test
          {isAuthenticated ? (
            <Badge className="bg-green-100 text-green-800">Signed In</Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800">Signed Out</Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Auth Status */}
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium mb-2">Authentication Status</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Authenticated:</strong> {isAuthenticated ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Provider:</strong> {authProvider}
            </div>
            <div>
              <strong>User ID:</strong> {user?.id || 'None'}
            </div>
            <div>
              <strong>Email:</strong> {user?.email || 'None'}
            </div>
          </div>
          
          <div className="mt-3 flex gap-2">
            <Button 
              size="sm" 
              onClick={refreshSession}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh Session
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={checkSessionHealth}
              disabled={testLoading}
            >
              Check Session Health
            </Button>
          </div>
        </div>

        {/* Login Options */}
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium mb-2">Quick Login (7-Day Session)</h4>
          <div className="flex gap-2">
            <Button 
              size="sm"
              onClick={testCoinbaseLogin}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Sign in with Coinbase
            </Button>
            <Button 
              size="sm"
              variant="outline"
              onClick={testReplitLogin}
            >
              Sign in with Replit
            </Button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Sessions persist for 7 days and extend automatically with activity
          </p>
        </div>

        {/* Session Health Data */}
        {sessionData && (
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium mb-2">Session Health Check</h4>
            <div className="text-sm space-y-1">
              <div>
                <strong>Session Exists:</strong> {sessionData.sessionExists ? '✅ Yes' : '❌ No'}
              </div>
              <div>
                <strong>User in Session:</strong> {sessionData.userInSession ? '✅ Yes' : '❌ No'}
              </div>
              <div>
                <strong>Coinbase Auth:</strong> {sessionData.coinbaseAuth ? '✅ Yes' : '❌ No'}
              </div>
              <div>
                <strong>Replit Auth:</strong> {sessionData.replitAuth ? '✅ Yes' : '❌ No'}
              </div>
              <div>
                <strong>Session ID:</strong> {sessionData.sessionId || 'None'}
              </div>
              <div>
                <strong>Timestamp:</strong> {sessionData.timestamp}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h4 className="font-medium mb-2 text-yellow-800">Test Instructions</h4>
          <ol className="text-sm text-yellow-700 space-y-1">
            <li>1. Sign in using one of the login methods above</li>
            <li>2. Navigate away from this page (go to dashboard, then back to homepage)</li>
            <li>3. Return here - you should still be signed in</li>
            <li>4. Close your browser completely and reopen - session should persist</li>
            <li>5. Sessions automatically extend with activity and last 7 days</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}