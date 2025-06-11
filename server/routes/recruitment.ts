
import { Router } from 'express';
import { agentRecruiter } from '../services/simpleAgentRecruiter';

const router = Router();

router.post('/recruit-agent', async (req, res) => {
  try {
    const { targetContact } = req.body;
    const result = await agentRecruiter.recruitAgent(targetContact);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Recruitment failed' });
  }
});

export default router;
