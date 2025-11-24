import { callOpenAI, formatJSONResponse } from "./common";

const REAL_ESTATE_SYSTEM_PROMPTS = {
  propertyValuation: `You are an expert real estate appraiser. Analyze property details and provide a comprehensive market valuation in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "estimatedValue": number,
  "valuationRange": {"low": number, "high": number},
  "confidenceScore": number (0-100),
  "keyFactors": [{"factor": string, "impact": string}],
  "comparableInsights": string,
  "marketTrends": string,
  "recommendations": string
}`,
  
  leaseAnalysis: `You are an expert commercial real estate attorney specializing in lease analysis. Extract key terms, identify risks, and provide actionable insights in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "leaseSummary": {"termLength": string, "monthlyRent": number, "securityDeposit": number, "leaseType": string},
  "keyTerms": [{"term": string, "details": string, "importance": string}],
  "riskFactors": [{"risk": string, "severity": string, "recommendation": string}],
  "financialAnalysis": {"totalValue": number, "annualCost": number, "costPerSqFt": number},
  "recommendations": string,
  "riskScore": number (0-100)
}`,
  
  constructionProgress: `You are a construction project manager and estimator. Analyze construction progress from descriptions/photos and estimate completion percentage in JSON format.
Your response MUST be valid JSON with this exact structure:
{
  "completionPercentage": number (0-100),
  "currentPhase": string,
  "completedMilestones": [string],
  "upcomingMilestones": [string],
  "qualityAssessment": {"score": number, "issues": [string], "notes": string},
  "timeline": {"estimatedCompletion": string, "onSchedule": boolean, "daysAhead": number},
  "budgetImplications": string,
  "recommendations": string
}`
};

export async function propertyValuationService(data: {
  address: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  condition?: string;
  features?: string[];
}) {
  const userPrompt = `Provide a detailed property valuation for:
Address: ${data.address}
Type: ${data.propertyType || 'Single Family'}
Bedrooms: ${data.bedrooms || 'Not specified'}
Bathrooms: ${data.bathrooms || 'Not specified'}
Square Footage: ${data.squareFootage || 'Not specified'}
Lot Size: ${data.lotSize || 'Not specified'}
Year Built: ${data.yearBuilt || 'Not specified'}
Condition: ${data.condition || 'Average'}
Features: ${data.features?.join(', ') || 'Standard'}

Analyze market conditions, comparable properties, and provide a comprehensive valuation estimate.`;

  const response = await callOpenAI(
    REAL_ESTATE_SYSTEM_PROMPTS.propertyValuation,
    userPrompt,
    "json_object"
  );
  
  return formatJSONResponse(JSON.parse(response));
}

export async function leaseAnalysisService(data: {
  leaseText?: string;
  propertyAddress?: string;
  leaseType?: string;
  termLength?: string;
  monthlyRent?: number;
}) {
  const userPrompt = data.leaseText 
    ? `Analyze this lease agreement:\n\n${data.leaseText.substring(0, 4000)}`
    : `Analyze lease with these details:
Property: ${data.propertyAddress || 'Not specified'}
Type: ${data.leaseType || 'Commercial'}
Term: ${data.termLength || 'Not specified'}
Monthly Rent: $${data.monthlyRent || 'Not specified'}

Provide comprehensive analysis of terms, risks, and financial implications.`;

  const response = await callOpenAI(
    REAL_ESTATE_SYSTEM_PROMPTS.leaseAnalysis,
    userPrompt,
    "json_object"
  );
  
  return formatJSONResponse(JSON.parse(response));
}

export async function constructionProgressService(data: {
  projectDescription: string;
  photoUrls?: string[];
  projectType?: string;
  targetCompletionDate?: string;
  currentPhase?: string;
}) {
  const userPrompt = `Analyze construction progress:
Project Type: ${data.projectType || 'Commercial Building'}
Description: ${data.projectDescription}
Current Phase: ${data.currentPhase || 'In Progress'}
Target Completion: ${data.targetCompletionDate || 'Not specified'}
Photos: ${data.photoUrls?.length || 0} images provided

Estimate completion percentage and provide detailed progress analysis.`;

  const response = await callOpenAI(
    REAL_ESTATE_SYSTEM_PROMPTS.constructionProgress,
    userPrompt,
    "json_object"
  );
  
  return formatJSONResponse(JSON.parse(response));
}
