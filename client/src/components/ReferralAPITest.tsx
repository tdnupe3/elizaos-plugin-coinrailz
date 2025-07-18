import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReferralAPITest() {
  const [statsData, setStatsData] = useState<any>(null);
  const [generateResult, setGenerateResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testStatsEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/referrals/my-stats', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatsData(data);
    } catch (err: any) {
      setError(`Stats API Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testGenerateEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/referrals/generate-link', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      setGenerateResult(data);
      
      if (!response.ok) {
        setError(`Generate API Response: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setError(`Generate API Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testStatsEndpoint();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Referral API Integration Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={testStatsEndpoint} 
              disabled={loading}
              variant="outline"
            >
              Test Stats API
            </Button>
            <Button 
              onClick={testGenerateEndpoint} 
              disabled={loading}
              variant="outline"
            >
              Test Generate API
            </Button>
          </div>

          {loading && (
            <div className="text-blue-600">Testing API connection...</div>
          )}

          {error && (
            <div className="text-red-600 bg-red-50 p-3 rounded border">
              <strong>API Test Result:</strong> {error}
            </div>
          )}

          {statsData && (
            <div className="bg-green-50 p-4 rounded border">
              <h3 className="font-semibold text-green-800 mb-2">✅ Stats API Working</h3>
              <pre className="text-sm text-green-700 overflow-auto">
                {JSON.stringify(statsData, null, 2)}
              </pre>
            </div>
          )}

          {generateResult && (
            <div className="bg-blue-50 p-4 rounded border">
              <h3 className="font-semibold text-blue-800 mb-2">📝 Generate API Response</h3>
              <pre className="text-sm text-blue-700 overflow-auto">
                {JSON.stringify(generateResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}