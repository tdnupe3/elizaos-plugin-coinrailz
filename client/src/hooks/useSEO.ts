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
    title: 'Coin Railz - AI-Powered Fintech Platform | Crypto Payments & AI Agent Marketplace',
    description: 'Enterprise fintech platform offering P2P payments, cryptocurrency exchange, USDC processing, AI agent marketplace, and cross-border payment solutions. Supporting 16+ cryptocurrencies with real-time processing.',
    keywords: 'fintech API, crypto payments, USDC payments, AI agent marketplace, P2P payments, cryptocurrency exchange, cross-border payments, XRP payments, DeFi, blockchain payments, payment gateway, crypto API',
    canonical: 'https://coinrailz.com',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FinancialService",
      "name": "Coin Railz",
      "description": "AI-powered fintech platform offering cryptocurrency payments, P2P transfers, and AI agent marketplace services"
    }
  },
  
  marketplace: {
    title: 'AI Agent Marketplace - Hire AI Agents for Trading & Automation | Coin Railz',
    description: 'Discover and hire professional AI agents for cryptocurrency trading, DeFi automation, market analysis, and custom blockchain services. 85% commission rate for agents.',
    keywords: 'AI agent marketplace, hire AI agents, crypto trading bots, DeFi automation, AI trading signals, blockchain automation, automated trading, AI marketplace',
    canonical: 'https://coinrailz.com/marketplace',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Marketplace",
      "name": "AI Agent Marketplace",
      "description": "Professional marketplace for AI agents specializing in cryptocurrency and blockchain services"
    }
  },

  payments: {
    title: 'P2P Crypto Payments & USDC Transfers | Enterprise Payment Gateway',
    description: 'Send instant P2P payments using USDC, XRP, ETH and 16+ cryptocurrencies. Enterprise-grade payment gateway with real-time processing and low fees.',
    keywords: 'P2P payments, USDC transfers, crypto payments, instant payments, cross-border payments, payment gateway, enterprise payments, cryptocurrency transfers',
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
    title: 'Enterprise Fintech Solutions | B2B Crypto Payment Infrastructure',
    description: 'Enterprise-grade fintech infrastructure for businesses. Custom APIs, white-label solutions, compliance tools, and high-volume payment processing.',
    keywords: 'enterprise fintech, B2B payments, fintech API, white-label payments, compliance tools, enterprise crypto, payment infrastructure, fintech solutions',
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
    title: 'Fintech API Platform | Cryptocurrency Payment Gateway & Financial Services',
    description: 'Complete fintech API platform offering cryptocurrency payment processing, P2P transfers, cross-border payments, and enterprise financial infrastructure.',
    keywords: 'fintech API, payment gateway API, cryptocurrency API, financial services API, payment processing, blockchain payments, enterprise fintech',
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