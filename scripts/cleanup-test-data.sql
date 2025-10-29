-- Cleanup Test Data Script
-- Run this after testing to remove all test data

-- Clean up test marketplace orders
DELETE FROM marketplace_orders 
WHERE user_id LIKE 'test_%' OR description LIKE '%test%' OR description LIKE '%TEST%';

-- Clean up test x402 payments
DELETE FROM x402_payments 
WHERE order_id IN (SELECT id FROM marketplace_orders WHERE user_id LIKE 'test_%');

-- Clean up test service deliveries  
DELETE FROM service_deliveries
WHERE order_id IN (SELECT id FROM marketplace_orders WHERE user_id LIKE 'test_%');

-- Clean up test agent communications
DELETE FROM agent_communications
WHERE agent_id LIKE 'test_%' OR message LIKE '%test%';

-- Clean up test discovered agents (not our 3 production agents)
DELETE FROM discovered_agents
WHERE id NOT IN ('smart-contract-auditor', 'payment-processor', 'compliance-consultant');

-- Clean up test agent service orders
DELETE FROM agent_service_orders
WHERE agent_id NOT IN ('smart-contract-auditor', 'payment-processor', 'compliance-consultant');

-- Verify cleanup
SELECT 'marketplace_orders' as table_name, COUNT(*) as remaining_rows FROM marketplace_orders
UNION ALL
SELECT 'x402_payments', COUNT(*) FROM x402_payments  
UNION ALL
SELECT 'service_deliveries', COUNT(*) FROM service_deliveries
UNION ALL
SELECT 'discovered_agents', COUNT(*) FROM discovered_agents
UNION ALL
SELECT 'agent_service_orders', COUNT(*) FROM agent_service_orders;
