-- Demo database tables migration
-- These tables are COMPLETELY ISOLATED from production tables
-- They use the demo_ prefix to ensure no naming conflicts

-- Table: demo_used_transaction_hashes
-- Prevents replay attacks in demo environment
CREATE TABLE IF NOT EXISTS demo_used_transaction_hashes (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) NOT NULL,
  network VARCHAR NOT NULL,
  service_name VARCHAR NOT NULL,
  amount VARCHAR NOT NULL,
  paid_by VARCHAR,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS IDX_demo_used_tx_hash_unique 
  ON demo_used_transaction_hashes(tx_hash);
CREATE INDEX IF NOT EXISTS IDX_demo_used_tx_network 
  ON demo_used_transaction_hashes(network);
CREATE INDEX IF NOT EXISTS IDX_demo_used_tx_service 
  ON demo_used_transaction_hashes(service_name);
CREATE INDEX IF NOT EXISTS IDX_demo_used_tx_timestamp 
  ON demo_used_transaction_hashes(used_at);

-- Table: demo_transaction_proofs
-- Stores blockchain transaction proofs for demo activities
CREATE TABLE IF NOT EXISTS demo_transaction_proofs (
  id SERIAL PRIMARY KEY,
  target_address VARCHAR NOT NULL,
  tx_signature VARCHAR NOT NULL,
  chain VARCHAR NOT NULL,
  message_snippet VARCHAR,
  campaign_id VARCHAR,
  status VARCHAR DEFAULT 'confirmed',
  network_fee NUMERIC(18, 8),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS IDX_demo_transaction_proofs_chain 
  ON demo_transaction_proofs(chain);
CREATE INDEX IF NOT EXISTS IDX_demo_transaction_proofs_campaign 
  ON demo_transaction_proofs(campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS IDX_demo_transaction_proofs_signature 
  ON demo_transaction_proofs(tx_signature);

-- Table: demo_service_metrics
-- Records demo agent service usage for analytics
CREATE TABLE IF NOT EXISTS demo_service_metrics (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR NOT NULL,
  request_body JSONB,
  response_data JSONB,
  tx_hash VARCHAR(66) NOT NULL,
  amount_paid VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  error_message VARCHAR,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS IDX_demo_service_metrics_service 
  ON demo_service_metrics(service_name);
CREATE INDEX IF NOT EXISTS IDX_demo_service_metrics_status 
  ON demo_service_metrics(status);
CREATE INDEX IF NOT EXISTS IDX_demo_service_metrics_created 
  ON demo_service_metrics(created_at);

-- Verification query
SELECT 
  'demo_used_transaction_hashes' as table_name, 
  COUNT(*) as row_count 
FROM demo_used_transaction_hashes
UNION ALL
SELECT 
  'demo_transaction_proofs', 
  COUNT(*) 
FROM demo_transaction_proofs
UNION ALL
SELECT 
  'demo_service_metrics', 
  COUNT(*) 
FROM demo_service_metrics;
