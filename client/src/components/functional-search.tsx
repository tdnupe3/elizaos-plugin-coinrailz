import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowRight, DollarSign, Users, Globe, Bot } from "lucide-react";
import { useLocation } from "wouter";

interface SearchResult {
  title: string;
  description: string;
  category: string;
  route: string;
  features: string[];
}

export function FunctionalSearch() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const allServices: SearchResult[] = [
    {
      title: "P2P Money Transfer",
      description: "Send money globally with ultra-low fees",
      category: "Payments",
      route: "/p2p-transfer",
      features: ["1-2.5% fees", "Instant transfers", "Global reach"]
    },
    {
      title: "DEX Aggregator",
      description: "Trade crypto across 15+ networks",
      category: "Trading",
      route: "/swap",
      features: ["0.75% platform fee", "Best rates", "Multi-chain"]
    },
    {
      title: "AI Agent Marketplace",
      description: "Access autonomous AI agents for various tasks",
      category: "AI Services",
      route: "/ai-marketplace",
      features: ["25% commission", "Verified agents", "Escrow protection"]
    },
    {
      title: "XRP Ecosystem",
      description: "Ultra-low cost cross-border payments",
      category: "Blockchain",
      route: "/xrp-ecosystem",
      features: ["$0.0002 fees", "3-second settlement", "Global liquidity"]
    },
    {
      title: "Crypto Wallet",
      description: "Multi-chain wallet management",
      category: "Wallet",
      route: "/wallet-management",
      features: ["15+ networks", "Secure storage", "Easy management"]
    },
    {
      title: "Portfolio Analytics",
      description: "Track your investments and performance",
      category: "Analytics",
      route: "/portfolio-analytics",
      features: ["Real-time tracking", "Performance metrics", "Insights"]
    }
  ];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 0) {
      const filtered = allServices.filter(service => 
        service.title.toLowerCase().includes(query.toLowerCase()) ||
        service.description.toLowerCase().includes(query.toLowerCase()) ||
        service.category.toLowerCase().includes(query.toLowerCase()) ||
        service.features.some(feature => feature.toLowerCase().includes(query.toLowerCase()))
      );
      setSearchResults(filtered);
      setShowResults(true);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Payments": return <DollarSign className="w-4 h-4" />;
      case "Trading": return <ArrowRight className="w-4 h-4" />;
      case "AI Services": return <Bot className="w-4 h-4" />;
      case "Blockchain": return <Globe className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Payments": return "bg-blue-100 text-blue-800";
      case "Trading": return "bg-purple-100 text-purple-800";
      case "AI Services": return "bg-orange-100 text-orange-800";
      case "Blockchain": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-2xl mx-auto mb-8">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          type="text"
          placeholder="Search services: P2P, DEX, AI agents, XRP..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 pr-4 py-3 text-lg border-2 border-gray-300 focus:border-blue-500 rounded-lg"
        />
      </div>

      {showResults && (
        <Card className="mt-4 border-2 border-blue-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">
              {searchResults.length > 0 
                ? `Found ${searchResults.length} service${searchResults.length > 1 ? 's' : ''}`
                : 'No services found'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map((result, index) => (
                  <div 
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setLocation(result.route)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getCategoryIcon(result.category)}
                          <h3 className="font-semibold text-gray-900">{result.title}</h3>
                          <Badge className={getCategoryColor(result.category)}>
                            {result.category}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{result.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {result.features.map((feature, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" className="ml-4">
                        Access
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                Try searching for: "P2P", "DEX", "AI", "XRP", "wallet", or "analytics"
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}