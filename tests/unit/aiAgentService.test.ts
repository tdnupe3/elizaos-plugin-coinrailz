
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIAgentService } from '../../server/services/aiAgentService';

describe('AIAgentService', () => {
  let aiAgentService: AIAgentService;

  beforeEach(() => {
    aiAgentService = AIAgentService.getInstance();
    vi.clearAllMocks();
  });

  describe('Agent Registration', () => {
    it('should register a new AI agent successfully', async () => {
      const mockAgent = {
        name: 'Test Agent',
        description: 'Test Description',
        serviceType: 'trading',
        pricingTier: 'standard',
        ownerId: 'user123'
      };

      const result = await aiAgentService.registerAgent(mockAgent);
      
      expect(result.success).toBe(true);
      expect(result.agent).toMatchObject({
        name: mockAgent.name,
        serviceType: mockAgent.serviceType
      });
    });

    it('should reject invalid agent registration', async () => {
      const invalidAgent = {
        name: '', // Invalid empty name
        serviceType: 'invalid-type'
      };

      const result = await aiAgentService.registerAgent(invalidAgent as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });
  });

  describe('Agent Discovery', () => {
    it('should return active agents', async () => {
      const mockAgents = [
        { id: '1', name: 'Agent 1', isActive: true },
        { id: '2', name: 'Agent 2', isActive: true }
      ];

      vi.mocked(aiAgentService.getActiveAgents).mockResolvedValue(mockAgents);

      const result = await aiAgentService.getActiveAgents();
      
      expect(result).toHaveLength(2);
      expect(result.every(agent => agent.isActive)).toBe(true);
    });
  });

  describe('Transaction Processing', () => {
    it('should process agent transaction with correct fees', async () => {
      const transaction = {
        fromAgentId: 'agent1',
        toAgentId: 'agent2',
        amount: 100,
        currency: 'USD'
      };

      const result = await aiAgentService.processAgentTransaction(transaction);

      expect(result.success).toBe(true);
      expect(result.platformFee).toBe(3.5); // 3.5% fee
      expect(result.netAmount).toBe(96.5);
    });
  });
});
