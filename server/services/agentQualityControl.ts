/**
 * AI Agent Quality Control System
 * Implements service delivery verification and performance rating
 */

import { connectionManager } from './connectionManager';

export interface AgentPerformanceMetrics {
  agentId: string;
  totalOrders: number;
  completedOrders: number;
  averageRating: number;
  responseTime: number;
  disputeRate: number;
  lastActive: Date;
}

export interface ServiceDeliveryVerification {
  orderId: string;
  agentId: string;
  serviceType: string;
  deliveryProof: string;
  customerConfirmation: boolean;
  qualityScore: number;
  timestamp: Date;
}

export class AgentQualityControl {
  
  async verifyServiceDelivery(orderId: string, deliveryProof: string): Promise<boolean> {
    try {
      const verification = await connectionManager.executeTransaction([
        {
          query: `INSERT INTO service_deliveries (order_id, delivery_proof, verification_status, created_at) 
                  VALUES ($1, $2, 'pending', NOW()) RETURNING id`,
          params: [orderId, deliveryProof]
        },
        {
          query: `UPDATE service_orders SET status = 'delivered', delivered_at = NOW() 
                  WHERE id = $1`,
          params: [orderId]
        }
      ]);

      return verification[0].rows.length > 0;
    } catch (error) {
      console.error('Service delivery verification failed:', error);
      return false;
    }
  }

  async rateAgentPerformance(orderId: string, rating: number, feedback: string): Promise<void> {
    try {
      await connectionManager.executeTransaction([
        {
          query: `INSERT INTO agent_ratings (order_id, rating, feedback, created_at) 
                  VALUES ($1, $2, $3, NOW())`,
          params: [orderId, rating, feedback]
        },
        {
          query: `UPDATE service_orders SET customer_rating = $1, rating_feedback = $2 
                  WHERE id = $3`,
          params: [rating, feedback, orderId]
        }
      ]);

      // Update agent's overall rating
      await this.updateAgentRating(orderId);
    } catch (error) {
      console.error('Failed to rate agent performance:', error);
      throw error;
    }
  }

  private async updateAgentRating(orderId: string): Promise<void> {
    try {
      await connectionManager.executeQuery(`
        UPDATE ai_agents 
        SET average_rating = (
          SELECT AVG(customer_rating) 
          FROM service_orders 
          WHERE agent_id = ai_agents.id 
          AND customer_rating IS NOT NULL
        ),
        total_ratings = (
          SELECT COUNT(*) 
          FROM service_orders 
          WHERE agent_id = ai_agents.id 
          AND customer_rating IS NOT NULL
        )
        WHERE id = (
          SELECT agent_id FROM service_orders WHERE id = $1
        )
      `, [orderId]);
    } catch (error) {
      console.error('Failed to update agent rating:', error);
    }
  }

  async getAgentPerformanceMetrics(agentId: string): Promise<AgentPerformanceMetrics | null> {
    try {
      const result = await connectionManager.executeQuery(`
        SELECT 
          a.id as agent_id,
          COUNT(so.id) as total_orders,
          COUNT(CASE WHEN so.status = 'completed' THEN 1 END) as completed_orders,
          COALESCE(AVG(so.customer_rating), 0) as average_rating,
          COALESCE(AVG(EXTRACT(EPOCH FROM (so.delivered_at - so.created_at))), 0) as avg_response_time,
          COALESCE(COUNT(CASE WHEN so.status = 'disputed' THEN 1 END) * 100.0 / NULLIF(COUNT(so.id), 0), 0) as dispute_rate,
          MAX(so.created_at) as last_active
        FROM ai_agents a
        LEFT JOIN service_orders so ON a.id = so.agent_id
        WHERE a.id = $1
        GROUP BY a.id
      `, [agentId]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        agentId: row.agent_id,
        totalOrders: parseInt(row.total_orders),
        completedOrders: parseInt(row.completed_orders),
        averageRating: parseFloat(row.average_rating),
        responseTime: parseFloat(row.avg_response_time),
        disputeRate: parseFloat(row.dispute_rate),
        lastActive: row.last_active
      };
    } catch (error) {
      console.error('Failed to get agent performance metrics:', error);
      return null;
    }
  }

  async flagUnderperformingAgents(): Promise<string[]> {
    try {
      const result = await connectionManager.executeQuery(`
        SELECT a.id, a.name
        FROM ai_agents a
        LEFT JOIN service_orders so ON a.id = so.agent_id
        GROUP BY a.id, a.name
        HAVING 
          COUNT(so.id) > 5 AND (
            AVG(so.customer_rating) < 3.0 OR
            COUNT(CASE WHEN so.status = 'disputed' THEN 1 END) * 100.0 / COUNT(so.id) > 20
          )
      `);

      return result.rows.map((row: { id: string }) => row.id);
    } catch (error) {
      console.error('Failed to flag underperforming agents:', error);
      return [];
    }
  }

  async suspendAgent(agentId: string, reason: string): Promise<boolean> {
    try {
      await connectionManager.executeTransaction([
        {
          query: `UPDATE ai_agents SET status = 'suspended', suspension_reason = $1 
                  WHERE id = $2`,
          params: [reason, agentId]
        },
        {
          query: `INSERT INTO agent_suspensions (agent_id, reason, suspended_at) 
                  VALUES ($1, $2, NOW())`,
          params: [agentId, reason]
        }
      ]);

      return true;
    } catch (error) {
      console.error('Failed to suspend agent:', error);
      return false;
    }
  }

  async createQualityReport(): Promise<any> {
    try {
      const result = await connectionManager.executeQuery(`
        SELECT 
          COUNT(*) as total_agents,
          AVG(average_rating) as platform_avg_rating,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_agents,
          COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_agents,
          COUNT(CASE WHEN average_rating >= 4.0 THEN 1 END) as high_rated_agents
        FROM ai_agents
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create quality report:', error);
      return null;
    }
  }
}

export const agentQualityControl = new AgentQualityControl();