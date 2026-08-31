ALTER TABLE "global_ai_agents" ADD COLUMN IF NOT EXISTS "verification_level" varchar DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "global_ai_agents" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "global_ai_agents" ADD COLUMN IF NOT EXISTS "suspicious_activity_flags" integer DEFAULT 0 NOT NULL;