import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Whitepaper() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-4">RAILZ Token Whitepaper</h1>
          
          <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-bold mt-0">Executive Summary</h2>
            <p className="mb-4">
              <strong>Railz Token (RALZ)</strong> is a <strong>Base Chain native utility token</strong> powering the Coin Railz ecosystem - a comprehensive AI-powered fintech platform built exclusively on Coinbase's Base Layer 2 network. As one of the first AI payment infrastructure tokens deployed on Base, RALZ leverages Base's low-cost, high-speed architecture to enable multi-chain payment acceptance, instant referral rewards, and seamless integration with the broader Coinbase ecosystem.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 my-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Built on Base Chain - Coinbase's Layer 2:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Lightning-fast transactions with sub-cent gas fees</li>
                  <li>Native integration with Coinbase Wallet and OAuth</li>
                  <li>Seamless USDC settlement via Circle on Base</li>
                  <li>First-mover advantage in Base's growing DeFi ecosystem</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Token Details:</h3>
                <ul className="list-none space-y-1">
                  <li><strong>Contract:</strong> 0x2D45A...886aE28</li>
                  <li><strong>Ticker:</strong> $RALZ</li>
                  <li><strong>Blockchain:</strong> Base (8453)</li>
                  <li><strong>Standard:</strong> ERC-20</li>
                  <li><strong>Decimals:</strong> 18</li>
                </ul>
              </div>
            </div>
          </div>

          <h2>1. Introduction</h2>
          
          <h3>1.1 Problem Statement</h3>
          <p>The current financial infrastructure for AI agents and decentralized applications faces critical challenges:</p>
          <ul>
            <li><strong>Fragmented Payment Systems:</strong> Businesses must integrate multiple payment processors across different blockchains</li>
            <li><strong>High Transaction Costs:</strong> Cross-chain transfers require expensive bridging solutions</li>
            <li><strong>Limited AI Integration:</strong> Traditional payment systems lack native support for AI agent transactions</li>
            <li><strong>Complex Referral Systems:</strong> Existing platforms struggle with transparent, instant commission distribution</li>
          </ul>

          <h3>1.2 Solution: Coin Railz Platform</h3>
          <p>Coin Railz provides unified financial infrastructure <strong>built natively on Base Chain</strong> with:</p>
          <ul>
            <li><strong>Base-Native Architecture:</strong> All core infrastructure deployed on Coinbase's Layer 2</li>
            <li>Multi-chain payment acceptance (Base, Ethereum, BNB Chain) with Base as settlement layer</li>
            <li>AI Agent Marketplace with automated service delivery on Base</li>
            <li>Real-time USDC settlement via Circle integration on Base</li>
            <li>Instant crypto commission payouts using Base's low-cost rails</li>
            <li>Complete XRP Ledger financial services with Base as payment hub</li>
          </ul>

          <h2>2. Base Ecosystem Integration</h2>
          
          <h3>2.1 Why Base Chain?</h3>
          <p><strong>RALZ is built exclusively on Base Chain (Coinbase Layer 2) to leverage the optimal infrastructure for AI-powered payments:</strong></p>
          
          <div className="grid md:grid-cols-2 gap-6 my-6">
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">⚡ Technical Advantages:</h4>
              <ul className="space-y-1">
                <li>Sub-Second Finality: &lt;2 seconds vs 12+ on Ethereum</li>
                <li>Ultra-Low Fees: &lt;$0.01 vs $5-50 on Ethereum</li>
                <li>High Throughput: 1000+ TPS capacity</li>
                <li>Ethereum Security via optimistic rollup</li>
              </ul>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">🏦 Ecosystem Benefits:</h4>
              <ul className="space-y-1">
                <li>Native Coinbase Wallet & OAuth support</li>
                <li>Direct Circle USDC settlement on Base</li>
                <li>Access to Base's growing DeFi ecosystem</li>
                <li>First-mover advantage on Base</li>
              </ul>
            </div>
          </div>

          <h3>2.2 Base Chain Infrastructure</h3>
          <p><strong>Production Deployment:</strong></p>
          <ul>
            <li><strong>Smart Contract:</strong> 0x2D45A4E7B3a89FbA480051c972c3A461d886aE28 on Base</li>
            <li><strong>Circle USDC on Base:</strong> 10+ production wallets for instant settlement</li>
            <li><strong>Coinbase Wallet:</strong> Full integration with one-click connection</li>
            <li><strong>Base RPC:</strong> Optimized for sub-200ms transaction processing</li>
          </ul>

          <h2>3. Token Utility</h2>
          
          <h3>3.1 Primary Use Cases</h3>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold">1. Payment Processing Fee Discounts</h4>
              <p>Users who pay with RALZ receive a 20% discount on all platform transaction fees, incentivizing token holding and usage.</p>
            </div>
            
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold">2. Referral Rewards Distribution</h4>
              <p>Multi-level referral system distributes commissions in RALZ:</p>
              <ul>
                <li>Level 1 (Direct Referral): 7%</li>
                <li>Level 2 (Second Degree): 2%</li>
                <li>Level 3 (Third Degree): 1%</li>
              </ul>
            </div>
            
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold">3. AI Marketplace Payments</h4>
              <p>Native currency for AI agent services with automated escrow and instant settlement on Base.</p>
            </div>
            
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-semibold">4. Staking & Governance</h4>
              <p>Stake RALZ to earn revenue share (15% APY initial) and participate in platform governance.</p>
            </div>
          </div>

          <h2>4. Tokenomics</h2>
          
          <h3>4.1 Token Distribution</h3>
          <p><strong>Total Supply:</strong> 100,000,000,000 RALZ (100 Billion)</p>
          <ul>
            <li><strong>Public Sale (40%):</strong> 40,000,000,000 RALZ</li>
            <li><strong>Referral Rewards (25%):</strong> 25,000,000,000 RALZ</li>
            <li><strong>Team & Advisors (15%):</strong> 15,000,000,000 RALZ (2-year cliff, 4-year vesting)</li>
            <li><strong>Treasury (10%):</strong> 10,000,000,000 RALZ</li>
            <li><strong>Liquidity (10%):</strong> 10,000,000,000 RALZ (DEX pools on Base)</li>
          </ul>

          <h3>4.2 Economic Model</h3>
          <p><strong>Deflationary Mechanisms:</strong></p>
          <ul>
            <li>0.5% burn on every RALZ transaction</li>
            <li>Quarterly buyback program from platform revenue</li>
            <li>Staking locks reduce circulating supply</li>
          </ul>

          <h2>5. Market Opportunity</h2>
          
          <h3>5.1 Total Addressable Market</h3>
          <ul>
            <li><strong>AI Agent Economy:</strong> $10B+ (2025 projection)</li>
            <li><strong>Cross-Border Payments:</strong> $150B annual volume</li>
            <li><strong>DeFi Infrastructure:</strong> $50B+ total value locked</li>
          </ul>

          <h3>5.2 Competitive Advantages</h3>
          <div className="bg-yellow-50 dark:bg-yellow-950 p-6 rounded-lg my-6">
            <h4 className="font-bold text-xl mb-3">🏆 Base Chain Native (Biggest Advantage)</h4>
            <ul className="space-y-2">
              <li>✅ <strong>First AI payment infrastructure token</strong> on Coinbase's Layer 2</li>
              <li>✅ <strong>95% lower fees</strong> than Ethereum ($0.01 vs $5+)</li>
              <li>✅ <strong>6x faster confirmations</strong> (2 seconds vs 12+)</li>
              <li>✅ <strong>Direct access</strong> to Coinbase's 100M+ users</li>
              <li>✅ <strong>Native Circle USDC</strong> on Base integration</li>
            </ul>
          </div>

          <h2>6. Security & Audits</h2>
          <ul>
            <li>Smart contract audited for Base deployment</li>
            <li>Multi-signature treasury on Base network</li>
            <li>Transparent on-chain tracking via BaseScan</li>
            <li>MEV protection using Base's sequencer design</li>
          </ul>

          <h2>7. Roadmap</h2>
          
          <h3>Phase 1: Foundation (Q4 2024 - Q1 2025) ✅</h3>
          <ul className="list-none">
            <li>✅ Base Chain token deployment</li>
            <li>✅ Multi-chain payment infrastructure</li>
            <li>✅ Circle USDC integration on Base</li>
            <li>✅ AI Agent Marketplace launch</li>
          </ul>

          <h3>Phase 2: Growth (Q2 2025)</h3>
          <ul className="list-none">
            <li>⏳ Coinbase Exchange listing application</li>
            <li>⏳ Base DEX liquidity pools (Uniswap V3, Aerodrome)</li>
            <li>⏳ Staking & governance portal</li>
            <li>⏳ Enterprise partnerships</li>
          </ul>

          <h3>Phase 3: Expansion (Q3-Q4 2025)</h3>
          <ul className="list-none">
            <li>⏳ Additional Base DeFi integrations</li>
            <li>⏳ AI agent SDK for developers</li>
            <li>⏳ Institutional services launch</li>
            <li>⏳ Global market expansion</li>
          </ul>

          <h2>8. Conclusion</h2>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-6 rounded-lg">
            <p className="text-lg font-semibold mb-4">
              Railz Token (RALZ) represents a fundamental building block for the future of AI-powered financial infrastructure, built exclusively on Coinbase's Base Chain ecosystem.
            </p>
            <p className="mb-4">
              By leveraging Base's technical advantages—95% lower fees, 6x faster transactions, and seamless Coinbase integration—RALZ delivers tangible utility while positioning holders to benefit from the explosive growth of both the Base ecosystem and the AI agent economy.
            </p>
            <p className="font-bold text-xl text-center mt-6">
              Join the Base Ecosystem Revolution with RALZ
            </p>
          </div>

          <hr className="my-8" />

          <h2>Appendix: Technical Specifications</h2>
          
          <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
            <h3>Smart Contract Details (Base Chain)</h3>
            <ul className="list-none space-y-2">
              <li><strong>Contract Address:</strong> <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded">0x2D45A4E7B3a89FbA480051c972c3A461d886aE28</code></li>
              <li><strong>Blockchain:</strong> Base Chain (Coinbase Layer 2)</li>
              <li><strong>Chain ID:</strong> 8453</li>
              <li><strong>Block Explorer:</strong> <a href="https://basescan.org/token/0x2D45A4E7B3a89FbA480051c972c3A461d886aE28" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">BaseScan</a></li>
              <li><strong>Token Standard:</strong> ERC-20 (Base-compatible)</li>
              <li><strong>Decimals:</strong> 18</li>
              <li><strong>Total Supply:</strong> 100,000,000,000 RALZ</li>
              <li><strong>Network Type:</strong> Optimistic Rollup (OP Stack)</li>
            </ul>

            <h3 className="mt-6">Base Ecosystem Integrations</h3>
            <ul>
              <li>Uniswap V3 on Base</li>
              <li>Aerodrome Finance (Base DEX)</li>
              <li>BaseSwap (Community DEX)</li>
              <li>Coinbase Wallet</li>
              <li>Circle USDC on Base</li>
            </ul>
          </div>

          <div className="mt-12 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>For more information, visit <a href="/" className="text-blue-600 dark:text-blue-400 underline">coinrailz.com</a></p>
            <p className="mt-2">© 2025 Coin Railz. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
