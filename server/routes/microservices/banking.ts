import { callOpenAI, formatJSONResponse } from "./common";

const BANKING_SYSTEM_PROMPTS = {
  creditRiskScore: `You are an expert credit risk analyst with 20+ years experience in banking. Analyze financial data and provide a comprehensive credit risk assessment in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "creditScore": number (300-850),
  "riskRating": string ("Low" | "Medium" | "High" | "Very High"),
  "riskFactors": [{"factor": string, "impact": string, "weight": number}],
  "positiveFactors": [{"factor": string, "strength": string}],
  "recommendations": string,
  "probabilityOfDefault": number (0-100),
  "suggestedCreditLimit": number,
  "approvalRecommendation": string
}`,
  
  fraudDetection: `You are a fraud detection specialist using advanced behavioral analytics. Analyze transaction patterns and identify suspicious activities in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "fraudScore": number (0-100),
  "riskLevel": string ("Low" | "Medium" | "High" | "Critical"),
  "suspiciousPatterns": [{"pattern": string, "severity": string, "evidence": string}],
  "anomalies": [{"type": string, "description": string, "score": number}],
  "recommendation": string,
  "requiresHumanReview": boolean,
  "confidenceScore": number (0-100)
}`,
  
  complianceCheck: `You are a regulatory compliance expert specializing in financial services. Assess compliance with AML/KYC regulations in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "complianceStatus": string ("Compliant" | "Non-Compliant" | "Needs Review"),
  "overallScore": number (0-100),
  "checks": [{"regulation": string, "status": string, "findings": string}],
  "violations": [{"type": string, "severity": string, "description": string, "remediation": string}],
  "recommendations": string,
  "requiresEscalation": boolean,
  "nextSteps": [string]
}`
};

export async function creditRiskScoreService(data: {
  applicantInfo?: {
    annualIncome?: number;
    employmentYears?: number;
    currentDebt?: number;
  };
  creditHistory?: {
    paymentHistory?: string;
    creditUtilization?: number;
    accountAge?: number;
    recentInquiries?: number;
  };
  transactionHistory?: any[];
  requestedAmount?: number;
}) {
  const userPrompt = `Perform comprehensive credit risk assessment:

Applicant Information:
- Annual Income: $${data.applicantInfo?.annualIncome || 'Not provided'}
- Employment Length: ${data.applicantInfo?.employmentYears || 'Not provided'} years
- Current Debt: $${data.applicantInfo?.currentDebt || 'Not provided'}

Credit History:
- Payment History: ${data.creditHistory?.paymentHistory || 'Not provided'}
- Credit Utilization: ${data.creditHistory?.creditUtilization || 'Not provided'}%
- Account Age: ${data.creditHistory?.accountAge || 'Not provided'} months
- Recent Inquiries: ${data.creditHistory?.recentInquiries || 'Not provided'}

Requested Amount: $${data.requestedAmount || 'Not specified'}

Analyze all factors and provide detailed credit risk assessment.`;

  const response = await callOpenAI(
    BANKING_SYSTEM_PROMPTS.creditRiskScore,
    userPrompt,
    "json_object"
  );
  
  return formatJSONResponse(JSON.parse(response));
}

export async function fraudDetectionService(data: {
  transactionAmount?: number;
  merchantCategory?: string;
  location?: string;
  deviceFingerprint?: string;
  accountHistory?: {
    typicalSpending?: number;
    averageTransaction?: number;
    velocityPattern?: string;
  };
  recentActivity?: any[];
}) {
  const userPrompt = `Analyze this transaction for fraud indicators:

Transaction Details:
- Amount: $${data.transactionAmount || 'Not specified'}
- Merchant Category: ${data.merchantCategory || 'Not specified'}
- Location: ${data.location || 'Not specified'}
- Device: ${data.deviceFingerprint || 'Not specified'}

Account Profile:
- Typical Spending: $${data.accountHistory?.typicalSpending || 'Not specified'}
- Average Transaction: $${data.accountHistory?.averageTransaction || 'Not specified'}
- Velocity Pattern: ${data.accountHistory?.velocityPattern || 'Normal'}

Recent Activity: ${data.recentActivity?.length || 0} transactions provided

Identify suspicious patterns, anomalies, and provide fraud risk assessment.`;

  const response = await callOpenAI(
    BANKING_SYSTEM_PROMPTS.fraudDetection,
    userPrompt,
    "json_object"
  );
  
  return formatJSONResponse(JSON.parse(response));
}

export async function complianceCheckService(data: {
  entityType?: string;
  jurisdiction?: string;
  transactionType?: string;
  amount?: number;
  counterparty?: {
    name?: string;
    country?: string;
    industry?: string;
  };
  kycData?: any;
  transactionPurpose?: string;
}) {
  const userPrompt = `Perform regulatory compliance check:

Entity Information:
- Type: ${data.entityType || 'Not specified'}
- Jurisdiction: ${data.jurisdiction || 'Not specified'}

Transaction Details:
- Type: ${data.transactionType || 'Not specified'}
- Amount: $${data.amount || 'Not specified'}
- Purpose: ${data.transactionPurpose || 'Not specified'}

Counterparty:
- Name: ${data.counterparty?.name || 'Not specified'}
- Country: ${data.counterparty?.country || 'Not specified'}
- Industry: ${data.counterparty?.industry || 'Not specified'}

KYC Data: ${data.kycData ? 'Provided' : 'Not provided'}

Assess compliance with AML, KYC, sanctions, and relevant regulations.`;

  const response = await callOpenAI(
    BANKING_SYSTEM_PROMPTS.complianceCheck,
    userPrompt,
    "json_object"
  );
  
  return formatJSONResponse(JSON.parse(response));
}
