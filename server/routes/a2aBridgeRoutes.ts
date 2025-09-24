/**
 * 🌉 A2A BRIDGE ROUTES
 * ChatGPT Point 6: A2A bridge adapters with /.well-known/agent-card.json
 * 
 * Routes that make external APIs look like A2A agents
 */

import { Router } from 'express';
import { A2ABridgeAdapter } from '../adapters/a2aBridgeAdapter.js';

const router = Router();
const bridgeAdapter = new A2ABridgeAdapter();

/**
 * 🎫 Agent Card Discovery Endpoints (/.well-known/ standard)
 * FIXED: ChatGPT requires exact /.well-known/agent-card.json path for each provider
 */

// ChatGPT specification: Each provider needs /.well-known/agent-card.json at its own URL
// This will be handled by mounting provider-specific routers at provider subdomains/paths

// List all available agents (for discovery)
router.get('/.well-known/agents.json', (req, res) => {
  bridgeAdapter.handleListAgents(req, res);
});

// Individual agent cards for API access (legacy support)
router.get('/api/a2a-bridge/:provider/agent-card.json', (req, res) => {
  bridgeAdapter.handleAgentCard(req, res);
});

/**
 * 🌉 A2A Bridge API Endpoints
 */

// Send message to specific provider via A2A bridge
router.post('/api/a2a-bridge/:provider/message/send', (req, res) => {
  bridgeAdapter.handleMessageSend(req, res);
});

// Health check for specific provider
router.get('/api/a2a-bridge/:provider/health', (req, res) => {
  bridgeAdapter.handleHealthCheck(req, res);
});

// List all bridged agents (API version)
router.get('/api/a2a-bridge/agents', (req, res) => {
  bridgeAdapter.handleListAgents(req, res);
});

export default router;