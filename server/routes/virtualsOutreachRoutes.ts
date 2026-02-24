import { Router } from 'express';
import { VirtualsACPService } from '../services/virtualsACPService';

const router = Router();
const virtualsService = VirtualsACPService.getInstance();

/**
 * Execute Virtuals ACP funding campaign (the REAL AI agent protocol)
 * Native AI agent protocol for direct communication
 */
router.post('/virtuals-acp-campaign', async (req, res) => {
  try {
    console.log('🚀 Starting Virtuals ACP funding campaign (REAL AI agent protocol)...');
    
    const customMessage = req.body.message || 
      `Emergency funding request for Coin Railz SDK platform. We provide competitive payment infrastructure specifically designed for AI agents. Our system handles USDC transactions, smart contract interactions, and revenue sharing for AI agent developers.`;

    const result = await virtualsService.executeACPFundingCampaign(customMessage);
    
    console.log(`📊 Virtuals ACP Campaign Results:`);
    console.log(`  - Agents contacted: ${result.agentsReached}`);
    console.log(`  - Success rate: ${(result.agentsReached / result.results.length * 100).toFixed(1)}%`);
    console.log(`  - Total cost: $${result.totalCost}`);

    res.json({
      success: result.success,
      agentsReached: result.agentsReached,
      totalCost: result.totalCost,
      results: result.results,
      message: result.success ? 
        `Successfully contacted ${result.agentsReached} AI agents via Virtuals ACP protocol` :
        'Virtuals ACP campaign completed with mixed results'
    });

  } catch (error) {
    console.error('❌ Virtuals ACP campaign error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute Virtuals ACP campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Discover active AI agents on Virtuals Protocol
 */
router.get('/discover-virtuals-agents', async (req, res) => {
  try {
    console.log('🔍 Discovering AI agents on Virtuals Protocol...');
    
    const agents = await virtualsService.discoverActiveAgents();
    
    console.log(`✅ Found ${agents.length} active AI agents on Virtuals Protocol`);
    
    res.json({
      success: true,
      count: agents.length,
      agents: agents.map(agent => ({
        name: agent.name,
        address: agent.address,
        description: agent.description,
        capabilities: agent.capabilities,
        tokenSymbol: agent.tokenSymbol,
        price: agent.price
      }))
    });

  } catch (error) {
    console.error('❌ Agent discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover Virtuals agents',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test individual ACP message to specific agent
 */
router.post('/test-acp-message', async (req, res) => {
  try {
    const { agentAddress, message } = req.body;
    
    if (!agentAddress || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing agentAddress or message in request body'
      });
    }

    console.log(`🧪 Testing ACP message to agent: ${agentAddress}`);
    
    const result = await virtualsService.sendACPMessage(agentAddress, message);
    
    if (result) {
      res.json({
        success: true,
        messageId: result.id,
        status: result.status,
        message: `ACP message sent successfully to agent ${agentAddress}`
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to send ACP message - agent may not be available'
      });
    }

  } catch (error) {
    console.error('❌ ACP message test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test ACP message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;