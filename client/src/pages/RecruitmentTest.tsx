import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Github, Users, Search } from "lucide-react";

interface DiscoveryResult {
  success: boolean;
  message: string;
  results: {
    totalDiscovered: number;
    githubTokenConfigured: boolean;
    sampleAgents: Array<{
      type: string;
      owner: string;
      repoName: string;
      description: string;
      stars: number;
      language: string;
      searchTerm: string;
    }>;
    apiStatus: {
      github: string;
      reddit: string;
      twitter: string;
      email: string;
    };
  };
}

export default function RecruitmentTest() {
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult | null>(null);

  const testDiscovery = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/recruitment/test-github-discovery", { method: "POST" });
    },
    onSuccess: (data) => {
      setDiscoveryResults(data);
    },
    onError: (error) => {
      console.error("Discovery test failed:", error);
    }
  });

  const startRecruitment = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/recruitment/start-automated-recruitment", { method: "POST" });
    },
    onSuccess: (data) => {
      console.log("Recruitment campaign started:", data);
    }
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Agent Recruitment System</h1>
        <p className="text-muted-foreground">
          Automated discovery and recruitment of AI agents from GitHub, Reddit, and other platforms
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GitHub Discovery</CardTitle>
            <Github className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {discoveryResults?.results.githubTokenConfigured ? "Active" : "Limited"}
            </div>
            <p className="text-xs text-muted-foreground">
              Searches for AI agents and trading bots
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discovered Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {discoveryResults?.results.totalDiscovered || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Potential candidates found
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Status</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {discoveryResults ? "Ready" : "Standby"}
            </div>
            <p className="text-xs text-muted-foreground">
              System operational status
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Agent Discovery</CardTitle>
            <CardDescription>
              Run a test to discover potential AI agents on GitHub
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => testDiscovery.mutate()}
              disabled={testDiscovery.isPending}
              className="w-full"
            >
              {testDiscovery.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Discovering Agents...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Test GitHub Discovery
                </>
              )}
            </Button>

            {discoveryResults && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold mb-2">API Status</h4>
                    <div className="space-y-1">
                      {Object.entries(discoveryResults.results.apiStatus).map(([platform, status]) => (
                        <div key={platform} className="flex justify-between items-center">
                          <span className="capitalize">{platform}:</span>
                          <Badge variant={status.includes("authenticated") ? "default" : "secondary"}>
                            {status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Discovery Results</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Found {discoveryResults.results.totalDiscovered} potential agents
                    </p>
                    <Badge variant="outline">
                      {discoveryResults.results.githubTokenConfigured ? "Full Access" : "Limited Rate"}
                    </Badge>
                  </div>
                </div>

                {discoveryResults.results.sampleAgents.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Sample Discovered Agents</h4>
                    <div className="space-y-3">
                      {discoveryResults.results.sampleAgents.map((agent, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h5 className="font-medium">{agent.owner}</h5>
                              <p className="text-sm text-muted-foreground">{agent.repoName}</p>
                            </div>
                            <div className="flex space-x-2">
                              <Badge variant="secondary">{agent.language}</Badge>
                              <Badge variant="outline">⭐ {agent.stars}</Badge>
                            </div>
                          </div>
                          <p className="text-sm mb-2">{agent.description}</p>
                          <Badge variant="outline" className="text-xs">
                            Found via: {agent.searchTerm}
                          </Badge>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start Recruitment Campaign</CardTitle>
            <CardDescription>
              Launch automated recruitment to discovered agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => startRecruitment.mutate()}
              disabled={startRecruitment.isPending || !discoveryResults}
              variant="destructive"
              className="w-full"
            >
              {startRecruitment.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Campaign...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Start Automated Recruitment
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              This will contact discovered agents via GitHub issues or email
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}