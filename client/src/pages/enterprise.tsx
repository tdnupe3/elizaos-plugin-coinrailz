import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Shield, Zap, Globe, Users, TrendingUp, ArrowRight, CheckCircle } from "lucide-react";
import { useSEO, seoConfigs } from "@/hooks/useSEO";

export default function EnterprisePage() {
  const [, setLocation] = useLocation();

  // SEO optimization for enterprise page
  useSEO(seoConfigs.enterprise);

  const enterpriseFeatures = [
    {
      title: "Coinbase CDP Server Wallets",
      description: "Enterprise-grade multi-chain wallet infrastructure with 6 networks",
      icon: <Shield className="w-6 h-6" />,
      features: ["Smart Account Support", "Gas Sponsorship", "Multi-chain Operations", "API-first Integration"],
      route: "/cdp-wallet"
    },
    {
      title: "Circle USDC Enterprise",
      description: "Business banking with USDC infrastructure for institutional clients",
      icon: <Building2 className="w-6 h-6" />,
      features: ["ACH Integration", "Float Capital Management", "KYC/AML Compliance", "Banking API"],
      route: "/usdc-enterprise"
    },
    {
      title: "XRP Ledger Enterprise",
      description: "Complete XRPL financial services for cross-border payments",
      icon: <Globe className="w-6 h-6" />,
      features: ["Cross-border Payments", "Liquidity Provision", "Compliance Tools", "RLUSD Integration"],
      route: "/xrp-ecosystem"
    },
    {
      title: "AI Agent Marketplace Enterprise",
      description: "Custom AI agents and automation for institutional workflows",
      icon: <Zap className="w-6 h-6" />,
      features: ["Custom Agent Development", "Enterprise SLA", "Dedicated Support", "Advanced Analytics"],
      route: "/ai-marketplace-enterprise"
    },
    {
      title: "Data Intelligence APIs",
      description: "Enterprise APIs for crypto flow intelligence and behavioral analytics",
      icon: <TrendingUp className="w-6 h-6" />,
      features: ["Crypto Flow Data", "User Behavior Analytics", "Market Intelligence", "Custom Reporting"],
      route: "/data-apis"
    },
    {
      title: "White-label Solutions",
      description: "Full platform customization for enterprise branding and deployment",
      icon: <Users className="w-6 h-6" />,
      features: ["Custom Branding", "Dedicated Infrastructure", "Technical Support", "Revenue Sharing"],
      route: "/white-label"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">Coin Railz Enterprise</span>
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
              >
                Consumer Platform
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-blue-100 text-blue-800">Enterprise Solutions</Badge>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Enterprise Crypto Infrastructure
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Production-ready blockchain infrastructure, compliance tools, and custom solutions 
            for institutions, banks, and enterprise clients.
          </p>
          <div className="flex justify-center space-x-4">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Schedule Demo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline">
              View Documentation
            </Button>
          </div>
        </div>

        {/* Enterprise Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {enterpriseFeatures.map((feature, index) => (
            <Card key={index} className="bg-white shadow-lg hover:shadow-xl transition-shadow border-0">
              <CardHeader>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {feature.features.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setLocation(feature.route)}
                >
                  Learn More
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enterprise Benefits */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Why Choose Coin Railz Enterprise
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Enterprise Security</h3>
              <p className="text-gray-600 text-sm">Bank-level security with SOC 2 compliance and multi-sig infrastructure</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">99.9% Uptime</h3>
              <p className="text-gray-600 text-sm">Production-grade infrastructure with guaranteed uptime SLA</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Dedicated Support</h3>
              <p className="text-gray-600 text-sm">24/7 technical support with dedicated account management</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-semibold mb-2">Global Compliance</h3>
              <p className="text-gray-600 text-sm">Multi-jurisdiction compliance with automated KYC/AML</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Scale Your Crypto Operations?</h2>
          <p className="text-xl mb-6 text-blue-100">
            Join leading institutions using Coin Railz Enterprise infrastructure
          </p>
          <div className="flex justify-center space-x-4">
            <Button size="lg" variant="secondary">
              Schedule Enterprise Demo
            </Button>
            <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-blue-600">
              Contact Sales Team
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}