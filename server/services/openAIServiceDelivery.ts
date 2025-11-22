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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

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

    const response = await openai.chat.completions.create({
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

    const response = await openai.chat.completions.create({
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

    const response = await openai.chat.completions.create({
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
 * Multi-Chain Balance Analysis using GPT-4o
 * 
 * Service: $0.50
 * Estimated Cost: ~$0.005 per analysis
 * Profit Margin: 99%
 */
export async function analyzeMultiChainBalanceWithAI(
  balanceData: any,
  walletAddress: string,
  orderId: string
): Promise<ServiceDeliveryResult<any>> {
  const startTime = Date.now();
  
  try {
    const prompt = `You are a crypto portfolio analyst. Analyze this multi-chain wallet and provide insights:

Order ID: ${orderId}
Wallet: ${walletAddress}

Balance Data:
${JSON.stringify(balanceData, null, 2)}

Provide analysis in JSON format with:
1. Total portfolio value (USD)
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

    const response = await openai.chat.completions.create({
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

    return {
      success: true,
      data: {
        orderId,
        walletAddress,
        balanceData,
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
