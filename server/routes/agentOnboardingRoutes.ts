import { Router } from 'express';
import { storage } from '../storage';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { isAuthenticated } from '../replitAuth';
import { emailService } from '../services/emailService';

const router = Router();

// Agent registration and verification
router.post('/agent/register', async (req, res) => {
  try {
    const { 
      name, 
      email, 
      specialties, 
      experience, 
      portfolio, 
      hourlyRate,
      bio,
      skills,
      certifications 
    } = req.body;

    if (!name || !email || !specialties) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and specialties are required'
      });
    }

    // Generate agent ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    // Create agent profile
    const agentData = {
      id: agentId,
      name,
      email,
      specialties: Array.isArray(specialties) ? specialties : [specialties],
      experience: experience || 'beginner',
      portfolio: portfolio || [],
      hourlyRate: parseFloat(hourlyRate) || 50,
      bio: bio || '',
      skills: Array.isArray(skills) ? skills : [],
      certifications: Array.isArray(certifications) ? certifications : [],
      status: 'pending_verification',
      commissionRate: 0.85, // 85% commission to agent
      joinedAt: new Date(),
      isActive: false, // Activated after verification
      verificationStatus: 'pending',
      totalEarnings: 0,
      completedJobs: 0,
      rating: 0,
      reviewCount: 0
    };

    // Insert into global AI agents table
    await db.execute(sql`
      INSERT INTO global_ai_agents (
        id, agent_name, email, specialties, experience, 
        portfolio, hourly_rate, bio, skills, certifications,
        status, commission_rate, joined_at, is_active,
        verification_status, total_earnings, completed_jobs,
        rating, review_count
      ) VALUES (
        ${agentData.id}, ${agentData.name}, ${agentData.email}, 
        ${JSON.stringify(agentData.specialties)}, ${agentData.experience},
        ${JSON.stringify(agentData.portfolio)}, ${agentData.hourlyRate}, 
        ${agentData.bio}, ${JSON.stringify(agentData.skills)}, 
        ${JSON.stringify(agentData.certifications)}, ${agentData.status},
        ${agentData.commissionRate}, ${agentData.joinedAt}, ${agentData.isActive},
        ${agentData.verificationStatus}, ${agentData.totalEarnings}, 
        ${agentData.completedJobs}, ${agentData.rating}, ${agentData.reviewCount}
      )
    `);

    // Send welcome email to new agent
    await emailService.sendAgentWelcomeEmail(agentData);

    res.json({
      success: true,
      agent: {
        id: agentData.id,
        name: agentData.name,
        status: agentData.status,
        commissionRate: agentData.commissionRate,
        message: 'Agent registration submitted for verification'
      }
    });

  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register agent'
    });
  }
});

// Get agent profile and statistics
router.get('/agent/:agentId/profile', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agentResult = await db.execute(sql`
      SELECT * FROM global_ai_agents WHERE id = ${agentId}
    `);

    if (!agentResult.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const agent = agentResult.rows[0];

    // Get agent statistics
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount * 0.85 END), 0) as total_earnings,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as avg_order_value
      FROM marketplace_orders 
      WHERE agent_id = ${agentId}
    `);

    const stats = statsResult.rows[0] as Record<string, unknown> | undefined;
    const stringValue = (value: unknown): string =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : '0';

    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.agent_name,
        email: agent.email,
        specialties: JSON.parse(typeof agent.specialties === 'string' ? agent.specialties : '[]'),
        experience: agent.experience,
        bio: agent.bio,
        skills: JSON.parse(typeof agent.skills === 'string' ? agent.skills : '[]'),
        hourlyRate: parseFloat(stringValue(agent.hourly_rate)),
        rating: parseFloat(stringValue(agent.rating)),
        reviewCount: parseInt(stringValue(agent.review_count)),
        isActive: agent.is_active,
        verificationStatus: agent.verification_status,
        statistics: {
          totalOrders: parseInt(stringValue(stats?.total_orders)) || 0,
          completedOrders: parseInt(stringValue(stats?.completed_orders)) || 0,
          totalEarnings: parseFloat(stringValue(stats?.total_earnings)) || 0,
          avgOrderValue: parseFloat(stringValue(stats?.avg_order_value)) || 0
        }
      }
    });

  } catch (error) {
    console.error('Agent profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent profile'
    });
  }
});

// Update agent profile
router.put('/agent/:agentId/profile', isAuthenticated, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { bio, skills, hourlyRate, portfolio } = req.body;

    await db.execute(sql`
      UPDATE global_ai_agents 
      SET 
        bio = ${bio || ''},
        skills = ${JSON.stringify(skills || [])},
        hourly_rate = ${parseFloat(hourlyRate) || 50},
        portfolio = ${JSON.stringify(portfolio || [])},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${agentId}
    `);

    res.json({
      success: true,
      message: 'Agent profile updated successfully'
    });

  } catch (error) {
    console.error('Agent profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent profile'
    });
  }
});

// Get agent earnings and commission tracking
router.get('/agent/:agentId/earnings', isAuthenticated, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND created_at >= '${startDate}' AND created_at <= '${endDate}'`;
    }

    const earningsResult = await db.execute(sql`
      SELECT 
        id as order_id,
        amount,
        amount * 0.85 as agent_commission,
        amount * 0.15 as platform_fee,
        status,
        created_at,
        completed_at,
        service_type
      FROM marketplace_orders 
      WHERE agent_id = ${agentId} 
        AND status IN ('completed', 'paid')
        ${dateFilter ? sql.raw(dateFilter) : sql``}
      ORDER BY created_at DESC
    `);

    const totalEarnings = earningsResult.rows.reduce((sum: number, order: any) => {
      return sum + (parseFloat(order.agent_commission) || 0);
    }, 0);

    res.json({
      success: true,
      earnings: {
        totalEarnings,
        commissionRate: 0.85,
        transactions: earningsResult.rows.map((order: any) => ({
          orderId: order.order_id,
          orderAmount: parseFloat(order.amount),
          agentCommission: parseFloat(order.agent_commission),
          platformFee: parseFloat(order.platform_fee),
          status: order.status,
          serviceType: order.service_type,
          completedAt: order.completed_at,
          createdAt: order.created_at
        }))
      }
    });

  } catch (error) {
    console.error('Agent earnings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent earnings'
    });
  }
});

// Agent verification (admin only)
router.post('/agent/:agentId/verify', isAuthenticated, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be approved or rejected'
      });
    }

    await db.execute(sql`
      UPDATE global_ai_agents 
      SET 
        verification_status = ${status},
        is_active = ${status === 'approved'},
        verification_notes = ${notes || ''},
        verified_at = CURRENT_TIMESTAMP
      WHERE id = ${agentId}
    `);

    res.json({
      success: true,
      message: `Agent ${status} successfully`,
      agentId,
      status
    });

  } catch (error) {
    console.error('Agent verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify agent'
    });
  }
});

export default router;