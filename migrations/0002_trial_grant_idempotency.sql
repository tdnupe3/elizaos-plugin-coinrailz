-- Keep the migration self-contained. Production may already have this table
-- from the incident-response hotfix, while fresh environments do not.
CREATE TABLE IF NOT EXISTS "m2m_trial_reservations" (
  "claim_key" varchar(64) PRIMARY KEY,
  "reservation_id" varchar(36) NOT NULL,
  "ip_hash" varchar(64) NOT NULL,
  "user_id" varchar,
  "status" varchar(20) NOT NULL DEFAULT 'reserved',
  "claimed_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_m2m_trial_reservations_claimed"
  ON "m2m_trial_reservations" ("claimed_at");
CREATE INDEX IF NOT EXISTS "IDX_m2m_trial_reservations_status"
  ON "m2m_trial_reservations" ("status");

-- Existing historical trial references use "trial_" rather than the new
-- claim-HMAC/reservation "trial:" namespace, so this partial index is safe to
-- add to populated production databases without making legacy rows collide.
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_credit_transactions_trial_grant_once"
  ON "credit_transactions" ("reference_id")
  WHERE "type" = 'purchase' AND "reference_id" LIKE 'trial:%';