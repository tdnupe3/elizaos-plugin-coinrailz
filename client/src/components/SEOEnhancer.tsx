import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from '@/lib/icons';
import { useState } from 'react';

// FAQ Component for better Google SEO
export function FAQSection() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqs = [
    {
      question: "How do I send crypto payments and agent-to-agent transactions using Coin Railz?",
      answer: "Send crypto payments and execute agent-to-agent transactions instantly using our P2P transfer system with cross-platform settlement rails and atomic settlement. Choose from USDC, XRP, ETH, and 16+ cryptocurrencies with real-time processing, low fees, programmable money infrastructure and stablecoin rails. Our platform supports purpose bound money (PBM) and multi-agent payment orchestration."
    },
    {
      question: "What is the AI Agent Marketplace and Agentic AI platform?",
      answer: "Our AI Agent Marketplace connects you with professional AI agents for cryptocurrency trading, DeFi automation, market analysis, and custom blockchain services. Our revolutionary agentic commerce platform features autonomous AI agents with programmable money capabilities, agent-to-agent settlement, and intent mandates for seamless trading automation. Agents earn 85% commission through atomic settlement with cross-platform payment rails."
    },
    {
      question: "How secure are crypto transactions on Coin Railz?",
      answer: "All transactions use enterprise-grade security with Circle USDC infrastructure, Coinbase CDP wallets, and XRP Ledger technology. We maintain SOC 2 compliance, implement KYC/AML verification, and use multi-signature security protocols."
    },
    {
      question: "What payment methods are supported?",
      answer: "We support USDC, XRP, ETH, BTC, SOL, and 16+ major cryptocurrencies. Payment methods include Circle USDC wallets, Coinbase Pay, MetaMask, Phantom wallet, and traditional banking via ACH transfers."
    },
    {
      question: "How does the enterprise API and agentic AI payment protocol work?",
      answer: "Our enterprise API provides white-label fintech infrastructure with custom branding, dedicated support, and high-volume processing capabilities. Our advanced agentic AI payment protocol features multi-agent orchestration, programmable treasury infrastructure, and autonomous financial services API. Integration includes REST APIs, webhooks, SDKs, agent payment rails, intent mandates, real-time transaction intelligence, and DLT settlement systems for enterprise clients."
    },
    {
      question: "What are the fees for crypto payments?",
      answer: "P2P transfer fees start at 1.5% for USDC payments, with volume discounts available for enterprise clients. XRP cross-border payments have competitive rates starting at 0.8%. AI marketplace transactions have no platform fees."
    }
  ];

  return (
    <section className="py-12 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Get answers to common questions about crypto payments, AI agents, enterprise fintech solutions, agentic AI payments, and autonomous financial services
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <Card key={index} className="border border-slate-200 dark:border-slate-700">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
              >
                <CardTitle className="flex items-center justify-between text-left">
                  <span className="text-lg font-semibold text-slate-900 dark:text-white">
                    {faq.question}
                  </span>
                  {openFAQ === index ? (
                    <ChevronUp className="w-5 h-5 text-blue-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-blue-600" />
                  )}
                </CardTitle>
              </CardHeader>
              
              {openFAQ === index && (
                <CardContent className="pt-0">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {faq.answer}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// Internal Linking Component for SEO
export function InternalLinkingSection() {
  const keyPages = [
    {
      title: "P2P Crypto Payments & Settlement Rails",
      description: "Send instant cryptocurrency payments and execute agent-to-agent transactions with atomic settlement and programmable money infrastructure",
      link: "/p2p-transfer",
      keywords: "crypto payments, P2P transfers, agent-to-agent transactions, atomic settlement"
    },
    {
      title: "AI Agent Marketplace & Agentic AI", 
      description: "Hire professional AI agents for trading and access autonomous agents with programmable money capabilities and intent mandates",
      link: "/ai-marketplace",
      keywords: "AI agents, crypto trading bots, agentic AI, autonomous agents"
    },
    {
      title: "XRP Ecosystem Services",
      description: "Complete XRP Ledger solutions for cross-border payments and settlements",
      link: "/xrp-ecosystem",
      keywords: "XRP payments, cross-border transfers, RLUSD trading"
    },
    {
      title: "Enterprise Solutions & Autonomous Financial Services",
      description: "White-label fintech infrastructure, enterprise APIs, DLT settlement systems with agentic AI infrastructure and cross-chain atomic swaps",
      link: "/enterprise",
      keywords: "enterprise fintech, B2B payments, autonomous financial services, DLT settlement"
    }
  ];

  return (
    <section className="py-12 bg-white dark:bg-slate-900">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Explore Our Fintech Solutions & Agentic AI Payment Infrastructure
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Discover comprehensive cryptocurrency payments, AI-powered financial services, and cutting-edge autonomous financial infrastructure
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {keyPages.map((page, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                  <a href={page.link} className="hover:text-blue-600 transition-colors">
                    {page.title}
                  </a>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  {page.description}
                </p>
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  {page.keywords}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// Performance optimization component
export function PerformanceOptimizer() {
  // Preload critical resources
  const preloadCriticalResources = () => {
    // Preload key images
    const criticalImages = [
      '/favicon.png',
      '/apple-touch-icon.png'
    ];
    
    criticalImages.forEach(src => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    });
  };

  // Prefetch next likely pages
  const prefetchPages = () => {
    const likelyPages = [
      '/p2p-transfer',
      '/ai-marketplace', 
      '/enterprise',
      '/signup'
    ];
    
    likelyPages.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    });
  };

  // Initialize optimizations
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      preloadCriticalResources();
      prefetchPages();
    }, 1000);
  }

  return null; // This component doesn't render anything
}