import OpenAI from "openai";
import { db } from "../../db";
import { microserviceRequests, microserviceMetrics } from "@shared/schema";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

export const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

export function setCachedData(key: string, data: any, ttlMs: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

export async function trackRequest(
  serviceId: string,
  requestInput: any,
  responseData: any | null,
  responseTime: number,
  paymentAmount: number,
  walletAddress: string,
  error?: string
) {
  try {
    await db.insert(microserviceRequests).values({
      id: nanoid(),
      serviceId,
      requestInput,
      responseData,
      responseTime,
      paymentAmount: paymentAmount.toString(),
      paymentStatus: error ? "failed" : "completed",
      walletAddress,
      error,
    });

    const today = new Date().toISOString().split('T')[0];
    const existing = await db.query.microserviceMetrics.findFirst({
      where: and(
        eq(microserviceMetrics.serviceId, serviceId),
        eq(microserviceMetrics.date, today)
      ),
    });

    if (existing) {
      const currentTotalRequests = existing.totalRequests || 0;
      const currentSuccessfulRequests = existing.successfulRequests || 0;
      const currentFailedRequests = existing.failedRequests || 0;
      const currentAvgResponseTime = existing.avgResponseTime || 0;
      const currentRevenue = parseFloat(existing.totalRevenue || "0");

      await db
        .update(microserviceMetrics)
        .set({
          totalRequests: currentTotalRequests + 1,
          successfulRequests: error ? currentSuccessfulRequests : currentSuccessfulRequests + 1,
          failedRequests: error ? currentFailedRequests + 1 : currentFailedRequests,
          totalRevenue: (currentRevenue + (error ? 0 : paymentAmount)).toString(),
          avgResponseTime: Math.round((currentAvgResponseTime * currentTotalRequests + responseTime) / (currentTotalRequests + 1)),
        })
        .where(eq(microserviceMetrics.id, existing.id));
    } else {
      await db.insert(microserviceMetrics).values({
        serviceId,
        date: today,
        totalRequests: 1,
        successfulRequests: error ? 0 : 1,
        failedRequests: error ? 1 : 0,
        totalRevenue: (error ? 0 : paymentAmount).toString(),
        avgResponseTime: responseTime,
      });
    }
  } catch (err) {
    console.error("Error tracking request:", err);
  }
}

/**
 * Sanitize AI response by removing BOM, control characters, and invalid UTF-8
 */
function sanitizeAIResponse(content: string): string {
  if (!content) return "";
  
  // Remove BOM (Byte Order Mark)
  let sanitized = content.replace(/^\uFEFF/, '');
  
  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove any non-printable unicode characters that might corrupt JSON
  sanitized = sanitized.replace(/[\uFFFD\uFFFE\uFFFF]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Extract the first balanced JSON object from a string using brace counting
 * Handles nested objects correctly unlike simple regex
 */
function extractFirstBalancedJSON(text: string): string | null {
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return null;
  
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return text.slice(startIdx, i + 1);
        }
      }
    }
  }
  
  return null;
}

/**
 * Safely parse JSON with error recovery
 * Includes telemetry for tracking recovery paths
 */
export function safeParseJSON(content: string): { success: boolean; data: any; error?: string; recoveryPath?: string } {
  const sanitized = sanitizeAIResponse(content);
  
  if (!sanitized) {
    console.log(`📊 TELEMETRY: safeParseJSON | result=failure | path=empty_response`);
    return { success: false, data: null, error: "Empty response from AI", recoveryPath: "empty_response" };
  }
  
  try {
    const data = JSON.parse(sanitized);
    console.log(`📊 TELEMETRY: safeParseJSON | result=success | path=direct_parse`);
    return { success: true, data, recoveryPath: "direct_parse" };
  } catch (e: any) {
    // Try to extract JSON from the response (sometimes AI adds markdown code blocks)
    const jsonMatch = sanitized.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1].trim());
        console.log(`📊 TELEMETRY: safeParseJSON | result=success | path=fenced_block_extraction`);
        return { success: true, data, recoveryPath: "fenced_block_extraction" };
      } catch {
        // Fall through to brace-balanced extraction
      }
    }
    
    // Try to find the first balanced JSON object using brace counting (handles nested objects)
    const balancedJSON = extractFirstBalancedJSON(sanitized);
    if (balancedJSON) {
      try {
        const data = JSON.parse(balancedJSON);
        console.log(`📊 TELEMETRY: safeParseJSON | result=success | path=brace_balanced_extraction`);
        return { success: true, data, recoveryPath: "brace_balanced_extraction" };
      } catch {
        // Fall through to error
      }
    }
    
    console.log(`📊 TELEMETRY: safeParseJSON | result=failure | path=all_recovery_failed | error=${e.message}`);
    return { success: false, data: null, error: `JSON parse failed: ${e.message}`, recoveryPath: "all_recovery_failed" };
  }
}

export async function callOpenAI(systemPrompt: string, userPrompt: string, responseFormat?: "json_object"): Promise<string> {
  const maxRetries = 2;
  let lastError: Error | null = null;
  const callStartTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();
    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: attempt === 1 ? 0.7 : 0.3, // Lower temperature on retry for more consistent output
        response_format: responseFormat ? { type: responseFormat } : undefined
      });
      
      const content = response.choices[0].message.content || "";
      const sanitized = sanitizeAIResponse(content);
      const attemptLatency = Date.now() - attemptStartTime;
      const tokensUsed = response.usage?.total_tokens || 0;
      
      // If JSON format requested, validate it's actually valid JSON
      if (responseFormat === "json_object") {
        const parseResult = safeParseJSON(sanitized);
        if (!parseResult.success) {
          console.warn(`[OpenAI] Attempt ${attempt}/${maxRetries} - Invalid JSON response: ${parseResult.error}`);
          console.log(`📊 TELEMETRY: callOpenAI | attempt=${attempt} | result=invalid_json | latency=${attemptLatency}ms | tokens=${tokensUsed}`);
          lastError = new Error(parseResult.error);
          if (attempt < maxRetries) {
            continue; // Retry
          }
          throw lastError;
        }
      }
      
      const totalLatency = Date.now() - callStartTime;
      console.log(`📊 TELEMETRY: callOpenAI | attempt=${attempt} | result=success | latency=${attemptLatency}ms | total_latency=${totalLatency}ms | tokens=${tokensUsed} | retries_needed=${attempt - 1}`);
      return sanitized;
    } catch (error: any) {
      const attemptLatency = Date.now() - attemptStartTime;
      console.error(`[OpenAI] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      console.log(`📊 TELEMETRY: callOpenAI | attempt=${attempt} | result=error | latency=${attemptLatency}ms | error=${error.message?.slice(0, 100)}`);
      lastError = error;
      
      if (attempt < maxRetries) {
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
    }
  }
  
  const totalLatency = Date.now() - callStartTime;
  console.log(`📊 TELEMETRY: callOpenAI | result=exhausted | total_latency=${totalLatency}ms | max_retries=${maxRetries} | final_error=${lastError?.message?.slice(0, 100)}`);
  throw new Error(`AI analysis failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

export function formatJSONResponse(data: any) {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    provider: "Coin Railz AI Analysis"
  };
}
