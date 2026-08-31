
/**
 * Isolated Stress Testing Service
 * Tests platform performance with simulated data that doesn't affect production metrics
 */

import { FeeCalculator } from './feeCalculator';

interface StressTestScenario {
  name: string;
  concurrentUsers: number;
  transactionsPerSecond: number;
  testDuration: number; // seconds
  transactionTypes: Array<{
    type: 'p2p' | 'crypto_swap' | 'agent_service';
    percentage: number;
    avgAmount: number;
  }>;
}

interface StressTestResults {
  scenario: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  cpuUsage: number;
  profitabilitySimulation: {
    totalRevenue: number;
    totalCosts: number;
    totalProfit: number;
    avgMargin: number;
  };
}

export class IsolatedStressTester {
  private static isRunning = false;
  private static currentTest: string | null = null;

  /**
   * Run comprehensive stress test with simulated data only
   */
  static async runStressTest(scenario: StressTestScenario): Promise<StressTestResults> {
    if (this.isRunning) {
      throw new Error('Stress test already running. Please wait for completion.');
    }

    this.isRunning = true;
    this.currentTest = scenario.name;
    
    console.log(`🧪 Starting isolated stress test: ${scenario.name}`);
    console.log(`⚡ ${scenario.concurrentUsers} concurrent users, ${scenario.transactionsPerSecond} TPS for ${scenario.testDuration}s`);

    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;
    let peakMemory = initialMemory;
    
    const results: StressTestResults = {
      scenario: scenario.name,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      memoryUsage: {
        initial: initialMemory,
        peak: 0,
        final: 0
      },
      cpuUsage: 0,
      profitabilitySimulation: {
        totalRevenue: 0,
        totalCosts: 0,
        totalProfit: 0,
        avgMargin: 0
      }
    };

    try {
      // Calculate total requests
      const totalRequests = scenario.transactionsPerSecond * scenario.testDuration;
      const batchSize = Math.min(scenario.concurrentUsers, 50); // Limit concurrent batches
      const batchInterval = 1000 / scenario.transactionsPerSecond * batchSize;

      const responseTimes: number[] = [];
      let completedRequests = 0;

      // Run test in batches
      for (let i = 0; i < totalRequests; i += batchSize) {
        const batchPromises: Promise<any>[] = [];
        
        for (let j = 0; j < Math.min(batchSize, totalRequests - i); j++) {
          batchPromises.push(this.simulateTransaction(scenario));
        }

        const batchStartTime = Date.now();
        const batchResults = await Promise.allSettled(batchPromises);
        const batchEndTime = Date.now();

        // Process batch results
        batchResults.forEach((result, index) => {
          results.totalRequests++;
          
          if (result.status === 'fulfilled') {
            results.successfulRequests++;
            const responseTime = batchEndTime - batchStartTime;
            responseTimes.push(responseTime);
            results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);
            
            // Add to profitability simulation
            const profit = result.value.profit || 0;
            const revenue = result.value.revenue || 0;
            const costs = result.value.costs || 0;
            
            results.profitabilitySimulation.totalRevenue += revenue;
            results.profitabilitySimulation.totalCosts += costs;
            results.profitabilitySimulation.totalProfit += profit;
          } else {
            results.failedRequests++;
          }
        });

        // Track memory usage
        const currentMemory = process.memoryUsage().heapUsed;
        peakMemory = Math.max(peakMemory, currentMemory);

        completedRequests += batchSize;
        
        // Progress logging
        if (completedRequests % (totalRequests / 10) === 0) {
          const progress = Math.round((completedRequests / totalRequests) * 100);
          console.log(`📊 Stress test progress: ${progress}% (${completedRequests}/${totalRequests} requests)`);
        }

        // Throttle to maintain target TPS
        if (i + batchSize < totalRequests) {
          await new Promise(resolve => setTimeout(resolve, Math.max(0, batchInterval - (batchEndTime - batchStartTime))));
        }
      }

      // Calculate final metrics
      const testDuration = Date.now() - startTime;
      results.avgResponseTime = responseTimes.length > 0 ? 
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
      results.requestsPerSecond = (results.totalRequests / testDuration) * 1000;
      results.errorRate = (results.failedRequests / results.totalRequests) * 100;
      results.memoryUsage.peak = peakMemory;
      results.memoryUsage.final = process.memoryUsage().heapUsed;
      results.cpuUsage = process.cpuUsage().user / 1000000; // Convert to seconds

      // Calculate profitability metrics
      if (results.profitabilitySimulation.totalRevenue > 0) {
        results.profitabilitySimulation.avgMargin = 
          (results.profitabilitySimulation.totalProfit / results.profitabilitySimulation.totalRevenue) * 100;
      }

      console.log(`✅ Stress test completed: ${scenario.name}`);
      console.log(`📈 Results: ${results.successfulRequests}/${results.totalRequests} successful (${(100-results.errorRate).toFixed(1)}%)`);
      console.log(`⚡ Performance: ${results.requestsPerSecond.toFixed(1)} RPS, ${results.avgResponseTime.toFixed(1)}ms avg response`);
      console.log(`💰 Simulated profit: $${results.profitabilitySimulation.totalProfit.toFixed(2)} (${results.profitabilitySimulation.avgMargin.toFixed(1)}% margin)`);

    } catch (error) {
      console.error('❌ Stress test failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentTest = null;
    }

    return results;
  }

  /**
   * Simulate a transaction without affecting production data
   */
  private static async simulateTransaction(scenario: StressTestScenario): Promise<any> {
    // Select random transaction type based on percentages
    const random = Math.random() * 100;
    let cumulative = 0;
    let selectedType = scenario.transactionTypes[0];
    
    for (const type of scenario.transactionTypes) {
      cumulative += type.percentage;
      if (random <= cumulative) {
        selectedType = type;
        break;
      }
    }

    // Generate random amount around average
    const amount = selectedType.avgAmount * (0.5 + Math.random());
    const paymentMethod = Math.random() > 0.5 ? 'stripe' : 'crypto';

    // Simulate processing time
    const processingTime = Math.random() * 100 + 20; // 20-120ms
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Calculate simulated fees and profits
    let revenue = 0;
    let costs = 0;
    let profit = 0;

    try {
      switch (selectedType.type) {
        case 'p2p':
          const p2pFees = FeeCalculator.calculateP2PFees(amount, paymentMethod);
          revenue = p2pFees.totalFee;
          costs = paymentMethod === 'stripe' ? (amount * 0.029 + 0.30) : 0;
          profit = revenue - costs;
          break;
          
        case 'crypto_swap':
          const swapFees = FeeCalculator.calculateSwapFee(amount, paymentMethod);
          revenue = swapFees.totalFee;
          costs = 0; // No processing costs for crypto swaps
          profit = revenue;
          break;
          
        case 'agent_service':
          const agentFees = FeeCalculator.calculateMarketplaceFees(amount, paymentMethod);
          revenue = agentFees.totalFee;
          costs = paymentMethod === 'stripe' ? (amount * 0.029 + 0.30) : 0;
          profit = revenue - costs;
          break;
      }

      // Simulate occasional failures (2% failure rate)
      if (Math.random() < 0.02) {
        throw new Error('Simulated transaction failure');
      }

      return { revenue, costs, profit, success: true };
    } catch (error) {
      return { revenue: 0, costs: 0, profit: 0, success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Pre-defined stress test scenarios
   */
  static getTestScenarios(): StressTestScenario[] {
    return [
      {
        name: 'Light Load Test',
        concurrentUsers: 10,
        transactionsPerSecond: 5,
        testDuration: 30,
        transactionTypes: [
          { type: 'p2p', percentage: 60, avgAmount: 100 },
          { type: 'crypto_swap', percentage: 30, avgAmount: 250 },
          { type: 'agent_service', percentage: 10, avgAmount: 50 }
        ]
      },
      {
        name: 'Medium Load Test',
        concurrentUsers: 50,
        transactionsPerSecond: 25,
        testDuration: 60,
        transactionTypes: [
          { type: 'p2p', percentage: 50, avgAmount: 150 },
          { type: 'crypto_swap', percentage: 35, avgAmount: 400 },
          { type: 'agent_service', percentage: 15, avgAmount: 75 }
        ]
      },
      {
        name: 'Heavy Load Test',
        concurrentUsers: 100,
        transactionsPerSecond: 50,
        testDuration: 120,
        transactionTypes: [
          { type: 'p2p', percentage: 45, avgAmount: 200 },
          { type: 'crypto_swap', percentage: 40, avgAmount: 500 },
          { type: 'agent_service', percentage: 15, avgAmount: 100 }
        ]
      },
      {
        name: 'Extreme Load Test',
        concurrentUsers: 200,
        transactionsPerSecond: 100,
        testDuration: 180,
        transactionTypes: [
          { type: 'p2p', percentage: 40, avgAmount: 300 },
          { type: 'crypto_swap', percentage: 45, avgAmount: 750 },
          { type: 'agent_service', percentage: 15, avgAmount: 150 }
        ]
      }
    ];
  }

  /**
   * Get current test status
   */
  static getStatus(): { running: boolean; currentTest: string | null } {
    return {
      running: this.isRunning,
      currentTest: this.currentTest
    };
  }
}

export const isolatedStressTester = new IsolatedStressTester();
