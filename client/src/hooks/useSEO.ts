import { useEffect } from 'react';

export interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  structuredData?: object;
}

export const useSEO = (config: SEOConfig) => {
  useEffect(() => {
    // Update document title
    if (config.title) {
      document.title = config.title;
    }

    // Create or update meta tags
    const updateMetaTag = (name: string, content: string, property?: boolean) => {
      const attribute = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      
      meta.content = content;
    };

    // Update basic meta tags
    if (config.description) {
      updateMetaTag('description', config.description);
    }

    if (config.keywords) {
      updateMetaTag('keywords', config.keywords);
    }

    // Update Open Graph tags
    if (config.ogTitle) {
      updateMetaTag('og:title', config.ogTitle, true);
    }

    if (config.ogDescription) {
      updateMetaTag('og:description', config.ogDescription, true);
    }

    if (config.ogImage) {
      updateMetaTag('og:image', config.ogImage, true);
    }

    // Update Twitter tags
    if (config.twitterTitle) {
      updateMetaTag('twitter:title', config.twitterTitle, true);
    }

    if (config.twitterDescription) {
      updateMetaTag('twitter:description', config.twitterDescription, true);
    }

    if (config.twitterImage) {
      updateMetaTag('twitter:image', config.twitterImage, true);
    }

    // Update canonical link
    if (config.canonical) {
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      
      canonical.href = config.canonical;
    }

    // Add structured data with unique IDs to prevent conflicts
    if (config.structuredData) {
      const pageIdentifier = window.location.pathname.replace(/\//g, '_').replace(/^_/, '') || 'home';
      const scriptId = `structured-data-${pageIdentifier}`;
      
      let script = document.querySelector(`script[type="application/ld+json"]#${scriptId}`) as HTMLScriptElement;
      
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = scriptId;
        document.head.appendChild(script);
      }
      
      script.textContent = JSON.stringify(config.structuredData);
    }

  }, [config]);
};

// SEO configurations for different pages
export const seoConfigs = {
  home: {
    title: 'Coin Railz | 60 Pay-Per-Call APIs for AI Agents — API Key in 60 Seconds',
    description: 'Access 60 pay-per-call APIs for AI agents across DeFi, IoT, satellite data & prediction markets. Get an API key in ~60 seconds via card, or use on-chain USDC via x402. From $0.03/call.',
    keywords: 'AI agent payments, pay per call API, API key instant, x402 protocol, micropayments, USDC payments, Base blockchain, Stripe x402, agentic commerce, agent-to-agent payments, MCP payments, IoT payments, satellite data API, prediction markets API, DeFi API, pay per use API, machine payments, Coinbase CDP wallets',
    canonical: 'https://coinrailz.com',
    ogTitle: 'Coin Railz | 60 APIs for AI Agents — API Key in 60 Seconds',
    ogDescription: 'Get an API key in ~60 seconds via card. 60 pay-per-call APIs across DeFi, IoT, satellite data & prediction markets. x402 on-chain USDC for advanced flows. From $0.03/call.',
    twitterTitle: 'Coin Railz | 60 APIs for AI Agents — API Key in 60 Seconds',
    twitterDescription: 'Get an API key in ~60 seconds via card. 60 pay-per-call APIs across DeFi, IoT, satellite data & prediction markets. x402 on-chain USDC for advanced flows.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Coin Railz",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "0.03",
        "highPrice": "100.00",
        "description": "60 pay-per-call APIs from $0.03/call. Get an API key in ~60 seconds via card, or pay on-chain with USDC via x402."
      },
      "description": "60 pay-per-call APIs for AI agents across DeFi, IoT, satellite data, and prediction markets. Get an API key in ~60 seconds via card, or pay on-chain with USDC via x402.",
      "provider": {
        "@type": "Organization",
        "name": "Kellogg Holdings LLC",
        "url": "https://coinrailz.com"
      },
      "potentialAction": [
        {
          "@type": "UseAction",
          "name": "AI Agent Micropayments",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://coinrailz.com/ai-marketplace",
            "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"]
          }
        },
        {
          "@type": "TradeAction",
          "name": "DEX Swap",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://coinrailz.com/swap",
            "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"]
          }
        }
      ],
      "serviceType": ["AI Agent Micropayments", "x402 Protocol", "Stripe Prepaid Credits", "Stock Sentiment API", "Forex Sentiment API", "DEX Aggregator", "Multi-Chain Swap"],
      "areaServed": "Worldwide"
    }
  },
  
  marketplace: {
    title: 'Agentic AI Marketplace - Autonomous Agents with Agent-to-Agent Payment Rails | Coin Railz',
    description: 'Revolutionary agentic commerce platform featuring autonomous AI agents with programmable money capabilities, agent-to-agent settlement, and intent mandates for seamless trading automation. 85% commission with atomic settlement.',
    keywords: 'AI agent marketplace, hire AI agents, crypto trading bots, DeFi automation, AI trading signals, blockchain automation, automated trading, AI marketplace, agentic AI marketplace, agentic commerce, autonomous agents, agent-to-agent payments, programmable money, agentic tokens, intent mandates, cart mandates, multi-agent orchestration',
    canonical: 'https://coinrailz.com/marketplace',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Marketplace",
      "name": "AI Agent Marketplace",
      "description": "Professional marketplace for AI agents specializing in cryptocurrency and blockchain services"
    }
  },

  payments: {
    title: 'Cross-Platform Settlement Rails & Atomic Settlement | Programmable Money Infrastructure',
    description: 'Advanced cross-platform settlement rails with atomic settlement, stablecoin rails, and programmable money infrastructure. Support for agent-to-agent transactions, purpose bound money (PBM), and instant multi-chain settlements.',
    keywords: 'P2P payments, USDC transfers, crypto payments, instant payments, cross-border payments, payment gateway, enterprise payments, cryptocurrency transfers, cross-platform settlement rails, atomic settlement, stablecoin rails, programmable money infrastructure, agent-to-agent transactions, purpose bound money, PBM, agentic payments, payment versus payment, PvP settlement',
    canonical: 'https://coinrailz.com/p2p-transfer',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "PaymentService",
      "name": "Coin Railz P2P Payments",
      "description": "Instant cryptocurrency payments and transfers"
    }
  },

  trading: {
    title: 'Cryptocurrency Exchange & DEX Trading | Multi-Chain Crypto Trading',
    description: 'Trade cryptocurrencies across multiple chains with DEX aggregation, real-time pricing, and professional trading tools. Support for XRP, USDC, ETH, SOL, and more.',
    keywords: 'cryptocurrency exchange, DEX trading, multi-chain trading, crypto trading, XRP trading, USDC exchange, DeFi trading, liquidity aggregation',
    canonical: 'https://coinrailz.com/trading',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "ExchangeService",
      "name": "Coin Railz Trading Platform",
      "description": "Multi-chain cryptocurrency exchange with professional trading tools"
    }
  },

  xrp: {
    title: 'XRP Ledger Services & Cross-Border Payments | Enterprise XRP Solutions',
    description: 'Complete XRP Ledger ecosystem including cross-border payments, instant settlements, RLUSD stablecoin trading, and enterprise XRP wallet solutions.',
    keywords: 'XRP Ledger, cross-border payments, XRP payments, RLUSD trading, XRP wallet, instant settlements, enterprise XRP, XRPL services',
    canonical: 'https://coinrailz.com/xrp',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FinancialService",
      "name": "XRP Ledger Services",
      "description": "Enterprise XRP Ledger services for cross-border payments and settlements"
    }
  },

  enterprise: {
    title: 'Autonomous Financial Services & DLT Settlement Systems | Enterprise Agentic AI',
    description: 'Enterprise autonomous financial services with DLT settlement systems, agentic AI infrastructure, cross-chain atomic swaps, and interoperable payment infrastructure. Complete token-versus-token (TvT) arrangements for institutional clients.',
    keywords: 'enterprise fintech, B2B payments, fintech API, white-label payments, compliance tools, enterprise crypto, payment infrastructure, fintech solutions, autonomous financial services, DLT settlement systems, agentic AI infrastructure, cross-chain atomic swaps, interoperable payment infrastructure, token-versus-token, TvT arrangements, hybrid settlement ecosystems, agentic commerce infrastructure',
    canonical: 'https://coinrailz.com/enterprise',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Coin Railz Enterprise Solutions",
      "description": "Enterprise fintech infrastructure and API solutions"
    }
  },

  // Enhanced SEO configurations for better Google ranking
  faq: {
    title: 'Frequently Asked Questions | Crypto Payments & AI Agent Marketplace',
    description: 'Get answers to common questions about Coin Railz crypto payments, P2P transfers, AI agent marketplace, and enterprise fintech solutions.',
    keywords: 'crypto payments FAQ, fintech questions, P2P payment help, AI agent marketplace guide, USDC transfer questions, XRP payment help',
    canonical: 'https://coinrailz.com/faq',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I send crypto payments using Coin Railz?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Send crypto payments instantly using our P2P transfer system. Choose from USDC, XRP, ETH, and 16+ cryptocurrencies with real-time processing and low fees."
          }
        },
        {
          "@type": "Question", 
          "name": "What is the AI Agent Marketplace?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Our AI Agent Marketplace connects you with professional AI agents for cryptocurrency trading, DeFi automation, market analysis, and custom blockchain services with 85% commission rates."
          }
        },
        {
          "@type": "Question",
          "name": "How secure are crypto transactions on Coin Railz?",
          "acceptedAnswer": {
            "@type": "Answer", 
            "text": "All transactions use enterprise-grade security with Circle USDC infrastructure, Coinbase CDP wallets, and XRP Ledger technology. KYC/AML compliance included."
          }
        }
      ]
    }
  },

  fintech: {
    title: 'Agentic AI Payment Protocol & Multi-Agent Orchestration API | Programmable Treasury',
    description: 'Advanced agentic AI payment protocol with multi-agent orchestration, programmable treasury infrastructure, and autonomous financial services API. Support for agent payment rails, intent mandates, and real-time transaction intelligence.',
    keywords: 'fintech API, payment gateway API, cryptocurrency API, financial services API, payment processing, blockchain payments, enterprise fintech, agentic AI payment protocol, multi-agent payment orchestration, programmable treasury, agent payment rails, intent mandates, real-time transaction intelligence, autonomous finance infrastructure, agentic commerce API, programmable money',
    canonical: 'https://coinrailz.com/fintech-api',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebAPI",
      "name": "Coin Railz Fintech API",
      "description": "Comprehensive fintech API for cryptocurrency payments and financial services",
      "documentation": "https://coinrailz.com/api-docs",
      "provider": {
        "@type": "Organization",
        "name": "Kellogg Holdings LLC"
      }
    }
  },

  // SDK Landing Page - 2026 Agentic Commerce Market ($1.7T by 2030)
  sdk: {
    title: 'AI Agent Payments SDK - Non-Custodial Payment Processing for Autonomous Agents | Coin Railz',
    description: 'Add payment capabilities to any AI agent in 3 lines of code. NPM, Python, Docker SDKs for ElizaOS, AgentKit, MCP. 1.5% + $0.01 fee. Multi-chain: Base, Ethereum, Polygon, Solana. Competing with Visa Intelligent Commerce, Mastercard Agent Pay, Google AP2.',
    keywords: 'AI agent payments SDK, agentic commerce, autonomous agent payments, agent-to-agent payments, ElizaOS payments, AgentKit integration, MCP payments, x402 protocol, AI payments infrastructure, non-custodial payments, autonomous payments SDK, agentic AI payments, programmable money SDK, agent payment rails 2026',
    canonical: 'https://coinrailz.com/sdk',
    ogTitle: 'AI Agent Payments SDK - 3 Lines of Code to Enable Autonomous Payments',
    ogDescription: 'NPM, Python, Docker SDKs for AI agent payments. Multi-chain support (7 EVM + Solana). 1.5% + $0.01 fee. ElizaOS, AgentKit, MCP compatible.',
    twitterTitle: 'AI Agent Payments SDK | Coin Railz',
    twitterDescription: 'Add payment capabilities to any AI agent. NPM: @coinrailz/agent-payments. Python: coinrailz. 43 bundled microservices.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Coin Railz Agent Payments SDK",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Cross-platform",
      "programmingLanguage": ["TypeScript", "JavaScript", "Python"],
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free SDK. Processing fee: 1.5% + $0.01 per transaction. $0.05 minimum."
      },
      "featureList": [
        "Non-custodial USDC payments",
        "Multi-chain support (Base, Ethereum, Polygon, Arbitrum, BSC, Optimism, Solana)",
        "43 bundled intelligence microservices",
        "ElizaOS plugin compatibility",
        "AgentKit tool integration",
        "MCP server implementation",
        "Docker/Kubernetes deployment"
      ],
      "softwareRequirements": "Node.js 18+ or Python 3.8+",
      "downloadUrl": [
        "https://www.npmjs.com/package/@coinrailz/agent-payments",
        "https://pypi.org/project/coinrailz/"
      ],
      "provider": {
        "@type": "Organization",
        "name": "Kellogg Holdings LLC",
        "url": "https://coinrailz.com"
      }
    }
  },

  // Solana SDK Page
  solana: {
    title: 'Solana AI Agent Payments SDK - SOL & USDC Processing for Autonomous Agents | Coin Railz',
    description: 'Non-custodial SOL and USDC payment processing for AI agents on Solana. NPM: @coinrailz/agent-payments-solana. Python: coinrailz-solana. 1.5% + $0.01 fee. Fast finality, low fees, DeFi integrations.',
    keywords: 'Solana AI payments, Solana agent SDK, SOL payments, USDC Solana, autonomous Solana payments, Solana agentic commerce, Solana x402, AI agent Solana, Solana payment processing, Solana developer SDK',
    canonical: 'https://coinrailz.com/solana',
    ogTitle: 'Solana AI Agent Payments SDK - Fast, Low-Cost Agent Payments',
    ogDescription: 'SOL & USDC payments for AI agents. Sub-second finality. NPM & Python packages available.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Coin Railz Solana Agent Payments SDK",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Cross-platform",
      "programmingLanguage": ["TypeScript", "JavaScript", "Python"],
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free SDK. Processing fee: 1.5% + $0.01 per transaction."
      },
      "featureList": [
        "SOL native payments",
        "USDC on Solana",
        "Sub-second transaction finality",
        "Low transaction fees",
        "Wallet generation and management",
        "SPL token support"
      ],
      "downloadUrl": [
        "https://www.npmjs.com/package/@coinrailz/agent-payments-solana",
        "https://pypi.org/project/coinrailz-solana/"
      ],
      "provider": {
        "@type": "Organization",
        "name": "Kellogg Holdings LLC",
        "url": "https://coinrailz.com"
      }
    }
  },

  // SDK Documentation Hub
  sdkDocs: {
    title: 'SDK Documentation - NPM, Python, Docker Installation Guides | Coin Railz',
    description: 'Complete SDK documentation for AI agent payment integration. Step-by-step guides for NPM (@coinrailz/agent-payments), Python (coinrailz), and Docker (tdnupe3/agent-payments). Framework guides for ElizaOS, AgentKit, MCP.',
    keywords: 'SDK documentation, AI agent SDK docs, payment SDK guide, ElizaOS integration guide, AgentKit tutorial, MCP payments documentation, agent payments API docs',
    canonical: 'https://coinrailz.com/docs/sdk',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "name": "Coin Railz SDK Documentation",
      "description": "Complete developer documentation for integrating AI agent payments",
      "author": {
        "@type": "Organization",
        "name": "Kellogg Holdings LLC"
      },
      "mainEntityOfPage": "https://coinrailz.com/docs/sdk"
    }
  },

  // API Keys Dashboard
  apiKeys: {
    title: 'API Keys Dashboard - Manage Your SDK Access | Coin Railz',
    description: 'Generate and manage API keys for Coin Railz SDKs. Monitor usage, view transaction history, configure webhooks, and manage your AI agent payment infrastructure.',
    keywords: 'API keys, SDK access, developer dashboard, payment API management, webhook configuration, usage monitoring',
    canonical: 'https://coinrailz.com/dashboard/api-keys',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Coin Railz API Keys Dashboard",
      "applicationCategory": "DeveloperApplication",
      "description": "Manage API keys and SDK access for AI agent payments"
    }
  }
};