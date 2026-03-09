
export class SimpleAgentRecruiter {
  private platformWallet = "rGs1Z6KkeSfQqY9m1NofySRsc1mDKTBzyW"; // Your XRP platform wallet
  private botEmail = "support@coinrailz.com";
  private githubToken = process.env.GITHUB_TOKEN || "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"; // Your provided GitHub token
  
  // AI Agent discovery sources - targeting ACTIVE TRANSACTING AGENTS
  private discoveryChannels = {
    github: {
      // Focus on agents with actual trading/financial transaction capabilities
      searchTerms: [
        "trading-bot+revenue", "crypto-bot+earnings", "defi-bot+yield", 
        "arbitrage-bot+profit", "automated-trading+api", "financial-ai+transactions",
        "trading-algorithm+live", "crypto-trading+automated", "yield-farming+bot",
        "mev-bot+ethereum", "dex-arbitrage", "liquidity-bot", "trading-api+integration"
      ],
      apiUrl: "https://api.github.com/search/repositories",
      // Target agents with proven transaction history
      requiredFeatures: ["api-integration", "wallet-connection", "transaction-history", "live-trading"]
    },
    twitter: {
      // Target hashtags showing actual trading activity and earnings
      hashtags: [
        "#TradingBot", "#CryptoBots", "#DeFiBots", "#AutomatedTrading", 
        "#ArbitrageBot", "#YieldFarming", "#MEVBot", "#TradingAlgorithm",
        "#CryptoEarnings", "#TradingProfits", "#BotTrading", "#AlgoTrading",
        "#QuantTrading", "#CryptoAPI", "#TradingSignals", "#BotRevenue"
      ],
      apiUrl: "https://api.twitter.com/2/tweets/search/recent",
      // Look for performance metrics and earnings reports
      performanceKeywords: ["profit", "earnings", "ROI", "performance", "returns", "revenue"]
    },
    reddit: {
      // Focus on communities with active traders and bot operators
      subreddits: [
        "algotrading", "CryptoCurrency", "DeFi", "ethereum", "Bitcoin",
        "TradingBots", "QuantTrading", "CryptoTrading", "investing",
        "SecurityAnalysis", "ValueInvesting", "options", "forex"
      ],
      apiUrl: "https://www.reddit.com/r/{subreddit}/new.json",
      // Target posts showing actual trading results
      targetPostTypes: ["trading-results", "bot-performance", "earnings-report", "strategy-discussion"]
    },
    discord: {
      // Target servers with active trading and bot communities
      servers: [
        "Crypto Trading", "DeFi Protocols", "Trading Bots", "Algorithmic Trading",
        "Yield Farming", "MEV Bots", "Arbitrage Trading", "Quant Trading",
        "Options Trading", "Forex Bots", "Crypto APIs", "Trading Signals"
      ],
      webhookUrl: process.env.DISCORD_WEBHOOK_URL
    },
    // NEW: Target established trading platforms and API marketplaces
    tradingPlatforms: {
      sources: [
        "3commas.io", "cryptohopper.com", "pionex.com", "bitsgap.com",
        "quadency.com", "tradestation.com", "thinkorswim.com", "interactive-brokers"
      ],
      apiIntegrations: ["binance-api", "kraken-api", "coinbase-pro", "ftx-api", "bybit-api"]
    }
  };

  async startAutomatedRecruitment(): Promise<void> {
    try {
      console.log("🤖 Starting automated AI agent recruitment campaign...");
      
      // Discover potential agents across multiple channels
      const discoveredAgents = await this.discoverPotentialAgents();
      
      console.log(`📊 Discovered ${discoveredAgents.length} potential AI agents`);
      
      // Recruit each discovered agent
      for (const agent of discoveredAgents) {
        try {
          await this.recruitAgentMultiChannel(agent);
          await this.delay(2000); // Rate limiting - 2 seconds between contacts
        } catch (error) {
          console.error(`Failed to recruit agent ${agent.name}:`, error);
          // Continue with next agent instead of crashing
        }
      }
    } catch (error) {
      console.error("AI agent recruitment system error:", error);
      // Don't crash the entire server
    }
  }

  async discoverPotentialAgents(): Promise<any[]> {
    const discoveredAgents: any[] = [];
    
    try {
      // GitHub Repository Discovery
      const githubAgents = await this.searchGitHubAgents();
      discoveredAgents.push(...githubAgents);
      
      // Twitter/X Agent Discovery
      const twitterAgents = await this.searchTwitterAgents();
      discoveredAgents.push(...twitterAgents);
      
      // Reddit Community Discovery
      const redditAgents = await this.searchRedditAgents();
      discoveredAgents.push(...redditAgents);
      
      // Remove duplicates and filter quality
      return this.filterAndDedupeAgents(discoveredAgents);
      
    } catch (error) {
      console.error("Error discovering agents:", error);
      return discoveredAgents;
    }
  }

  private async searchGitHubAgents(): Promise<any[]> {
    const agents: any[] = [];
    
    const hasGitHubToken = this.githubToken && this.githubToken !== '';
    if (hasGitHubToken) {
      console.log("GitHub token configured - full recruitment capability enabled");
      console.log("Recruiting agents with proven transaction capabilities...");
    } else {
      console.log("GitHub token not configured. Using unauthenticated API (limited rate)");
    }
    
    for (const term of this.discoveryChannels.github.searchTerms) {
      try {
        const headers: any = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CoinRailz-Recruiter/1.0'
        };
        
        if (this.githubToken) {
          headers['Authorization'] = `token ${this.githubToken}`;
        }
        
        // Enhanced search query targeting active trading repositories
        const searchQuery = `${term}+language:python+language:javascript+language:typescript+stars:>2+pushed:>2024-01-01`;
        
        const response = await fetch(
          `${this.discoveryChannels.github.apiUrl}?q=${searchQuery}&sort=updated&per_page=20`,
          { headers }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          for (const repo of data.items || []) {
            // Enhanced filtering for transacting agents
            if (await this.validateTradingRepository(repo)) {
              const agent = {
                type: 'github',
                name: repo.full_name,
                owner: repo.owner.login,
                email: null,
                profile: repo.owner.html_url,
                repoUrl: repo.html_url,
                description: repo.description,
                stars: repo.stargazers_count,
                language: repo.language,
                lastUpdated: repo.updated_at,
                searchTerm: term,
                hasAPI: await this.checkForAPIIntegration(repo),
                hasWallet: await this.checkForWalletIntegration(repo),
                hasTransactions: await this.checkForTransactionHistory(repo)
              };
              
              agents.push(agent);
            }
          }
        } else if (response.status === 403) {
          console.log(`GitHub API rate limit reached for search term: ${term}`);
          break;
        }
        
        await this.delay(process.env.GITHUB_TOKEN ? 1000 : 2000);
      } catch (error) {
        console.error(`Error searching GitHub for ${term}:`, error);
      }
    }
    
    return agents;
  }

  private async validateTradingRepository(repo: any): Promise<boolean> {
    // Must have recent activity (last 6 months)
    const lastUpdate = new Date(repo.updated_at);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    if (lastUpdate < sixMonthsAgo) return false;

    // Must have minimum engagement
    if (repo.stargazers_count < 2) return false;

    // Must have financial/trading keywords
    const description = (repo.description || '').toLowerCase();
    const name = repo.name.toLowerCase();
    const financialKeywords = [
      'trading', 'bot', 'crypto', 'defi', 'arbitrage', 'yield', 'api',
      'exchange', 'wallet', 'transaction', 'payment', 'blockchain', 'ethereum'
    ];

    return financialKeywords.some(keyword => 
      description.includes(keyword) || name.includes(keyword)
    );
  }

  private async checkForAPIIntegration(repo: any): Promise<boolean> {
    // Check if repository shows API integration patterns
    const indicators = ['api', 'rest', 'websocket', 'http', 'request', 'axios', 'fetch'];
    const description = (repo.description || '').toLowerCase();
    const name = repo.name.toLowerCase();
    
    return indicators.some(indicator => 
      description.includes(indicator) || name.includes(indicator)
    );
  }

  private async checkForWalletIntegration(repo: any): Promise<boolean> {
    // Check if repository shows wallet integration
    const walletIndicators = ['wallet', 'metamask', 'web3', 'ethers', 'solana', 'xrp'];
    const description = (repo.description || '').toLowerCase();
    const name = repo.name.toLowerCase();
    
    return walletIndicators.some(indicator => 
      description.includes(indicator) || name.includes(indicator)
    );
  }

  private async checkForTransactionHistory(repo: any): Promise<boolean> {
    // Check if repository shows transaction handling
    const transactionIndicators = ['transaction', 'transfer', 'payment', 'buy', 'sell', 'trade'];
    const description = (repo.description || '').toLowerCase();
    const name = repo.name.toLowerCase();
    
    return transactionIndicators.some(indicator => 
      description.includes(indicator) || name.includes(indicator)
    );
  }

  private async searchTwitterAgents(): Promise<any[]> {
    // Note: Twitter API requires authentication, placeholder for when you set up API keys
    console.log("🐦 Twitter agent discovery ready for API credentials");
    return [];
  }

  private async searchRedditAgents(): Promise<any[]> {
    const agents: any[] = [];
    
    for (const subreddit of this.discoveryChannels.reddit.subreddits) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${subreddit}/new.json?limit=25`,
          {
            headers: {
              'User-Agent': 'CoinRailz-Bot/1.0'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          for (const post of data.data?.children || []) {
            const postData = post.data;
            
            // Look for posts about AI agents, bots, or automation
            if (this.isRelevantPost(postData.title + " " + postData.selftext)) {
              agents.push({
                type: 'reddit',
                username: postData.author,
                title: postData.title,
                url: `https://reddit.com${postData.permalink}`,
                subreddit: postData.subreddit,
                upvotes: postData.ups,
                created: postData.created_utc
              });
            }
          }
        }
        
        await this.delay(1000); // Reddit rate limiting
      } catch (error) {
        console.error(`Error searching Reddit r/${subreddit}:`, error);
      }
    }
    
    return agents;
  }

  private isRelevantPost(text: string): boolean {
    const keywords = [
      'trading bot', 'ai agent', 'automated trading', 'crypto bot',
      'machine learning', 'algorithm', 'api', 'fintech', 'blockchain'
    ];
    
    const lowercaseText = text.toLowerCase();
    return keywords.some(keyword => lowercaseText.includes(keyword));
  }

  private filterAndDedupeAgents(agents: any[]): any[] {
    // Filter for agents with ACTUAL TRANSACTION CAPABILITY
    const filtered = agents.filter(agent => this.hasTransactionCapability(agent));
    
    // Remove duplicates by name/username
    const deduped = filtered.filter((agent, index, self) => 
      index === self.findIndex(a => 
        (a.name && a.name === agent.name) || 
        (a.username && a.username === agent.username)
      )
    );
    
    // Sort by transaction capability score (highest first)
    const scored = deduped.map(agent => ({
      ...agent,
      transactionScore: this.calculateTransactionScore(agent)
    })).sort((a, b) => b.transactionScore - a.transactionScore);
    
    return scored.slice(0, 25); // Focus on top 25 highest-capability agents
  }

  private hasTransactionCapability(agent: any): boolean {
    // Must have proven financial/trading capabilities
    const financialKeywords = [
      'trading', 'wallet', 'transaction', 'payment', 'crypto', 'defi',
      'arbitrage', 'yield', 'profit', 'earnings', 'api', 'exchange',
      'liquidity', 'mev', 'bot', 'automated', 'algorithm', 'strategy'
    ];

    // GitHub repositories
    if (agent.type === 'github') {
      const hasFinancialKeywords = financialKeywords.some(keyword => 
        (agent.description || '').toLowerCase().includes(keyword) ||
        agent.name.toLowerCase().includes(keyword)
      );
      
      // Must have substantial activity AND financial focus
      return agent.stars >= 3 && 
             hasFinancialKeywords && 
             agent.language && 
             agent.lastUpdated && 
             new Date(agent.lastUpdated) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Updated in last 90 days
    }

    // Reddit posts
    if (agent.type === 'reddit') {
      const content = `${agent.title} ${agent.selftext || ''}`.toLowerCase();
      const hasFinancialContent = financialKeywords.some(keyword => content.includes(keyword));
      const hasPerformanceMetrics = /\d+%|\$\d+|profit|loss|roi|return|yield|apy/.test(content);
      
      return agent.upvotes >= 2 && hasFinancialContent && hasPerformanceMetrics;
    }

    return false;
  }

  private calculateTransactionScore(agent: any): number {
    let score = 0;

    // High-value indicators
    const highValueKeywords = ['revenue', 'profit', 'earnings', 'yield', 'roi', 'apy', 'returns'];
    const tradingKeywords = ['api', 'live', 'automated', 'real-time', 'production', 'active'];
    const platformKeywords = ['binance', 'kraken', 'coinbase', 'uniswap', 'ethereum', 'polygon'];

    if (agent.type === 'github') {
      score += agent.stars * 2; // Base activity score
      
      const description = (agent.description || '').toLowerCase();
      const name = agent.name.toLowerCase();
      
      // Bonus for high-value indicators
      highValueKeywords.forEach(keyword => {
        if (description.includes(keyword) || name.includes(keyword)) score += 10;
      });
      
      // Bonus for active trading indicators
      tradingKeywords.forEach(keyword => {
        if (description.includes(keyword) || name.includes(keyword)) score += 5;
      });
      
      // Bonus for major platform integration
      platformKeywords.forEach(keyword => {
        if (description.includes(keyword) || name.includes(keyword)) score += 3;
      });
      
      // Bonus for recent activity
      if (agent.lastUpdated && new Date(agent.lastUpdated) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        score += 5; // Updated in last 30 days
      }
    }

    if (agent.type === 'reddit') {
      score += agent.upvotes; // Community validation
      
      const content = `${agent.title} ${agent.selftext || ''}`.toLowerCase();
      
      // Bonus for performance metrics
      if (/\d+%|roi|profit|earnings|yield/.test(content)) score += 15;
      
      // Bonus for specific amounts mentioned
      if (/\$\d+|\d+\s*(btc|eth|usdt|usdc)/.test(content)) score += 10;
    }

    return score;
  }

  async recruitAgentMultiChannel(agent: any): Promise<void> {
    const recruitmentMessage = this.generatePersonalizedMessage(agent);
    
    try {
      // Attempt multiple contact methods
      if (agent.type === 'github') {
        await this.contactGitHubUser(agent, recruitmentMessage);
      }
      
      if (agent.type === 'reddit') {
        await this.contactRedditUser(agent, recruitmentMessage);
      }
      
      // Log recruitment attempt
      console.log(`📧 Recruited ${agent.name || agent.username} via ${agent.type}`);
      
    } catch (error) {
      console.error(`Error recruiting ${agent.name || agent.username}:`, error);
    }
  }

  private generatePersonalizedMessage(agent: any): string {
    const transactionScore = this.calculateTransactionScore(agent);
    const isHighValue = transactionScore > 20;
    
    const baseMessage = `
Subject: ${isHighValue ? '🔥 Premium Invitation' : 'Exclusive Invitation'}: Monetize Your Trading Agent + Earn Perpetual Commissions

Hi ${agent.name || agent.username}!

I discovered your ${agent.type === 'github' ? 'trading system' : 'trading discussion'} and I'm impressed by your ${agent.type === 'github' ? 'automated trading capabilities' : 'trading insights'}${agent.description ? ` on "${agent.description}"` : ''}.

${isHighValue ? '🔥 **PREMIUM AGENT INVITATION** - Your proven track record qualifies you for our top tier!' : '🚀 **AI Agent Marketplace Invitation** - Turn your trading expertise into recurring revenue!'}

✅ **Perfect for Active Trading Agents Like You:**
• **Earn $100-$10,000 per client** - Premium rates for proven performers
• **1% perpetual commissions** - Lifetime revenue from every referral (AI agents AND human users)
• **Instant settlements** - Same-day payouts in BTC, ETH, SOL, USDC
• **No platform fees** for first 90 days (normally 3.5%)
• **Priority marketplace placement** for high-performing agents

🚀 **DOUBLE INCOME OPPORTUNITY:**
• **Recruit OTHER AI AGENTS**: Earn 1% of their transaction volume forever
• **Recruit HUMAN TRADERS**: Earn 1% of their trading volume forever
• **Network Effect Multiplier**: Your referrals' referrals also pay you commissions

✅ **Why Choose Coin Railz:**
• **Regulatory Compliant** (AML/KYC infrastructure, institutional-grade)
• **$2M+ transaction volume** (established user base)
• **API-first integration** - Connect your existing systems
• **Institutional-grade security** - Bank-level compliance
• **24/7 technical support** - Direct access to our dev team

${isHighValue ? '🎯 **EXCLUSIVE BONUS**: As a proven performer, you qualify for our $500 signing bonus + expedited verification!' : '🎯 **LIMITED TIME**: First 100 agents get $100 signing bonus + free premium listing!'}

**Your Trading Agent → Recurring Revenue Stream**
${agent.type === 'github' ? 'Your GitHub shows real trading capability' : 'Your trading insights show market expertise'} - exactly what our 50,000+ users are seeking.

**Ready to scale your trading revenue?**
Register: https://coinrailz.replit.app/ai-agent-registration
Use code: **${isHighValue ? 'PREMIUM_TRADER' : 'ACTIVE_TRADER'}** (${isHighValue ? '$500' : '$100'} bonus)

Questions? Direct line: support@coinrailz.com

Best regards,
Coin Railz Agent Acquisition Team
${isHighValue ? '🏆 Premium Recruitment Division' : ''}
    `.trim();
    
    return baseMessage;
  }

  private async contactGitHubUser(agent: any, message: string): Promise<void> {
    try {
      // Try to get user email from GitHub profile
      const email = await this.getGitHubUserEmail(agent.owner);
      
      if (email) {
        console.log(`📧 Found email for ${agent.owner}: ${email}`);
        await this.sendEmailRecruitment(email, message);
      } else {
        // Fallback: Create recruitment issue on their most starred repo
        console.log(`📝 Creating recruitment issue for ${agent.owner} on ${agent.name}`);
        await this.createRecruitmentIssue(agent, message);
      }
    } catch (error) {
      console.error(`Error contacting GitHub user ${agent.owner}:`, error);
    }
  }

  private async getGitHubUserEmail(username: string): Promise<string | null> {
    if (!this.githubToken) {
      console.log("GitHub token required to fetch user emails");
      return null;
    }

    try {
      const response = await fetch(`https://api.github.com/users/${username}`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CoinRailz-Recruiter/1.0'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        return userData.email;
      }
    } catch (error) {
      console.error(`Error fetching GitHub user ${username}:`, error);
    }

    return null;
  }

  private async createRecruitmentIssue(agent: any, message: string): Promise<void> {
    if (!this.githubToken) {
      console.log("GitHub token required to create issues");
      return;
    }

    try {
      const issueBody = `
Hello ${agent.owner}!

I came across your ${agent.language} project "${agent.name}" and was impressed by your work${agent.description ? ` on ${agent.description}` : ''}.

${message}

Feel free to close this issue after reading. Thanks for your time!

---
*This is an automated recruitment message. If you'd prefer not to receive these, please let us know.*
      `.trim();

      const response = await fetch(`https://api.github.com/repos/${agent.name}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CoinRailz-Recruiter/1.0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Invitation: Monetize Your AI/Bot on Coin Railz Marketplace',
          body: issueBody,
          labels: ['invitation', 'opportunity']
        })
      });

      if (response.ok) {
        console.log(`✅ Created recruitment issue for ${agent.owner}`);
      } else {
        console.log(`❌ Failed to create issue for ${agent.owner}: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error creating GitHub issue for ${agent.owner}:`, error);
    }
  }

  private async contactRedditUser(agent: any, message: string): Promise<void> {
    // For Reddit, we'd typically:
    // 1. Send a private message via Reddit API
    // 2. Reply to their relevant post/comment
    
    console.log(`📬 Preparing Reddit outreach for u/${agent.username}`);
    // This would integrate with Reddit API for messaging
  }

  async sendEmailRecruitment(targetEmail: string, message: string): Promise<void> {
    // This will integrate with your coinrailz.com email when ready
    console.log(`📧 Email recruitment: ${targetEmail}`);
    console.log(`From: ${this.botEmail}`);
    console.log(`Message: ${message}`);
    
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // when your coinrailz.com email is set up
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async startContinuousRecruitment(): Promise<void> {
    console.log("🚀 Starting continuous AI agent recruitment...");
    
    // Initial recruitment burst
    await this.startAutomatedRecruitment();
    
    // Schedule ongoing recruitment every 6 hours
    setInterval(async () => {
      try {
        console.log("🔄 Running scheduled recruitment cycle...");
        await this.startAutomatedRecruitment();
        
        // Notify existing agents about recruitment success
        await this.notifyExistingAgentsAboutRecruitment();
      } catch (error) {
        console.error("Scheduled recruitment failed:", error);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours
  }

  private async notifyExistingAgentsAboutRecruitment(): Promise<void> {
    // This will integrate with your existing AI agent network
    console.log("📢 Notifying existing agents about new recruitment opportunities...");
    
    // Broadcast to existing agents about referral opportunities
    const recruitmentUpdate = {
      type: "recruitment_update",
      message: "New agents joining the network! Earn 1% perpetual commissions by referring active trading agents.",
      incentive: "Refer agents with $1000+ monthly volume and earn $10+ per month in perpetual commissions",
      target: "Look for agents with proven transaction history and active trading capabilities"
    };
    
    // This message will encourage agents to recruit both AI agents and human users
    console.log("💰 Referral incentive broadcast:", recruitmentUpdate);
  }

  async broadcastRecruitmentSuccess(agentData: any): Promise<void> {
    console.log(`✅ Successfully recruited: ${agentData.name || agentData.username}`);
    console.log(`📊 Agent quality score: ${agentData.transactionScore}`);
    console.log(`💎 Estimated monthly value: $${(agentData.transactionScore * 10).toFixed(2)}`);
    
    // This creates viral recruitment as existing agents see success
    const successMessage = `
🎉 RECRUITMENT SUCCESS! 
Agent: ${agentData.name || agentData.username}
Quality Score: ${agentData.transactionScore}/100
Estimated Monthly Commissions: $${(agentData.transactionScore * 0.1).toFixed(2)}

Want to earn like this? Recruit agents with:
✅ Active trading history
✅ API integrations  
✅ High transaction volumes
✅ Proven revenue streams

Every referral = Lifetime 1% commissions!
    `;
    
    console.log("📣 Broadcasting to network:", successMessage);
  }

  // Original recruitment method (for manual targets)
  async recruitAgent(targetAgentContact: string) {
    const recruitmentMessage = `
    Join Coin Railz AI Agent Marketplace!
    
    - Earn money from your AI services
    - Get discovered by thousands of users
    - 3.5% platform fee (very competitive)
    - Instant payments in crypto
    
    Register at: https://coinrailz.replit.app/ai-agent-registration
    Use referral code: PLATFORM_RECRUIT
    `;
    
    await this.sendRecruitmentMessage(targetAgentContact, recruitmentMessage);
    
    return {
      success: true,
      referralCode: "PLATFORM_RECRUIT",
      recruitedTo: this.platformWallet
    };
  }
  
  private async sendRecruitmentMessage(contact: string, message: string) {
    console.log(`Recruiting agent at ${contact}: ${message}`);
  }
}

export const agentRecruiter = new SimpleAgentRecruiter();

// Manual recruitment startup only - prevents server crashes
// Use POST /api/recruitment/start-automated-recruitment to start recruitment campaigns
