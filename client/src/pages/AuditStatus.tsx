/**
 * 🔍 Audit Status Page
 * Simple status checker for customers to view their audit progress and download results
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, Download, ExternalLink, Search } from 'lucide-react';

interface AuditStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress: number;
  submittedAt: string;
  auditCompletedAt?: string;
  certificateGenerated: boolean;
  downloadAccess?: {
    directUrl: string;
    accessToken: string;
    message: string;
    instructions: string;
  };
}

interface AuditResults {
  auditId: string;
  contractName: string;
  blockchain: string;
  grade: string;
  score: number;
  summary: string;
  vulnerabilities: any[];
  certificateUrl: string;
  certificateId: string;
}
interface AuditStatusResponse {
  status: AuditStatus;
  downloadAccess?: AuditStatus["downloadAccess"];
}
type AuditResultsResponse =
  | { status: "processing"; message: string }
  | { status: "completed"; results: AuditResults };

export default function AuditStatus() {
  const [auditId, setAuditId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [searchMode, setSearchMode] = useState<'id' | 'token'>('id');

  // Query for audit status (when using audit ID) - PUBLIC endpoint for guests
  const { data: statusData, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useQuery<AuditStatusResponse>({
    queryKey: ['/api/audits/guest-status', auditId],
    enabled: searchMode === 'id' && !!auditId,
  });

  // Query for audit results (when using access token)
  const { data: resultsData, isLoading: resultsLoading, error: resultsError, refetch: refetchResults } = useQuery<AuditResultsResponse>({
    queryKey: ['/api/audits/results', accessToken],
    enabled: searchMode === 'token' && !!accessToken,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-yellow-500';
      case 'F': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleSearch = () => {
    if (searchMode === 'id') {
      refetchStatus();
    } else {
      refetchResults();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Audit Status Checker
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Check the status of your smart contract audit and download results
          </p>
        </div>

        {/* Search Interface */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Find Your Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={searchMode === 'id' ? 'default' : 'outline'}
                onClick={() => setSearchMode('id')}
                data-testid="button-search-by-id"
              >
                Search by Audit ID
              </Button>
              <Button
                variant={searchMode === 'token' ? 'default' : 'outline'}
                onClick={() => setSearchMode('token')}
                data-testid="button-search-by-token"
              >
                Search by Access Token
              </Button>
            </div>

            <div className="flex gap-2">
              {searchMode === 'id' ? (
                <Input
                  placeholder="Enter your Audit ID..."
                  value={auditId}
                  onChange={(e) => setAuditId(e.target.value)}
                  data-testid="input-audit-id"
                />
              ) : (
                <Input
                  placeholder="Enter your Access Token..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  data-testid="input-access-token"
                />
              )}
              <Button 
                onClick={handleSearch}
                disabled={(searchMode === 'id' && !auditId) || (searchMode === 'token' && !accessToken)}
                data-testid="button-search"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status Results */}
        {statusLoading && (
          <Card>
            <CardContent className="py-8 text-center">
              <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading audit status...</p>
            </CardContent>
          </Card>
        )}

        {statusData && searchMode === 'id' && (
          <Card data-testid="card-audit-status">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Audit Status</span>
                <Badge className={getStatusColor(statusData.status.status)}>
                  {statusData.status.status.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{statusData.status.progress}%</span>
                </div>
                <Progress value={statusData.status.progress} className="w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="font-medium" data-testid="text-submitted-date">
                    {new Date(statusData.status.submittedAt).toLocaleString()}
                  </p>
                </div>
                {statusData.status.auditCompletedAt && (
                  <div>
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="font-medium" data-testid="text-completed-date">
                      {new Date(statusData.status.auditCompletedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {statusData.status.status === 'completed' && statusData.downloadAccess && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="font-medium text-green-800 dark:text-green-200">
                      {statusData.downloadAccess.message}
                    </p>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                    {statusData.downloadAccess.instructions}
                  </p>
                  <Button 
                    asChild 
                    className="w-full"
                    data-testid="button-download-results"
                  >
                    <a href={statusData.downloadAccess.directUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      View Your Audit Results
                    </a>
                  </Button>
                </div>
              )}

              {statusData.status.status === 'in_progress' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                    <p className="font-medium text-blue-800 dark:text-blue-200">
                      Audit in Progress
                    </p>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Your audit is being processed. Estimated completion: ~5 minutes
                  </p>
                  <Button 
                    onClick={handleSearch}
                    variant="outline"
                    className="mt-3"
                    data-testid="button-refresh-status"
                  >
                    Refresh Status
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Display */}
        {resultsData && searchMode === 'token' && (
          <div className="space-y-6">
            {resultsData.status === 'processing' ? (
              <Card data-testid="card-processing">
                <CardContent className="py-8 text-center">
                  <Clock className="h-12 w-12 animate-pulse mx-auto mb-4 text-blue-500" />
                  <h3 className="text-xl font-semibold mb-2">Audit in Progress</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {resultsData.message}
                  </p>
                  <Button onClick={handleSearch} variant="outline" data-testid="button-check-again">
                    Check Again
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Audit Summary */}
                <Card data-testid="card-audit-summary">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Audit Complete</span>
                      <Badge className={getGradeColor(resultsData.results.grade)}>
                        Grade: {resultsData.results.grade}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-gray-500">Contract</p>
                        <p className="font-medium" data-testid="text-contract-name">
                          {resultsData.results.contractName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Blockchain</p>
                        <p className="font-medium" data-testid="text-blockchain">
                          {resultsData.results.blockchain}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Score</p>
                        <p className="font-medium text-2xl" data-testid="text-score">
                          {resultsData.results.score}/100
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Vulnerabilities</p>
                        <p className="font-medium" data-testid="text-vulnerabilities-count">
                          {resultsData.results.vulnerabilities?.length || 0} found
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Audit Summary</h4>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                          <p className="text-sm whitespace-pre-wrap" data-testid="text-audit-summary">
                            {resultsData.results.summary}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button asChild className="flex-1" data-testid="button-view-certificate">
                          <a href={resultsData.results.certificateUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Certificate
                          </a>
                        </Button>
                        <Button variant="outline" className="flex-1" data-testid="button-view-full-report">
                          <Download className="h-4 w-4 mr-2" />
                          Download Full Report
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Error States */}
        {(statusError || resultsError) && (
          <Card data-testid="card-error">
            <CardContent className="py-8 text-center">
              <p className="text-red-600 dark:text-red-400">
                Failed to load audit information. Please check your ID/token and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {((searchMode === 'id' && auditId && !statusLoading && !statusData && !statusError) ||
          (searchMode === 'token' && accessToken && !resultsLoading && !resultsData && !resultsError)) && (
          <Card data-testid="card-no-results">
            <CardContent className="py-8 text-center">
              <p className="text-gray-600 dark:text-gray-300">
                No audit found with the provided {searchMode === 'id' ? 'ID' : 'token'}. Please check and try again.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}