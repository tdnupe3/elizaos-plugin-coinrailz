// MANDATORY TRUTH VERIFICATION - NO CLAIMS WITHOUT EVIDENCE
// This must be called before ANY statement about platform performance

const db = require('./server/db');

class TruthVerificationSystem {
  static async getFactualMetrics() {
    const results = await Promise.all([
      // Real revenue (excluding test user)
      db.execute(`SELECT COALESCE(SUM(amount), 0) as total_revenue FROM ai_marketplace_orders WHERE customer_id != 'oauth-test-user-1749701423054' AND created_at > '2025-09-19'`),
      
      // Real orders count
      db.execute(`SELECT COUNT(*) as real_orders FROM ai_marketplace_orders WHERE customer_id != 'oauth-test-user-1749701423054' AND created_at > '2025-09-19'`),
      
      // External agents (human registered only)
      db.execute(`SELECT COUNT(*) as external_agents FROM global_ai_agents WHERE is_human_registered = true AND agent_name NOT LIKE '%Treasury%' AND agent_name NOT LIKE '%Emergency Fund%'`),
      
      // Recent discovery results
      db.execute(`SELECT COUNT(*) as new_agents_today FROM global_ai_agents WHERE updated_at > NOW() - INTERVAL '24 hours' AND is_human_registered = true`)
    ]);

    return {
      total_revenue: parseFloat(results[0][0]?.total_revenue || 0),
      real_orders: parseInt(results[1][0]?.real_orders || 0),
      external_agents: parseInt(results[2][0]?.external_agents || 0),
      new_agents_24h: parseInt(results[3][0]?.new_agents_today || 0),
      last_updated: new Date().toISOString()
    };
  }

  static enforceHonesty(claim, metrics) {
    const violations = [];
    
    if (claim.includes('revenue') && metrics.total_revenue === 0) {
      violations.push('CLAIMED REVENUE BUT total_revenue = $0.00');
    }
    
    if (claim.includes('agents contacted') && metrics.new_agents_24h === 0) {
      violations.push('CLAIMED AGENTS CONTACTED BUT new_agents_24h = 0');
    }
    
    if (claim.includes('real') || claim.includes('live') || claim.includes('production')) {
      if (metrics.real_orders === 0 && metrics.external_agents === 0) {
        violations.push('CLAIMED REAL/LIVE/PRODUCTION BUT all metrics = 0');
      }
    }

    if (violations.length > 0) {
      throw new Error(`HONESTY VIOLATION: ${violations.join(', ')}. ACTUAL METRICS: ${JSON.stringify(metrics)}`);
    }
    
    return true;
  }

  static generateFactualStatement(metrics) {
    return `VERIFIED FACTS (${metrics.last_updated}):
- Revenue Generated: $${metrics.total_revenue.toFixed(2)}
- Real Customer Orders: ${metrics.real_orders}
- External AI Agents: ${metrics.external_agents}
- New Agents (24h): ${metrics.new_agents_24h}

SOURCE: Database queries executed at ${metrics.last_updated}`;
  }
}

module.exports = { TruthVerificationSystem };

// IMMEDIATE TRUTH CHECK FOR CURRENT STATUS
async function getCurrentTruth() {
  const metrics = await TruthVerificationSystem.getFactualMetrics();
  console.log('MANDATORY TRUTH VERIFICATION:');
  console.log(TruthVerificationSystem.generateFactualStatement(metrics));
  return metrics;
}

getCurrentTruth().catch(console.error);