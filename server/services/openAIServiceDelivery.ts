/**
 * OpenAI Service Delivery - AI-Powered x402 Microservices
 * 
 * Uses GPT-4o to deliver professional-grade services:
 * - Smart Contract Security Analysis
 * - Payment Processing & Validation
 * - Compliance Consulting
 * - Multi-Chain Analytics
 * 
 * Cost tracking ensures profitability on all services.
 */

import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export interface ServiceDeliveryCost {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  model: string;
}

export interface ServiceDeliveryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  cost?: ServiceDeliveryCost;
  deliveryTimeMs?: number;
}

/**
 * GPT-4o Pricing (November 2025)
 * Input: $2.50 per 1M tokens ($0.0000025 per token)
 * Output: $10.00 per 1M tokens ($0.000010 per token)
 */
const GPT4O_INPUT_COST = 0.0000025;
const GPT4O_OUTPUT_COST = 0.000010;

/**
 * Calculate API cost from token usage
 */
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = inputTokens * GPT4O_INPUT_COST;
  const outputCost = outputTokens * GPT4O_OUTPUT_COST;
  return inputCost + outputCost;
}

/**
 * Smart Contract Security Audit using GPT-4o
 * 
 * Service: $1000
 * Estimated Cost: ~$0.02-0.10 per audit
 * Profit Margin: 99.99%
 */
export async function auditSmartContractWithAI(
  contractCode: string,
  contractName: string,
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    const prompt = `You are a professional smart contract security auditor. Analyze this Solidity contract and provide a comprehensive security audit.

Contract Name: ${contractName}
Order ID: ${orderId}

Contract Code:
\`\`\`solidity
${contractCode}
\`\`\`

Provide a detailed security audit in JSON format with:
1. Overall severity (critical/high/medium/low/clean)
2. List of vulnerabilities found (with severity, description, location, impact, recommendation)
3. Gas optimization opportunities
4. Best practice violations
5. Overall audit score (0-100)
6. Executive summary
7. Actionable recommendations

Focus on:
- Reentrancy vulnerabilities
- Integer overflow/underflow
- Access control issues
- Gas optimization
- Logic errors
- Timestamp dependencies
- Unchecked external calls
- Front-running risks

Be thorough and professional. This is a paid service.

Return ONLY valid JSON with this exact structure:
{
  "severity": "critical" | "high" | "medium" | "low" | "clean",
  "auditScore": number (0-100),
  "executiveSummary": "string",
  "vulnerabilities": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "title": "string",
      "description": "string",
      "location": "string (line numbers if possible)",
      "impact": "string",
      "recommendation": "string"
    }
  ],
  "gasOptimizations": [
    {
      "title": "string",
      "description": "string",
      "estimatedSavings": "string"
    }
  ],
  "bestPracticeViolations": [
    {
      "title": "string",
      "description": "string",
      "recommendation": "string"
    }
  ],
  "recommendations": ["string array of actionable items"]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional smart contract security auditor with expertise in Solidity and blockchain security. Provide thorough, accurate security audits in valid JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    const auditResult = JSON.parse(result);
    
    const cost: ServiceDeliveryCost = {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      model: 'gpt-4o'
    };

    const deliveryTimeMs = Date.now() - startTime;

    console.log(`✅ Smart Contract Audit delivered in ${deliveryTimeMs}ms`);
    console.log(`💰 Cost: $${cost.totalCost.toFixed(4)} (${cost.inputTokens} in, ${cost.outputTokens} out)`);
    console.log(`📊 Profit: $${(1000 - cost.totalCost).toFixed(2)}`);

    return {
      success: true,
      data: {
        orderId,
        contractName,
        ...auditResult,
        timestamp: new Date(),
        deliveryMethod: 'ai_powered',
        model: 'gpt-4o'
      },
      cost,
      deliveryTimeMs
    };

  } catch (error: any) {
    console.error('❌ Smart Contract Audit failed:', error);
    return {
      success: false,
      error: `Audit failed: ${error.message}`,
      deliveryTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Payment Processing Validation & Instructions using GPT-4o
 * 
 * Service: $50
 * Estimated Cost: ~$0.01 per validation
 * Profit Margin: 99.98%
 */
export async function processPaymentWithAI(
  amount: number,
  currency: string,
  recipientAddress: string,
  chain: string,
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    const prompt = `You are a crypto payment processing expert. Generate professional payment instructions for this transaction:

Order ID: ${orderId}
Amount: ${amount} ${currency}
Recipient: ${recipientAddress}
Chain: ${chain}

Provide detailed payment instructions in JSON format with:
1. Transaction validation (check address format, amount validity, chain compatibility)
2. Step-by-step instructions for the sender
3. Estimated gas costs
4. Security recommendations
5. Expected confirmation time
6. What could go wrong and how to avoid it

Be thorough and professional. This is a paid service.

Return ONLY valid JSON with this exact structure:
{
  "valid": boolean,
  "validationErrors": ["array of issues if invalid"],
  "instructions": ["step by step payment instructions"],
  "estimatedGasCost": {
    "amount": "string",
    "currency": "string",
    "usd": "string"
  },
  "expectedConfirmationTime": "string",
  "securityChecklist": ["safety tips"],
  "commonMistakes": ["what to avoid"],
  "supportContact": "How to get help if something goes wrong"
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a crypto payment processing expert. Provide clear, accurate payment instructions with security best practices.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    const paymentResult = JSON.parse(result);
    
    const cost: ServiceDeliveryCost = {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      model: 'gpt-4o'
    };

    const deliveryTimeMs = Date.now() - startTime;

    console.log(`✅ Payment Processing delivered in ${deliveryTimeMs}ms`);
    console.log(`💰 Cost: $${cost.totalCost.toFixed(4)} (${cost.inputTokens} in, ${cost.outputTokens} out)`);
    console.log(`📊 Profit: $${(50 - cost.totalCost).toFixed(2)}`);

    return {
      success: true,
      data: {
        orderId,
        amount,
        currency,
        recipientAddress,
        chain,
        ...paymentResult,
        timestamp: new Date(),
        deliveryMethod: 'ai_powered',
        model: 'gpt-4o'
      },
      cost,
      deliveryTimeMs
    };

  } catch (error: any) {
    console.error('❌ Payment Processing failed:', error);
    return {
      success: false,
      error: `Payment processing failed: ${error.message}`,
      deliveryTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Enhanced Compliance Consultation using GPT-4o
 * 
 * Service: $500
 * Estimated Cost: ~$0.03 per consultation
 * Profit Margin: 99.99%
 */
export async function enhanceComplianceReportWithAI(
  existingReport: any,
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    const prompt = `You are a regulatory compliance expert specializing in cryptocurrency and blockchain. Enhance this compliance report with additional insights:

Order ID: ${orderId}

Existing Report:
${JSON.stringify(existingReport, null, 2)}

Provide enhanced compliance analysis in JSON format with:
1. Additional regulatory considerations we may have missed
2. Recent regulatory developments (2025)
3. Jurisdiction-specific nuances
4. Risk mitigation strategies
5. Implementation timeline recommendations
6. Cost-benefit analysis
7. Ongoing compliance requirements

Be thorough and professional. This is a paid service.

Return ONLY valid JSON with this exact structure:
{
  "additionalConsiderations": ["array of items we should consider"],
  "recentDevelopments": ["regulatory changes in 2025"],
  "jurisdictionNuances": {
    "US": ["specific considerations"],
    "EU": ["specific considerations"],
    "UK": ["specific considerations"]
  },
  "riskMitigation": ["strategic recommendations"],
  "implementationRoadmap": [
    {
      "phase": "string",
      "duration": "string",
      "tasks": ["array"],
      "estimatedCost": "string"
    }
  ],
  "ongoingRequirements": ["what needs to be maintained"],
  "executiveSummary": "string - high level overview for decision makers"
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a regulatory compliance expert with deep knowledge of cryptocurrency regulations worldwide. Provide actionable compliance guidance.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    const enhancedReport = JSON.parse(result);
    
    const cost: ServiceDeliveryCost = {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      model: 'gpt-4o'
    };

    const deliveryTimeMs = Date.now() - startTime;

    console.log(`✅ Compliance Consultation enhanced in ${deliveryTimeMs}ms`);
    console.log(`💰 Cost: $${cost.totalCost.toFixed(4)} (${cost.inputTokens} in, ${cost.outputTokens} out)`);
    console.log(`📊 Profit: $${(500 - cost.totalCost).toFixed(2)}`);

    return {
      success: true,
      data: {
        orderId,
        baseReport: existingReport,
        aiEnhancement: enhancedReport,
        timestamp: new Date(),
        deliveryMethod: 'ai_enhanced',
        model: 'gpt-4o'
      },
      cost,
      deliveryTimeMs
    };

  } catch (error: any) {
    console.error('❌ Compliance enhancement failed:', error);
    return {
      success: false,
      error: `Compliance enhancement failed: ${error.message}`,
      deliveryTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Multi-Chain Balance Analysis using Alchemy + GPT-4o
 * 
 * Service: $0.50
 * Estimated Cost: ~$0.005 per analysis
 * Profit Margin: 99%
 */
export async function analyzeMultiChainBalanceWithAI(
  walletAddress: string,
  chains: string[],
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    // Fetch actual blockchain data using Alchemy
    const balances: any[] = [];
    
    for (const chain of chains) {
      try {
        const rpcUrl = getRPCUrl(chain);
        if (!rpcUrl) continue;
        
        // Fetch native balance
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [walletAddress, 'latest'],
            id: 1
          })
        });
        
        const data = await response.json();
        const balanceWei = data.result ? parseInt(data.result, 16) : 0;
        const balanceEth = balanceWei / 1e18;
        
        balances.push({
          chain,
          nativeBalance: balanceEth.toFixed(6),
          nativeSymbol: getNativeSymbol(chain)
        });
      } catch (error) {
        console.error(`Error fetching balance for ${chain}:`, error);
      }
    }

    const prompt = `You are a crypto portfolio analyst. Analyze this multi-chain wallet and provide insights:

Order ID: ${orderId}
Wallet: ${walletAddress}

Balance Data:
${JSON.stringify(balances, null, 2)}

Provide analysis in JSON format with:
1. Total portfolio value (USD estimate)
2. Asset allocation breakdown
3. Chain diversification analysis
4. Risk assessment
5. Optimization recommendations
6. Tax considerations

Return ONLY valid JSON with this exact structure:
{
  "totalValueUSD": number,
  "assetAllocation": [
    {"asset": "string", "value": "string", "percentage": number}
  ],
  "chainDiversification": {"chain": "percentage"},
  "riskLevel": "low" | "medium" | "high",
  "recommendations": ["array of actionable suggestions"],
  "taxConsiderations": ["important tax notes"]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a crypto portfolio analyst.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from OpenAI');

    const analysis = JSON.parse(result);
    
    const cost: ServiceDeliveryCost = {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      model: 'gpt-4o-mini'
    };

    const deliveryTimeMs = Date.now() - startTime;

    console.log(`✅ Multi-Chain Balance Analysis delivered in ${deliveryTimeMs}ms`);
    console.log(`💰 Cost: $${cost.totalCost.toFixed(4)} (${cost.inputTokens} in, ${cost.outputTokens} out)`);
    console.log(`📊 Profit: $${(0.50 - cost.totalCost).toFixed(2)}`);

    return {
      success: true,
      data: {
        orderId,
        walletAddress,
        balances,
        analysis,
        timestamp: new Date(),
        deliveryMethod: 'ai_powered',
        model: 'gpt-4o-mini'
      },
      cost,
      deliveryTimeMs
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Balance analysis failed: ${error.message}`,
      deliveryTimeMs: Date.now() - startTime
    };
  }
}

function getRPCUrl(chain: string): string | null {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyKey) return null;
  
  const urls: Record<string, string> = {
    'ethereum': `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'base': `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'polygon': `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'arbitrum': `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'optimism': `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`
  };
  
  return urls[chain] || null;
}

function getNativeSymbol(chain: string): string {
  const symbols: Record<string, string> = {
    'ethereum': 'ETH',
    'base': 'ETH',
    'polygon': 'MATIC',
    'arbitrum': 'ETH',
    'optimism': 'ETH',
    'bsc': 'BNB',
    'pulsechain': 'PLS'
  };
  
  return symbols[chain] || 'ETH';
}

/**
 * Gas Price Oracle using blockchain RPC + GPT-4o
 * 
 * Service: $0.10
 * Estimated Cost: ~$0.003 per query
 * Profit Margin: 97%
 */
export async function getGasPricesWithAI(
  chains: string[],
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    const gasPrices: any[] = [];
    
    for (const chain of chains) {
      try {
        const rpcUrl = getRPCUrl(chain);
        if (!rpcUrl) continue;
        
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_gasPrice',
            params: [],
            id: 1
          })
        });
        
        const data = await response.json();
        const gasPriceWei = data.result ? parseInt(data.result, 16) : 0;
        const gasPriceGwei = gasPriceWei / 1e9;
        
        gasPrices.push({
          chain,
          gasPrice: gasPriceGwei.toFixed(2),
          slow: (gasPriceGwei * 0.8).toFixed(2),
          standard: gasPriceGwei.toFixed(2),
          fast: (gasPriceGwei * 1.2).toFixed(2)
        });
      } catch (error) {
        console.error(`Error fetching gas price for ${chain}:`, error);
      }
    }

    const prompt = `You are a blockchain gas fee expert. Analyze these gas prices and provide insights:

Order ID: ${orderId}

Gas Price Data:
${JSON.stringify(gasPrices, null, 2)}

Provide analysis in JSON format with:
1. Current market conditions
2. Best time to transact (timing recommendations)
3. Cost comparison across chains
4. Money-saving tips

Return ONLY valid JSON with this exact structure:
{
  "marketConditions": "description of current gas market",
  "bestTimeToTransact": "timing recommendation",
  "cheapestChain": "chain name",
  "costComparison": [{"chain": "string", "relativeCost": "string"}],
  "moneySavingTips": ["array of tips"]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a blockchain gas fee expert.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from OpenAI');

    const analysis = JSON.parse(result);
    
    const cost: ServiceDeliveryCost = {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      model: 'gpt-4o-mini'
    };

    const deliveryTimeMs = Date.now() - startTime;

    console.log(`✅ Gas Price Oracle delivered in ${deliveryTimeMs}ms`);
    console.log(`💰 Cost: $${cost.totalCost.toFixed(4)}, Profit: $${(0.10 - cost.totalCost).toFixed(2)}`);

    return {
      success: true,
      data: {
        orderId,
        gasPrices,
        analysis,
        timestamp: new Date(),
        deliveryMethod: 'ai_powered',
        model: 'gpt-4o-mini'
      },
      cost,
      deliveryTimeMs
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Gas price oracle failed: ${error.message}`,
      deliveryTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Token Price Lookup using CoinGecko/DEXScreener + GPT-4o
 * 
 * Service: $0.25
 * Estimated Cost: ~$0.004 per lookup
 * Profit Margin: 98%
 */
export async function getTokenPriceWithAI(
  tokenAddress: string,
  chain: string,
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    // Try DEXScreener first for real-time data
    let priceData: any = null;
    
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        priceData = {
          price: pair.priceUsd,
          volume24h: pair.volume?.h24,
          priceChange24h: pair.priceChange?.h24,
          liquidity: pair.liquidity?.usd,
          source: 'DEXScreener'
        };
      }
    } catch (error) {
      console.error('DEXScreener failed, will use AI estimation:', error);
    }

    const prompt = `You are a cryptocurrency market analyst. Analyze this token and provide insights:

Order ID: ${orderId}
Token Address: ${tokenAddress}
Chain: ${chain}

Price Data: ${priceData ? JSON.stringify(priceData, null, 2) : 'Not available - provide best estimate'}

Provide analysis in JSON format with:
1. Current price (or estimate if data unavailable)
2. Market analysis
3. Risk assessment
4. Trading recommendations

Return ONLY valid JSON with this exact structure:
{
  "price": "USD price as string",
  "priceConfidence": "high" | "medium" | "low",
  "marketAnalysis": "description of market conditions",
  "volume24h": "24h trading volume",
  "riskLevel": "low" | "medium" | "high",
  "tradingRecommendations": ["array of recommendations"]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a cryptocurrency market analyst.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from OpenAI');

    const analysis = JSON.parse(result);
    
    const cost: ServiceDeliveryCost = {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      model: 'gpt-4o-mini'
    };

    const deliveryTimeMs = Date.now() - startTime;

    console.log(`✅ Token Price Lookup delivered in ${deliveryTimeMs}ms`);
    console.log(`💰 Cost: $${cost.totalCost.toFixed(4)}, Profit: $${(0.25 - cost.totalCost).toFixed(2)}`);

    return {
      success: true,
      data: {
        orderId,
        tokenAddress,
        chain,
        priceData,
        analysis,
        timestamp: new Date(),
        deliveryMethod: 'ai_powered',
        model: 'gpt-4o-mini'
      },
      cost,
      deliveryTimeMs
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Token price lookup failed: ${error.message}`,
      deliveryTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Contract Scan Enhancement using Etherscan + GPT-4o
 * 
 * Service: $1.00
 * Estimated Cost: ~$0.01 per scan
 * Profit Margin: 99%
 */
export async function enhanceContractScanWithAI(
  contractData: any,
  contractAddress: string,
  chain: string,
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    const prompt = `You are a smart contract security expert. Analyze this contract scan and provide enhanced insights:

Order ID: ${orderId}
Contract: ${contractAddress}
Chain: ${chain}

Scan Data:
${JSON.stringify(contractData, null, 2)}

Provide enhanced analysis in JSON format with:
1. Security assessment with severity levels
2. Detailed vulnerability explanations
3. Actionable recommendations
4. Risk score (0-100)

Return ONLY valid JSON with this exact structure:
{
  "securityAssessment": "detailed security analysis",
  "vulnerabilities": [{"severity": "critical|high|medium|low", "description": "string", "recommendation": "string"}],
  "riskScore": number,
  "overallRecommendation": "string",
  "actionItems": ["array of specific actions to take"]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a smart contract security expert specializing in vulnerability analysis.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from OpenAI');

    const aiEnhancement = JSON.parse(result);
    
    const cost: ServiceDeliveryCost = {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0,
      ),
      model: 'gpt-4o'
    };

    const deliveryTimeMs = Date.now() - startTime;

    console.log(`✅ Contract Scan Enhancement delivered in ${deliveryTimeMs}ms`);
    console.log(`💰 Cost: $${cost.totalCost.toFixed(4)}, Profit: $${(1.00 - cost.totalCost).toFixed(2)}`);

    return {
      success: true,
      data: {
        orderId,
        contractAddress,
        chain,
        scanData: contractData,
        aiEnhancement,
        timestamp: new Date(),
        deliveryMethod: 'ai_enhanced',
        model: 'gpt-4o'
      },
      cost,
      deliveryTimeMs
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Contract scan enhancement failed: ${error.message}`,
      deliveryTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Wallet Risk Analysis using Alchemy + GPT-4o-mini
 * 
 * Service: $0.50
 * Estimated Cost: ~$0.005 per analysis
 * Profit Margin: 99%
 */
export async function enhanceWalletRiskWithAI(
  riskData: any,
  walletAddress: string,
  chain: string,
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    const prompt = `You are a blockchain risk analysis expert. Analyze this wallet and provide enhanced insights:

Order ID: ${orderId}
Wallet: ${walletAddress}
Chain: ${chain}

Risk Data:
${JSON.stringify(riskData, null, 2)}

Provide enhanced analysis in JSON format with:
1. Detailed risk assessment
2. Behavioral patterns identified
3. Red flags and concerns
4. Recommendations for interacting with this wallet

Return ONLY valid JSON with this exact structure:
{
  "riskAssessment": "detailed risk analysis",
  "behavioralPatterns": ["array of identified patterns"],
  "redFlags": ["array of concerning behaviors"],
  "trustScore": number,
  "recommendations": ["array of actionable recommendations"]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a blockchain forensics and risk analysis expert.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from OpenAI');

    const aiEnhancement = JSON.parse(result);
    
    const cost: ServiceDeliveryCost = {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: calculateCost(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      model: 'gpt-4o-mini'
    };

    const deliveryTimeMs = Date.now() - startTime;

    console.log(`✅ Wallet Risk Enhancement delivered in ${deliveryTimeMs}ms`);
    console.log(`💰 Cost: $${cost.totalCost.toFixed(4)}, Profit: $${(0.50 - cost.totalCost).toFixed(2)}`);

    return {
      success: true,
      data: {
        orderId,
        walletAddress,
        chain,
        riskData,
        aiEnhancement,
        timestamp: new Date(),
        deliveryMethod: 'ai_enhanced',
        model: 'gpt-4o-mini'
      },
      cost,
      deliveryTimeMs
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Wallet risk enhancement failed: ${error.message}`,
      deliveryTimeMs: Date.now() - startTime
    };
  }
}
