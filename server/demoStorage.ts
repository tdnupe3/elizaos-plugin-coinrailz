import {
  demoUsedTransactionHashes,
  demoTransactionProofs,
  demoServiceMetrics,
  type InsertDemoUsedTransactionHash,
  type InsertDemoTransactionProof,
  type InsertDemoServiceMetric,
  type DemoUsedTransactionHash,
  type DemoServiceMetric,
} from "./demoSchema";
import { demoDb } from "./demoDb";
import { eq, desc } from "drizzle-orm";

/**
 * DEMO STORAGE LAYER
 * 
 * This storage layer is COMPLETELY ISOLATED from production data.
 * It only interacts with demo_* tables and has zero access to production tables.
 * 
 * SAFETY GUARANTEE: Even if this code has bugs, it cannot touch production data
 * because it uses demoDb connection which is bound to demo schema only.
 */
export class DemoStorage {
  
  /**
   * Check if a transaction hash has been used for demo services
   * This prevents replay attacks in the demo environment
   */
  async isDemoTransactionUsed(txHash: string): Promise<boolean> {
    const result = await demoDb
      .select()
      .from(demoUsedTransactionHashes)
      .where(eq(demoUsedTransactionHashes.txHash, txHash))
      .limit(1);
    
    return result.length > 0;
  }

  /**
   * Record a demo transaction as used
   */
  async recordDemoTransactionUsed(data: InsertDemoUsedTransactionHash): Promise<DemoUsedTransactionHash> {
    const [result] = await demoDb
      .insert(demoUsedTransactionHashes)
      .values(data)
      .returning();
    
    return result;
  }

  /**
   * Record demo transaction proof
   */
  async recordDemoTransactionProof(data: InsertDemoTransactionProof): Promise<void> {
    await demoDb
      .insert(demoTransactionProofs)
      .values(data);
  }

  /**
   * Record demo service usage metrics
   */
  async recordDemoServiceMetric(data: InsertDemoServiceMetric): Promise<DemoServiceMetric> {
    const [result] = await demoDb
      .insert(demoServiceMetrics)
      .values(data)
      .returning();
    
    return result;
  }

  /**
   * Get demo service metrics (for demo agent dashboard)
   */
  async getDemoServiceMetrics(limit: number = 50): Promise<DemoServiceMetric[]> {
    return await demoDb
      .select()
      .from(demoServiceMetrics)
      .orderBy(desc(demoServiceMetrics.createdAt))
      .limit(limit);
  }

  /**
   * Get demo metrics by service name
   */
  async getDemoMetricsByService(serviceName: string, limit: number = 20): Promise<DemoServiceMetric[]> {
    return await demoDb
      .select()
      .from(demoServiceMetrics)
      .where(eq(demoServiceMetrics.serviceName, serviceName))
      .orderBy(desc(demoServiceMetrics.createdAt))
      .limit(limit);
  }

  /**
   * Get total demo transactions count
   */
  async getDemoTransactionCount(): Promise<number> {
    const result = await demoDb
      .select()
      .from(demoUsedTransactionHashes);
    
    return result.length;
  }

  /**
   * Clear all demo data (for testing/cleanup)
   * This only affects demo tables, never production
   */
  async clearAllDemoData(): Promise<void> {
    await demoDb.delete(demoServiceMetrics);
    await demoDb.delete(demoTransactionProofs);
    await demoDb.delete(demoUsedTransactionHashes);
    
    console.log('[DEMO] All demo data cleared successfully');
  }
}

// Export singleton instance
export const demoStorage = new DemoStorage();
