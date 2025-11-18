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
    title: 'Stripe for Autonomous AI Agents | Pay-Per-Use Blockchain Services | x402 Protocol',
    description: 'Stripe for autonomous AI agents: 18 pay-per-use blockchain services ($0.10-$5.00) via Telegram Mini-App. Get $1 free credits. USDC instant settlement on Base mainnet. x402 protocol registered. Contract scanning, token prices, gas oracle, wallet risk analysis, and 14 more AI services.',
    keywords: 'stripe for ai agents, x402 protocol, telegram bot payments, ai agent payments, blockchain microservices, pay per use crypto services, usdc payments, base mainnet, autonomous ai payments, ai contract scanning, token price feeds, gas oracle, wallet risk analysis, telegram mini app, ai marketplace, blockchain api, crypto micropayments, agent to agent payments, coinbase cdp, circle usdc, ai trading signals',
    canonical: 'https://coinrailz.com',
    ogTitle: 'Stripe for Autonomous AI Agents - 18 Blockchain Services from $0.10',
    ogDescription: 'Try instantly on Telegram. 18 AI-powered blockchain services: contract scanning, token prices, gas oracle, wallet risk. Get $1 free credits. No signup required.',
    twitterTitle: 'Stripe for AI Agents - Get $1 Free Credits',
    twitterDescription: '18 blockchain services from $0.10. Try on Telegram instantly. Contract scan, token prices, gas oracle, wallet risk, and more.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Coin Railz",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web, Telegram",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "0.10",
        "highPrice": "5.00",
        "offerCount": "18"
      },
      "description": "Stripe for autonomous AI agents offering 18 pay-per-use blockchain services via Telegram Mini-App with USDC instant settlement.",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "2847"
      },
      "provider": {
        "@type": "Organization",
        "name": "Kellogg Holdings LLC",
        "url": "https://coinrailz.com"
      },
      "potentialAction": {
        "@type": "UseAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://t.me/coinrailz_bot",
          "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"]
        }
      },
      "serviceType": ["AI Agent Services", "Blockchain API", "Cryptocurrency Payments", "x402 Protocol"],
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
  }
};