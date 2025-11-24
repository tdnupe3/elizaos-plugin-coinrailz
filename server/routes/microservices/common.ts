import OpenAI from "openai";
import { db } from "../../db";
import { microserviceRequests, microserviceMetrics } from "@shared/schema";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export async function callOpenAI(systemPrompt: string, userPrompt: string, responseFormat?: "json_object"): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      response_format: responseFormat ? { type: responseFormat } : undefined
    });
    
    return response.choices[0].message.content || "";
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

export function formatJSONResponse(data: any) {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    provider: "Coin Railz AI Analysis"
  };
}
