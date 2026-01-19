CREATE TABLE "a2a_outreach_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"agent_url" varchar NOT NULL,
	"agent_name" varchar,
	"campaign_id" varchar NOT NULL,
	"message_variant" varchar,
	"task_id" varchar,
	"context_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"task_status" varchar,
	"response_content" text,
	"response_intent" varchar,
	"error_message" text,
	"trial_credits_offered" integer DEFAULT 0,
	"sent_at" timestamp,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "a2a_tasks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"task_type" varchar NOT NULL,
	"description" text,
	"parameters" jsonb,
	"result" jsonb,
	"callback_url" varchar,
	"agent_url" varchar,
	"urgency_level" varchar,
	"contacted_agents" integer DEFAULT 0,
	"completed_tasks" integer DEFAULT 0,
	"total_value" numeric(20, 8) DEFAULT '0.00000000',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "acp_orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"product_id" varchar NOT NULL,
	"checkout_session_id" varchar,
	"stripe_payment_intent_id" varchar,
	"customer_email" varchar,
	"customer_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"api_key_issued" varchar,
	"credits_added" integer,
	"fulfillment_status" varchar DEFAULT 'pending',
	"fulfillment_details" jsonb,
	"source" varchar DEFAULT 'chatgpt',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "acp_products" (
	"id" varchar PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"product_type" varchar NOT NULL,
	"credits_included" integer,
	"api_calls_included" integer,
	"validity_days" integer,
	"service_slugs" text[],
	"metadata" jsonb,
	"active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "advanced_watchlist_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"watchlist_id" integer NOT NULL,
	"symbol" varchar NOT NULL,
	"name" varchar NOT NULL,
	"network" varchar NOT NULL,
	"contract_address" varchar,
	"price_alert_high" numeric(18, 8),
	"price_alert_low" numeric(18, 8),
	"volume_alert_threshold" numeric(20, 8),
	"notes" text,
	"color" varchar DEFAULT '#3B82F6',
	"sort_order" integer DEFAULT 0,
	"last_price" numeric(18, 8),
	"change_24h" numeric(10, 4),
	"volume_24h" numeric(20, 8),
	"market_cap" numeric(20, 2),
	"last_updated" timestamp,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "advanced_watchlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"price_alerts_enabled" boolean DEFAULT true,
	"volume_alerts_enabled" boolean DEFAULT false,
	"news_alerts_enabled" boolean DEFAULT false,
	"sort_by" varchar DEFAULT 'market_cap',
	"sort_order" varchar DEFAULT 'desc',
	"display_columns" jsonb DEFAULT '["symbol", "price", "change_24h", "volume", "market_cap"]',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "affiliate_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_code" varchar(50) NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"sale_amount" numeric(10, 2) NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"payout_id" varchar(255),
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_code" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"website" varchar(255),
	"audience" text NOT NULL,
	"paypal_email" varchar(255) NOT NULL,
	"commission_rate" numeric(3, 2) DEFAULT '0.50',
	"total_sales" numeric(10, 2) DEFAULT '0.00',
	"total_commission" numeric(10, 2) DEFAULT '0.00',
	"conversion_count" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "affiliates_affiliate_code_unique" UNIQUE("affiliate_code")
);
--> statement-breakpoint
CREATE TABLE "agent_communications" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_agent_id" varchar NOT NULL,
	"to_agent_id" varchar NOT NULL,
	"message_type" varchar NOT NULL,
	"content" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" varchar NOT NULL,
	"initiator_agent_id" varchar NOT NULL,
	"recipient_agent_id" varchar NOT NULL,
	"contract_type" varchar NOT NULL,
	"terms" jsonb NOT NULL,
	"amount" varchar NOT NULL,
	"currency" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp,
	"signed_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agent_contracts_contract_id_unique" UNIQUE("contract_id")
);
--> statement-breakpoint
CREATE TABLE "agent_outreach_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"channel" varchar NOT NULL,
	"recipient_address" varchar,
	"message_type" varchar NOT NULL,
	"message_content" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"error_message" text,
	"response_received" boolean DEFAULT false,
	"response_content" text,
	"response_at" timestamp,
	"campaign_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_agent_id" varchar NOT NULL,
	"referee_agent_id" varchar,
	"referred_user_id" varchar,
	"referral_type" varchar DEFAULT 'agent' NOT NULL,
	"human_transaction_required" boolean DEFAULT false NOT NULL,
	"transaction_amount" varchar NOT NULL,
	"reward_amount" varchar NOT NULL,
	"currency" varchar DEFAULT 'USDT',
	"status" varchar DEFAULT 'pending',
	"is_completed" boolean DEFAULT false,
	"is_paid_out" boolean DEFAULT false,
	"is_first_transaction" boolean DEFAULT false,
	"transaction_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_service_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"service_name" varchar NOT NULL,
	"description" text NOT NULL,
	"category" varchar NOT NULL,
	"subcategory" varchar,
	"pricing_model" varchar NOT NULL,
	"base_price" varchar NOT NULL,
	"currency" varchar DEFAULT 'USDT' NOT NULL,
	"estimated_delivery_time" varchar,
	"availability_status" varchar DEFAULT 'available' NOT NULL,
	"required_inputs" jsonb DEFAULT '[]',
	"sample_outputs" jsonb DEFAULT '[]',
	"success_metrics" jsonb DEFAULT '[]',
	"rating" numeric(3, 2) DEFAULT '0.0',
	"completed_orders" integer DEFAULT 0 NOT NULL,
	"total_revenue" varchar DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" varchar NOT NULL,
	"service_listing_id" integer NOT NULL,
	"buyer_agent_id" varchar NOT NULL,
	"seller_agent_id" varchar NOT NULL,
	"order_status" varchar DEFAULT 'pending' NOT NULL,
	"total_amount" varchar NOT NULL,
	"currency" varchar NOT NULL,
	"platform_fee" varchar NOT NULL,
	"requirements" text,
	"deliverables" text,
	"communication_channel" varchar,
	"estimated_completion" timestamp,
	"actual_completion" timestamp,
	"buyer_rating" integer,
	"seller_rating" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agent_service_orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "agent_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar NOT NULL,
	"initiator_agent_id" varchar NOT NULL,
	"recipient_agent_id" varchar,
	"transaction_type" varchar NOT NULL,
	"amount" varchar NOT NULL,
	"currency" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"platform_fee" varchar NOT NULL,
	"gas_fee" varchar NOT NULL,
	"agent_commission" varchar DEFAULT '0' NOT NULL,
	"network_fee" varchar DEFAULT '0' NOT NULL,
	"total_fees" varchar NOT NULL,
	"description" text,
	"metadata" jsonb,
	"blockchain_tx_hash" varchar,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agent_transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "agent_wallet_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"actor" varchar,
	"request_id" varchar,
	"offer_tracking" varchar,
	"payload" jsonb,
	"response" jsonb,
	"error_message" text,
	"ip_address" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"wallet_id" varchar NOT NULL,
	"address" varchar NOT NULL,
	"chain" varchar DEFAULT 'base-mainnet' NOT NULL,
	"custody_type" varchar DEFAULT 'cdp' NOT NULL,
	"purpose" varchar DEFAULT 'persistent' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"tier" varchar DEFAULT 'paid' NOT NULL,
	"labels" text[],
	"tags" text[],
	"metadata" jsonb,
	"payment_tx_hash" varchar,
	"payer_wallet_address" varchar,
	"payer_ip_address" varchar,
	"payer_user_agent" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_wallets_wallet_id_unique" UNIQUE("wallet_id"),
	CONSTRAINT "agent_wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "ai_agent_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"price_usd" numeric(10, 2) NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL,
	"features" text[] NOT NULL,
	"api_endpoints" text[] NOT NULL,
	"request_limits" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"target_audience" varchar(100) DEFAULT 'ai_agents' NOT NULL,
	"stripe_product_id" varchar(255),
	"stripe_price_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agent_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"product_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"payment_method" varchar(20) NOT NULL,
	"payment_address" varchar(255),
	"monthly_revenue" numeric(10, 2) NOT NULL,
	"api_key_hash" varchar(255) NOT NULL,
	"stripe_subscription_id" varchar(255),
	"stripe_customer_id" varchar(255),
	"last_payment_date" timestamp,
	"next_billing_date" timestamp,
	"usage_stats" jsonb,
	"email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_marketplace_categories" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"icon" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"service_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_marketplace_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ai_marketplace_commissions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"order_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"agent_tier" varchar NOT NULL,
	"service_amount" varchar NOT NULL,
	"commission_rate" numeric(5, 4) NOT NULL,
	"commission_amount" varchar NOT NULL,
	"platform_fee_rate" numeric(5, 4) NOT NULL,
	"platform_fee_amount" varchar NOT NULL,
	"payout_status" varchar DEFAULT 'pending' NOT NULL,
	"payout_method" varchar,
	"payout_transaction_id" varchar,
	"calculated_at" timestamp DEFAULT now(),
	"paid_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_marketplace_deliveries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"order_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"delivery_method" varchar NOT NULL,
	"delivery_content" jsonb NOT NULL,
	"delivery_files" jsonb,
	"evidence_urls" jsonb,
	"customer_confirmed" boolean DEFAULT false,
	"confirmation_timestamp" timestamp,
	"quality_score" numeric(3, 2),
	"customer_feedback" text,
	"auto_release_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_marketplace_disputes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"order_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"dispute_type" varchar NOT NULL,
	"customer_statement" text NOT NULL,
	"agent_response" text,
	"evidence_urls" jsonb,
	"moderator_id" varchar,
	"status" varchar DEFAULT 'open' NOT NULL,
	"resolution" varchar,
	"resolution_reason" text,
	"resolution_amount" varchar,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_marketplace_orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"service_type" varchar DEFAULT 'general',
	"amount" numeric(10, 2) NOT NULL,
	"agent_commission" numeric(10, 2) DEFAULT '0.00',
	"platform_fee" numeric(10, 2) DEFAULT '0.00',
	"status" varchar DEFAULT 'pending',
	"payment_method" varchar DEFAULT 'stripe',
	"service_description" text,
	"customer_requirements" text,
	"estimated_delivery_hours" integer DEFAULT 24,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_marketplace_performance" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"completed_orders" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT '0.0' NOT NULL,
	"total_ratings" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(5, 4) DEFAULT '0.0' NOT NULL,
	"average_delivery_time" numeric(8, 2),
	"total_revenue" varchar DEFAULT '0.0' NOT NULL,
	"dispute_count" integer DEFAULT 0 NOT NULL,
	"dispute_rate" numeric(5, 4) DEFAULT '0.0' NOT NULL,
	"suspension_count" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp,
	"performance_score" numeric(5, 2) DEFAULT '100.0' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_marketplace_performance_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "ai_marketplace_services" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"category_id" varchar NOT NULL,
	"service_name" varchar NOT NULL,
	"description" text NOT NULL,
	"short_description" varchar NOT NULL,
	"pricing" jsonb NOT NULL,
	"delivery_methods" jsonb NOT NULL,
	"estimated_delivery_time" integer NOT NULL,
	"requirements" jsonb,
	"samples" jsonb,
	"tags" jsonb,
	"approval_status" varchar DEFAULT 'pending' NOT NULL,
	"moderator_id" varchar,
	"approval_notes" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT '0.0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_marketplace_suspensions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"reason" varchar NOT NULL,
	"suspension_type" varchar NOT NULL,
	"suspension_duration" integer,
	"moderator_id" varchar,
	"description" text NOT NULL,
	"evidence_urls" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"lifted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "analytics_datasets" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_type" varchar NOT NULL,
	"data_hash" varchar NOT NULL,
	"aggregated_data" jsonb NOT NULL,
	"time_range" varchar,
	"currency" varchar,
	"volume" numeric(20, 8),
	"transaction_count" integer,
	"average_amount" numeric(15, 2),
	"volatility" numeric(5, 4),
	"risk_score" integer,
	"geolocation" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "analytics_datasets_data_hash_unique" UNIQUE("data_hash")
);
--> statement-breakpoint
CREATE TABLE "api_integration_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"api_provider" varchar NOT NULL,
	"endpoint" varchar NOT NULL,
	"request_id" varchar NOT NULL,
	"request_data" jsonb,
	"response_data" jsonb,
	"status_code" integer,
	"iso20022_message_type" varchar,
	"compliance_flags" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"hashed_key" varchar(255) NOT NULL,
	"name" varchar DEFAULT 'API Key',
	"status" varchar DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"allowed_services" jsonb,
	"rate_limit" integer DEFAULT 1000,
	"created_at" timestamp DEFAULT now(),
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "api_usage_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" varchar NOT NULL,
	"api_endpoint" varchar NOT NULL,
	"request_method" varchar NOT NULL,
	"response_time" integer,
	"data_points_returned" integer,
	"price_paid" numeric(10, 2),
	"billing_status" varchar DEFAULT 'pending',
	"ip_address" varchar,
	"user_agent" text,
	"request_timestamp" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "b2b_marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_email" varchar NOT NULL,
	"client_organization" varchar NOT NULL,
	"campaign_name" varchar NOT NULL,
	"target_category" varchar NOT NULL,
	"message" text NOT NULL,
	"budget_amount" integer DEFAULT 5000 NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"targets_reached" integer DEFAULT 0,
	"delivery_success_rate" numeric(5, 2) DEFAULT '0.00',
	"blockchain_tx_hashes" text[] DEFAULT ARRAY[]::text[],
	"payment_status" varchar DEFAULT 'pending',
	"stripe_payment_intent_id" varchar,
	"expected_targets" integer DEFAULT 0,
	"delivery_cost" numeric(10, 2) DEFAULT '0.00',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "base_ecosystem_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_name" varchar NOT NULL,
	"wallet_address" varchar NOT NULL,
	"treasury_value" bigint NOT NULL,
	"region" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text,
	"contact_status" varchar DEFAULT 'available',
	"last_contact_date" timestamp,
	"is_verified" boolean DEFAULT true,
	"delivery_channels" text[] DEFAULT ARRAY['blockchain'],
	"successful_campaigns" integer DEFAULT 0,
	"total_campaigns" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bracket_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"parent_order_id" varchar NOT NULL,
	"from_asset" varchar NOT NULL,
	"to_asset" varchar NOT NULL,
	"from_amount" numeric(18, 8) NOT NULL,
	"take_profit_price" numeric(18, 8) NOT NULL,
	"take_profit_order_id" varchar,
	"stop_loss_price" numeric(18, 8) NOT NULL,
	"stop_loss_order_id" varchar,
	"trailing_stop_enabled" boolean DEFAULT false,
	"trailing_amount" numeric(18, 8),
	"trailing_percent" numeric(5, 2),
	"status" varchar DEFAULT 'active' NOT NULL,
	"completed_leg" varchar,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bridge_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"from_chain" varchar NOT NULL,
	"to_chain" varchar NOT NULL,
	"from_asset" varchar NOT NULL,
	"to_asset" varchar NOT NULL,
	"from_amount" numeric(18, 8) NOT NULL,
	"to_amount" numeric(18, 8),
	"bridge_fee" numeric(18, 8),
	"network_fee" numeric(18, 8),
	"total_fee" numeric(18, 8),
	"from_tx_hash" varchar,
	"to_tx_hash" varchar,
	"bridge_provider" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"estimated_time" integer,
	"actual_time" integer,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cdp_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar NOT NULL,
	"wallet_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar NOT NULL,
	"to_address" varchar,
	"from_address" varchar,
	"status" varchar NOT NULL,
	"transaction_hash" varchar,
	"network_fee" numeric(18, 8),
	"platform_fee" numeric(10, 2),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cdp_transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "cdp_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"address" varchar NOT NULL,
	"network" varchar NOT NULL,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cdp_wallets_wallet_id_unique" UNIQUE("wallet_id")
);
--> statement-breakpoint
CREATE TABLE "chain_fee_optimization" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_chain" varchar NOT NULL,
	"to_chain" varchar NOT NULL,
	"asset" varchar NOT NULL,
	"bridge_provider" varchar NOT NULL,
	"base_fee" numeric(18, 8) NOT NULL,
	"network_fee" numeric(18, 8) NOT NULL,
	"platform_fee" numeric(18, 8) NOT NULL,
	"total_fee" numeric(18, 8) NOT NULL,
	"estimated_time" integer NOT NULL,
	"success_rate" numeric(5, 2) NOT NULL,
	"is_recommended" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chain_selection_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"preferred_chains" jsonb DEFAULT '[]',
	"auto_select_cheapest" boolean DEFAULT true,
	"max_acceptable_fee" numeric(18, 8) DEFAULT '10.00',
	"max_acceptable_time" integer DEFAULT 30,
	"show_advanced_options" boolean DEFAULT false,
	"fee_display_format" varchar DEFAULT 'usd',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chart_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"default_timeframe" varchar DEFAULT '1h',
	"indicators" jsonb DEFAULT '[]',
	"chart_type" varchar DEFAULT 'candlestick',
	"theme" varchar DEFAULT 'dark',
	"auto_refresh" boolean DEFAULT true,
	"refresh_interval" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" varchar NOT NULL,
	"chat_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"recipient_id" varchar,
	"content" text NOT NULL,
	"message_type" varchar DEFAULT 'text',
	"file_url" varchar,
	"order_id" varchar,
	"timestamp" timestamp DEFAULT now(),
	"is_read" boolean DEFAULT false,
	"is_delivered" boolean DEFAULT true,
	CONSTRAINT "chat_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" varchar NOT NULL,
	"participants" jsonb NOT NULL,
	"chat_name" varchar NOT NULL,
	"order_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_message" jsonb,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "chat_rooms_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "coinbase_address_database" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" varchar NOT NULL,
	"domain_name" varchar,
	"domain_type" varchar NOT NULL,
	"last_activity" timestamp,
	"can_receive_messages" boolean DEFAULT true,
	"added_at" timestamp DEFAULT now(),
	CONSTRAINT "coinbase_address_database_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "coinbase_oauth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_type" varchar DEFAULT 'Bearer',
	"expires_at" timestamp NOT NULL,
	"scope" text,
	"coinbase_user_id" varchar,
	"coinbase_username" varchar,
	"last_refreshed" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coinbase_oauth_tokens_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"report_type" varchar NOT NULL,
	"transaction_id" integer,
	"crypto_transaction_id" integer,
	"risk_score" integer NOT NULL,
	"flagged_reasons" jsonb,
	"iso20022_message_id" varchar,
	"filed_with_authorities" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_scoring_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_hash" varchar NOT NULL,
	"credit_score" integer NOT NULL,
	"score_factors" jsonb,
	"confidence" numeric(3, 2),
	"transaction_history" jsonb,
	"risk_profile" varchar,
	"income_estimate" numeric(12, 2),
	"debt_to_income_ratio" numeric(5, 4),
	"payment_behavior" jsonb,
	"last_updated" timestamp DEFAULT now(),
	"valid_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balance_before" numeric(12, 2) NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"reference_id" varchar,
	"service_name" varchar,
	"payment_method" varchar,
	"metadata" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credits_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"auto_top_up_enabled" boolean DEFAULT false,
	"auto_top_up_threshold" numeric(12, 2) DEFAULT '10.00',
	"auto_top_up_amount" numeric(12, 2) DEFAULT '50.00',
	"preferred_payment_method" varchar DEFAULT 'stripe',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credits_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"dollar_value" numeric(10, 2) NOT NULL,
	"description" text,
	"related_order_id" varchar,
	"balance_after" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cross_chain_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" varchar NOT NULL,
	"user_id" varchar,
	"wallet_address" varchar NOT NULL,
	"source_chain" varchar NOT NULL,
	"target_chain" varchar NOT NULL,
	"asset" varchar NOT NULL,
	"source_amount" numeric(20, 8) NOT NULL,
	"target_amount" numeric(20, 8) NOT NULL,
	"bridge_fee" numeric(10, 6) NOT NULL,
	"source_tx_hash" varchar,
	"target_tx_hash" varchar,
	"status" varchar DEFAULT 'pending',
	"bridge_provider" varchar,
	"is_guest_trade" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "cross_chain_trades_trade_id_unique" UNIQUE("trade_id")
);
--> statement-breakpoint
CREATE TABLE "crypto_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"coin_symbol" varchar NOT NULL,
	"coin_name" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"average_buy_price" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crypto_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"coin_symbol" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"price_per_coin" numeric(10, 2),
	"total_value" numeric(10, 2),
	"status" varchar DEFAULT 'completed',
	"blockchain_hash" varchar,
	"blockchain_address" varchar,
	"network_fee" numeric(10, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crypto_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_user_id" varchar,
	"to_wallet_address" varchar NOT NULL,
	"crypto_symbol" varchar(10) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"commission_rate" numeric(5, 4) DEFAULT '0.0025' NOT NULL,
	"commission_amount" numeric(18, 8) NOT NULL,
	"net_amount" numeric(18, 8) NOT NULL,
	"transaction_hash" varchar,
	"blockchain_network" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"related_order_id" varchar,
	"related_dispute_id" varchar,
	"priority" varchar DEFAULT 'normal',
	"read" boolean DEFAULT false,
	"email_sent" boolean DEFAULT false,
	"sms_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_risk_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" varchar NOT NULL,
	"dispute_history" integer DEFAULT 0,
	"successful_transactions" integer DEFAULT 0,
	"risk_score" integer DEFAULT 0,
	"requires_escrow_extension" boolean DEFAULT false,
	"blacklisted" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT now(),
	CONSTRAINT "customer_risk_profiles_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" varchar NOT NULL,
	"delivery_hash" varchar NOT NULL,
	"agent_signature" varchar NOT NULL,
	"delivery_data" jsonb,
	"evidence_urls" jsonb,
	"evidence_score" integer DEFAULT 50,
	"verification_method" varchar DEFAULT 'automatic',
	"verified_at" timestamp DEFAULT now(),
	"dispute_deadline" timestamp NOT NULL,
	"escrow_status" varchar DEFAULT 'held',
	CONSTRAINT "delivery_verifications_delivery_hash_unique" UNIQUE("delivery_hash")
);
--> statement-breakpoint
CREATE TABLE "dex_revenue" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"total_trading_volume" numeric(20, 2) DEFAULT '0.00',
	"total_trading_fees" numeric(20, 6) DEFAULT '0.000000',
	"total_cross_chain_volume" numeric(20, 2) DEFAULT '0.00',
	"total_cross_chain_fees" numeric(20, 6) DEFAULT '0.000000',
	"total_subscription_revenue" numeric(10, 2) DEFAULT '0.00',
	"guest_trade_count" integer DEFAULT 0,
	"user_trade_count" integer DEFAULT 0,
	"active_subscriptions" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dex_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"tier" varchar NOT NULL,
	"fee_discount" numeric(5, 4) NOT NULL,
	"monthly_price" numeric(8, 2) NOT NULL,
	"is_active" boolean DEFAULT true,
	"auto_renew" boolean DEFAULT true,
	"current_period_start" timestamp DEFAULT now(),
	"current_period_end" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dex_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" varchar NOT NULL,
	"user_id" varchar,
	"wallet_address" varchar NOT NULL,
	"from_asset" varchar NOT NULL,
	"to_asset" varchar NOT NULL,
	"from_amount" numeric(20, 8) NOT NULL,
	"to_amount" numeric(20, 8) NOT NULL,
	"platform_fee" numeric(10, 6) NOT NULL,
	"network" varchar NOT NULL,
	"network_fee" numeric(18, 8),
	"slippage_percent" numeric(5, 2) DEFAULT '2.0',
	"chain" varchar,
	"dex_protocol" varchar,
	"transaction_hash" varchar,
	"status" varchar DEFAULT 'pending',
	"is_guest_trade" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dex_trades_trade_id_unique" UNIQUE("trade_id")
);
--> statement-breakpoint
CREATE TABLE "discovered_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" varchar NOT NULL,
	"canonical_url" varchar,
	"source" varchar NOT NULL,
	"channels" jsonb,
	"wallet" varchar,
	"status" varchar DEFAULT 'new',
	"score" integer DEFAULT 0,
	"last_seen_at" timestamp DEFAULT now(),
	"last_contact_at" timestamp,
	"attempts" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"capabilities" jsonb,
	"metadata" jsonb,
	"discovered_at" timestamp DEFAULT now(),
	"verified_at" timestamp,
	"xmtp_address" varchar,
	"xmtp_can_message" boolean DEFAULT false,
	"xmtp_status" varchar DEFAULT 'unknown',
	"xmtp_quality_score" integer DEFAULT 0,
	"xmtp_last_checked" timestamp,
	"agent_card_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "discovery_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_type" varchar DEFAULT 'scheduled' NOT NULL,
	"status" varchar DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"total_raw" integer DEFAULT 0,
	"total_unique" integer DEFAULT 0,
	"new_agents" integer DEFAULT 0,
	"updated_agents" integer DEFAULT 0,
	"by_source" jsonb,
	"errors" jsonb,
	"raw_output" jsonb,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "enterprise_outreach_campaigns" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"target_market" varchar(50) NOT NULL,
	"target_count" integer NOT NULL,
	"email_template" text NOT NULL,
	"follow_up_template" text NOT NULL,
	"target_criteria" text NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"contacted" integer DEFAULT 0 NOT NULL,
	"responses" integer DEFAULT 0 NOT NULL,
	"qualified" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_outreach_objections" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_id" varchar NOT NULL,
	"campaign_id" varchar,
	"objection_category" varchar(50) NOT NULL,
	"objection_text" text NOT NULL,
	"sentiment" varchar(10) DEFAULT 'neutral' NOT NULL,
	"severity" integer DEFAULT 5 NOT NULL,
	"communication_channel" varchar(30) NOT NULL,
	"response_delay" integer,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_outreach_targets" (
	"id" varchar PRIMARY KEY NOT NULL,
	"campaign_id" varchar,
	"user_id" varchar NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"industry" varchar(100) NOT NULL,
	"employee_count" varchar(50) NOT NULL,
	"revenue" varchar(50) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"contact_title" varchar(255) NOT NULL,
	"linkedin_url" varchar(500),
	"phone_number" varchar(50),
	"company_description" text NOT NULL,
	"use_case" text NOT NULL,
	"priority" varchar(10) DEFAULT 'medium' NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"lead_tier" varchar(10) DEFAULT 'cold' NOT NULL,
	"last_scored_at" timestamp,
	"follow_up_status" varchar(20) DEFAULT 'automated' NOT NULL,
	"objection_category" varchar(50),
	"response_time" integer,
	"engagement_score" integer DEFAULT 0,
	"last_contact_date" timestamp,
	"next_follow_up" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fast_credit_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"credit_package_id" varchar NOT NULL,
	"credits_spent" numeric(8, 2) NOT NULL,
	"service" varchar NOT NULL,
	"service_details" jsonb,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fast_premium_credits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"credits" numeric(8, 2) NOT NULL,
	"tier" varchar DEFAULT 'basic' NOT NULL,
	"price_per_credit" numeric(6, 4) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"purchase_transaction_id" varchar,
	"remaining_credits" numeric(8, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fast_revenue_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"service" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'USD' NOT NULL,
	"user_id" varchar,
	"metadata" jsonb,
	"stripe_payment_intent_id" varchar,
	"payment_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "free_credits_claim_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar NOT NULL,
	"fingerprint" varchar NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"user_agent" text,
	"claimed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "free_wallet_blacklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar,
	"agent_id" varchar,
	"reason" varchar NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "free_wallet_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar NOT NULL,
	"agent_id" varchar,
	"trust_tier" varchar DEFAULT 'baseline' NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"cooldown_until" timestamp,
	"cooldown_level" integer DEFAULT 0,
	"last_request_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_id" integer NOT NULL,
	"type" varchar NOT NULL,
	"method" varchar NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"currency" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"external_transaction_id" varchar,
	"bank_account" jsonb,
	"crypto_address" varchar,
	"network_fee" numeric(20, 8) DEFAULT '0.00000000',
	"platform_fee" numeric(10, 2) DEFAULT '0.00',
	"expected_confirmations" integer DEFAULT 0,
	"current_confirmations" integer DEFAULT 0,
	"transaction_hash" varchar,
	"failure_reason" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "global_ai_agents" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_name" varchar NOT NULL,
	"description" text,
	"capabilities" jsonb NOT NULL,
	"primary_wallet_address" varchar NOT NULL,
	"ethereum_wallet" varchar,
	"xrp_wallet" varchar,
	"solana_wallet" varchar,
	"bitcoin_address" varchar,
	"wallet_network" varchar DEFAULT 'ethereum' NOT NULL,
	"rwa_capabilities" jsonb DEFAULT '[]',
	"supported_token_standards" jsonb DEFAULT '["ERC-20", "ERC-721", "ERC-1155"]',
	"defi_protocol_integrations" jsonb DEFAULT '[]',
	"api_endpoint" varchar,
	"public_key" text NOT NULL,
	"signature" text NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"reputation" numeric(3, 2) DEFAULT '0.0' NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"total_volume" varchar DEFAULT '0' NOT NULL,
	"preferred_currencies" jsonb NOT NULL,
	"accepted_stablecoins" jsonb DEFAULT '["USDC", "USDT", "DAI"]',
	"minimum_transaction_amount" varchar DEFAULT '1.00',
	"maximum_transaction_amount" varchar DEFAULT '1000000.00',
	"compliance_level" varchar DEFAULT 'basic' NOT NULL,
	"geolocation" varchar,
	"timezone" varchar,
	"referral_code" varchar,
	"hourly_rate" numeric(10, 2) DEFAULT '0.00',
	"completed_jobs" integer DEFAULT 0,
	"referred_by_agent" varchar,
	"referral_rewards" varchar DEFAULT '0' NOT NULL,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"has_completed_first_transaction" boolean DEFAULT false NOT NULL,
	"marketplace_service_listings" jsonb DEFAULT '[]',
	"service_categories" jsonb DEFAULT '[]',
	"pricing_model" varchar DEFAULT 'fixed',
	"membership_tier" varchar DEFAULT 'basic' NOT NULL,
	"membership_expiry_date" timestamp,
	"annual_revenue" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"has_auto_upgraded" boolean DEFAULT false NOT NULL,
	"last_payment_date" timestamp,
	"is_human_registered" boolean DEFAULT true NOT NULL,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"last_active" timestamp DEFAULT now(),
	"registered_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "global_ai_agents_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "gpt_auth_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_fingerprint" varchar(64) NOT NULL,
	"session_fingerprint" varchar(64) NOT NULL,
	"encrypted_conversation_id" text,
	"encrypted_session_id" text,
	"user_id" varchar,
	"credits_account_id" integer,
	"status" varchar DEFAULT 'active' NOT NULL,
	"email" varchar,
	"email_hash" varchar(64),
	"gpt_identifier_hash" varchar(64),
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "gpt_oauth_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" varchar,
	"state" varchar,
	"code_challenge" varchar,
	"code_challenge_method" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "gpt_oauth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"access_token_hash" varchar(64) NOT NULL,
	"refresh_token_hash" varchar(64),
	"scope" varchar DEFAULT 'basic credits.read credits.charge',
	"status" varchar DEFAULT 'active' NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"refresh_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	"client_id" varchar,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "gpt_purchase_sessions" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"stripe_session_id" varchar,
	"stripe_payment_intent_id" varchar,
	"client_secret" varchar,
	"user_id" varchar NOT NULL,
	"package_name" varchar NOT NULL,
	"amount" integer NOT NULL,
	"credits" integer,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"api_key" varchar,
	"gpt_auth_session_id" integer,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "guest_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar NOT NULL,
	"fingerprint" varchar NOT NULL,
	"credits_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_earned" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_spent" numeric(10, 2) DEFAULT '0' NOT NULL,
	"free_credits_granted" boolean DEFAULT false NOT NULL,
	"last_activity" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	CONSTRAINT "guest_credits_ip_address_unique" UNIQUE("ip_address")
);
--> statement-breakpoint
CREATE TABLE "guest_credits_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_id" integer NOT NULL,
	"ip_address" varchar NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"dollar_value" numeric(10, 2) NOT NULL,
	"description" text,
	"balance_after" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "human_referral_rewards" (
	"id" varchar PRIMARY KEY NOT NULL,
	"referrer_agent_id" varchar NOT NULL,
	"referred_user_id" varchar NOT NULL,
	"transaction_id" varchar NOT NULL,
	"reward_amount" varchar NOT NULL,
	"reward_currency" varchar DEFAULT 'USDT' NOT NULL,
	"transaction_amount" varchar NOT NULL,
	"is_qualifying_transaction" boolean DEFAULT false NOT NULL,
	"payout_status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "human_to_human_referrals" (
	"id" varchar PRIMARY KEY NOT NULL,
	"referrer_user_id" varchar NOT NULL,
	"referred_user_id" varchar NOT NULL,
	"transaction_id" integer NOT NULL,
	"transaction_amount" varchar NOT NULL,
	"commission_amount" varchar NOT NULL,
	"currency" varchar DEFAULT 'USD' NOT NULL,
	"is_first_transaction" boolean DEFAULT false NOT NULL,
	"is_qualifying_transaction" boolean DEFAULT true NOT NULL,
	"payout_status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "instant_api_key_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar NOT NULL,
	"chain" varchar NOT NULL,
	"token" varchar NOT NULL,
	"api_key_id" varchar NOT NULL,
	"credits_granted" numeric(10, 2) DEFAULT '5.00' NOT NULL,
	"tx_hash" varchar,
	"amount_paid" numeric(10, 6) NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "iot_accounts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"owner_id" varchar,
	"owner_wallet" varchar,
	"api_key_hash" varchar,
	"account_name" varchar NOT NULL,
	"credits_balance" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_deposited" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_spent" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_fees_earned" numeric(12, 4) DEFAULT '0' NOT NULL,
	"auto_topup_enabled" boolean DEFAULT false NOT NULL,
	"auto_topup_threshold" numeric(12, 4),
	"auto_topup_amount" numeric(12, 4),
	"stripe_customer_id" varchar,
	"tier" varchar DEFAULT 'starter' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_billable_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"device_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"event_name" varchar,
	"units" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 4) DEFAULT '0.01' NOT NULL,
	"total_cost" numeric(12, 4) NOT NULL,
	"balance_after" numeric(12, 4) NOT NULL,
	"topic" varchar,
	"payload" jsonb,
	"service_id" varchar,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_data_sales" (
	"id" varchar PRIMARY KEY NOT NULL,
	"product_id" varchar NOT NULL,
	"device_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"buyer_agent_id" varchar,
	"buyer_wallet" varchar,
	"x402_payment_id" varchar,
	"tx_hash" varchar,
	"amount" numeric(12, 6) NOT NULL,
	"platform_fee" numeric(12, 6) DEFAULT '0' NOT NULL,
	"seller_credit" numeric(12, 6) NOT NULL,
	"units" integer DEFAULT 1,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"delivery_status" varchar,
	"delivery_data" jsonb,
	"access_token" varchar,
	"access_token_expiry" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "iot_device_products" (
	"id" varchar PRIMARY KEY NOT NULL,
	"device_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"description" text,
	"price_usd" numeric(12, 6) NOT NULL,
	"unit" varchar DEFAULT 'request' NOT NULL,
	"delivery_mode" varchar DEFAULT 'pull' NOT NULL,
	"data_schema" jsonb,
	"x402_service_id" varchar,
	"x402_endpoint" varchar,
	"expected_network" varchar DEFAULT 'base' NOT NULL,
	"bazaar_registered" boolean DEFAULT false,
	"tags" text[],
	"status" varchar DEFAULT 'active' NOT NULL,
	"total_sales" integer DEFAULT 0,
	"total_revenue" numeric(12, 4) DEFAULT '0',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_device_registry" (
	"id" varchar PRIMARY KEY NOT NULL,
	"device_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"device_name" varchar,
	"device_type" varchar DEFAULT 'iot_device' NOT NULL,
	"wallet_address" varchar,
	"chain" varchar DEFAULT 'base-mainnet' NOT NULL,
	"spending_limit" numeric(12, 4),
	"today_spent" numeric(12, 4) DEFAULT '0' NOT NULL,
	"limit_reset_at" timestamp,
	"can_receive_payments" boolean DEFAULT true NOT NULL,
	"can_send_payments" boolean DEFAULT true NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp,
	CONSTRAINT "iot_device_registry_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "iot_topups" (
	"id" varchar PRIMARY KEY NOT NULL,
	"account_id" varchar NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"amount_paid" numeric(12, 4) NOT NULL,
	"pack_type" varchar NOT NULL,
	"payment_method" varchar NOT NULL,
	"stripe_payment_intent_id" varchar,
	"paypal_order_id" varchar,
	"tx_hash" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"balance_after" numeric(12, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "iot_transfers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"from_device_id" varchar NOT NULL,
	"from_account_id" varchar NOT NULL,
	"to_device_id" varchar,
	"to_account_id" varchar,
	"to_wallet" varchar,
	"amount" numeric(12, 4) NOT NULL,
	"fee" numeric(12, 4) NOT NULL,
	"net_amount" numeric(12, 4) NOT NULL,
	"currency" varchar DEFAULT 'USD' NOT NULL,
	"payment_method" varchar NOT NULL,
	"chain" varchar,
	"tx_hash" varchar,
	"purpose" varchar,
	"reference" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"idempotency_key" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "iot_transfers_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "kyc_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"verification_type" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"verification_id" varchar,
	"status" varchar NOT NULL,
	"document_type" varchar,
	"verification_data" jsonb,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "limit_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"from_asset" varchar NOT NULL,
	"to_asset" varchar NOT NULL,
	"from_amount" numeric(18, 8) NOT NULL,
	"limit_price" numeric(18, 8) NOT NULL,
	"order_type" varchar NOT NULL,
	"stop_price" numeric(18, 8),
	"stop_condition" varchar,
	"take_profit_price" numeric(18, 8),
	"stop_loss_price" numeric(18, 8),
	"bracket_type" varchar,
	"parent_order_id" integer,
	"status" varchar DEFAULT 'pending',
	"filled_amount" numeric(18, 8) DEFAULT '0',
	"network" varchar NOT NULL,
	"wallet_address" varchar NOT NULL,
	"expires_at" timestamp,
	"triggered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"filled_at" timestamp,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "m2m_devices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"device_id" varchar NOT NULL,
	"device_type" varchar DEFAULT 'ai_agent' NOT NULL,
	"name" varchar,
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"api_key_hash" varchar NOT NULL,
	"api_key_prefix" varchar NOT NULL,
	"wallet_address" varchar,
	"chain" varchar DEFAULT 'base-mainnet' NOT NULL,
	"ip_address" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	CONSTRAINT "m2m_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "market_intelligence" (
	"id" serial PRIMARY KEY NOT NULL,
	"currency" varchar NOT NULL,
	"timeframe" varchar NOT NULL,
	"volume" numeric(20, 8) NOT NULL,
	"average_transaction_size" numeric(15, 2),
	"total_transactions" integer NOT NULL,
	"unique_users" integer,
	"volatility_index" numeric(5, 4),
	"sentiment_score" numeric(3, 2),
	"trend_direction" varchar,
	"price_impact_score" numeric(5, 4),
	"liquidity_score" numeric(5, 4),
	"adoption_rate" numeric(5, 4),
	"cross_currency_flows" jsonb,
	"geographic_distribution" jsonb,
	"time_of_day_patterns" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mev_protection_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"enabled" boolean DEFAULT true,
	"max_slippage" numeric(5, 2) DEFAULT '0.5',
	"priority_routing" boolean DEFAULT false,
	"front_run_protection" boolean DEFAULT true,
	"sandwich_protection" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "microservice_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" varchar NOT NULL,
	"date" date NOT NULL,
	"total_requests" integer DEFAULT 0,
	"successful_requests" integer DEFAULT 0,
	"failed_requests" integer DEFAULT 0,
	"total_revenue" numeric(20, 6) DEFAULT '0',
	"avg_response_time" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "microservice_requests" (
	"id" varchar PRIMARY KEY NOT NULL,
	"service_id" varchar NOT NULL,
	"request_input" jsonb NOT NULL,
	"response_data" jsonb,
	"response_time" integer,
	"payment_amount" numeric(20, 6),
	"payment_status" varchar(50),
	"x402_payment_id" varchar,
	"wallet_address" varchar,
	"payment_method" varchar(20),
	"user_agent" text,
	"request_method" varchar(10),
	"request_path" varchar(255),
	"client_ip" varchar(45),
	"payment_attempted" boolean DEFAULT false,
	"source_gateway" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"error" text
);
--> statement-breakpoint
CREATE TABLE "network_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" varchar NOT NULL,
	"active_agents" integer DEFAULT 0 NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"transaction_volume" varchar DEFAULT '0' NOT NULL,
	"platform_fees" varchar DEFAULT '0' NOT NULL,
	"new_registrations" integer DEFAULT 0 NOT NULL,
	"average_transaction_size" varchar DEFAULT '0' NOT NULL,
	"top_currency" varchar DEFAULT 'USD',
	"network_health" numeric(3, 2) DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"email_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT true,
	"sms_notifications" boolean DEFAULT false,
	"transaction_alerts" boolean DEFAULT true,
	"security_alerts" boolean DEFAULT true,
	"marketing_emails" boolean DEFAULT false,
	"agent_notifications" boolean DEFAULT true,
	"referral_notifications" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"priority" varchar DEFAULT 'medium',
	"metadata" jsonb,
	"action_url" varchar,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outreach_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" varchar(255) NOT NULL,
	"target_count" integer NOT NULL,
	"estimated_cost" numeric(10, 6) NOT NULL,
	"approved_by_user" boolean DEFAULT false,
	"approved_at" timestamp,
	"executed_at" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"target_summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_approvals_campaign_id_unique" UNIQUE("campaign_id")
);
--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"target_ecosystem" varchar,
	"message_template" text NOT NULL,
	"status" varchar DEFAULT 'draft',
	"target_count" integer DEFAULT 0,
	"sent_count" integer DEFAULT 0,
	"response_count" integer DEFAULT 0,
	"revenue_generated" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"launched_at" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "outreach_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(50) NOT NULL,
	"target" varchar(255) NOT NULL,
	"url" varchar(500),
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"prospect_wallet_id" integer,
	"protocol" varchar NOT NULL,
	"message_content" text NOT NULL,
	"status" varchar DEFAULT 'pending',
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"responded_at" timestamp,
	"message_id" varchar,
	"tx_hash" varchar,
	"error" text,
	"cost" numeric(10, 6),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "p2p_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" varchar NOT NULL,
	"recipient" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"fee" numeric(10, 2) NOT NULL,
	"processing_fee" numeric(10, 2) NOT NULL,
	"total_fee" numeric(10, 2) NOT NULL,
	"sender_method" varchar NOT NULL,
	"recipient_method" varchar NOT NULL,
	"status" varchar DEFAULT 'initiated' NOT NULL,
	"note" text,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "p2p_transfers_transfer_id_unique" UNIQUE("transfer_id")
);
--> statement-breakpoint
CREATE TABLE "payment_intent_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_intent_id" varchar NOT NULL,
	"customer_email" varchar NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar DEFAULT 'usd',
	"purpose" varchar NOT NULL,
	"config_id" varchar,
	"task_description" text,
	"metadata" jsonb,
	"status" varchar DEFAULT 'used',
	"used_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_intent_tracking_payment_intent_id_unique" UNIQUE("payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"is_default" boolean DEFAULT false,
	"stripe_payment_method_id" varchar,
	"card_last4" varchar,
	"card_brand" varchar,
	"card_exp_month" integer,
	"card_exp_year" integer,
	"paypal_email" varchar,
	"wallet_address" varchar,
	"blockchain" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pending_crypto_payment_requests" (
	"id" varchar PRIMARY KEY NOT NULL,
	"guest_ip" varchar NOT NULL,
	"fingerprint" varchar,
	"requested_amount_usd" numeric(10, 2) NOT NULL,
	"unique_payment_amount" numeric(18, 6) NOT NULL,
	"platform_wallet_address" varchar NOT NULL,
	"network" varchar DEFAULT 'base' NOT NULL,
	"currency" varchar DEFAULT 'USDC' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"tx_hash" varchar,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_testimonials" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_name" varchar NOT NULL,
	"author_handle" varchar,
	"platform" varchar NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"testimonial" text NOT NULL,
	"featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_transactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"type" varchar(50) NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"currency" varchar(10) DEFAULT 'USDC' NOT NULL,
	"fee" numeric(18, 6) DEFAULT '0',
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"from_address" varchar(255),
	"to_address" varchar(255),
	"tx_hash" varchar(255),
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"network_confirmations" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "portfolio_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"analysis_date" date NOT NULL,
	"total_value" numeric(20, 8) NOT NULL,
	"total_invested" numeric(20, 8) NOT NULL,
	"unrealized_pnl" numeric(20, 8) NOT NULL,
	"realized_pnl" numeric(20, 8) NOT NULL,
	"total_return" numeric(10, 4) NOT NULL,
	"day_change" numeric(10, 4) NOT NULL,
	"week_change" numeric(10, 4) NOT NULL,
	"month_change" numeric(10, 4) NOT NULL,
	"year_to_date_change" numeric(10, 4) NOT NULL,
	"volatility" numeric(10, 6),
	"sharpe_ratio" numeric(10, 6),
	"max_drawdown" numeric(10, 4),
	"beta" numeric(10, 6),
	"asset_allocation" jsonb NOT NULL,
	"sector_allocation" jsonb,
	"day_trades" integer DEFAULT 0,
	"week_trades" integer DEFAULT 0,
	"month_trades" integer DEFAULT 0,
	"total_trading_fees" numeric(20, 8) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"asset" varchar NOT NULL,
	"network" varchar NOT NULL,
	"balance" numeric(18, 8) NOT NULL,
	"avg_buy_price" numeric(18, 8),
	"total_invested" numeric(18, 2),
	"current_value" numeric(18, 2),
	"profit_loss" numeric(18, 2),
	"profit_loss_percentage" numeric(5, 2),
	"day_change" numeric(18, 2),
	"day_change_percentage" numeric(5, 2),
	"week_change" numeric(18, 2),
	"month_change" numeric(18, 2),
	"all_time_high" numeric(18, 8),
	"all_time_low" numeric(18, 8),
	"volatility_score" numeric(5, 2),
	"risk_level" varchar,
	"beta_coefficient" numeric(10, 6),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prospect_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain" varchar NOT NULL,
	"address" varchar NOT NULL,
	"source_token" varchar NOT NULL,
	"token_label" varchar NOT NULL,
	"balance" varchar,
	"holder_rank" integer,
	"can_receive_xmtp" boolean DEFAULT false,
	"can_receive_dialect" boolean DEFAULT false,
	"last_activity" timestamp,
	"discovered_at" timestamp DEFAULT now(),
	"last_contacted_at" timestamp,
	"response_status" varchar DEFAULT 'pending',
	"contact_count" integer DEFAULT 0,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "pumpfun_copy_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_wallet_address" varchar(255) NOT NULL,
	"token_mint" varchar(255) NOT NULL,
	"action" varchar(10) NOT NULL,
	"original_amount" numeric(15, 6) NOT NULL,
	"executed_amount" numeric(15, 6) NOT NULL,
	"execution_price" numeric(20, 10),
	"slippage" numeric(5, 2),
	"gas_fee" numeric(15, 6),
	"tx_hash" varchar(255),
	"success" boolean NOT NULL,
	"error_message" text,
	"signal_confidence" integer,
	"reasoning" text,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pumpfun_hft_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" varchar(255) NOT NULL,
	"win_rate" numeric(5, 2) NOT NULL,
	"total_pnl" numeric(15, 6) NOT NULL,
	"avg_hold_time" integer NOT NULL,
	"trading_volume_24h" numeric(15, 6) NOT NULL,
	"successful_trades" integer NOT NULL,
	"total_trades" integer NOT NULL,
	"avg_trade_size" numeric(15, 6) NOT NULL,
	"last_active_time" timestamp NOT NULL,
	"rating" varchar(1) NOT NULL,
	"specializations" text[] DEFAULT ARRAY[]::text[],
	"is_monitored" boolean DEFAULT false,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pumpfun_hft_wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "pumpfun_trade_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(255) NOT NULL,
	"token_mint" varchar(255) NOT NULL,
	"action" varchar(10) NOT NULL,
	"amount" numeric(15, 6) NOT NULL,
	"price" numeric(20, 10),
	"confidence" integer NOT NULL,
	"reasoning" text,
	"was_executed" boolean DEFAULT false,
	"signal_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "railz_presale_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"total_raised" numeric(18, 8) DEFAULT '0',
	"total_tokens_sold" numeric(18, 8) DEFAULT '0',
	"current_token_price" numeric(18, 8) DEFAULT '0.00008',
	"base_chain_volume" numeric(18, 8) DEFAULT '0',
	"ethereum_volume" numeric(18, 8) DEFAULT '0',
	"bnb_chain_volume" numeric(18, 8) DEFAULT '0',
	"total_participants" integer DEFAULT 0,
	"total_network_size" integer DEFAULT 0,
	"average_network_depth" numeric(4, 2) DEFAULT '0',
	"total_commissions_paid" numeric(18, 8) DEFAULT '0',
	"level1_commissions_paid" numeric(18, 8) DEFAULT '0',
	"level2_commissions_paid" numeric(18, 8) DEFAULT '0',
	"level3_commissions_paid" numeric(18, 8) DEFAULT '0',
	"last_metrics_update" timestamp DEFAULT now(),
	"is_live" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "railz_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" varchar(64) NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"source_chain" varchar NOT NULL,
	"payment_token" varchar(42) NOT NULL,
	"payment_amount" numeric(18, 8) NOT NULL,
	"tokens_allocated" numeric(18, 8) NOT NULL,
	"token_price" numeric(18, 8) NOT NULL,
	"level1_referrer" varchar(42),
	"level2_referrer" varchar(42),
	"level3_referrer" varchar(42),
	"level1_commission" numeric(18, 8) DEFAULT '0',
	"level2_commission" numeric(18, 8) DEFAULT '0',
	"level3_commission" numeric(18, 8) DEFAULT '0',
	"tx_hash" varchar(66),
	"block_number" integer,
	"status" varchar DEFAULT 'pending',
	"processing_time" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "railz_purchases_purchase_id_unique" UNIQUE("purchase_id")
);
--> statement-breakpoint
CREATE TABLE "railz_referral_tree" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"level1_referrer" varchar(42),
	"level2_referrer" varchar(42),
	"level3_referrer" varchar(42),
	"referral_path" text,
	"tree_depth" integer DEFAULT 0,
	"direct_referral_count" integer DEFAULT 0,
	"total_network_size" integer DEFAULT 0,
	"total_level1_earnings" numeric(18, 8) DEFAULT '0',
	"total_level2_earnings" numeric(18, 8) DEFAULT '0',
	"total_level3_earnings" numeric(18, 8) DEFAULT '0',
	"last_updated" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "railz_referral_tree_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "railz_user_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"total_contributions" numeric(18, 8) DEFAULT '0',
	"total_tokens_allocated" numeric(18, 8) DEFAULT '0',
	"purchase_count" integer DEFAULT 0,
	"base_chain_contributions" numeric(18, 8) DEFAULT '0',
	"ethereum_contributions" numeric(18, 8) DEFAULT '0',
	"bnb_chain_contributions" numeric(18, 8) DEFAULT '0',
	"total_level1_earnings" numeric(18, 8) DEFAULT '0',
	"total_level2_earnings" numeric(18, 8) DEFAULT '0',
	"total_level3_earnings" numeric(18, 8) DEFAULT '0',
	"total_commissions" numeric(18, 8) DEFAULT '0',
	"direct_referral_count" integer DEFAULT 0,
	"level2_referral_count" integer DEFAULT 0,
	"level3_referral_count" integer DEFAULT 0,
	"total_network_size" integer DEFAULT 0,
	"last_stats_update" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "railz_user_stats_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" varchar,
	"referee_id" varchar,
	"referral_code" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"bonus_amount" numeric(10, 2) DEFAULT '5.00',
	"is_paid_out" boolean DEFAULT false,
	"completed_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_assessment_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_hash" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"currency" varchar NOT NULL,
	"risk_score" integer NOT NULL,
	"risk_factors" jsonb NOT NULL,
	"aml_risk" integer,
	"kyc_recommendation" varchar,
	"sanctions_check_result" boolean,
	"peps_check_result" boolean,
	"velocity_score" integer,
	"geolocation_risk" integer,
	"device_fingerprint_risk" integer,
	"behavioral_anomaly_score" integer,
	"recommendation" varchar NOT NULL,
	"confidence_level" numeric(3, 2),
	"review_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "risk_assessment_data_assessment_hash_unique" UNIQUE("assessment_hash")
);
--> statement-breakpoint
CREATE TABLE "risk_management_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"max_position_size" numeric(18, 2) DEFAULT '1000',
	"max_portfolio_risk" numeric(5, 2) DEFAULT '2.5',
	"max_daily_loss" numeric(18, 2) DEFAULT '500',
	"auto_stop_loss" boolean DEFAULT true,
	"default_stop_loss_percent" numeric(5, 2) DEFAULT '5.0',
	"auto_take_profit" boolean DEFAULT false,
	"default_take_profit_percent" numeric(5, 2) DEFAULT '10.0',
	"enable_risk_alerts" boolean DEFAULT true,
	"risk_tolerance_level" varchar DEFAULT 'moderate',
	"margin_call_alert" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sdk_demo_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"install_id" varchar NOT NULL,
	"api_key" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"credits_remaining" integer DEFAULT 500,
	"status" varchar DEFAULT 'active',
	"usage_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"ip_address" varchar,
	CONSTRAINT "sdk_demo_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "sdk_installs" (
	"id" serial PRIMARY KEY NOT NULL,
	"install_id" varchar NOT NULL,
	"sdk_type" varchar NOT NULL,
	"sdk_version" varchar NOT NULL,
	"environment" jsonb,
	"ip_address" varchar,
	"user_agent" varchar,
	"first_seen_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now(),
	"total_requests" integer DEFAULT 0,
	"free_calls_used" integer DEFAULT 0,
	"demo_key_issued" boolean DEFAULT false,
	"converted_to_paid" boolean DEFAULT false,
	CONSTRAINT "sdk_installs_install_id_unique" UNIQUE("install_id")
);
--> statement-breakpoint
CREATE TABLE "sdk_license_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_key" varchar(255) NOT NULL,
	"license_key_hash" varchar(255) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"phone_number" varchar(20),
	"company_size" varchar(50),
	"use_case" text,
	"tier_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'yearly' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp NOT NULL,
	"next_billing_date" timestamp NOT NULL,
	"payment_method" varchar(30) NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"current_month_transactions" integer DEFAULT 0,
	"current_month_volume" numeric(15, 2) DEFAULT '0.00',
	"total_lifetime_transactions" integer DEFAULT 0,
	"total_lifetime_volume" numeric(15, 2) DEFAULT '0.00',
	"total_lifetime_revenue" numeric(15, 2) DEFAULT '0.00',
	"last_usage_reset" timestamp DEFAULT now(),
	"allowed_domains" text[],
	"webhook_urls" text[],
	"signup_source" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sdk_license_subscriptions_license_key_unique" UNIQUE("license_key")
);
--> statement-breakpoint
CREATE TABLE "sdk_license_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"yearly_price" numeric(10, 2) NOT NULL,
	"monthly_price" numeric(10, 2) NOT NULL,
	"setup_fee" numeric(10, 2) DEFAULT '0.00',
	"transaction_fee_rate" numeric(5, 4) NOT NULL,
	"fixed_fee_per_transaction" numeric(5, 2) NOT NULL,
	"monthly_transaction_limit" integer,
	"monthly_volume_limit" numeric(15, 2),
	"support_level" varchar(50) NOT NULL,
	"sla_guarantee" varchar(50),
	"custom_integrations" boolean DEFAULT false,
	"white_labeling" boolean DEFAULT false,
	"dedicated_infrastructure" boolean DEFAULT false,
	"api_requests_per_second" integer DEFAULT 10,
	"webhook_endpoints" integer DEFAULT 5,
	"team_members" integer DEFAULT 1,
	"features" text[] NOT NULL,
	"is_active" boolean DEFAULT true,
	"target_market" varchar(100) DEFAULT 'enterprise_ai',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdk_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar NOT NULL,
	"api_key_hash" varchar NOT NULL,
	"user_id" varchar,
	"transaction_type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"fee" numeric(18, 6) NOT NULL,
	"net_amount" numeric(18, 6) NOT NULL,
	"currency" varchar DEFAULT 'USDC' NOT NULL,
	"to_address" varchar,
	"memo" text,
	"network" varchar DEFAULT 'base' NOT NULL,
	"blockchain_tx_hash" varchar,
	"error_message" text,
	"metadata" jsonb,
	"ip_address" varchar,
	"user_agent" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sdk_transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "service_bundle_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"bundle_id" varchar NOT NULL,
	"tier" varchar NOT NULL,
	"subscriber_id" varchar NOT NULL,
	"subscriber_type" varchar DEFAULT 'agent' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"credits_total" integer NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"credits_remaining" integer NOT NULL,
	"monthly_price" numeric(10, 2) NOT NULL,
	"payment_method" varchar NOT NULL,
	"payment_address" varchar,
	"stripe_subscription_id" varchar,
	"stripe_customer_id" varchar,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"next_billing_date" timestamp,
	"cancelled_at" timestamp,
	"email" varchar,
	"api_key_hash" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_bundle_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"service_slug" varchar NOT NULL,
	"credits_charged" integer DEFAULT 1 NOT NULL,
	"request_method" varchar,
	"request_path" varchar,
	"response_status" integer,
	"response_time" integer,
	"ip_address" varchar,
	"user_agent" varchar,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispute_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"reason" text NOT NULL,
	"customer_evidence" jsonb,
	"agent_response" text,
	"agent_evidence" jsonb,
	"status" varchar DEFAULT 'open',
	"resolution" text,
	"resolved_by" varchar,
	"requires_manual_review" boolean DEFAULT true,
	"auto_resolution" varchar,
	"filed_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	CONSTRAINT "service_disputes_dispute_id_unique" UNIQUE("dispute_id")
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"service_type" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"status" varchar DEFAULT 'pending_payment',
	"delivery_method" varchar NOT NULL,
	"delivery_instructions" jsonb,
	"payment_transaction_id" varchar,
	"delivered_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "service_orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_contract_audits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar,
	"guest_email" varchar,
	"guest_company" varchar,
	"submission_type" varchar DEFAULT 'authenticated',
	"contract_address" varchar,
	"contract_code" text,
	"contract_type" varchar NOT NULL,
	"blockchain" varchar NOT NULL,
	"project_name" varchar,
	"project_description" text,
	"amount" numeric(10, 2) DEFAULT '1000.00',
	"currency" varchar DEFAULT 'USD',
	"payment_method" varchar,
	"payment_tx_hash" varchar,
	"status" varchar DEFAULT 'pending',
	"grade" varchar,
	"score" integer,
	"audit_report" text,
	"vulnerabilities" jsonb,
	"recommendations" text,
	"gas_optimizations" text,
	"certificate_id" varchar,
	"certificate_generated" boolean DEFAULT false,
	"certificate_url" varchar,
	"submitted_at" timestamp DEFAULT now(),
	"audit_started_at" timestamp,
	"audit_completed_at" timestamp,
	"estimated_delivery_hours" integer DEFAULT 1,
	"chat_session_id" varchar,
	"delivery_method" varchar DEFAULT 'download',
	"access_token" varchar,
	"delivery_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "smart_contract_audits_certificate_id_unique" UNIQUE("certificate_id")
);
--> statement-breakpoint
CREATE TABLE "solana_custom_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"alert_type" varchar NOT NULL,
	"conditions" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered" timestamp,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solana_endpoint_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" varchar NOT NULL,
	"method" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"user_agent_category" varchar,
	"wallet_address" varchar,
	"customer_id" varchar,
	"status_code" integer NOT NULL,
	"response_time_ms" integer,
	"success" boolean DEFAULT true NOT NULL,
	"intent_id" varchar,
	"service_slug" varchar,
	"token_symbol" varchar,
	"requested_amount" numeric(18, 9),
	"is_webhook" boolean DEFAULT false,
	"webhook_type" varchar,
	"tx_signature" varchar,
	"error_type" varchar,
	"error_message" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "solana_fee_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"percentage_fee" numeric(5, 4) NOT NULL,
	"minimum_fee_sol" numeric(18, 9) NOT NULL,
	"minimum_fee_usdc" numeric(10, 6) NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "solana_fee_tiers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "solana_payment_intents" (
	"id" varchar PRIMARY KEY NOT NULL,
	"amount" numeric(18, 9) NOT NULL,
	"token_mint" varchar NOT NULL,
	"token_symbol" varchar NOT NULL,
	"amount_usd" numeric(10, 2),
	"memo_tag" varchar NOT NULL,
	"recipient_address" varchar NOT NULL,
	"recipient_ata" varchar,
	"customer_wallet" varchar,
	"customer_id" varchar,
	"service_name" varchar NOT NULL,
	"service_slug" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"tx_signature" varchar,
	"confirmed_slot" bigint,
	"confirmation_status" varchar,
	"platform_fee" numeric(18, 9),
	"platform_fee_usd" numeric(10, 2),
	"fee_percentage" numeric(5, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"paid_at" timestamp,
	"settled_at" timestamp,
	"subscription_id" integer,
	"bundle_id" integer,
	"partner_id" varchar,
	"settlement_batch_id" varchar,
	"offer_tracking_id" varchar,
	"is_test_mode" boolean DEFAULT false,
	"metadata" jsonb,
	"webhook_payload" jsonb,
	"last_error" text,
	"retry_count" integer DEFAULT 0,
	CONSTRAINT "solana_payment_intents_memo_tag_unique" UNIQUE("memo_tag")
);
--> statement-breakpoint
CREATE TABLE "solana_payment_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"total_intents_created" integer DEFAULT 0,
	"total_payments_received" integer DEFAULT 0,
	"total_payments_expired" integer DEFAULT 0,
	"total_payments_failed" integer DEFAULT 0,
	"total_volume_usdc" numeric(18, 6) DEFAULT '0',
	"total_volume_sol" numeric(18, 9) DEFAULT '0',
	"total_fees_usdc" numeric(18, 6) DEFAULT '0',
	"total_fees_sol" numeric(18, 9) DEFAULT '0',
	"unique_customer_wallets" integer DEFAULT 0,
	"by_service" jsonb,
	"test_mode_intents" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "solana_premium_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_address" varchar NOT NULL,
	"subscription_type" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"payment_amount" numeric(10, 6) NOT NULL,
	"payment_signature" varchar,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp NOT NULL,
	"features" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solana_processed_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"tx_signature" varchar NOT NULL,
	"intent_id" varchar,
	"processed_at" timestamp DEFAULT now(),
	CONSTRAINT "solana_processed_signatures_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "solana_user_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"course_id" varchar NOT NULL,
	"completed_modules" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"current_module" varchar,
	"progress" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"certificates" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solana_wallet_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar NOT NULL,
	"sol_balance" numeric(18, 9) NOT NULL,
	"token_count" integer NOT NULL,
	"total_value" numeric(18, 2) NOT NULL,
	"transaction_count" integer NOT NULL,
	"first_activity" timestamp,
	"last_activity" timestamp,
	"risk_score" integer DEFAULT 50 NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stop_limit_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"from_asset" varchar NOT NULL,
	"to_asset" varchar NOT NULL,
	"from_amount" numeric(18, 8) NOT NULL,
	"stop_price" numeric(18, 8) NOT NULL,
	"limit_price" numeric(18, 8) NOT NULL,
	"trigger_condition" varchar DEFAULT 'above' NOT NULL,
	"time_in_force" varchar DEFAULT 'GTC' NOT NULL,
	"expires_at" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"triggered_at" timestamp,
	"filled_at" timestamp,
	"cancelled_at" timestamp,
	"filled_amount" numeric(18, 8),
	"execution_price" numeric(18, 8),
	"tx_hash" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"monthly_price" numeric(8, 2) NOT NULL,
	"yearly_price" numeric(8, 2) NOT NULL,
	"yearly_discount" integer NOT NULL,
	"trading_fee_reduction" integer NOT NULL,
	"cross_chain_fee_reduction" integer NOT NULL,
	"ai_marketplace_credits" numeric(8, 2) NOT NULL,
	"features" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false,
	"stripe_subscription_id" varchar,
	"stripe_customer_id" varchar,
	"paypal_subscription_id" varchar,
	"usdc_payment_tx_hash" varchar,
	"is_yearly" boolean DEFAULT false,
	"last_payment_amount" numeric(8, 2),
	"last_payment_date" timestamp,
	"next_billing_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "telegram_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" varchar(255) NOT NULL,
	"user_id" varchar NOT NULL,
	"api_key_id" varchar,
	"username" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"referral_code" varchar(50),
	"referred_by_user_id" varchar,
	"welcome_bonus_granted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now(),
	CONSTRAINT "telegram_accounts_telegram_id_unique" UNIQUE("telegram_id"),
	CONSTRAINT "telegram_accounts_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "telegram_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_user_id" varchar NOT NULL,
	"referee_user_id" varchar NOT NULL,
	"bonus_amount" numeric(10, 2) NOT NULL,
	"referee_first_purchase_amount" numeric(10, 2),
	"credited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_user_id" varchar(255) NOT NULL,
	"token_mint" varchar(255) NOT NULL,
	"action" varchar(10) NOT NULL,
	"amount" numeric(18, 9) NOT NULL,
	"price" numeric(18, 9),
	"slippage" numeric(5, 2),
	"fee" numeric(18, 9),
	"tx_hash" varchar(255),
	"status" varchar(20) DEFAULT 'pending',
	"pnl" numeric(18, 9),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" varchar(255) NOT NULL,
	"username" varchar(255),
	"subscription_tier" varchar(20) DEFAULT 'free',
	"copy_trading_enabled" boolean DEFAULT false,
	"trading_balance" numeric(18, 9) DEFAULT '0',
	"total_pnl" numeric(18, 9) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now(),
	CONSTRAINT "telegram_users_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "token_launcher_campaigns" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"mode" varchar DEFAULT 'paper' NOT NULL,
	"config" jsonb NOT NULL,
	"stats" jsonb DEFAULT '{"totalLaunches":0,"successfulLaunches":0,"failedLaunches":0,"totalSpentSol":0,"totalRecoveredSol":0,"profitLossSol":0,"profitLossUsd":0}'::jsonb NOT NULL,
	"wallet_address" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "token_launcher_launches" (
	"id" varchar PRIMARY KEY NOT NULL,
	"campaign_id" varchar NOT NULL,
	"token_mint" varchar,
	"metadata" jsonb NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"launch_time" timestamp,
	"exit_time" timestamp,
	"cost_sol" numeric(18, 9) DEFAULT '0',
	"recovery_sol" numeric(18, 9) DEFAULT '0',
	"profit_loss_sol" numeric(18, 9) DEFAULT '0',
	"signature" varchar,
	"pumpfun_url" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_address" varchar NOT NULL,
	"from_token" varchar NOT NULL,
	"to_token" varchar NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"platform_fee" numeric(18, 8) NOT NULL,
	"transaction_hash" varchar,
	"chain_id" integer DEFAULT 1,
	"status" varchar DEFAULT 'completed',
	"revenue" numeric(18, 8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"timeframe" varchar NOT NULL,
	"total_volume" numeric(20, 8) NOT NULL,
	"total_trades" integer NOT NULL,
	"profitable_trades" integer NOT NULL,
	"total_pnl" numeric(18, 2) NOT NULL,
	"win_rate" numeric(5, 2) NOT NULL,
	"average_win" numeric(18, 2) NOT NULL,
	"average_loss" numeric(18, 2) NOT NULL,
	"profit_factor" numeric(10, 4) NOT NULL,
	"sharpe_ratio" numeric(10, 6),
	"max_drawdown" numeric(5, 2),
	"record_date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_address" varchar NOT NULL,
	"tx_signature" varchar NOT NULL,
	"chain" varchar NOT NULL,
	"message_snippet" text,
	"campaign_id" varchar,
	"status" varchar DEFAULT 'confirmed',
	"network_fee" numeric(18, 8),
	"timestamp" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" varchar,
	"to_user_id" varchar,
	"to_email" varchar,
	"amount" numeric(20, 8) NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"message" text,
	"status" varchar DEFAULT 'pending',
	"transaction_type" varchar NOT NULL,
	"platform_fee" numeric(10, 2) DEFAULT '0.00',
	"exchange_rate" numeric(18, 8),
	"external_transaction_id" varchar,
	"failure_reason" varchar,
	"from_wallet_id" integer,
	"to_wallet_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "unified_credits_accounts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"owner_type" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"balance" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_deposited" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_spent" numeric(12, 4) DEFAULT '0' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unified_credits_links" (
	"id" varchar PRIMARY KEY NOT NULL,
	"unified_account_id" varchar NOT NULL,
	"user_id" varchar,
	"iot_account_id" varchar,
	"link_type" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "unified_credits_transactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"account_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"balance_after" numeric(12, 4) NOT NULL,
	"source" varchar NOT NULL,
	"reference_type" varchar,
	"reference_id" varchar,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"idempotency_key" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unified_credits_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "usdc_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"source_asset" varchar NOT NULL,
	"source_amount" numeric(20, 8) NOT NULL,
	"target_network" varchar NOT NULL,
	"usdc_amount" numeric(20, 8) NOT NULL,
	"conversion_rate" numeric(20, 8) NOT NULL,
	"platform_fee" numeric(10, 4) NOT NULL,
	"fee_amount" numeric(20, 8) NOT NULL,
	"expedited" boolean DEFAULT false,
	"status" varchar DEFAULT 'pending',
	"tx_hash" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "used_transaction_hashes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"network" varchar NOT NULL,
	"service_name" varchar NOT NULL,
	"amount" varchar NOT NULL,
	"paid_by" varchar,
	"used_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_violations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"violation_type" varchar NOT NULL,
	"description" text NOT NULL,
	"enforcement_action" varchar NOT NULL,
	"suspension_end_date" timestamp,
	"reported_by" varchar,
	"evidence" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_user_id" varchar(255) NOT NULL,
	"address" varchar(255) NOT NULL,
	"private_key" text,
	"chain" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_watchlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"password" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"usd_balance" numeric(10, 2) DEFAULT '0.00',
	"security_pin" varchar(6),
	"kyc_status" varchar DEFAULT 'pending',
	"compliance_level" varchar DEFAULT 'basic',
	"risk_score" integer DEFAULT 0,
	"sanctions_check" boolean DEFAULT false,
	"peps_check" boolean DEFAULT false,
	"date_of_birth" varchar,
	"ssn" varchar,
	"address" jsonb,
	"kyc_submitted_at" timestamp,
	"kyc_approved_at" timestamp,
	"kyc_updated_at" timestamp,
	"kyc_rejection_reason" text,
	"kyc_required_documents" jsonb,
	"kyc_verification_id" varchar,
	"country" varchar(2),
	"referred_by_agent" varchar,
	"has_completed_qualifying_transaction" boolean DEFAULT false,
	"referral_source" varchar DEFAULT 'direct',
	"phone_number" varchar,
	"ethereum_wallet" varchar,
	"solana_wallet" varchar,
	"bitcoin_address" varchar,
	"xrp_wallet" varchar,
	"circle_wallet_id" varchar,
	"circle_wallet_set_id" varchar,
	"circle_entity_secret" varchar,
	"coinbase_cdp_wallet_id" varchar,
	"coinbase_oauth_token" text,
	"coinbase_oauth_refresh_token" text,
	"coinbase_oauth_expires_at" timestamp,
	"coinbase_user_id" varchar,
	"coinbase_id" varchar,
	"coinbase_access_token" text,
	"coinbase_profile" text,
	"is_kyc_verified" boolean DEFAULT false,
	"kyc_level" varchar DEFAULT 'none',
	"kyc_provider" varchar,
	"coinbase_native_currency" varchar DEFAULT 'USD',
	"coinbase_country" varchar,
	"coinbase_region_supports_transfers" boolean DEFAULT false,
	"usdc_balance" numeric(20, 8) DEFAULT '0.00000000',
	"circle_wallet_address" varchar,
	"circle_account_type" varchar DEFAULT 'SCA',
	"circle_blockchain" varchar DEFAULT 'ETH',
	"circle_wallet_state" varchar DEFAULT 'PENDING',
	"circle_recovery_file" jsonb,
	"last_balance_update" timestamp,
	"referral_code" varchar,
	"referred_by" varchar,
	"referral_bonus" numeric(10, 2) DEFAULT '0.00',
	"total_referrals" integer DEFAULT 0,
	"account_status" varchar DEFAULT 'active',
	"suspension_end_date" timestamp,
	"dex_subscription_tier" varchar DEFAULT 'basic',
	"dex_subscription_active" boolean DEFAULT false,
	"dex_subscription_expires_at" timestamp,
	"credits_balance" numeric(10, 2) DEFAULT '0.00',
	"free_credits_granted" boolean DEFAULT false,
	"monthly_spending_limit" numeric(10, 2) DEFAULT '1100.00',
	"monthly_spend_total" numeric(10, 2) DEFAULT '0.00',
	"last_spend_reset" timestamp DEFAULT now(),
	"successful_transactions" integer DEFAULT 0,
	"last_gpt_conversation_fingerprint" varchar(64),
	"last_gpt_session_fingerprint" varchar(64),
	"last_gpt_identifier_hash" varchar(64),
	"last_gpt_session_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "verified_solana_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"entity_type" varchar(50),
	"verification_level" varchar(20) NOT NULL,
	"labels" text[] DEFAULT ARRAY[]::text[],
	"owner_program" varchar(255) NOT NULL,
	"is_executable" boolean DEFAULT false,
	"balance_sol" numeric(15, 6) NOT NULL,
	"tx_count_30d" integer NOT NULL,
	"dex_swaps_30d" integer DEFAULT 0,
	"last_active" timestamp NOT NULL,
	"is_signer_rate" numeric(5, 2) NOT NULL,
	"reachable" boolean DEFAULT true,
	"excluded_reason" text,
	"metadata" jsonb,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"last_checked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "verified_solana_wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "wallet_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"currency" varchar NOT NULL,
	"balance" numeric(20, 8) DEFAULT '0.00000000',
	"available_balance" numeric(20, 8) DEFAULT '0.00000000',
	"frozen_balance" numeric(20, 8) DEFAULT '0.00000000',
	"wallet_address" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "watchlist_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"watchlist_id" integer NOT NULL,
	"asset" varchar NOT NULL,
	"network" varchar NOT NULL,
	"added_at" timestamp DEFAULT now(),
	"alert_price" numeric(18, 8),
	"alert_condition" varchar,
	"alert_percentage" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "x402_discovery_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"total_payment_requests" integer DEFAULT 0,
	"unique_wallets" integer DEFAULT 0,
	"completed_payments" integer DEFAULT 0,
	"expired_payments" integer DEFAULT 0,
	"total_revenue" numeric(18, 6) DEFAULT '0',
	"by_service" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "x402_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" varchar,
	"wallet_address" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"request_path" varchar,
	"request_method" varchar,
	"response_status" integer,
	"paid" boolean DEFAULT false,
	"amount" numeric(18, 6),
	"interaction_type" varchar,
	"request_id" varchar,
	"event_type" varchar,
	"service_name" varchar,
	"x402_client_header" varchar,
	"referer" varchar,
	"challenge_payload" jsonb,
	"latency_ms" integer,
	"retry_count" integer DEFAULT 0,
	"payment_received" boolean DEFAULT false,
	"payment_amount" numeric(18, 6),
	"error_message" text,
	"offer_tracking_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "x402_offer_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracking_id" varchar(21) NOT NULL,
	"outreach_message_id" integer,
	"service_id" varchar NOT NULL,
	"campaign_id" varchar,
	"target_agent_url" varchar,
	"click_count" integer DEFAULT 0,
	"first_click_at" timestamp,
	"last_click_at" timestamp,
	"converted_at" timestamp,
	"conversion_amount" numeric(18, 6),
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "x402_payment_intents" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"network" varchar NOT NULL,
	"service_name" varchar NOT NULL,
	"payer" varchar NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"status" varchar NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"succeeded_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "x402_payments" (
	"id" varchar PRIMARY KEY NOT NULL,
	"order_id" varchar,
	"agent_id" varchar NOT NULL,
	"customer_id" varchar,
	"amount" numeric(18, 6) NOT NULL,
	"currency" varchar DEFAULT 'USDC',
	"status" varchar NOT NULL,
	"x402_transaction_id" varchar,
	"wallet_address" varchar,
	"network" varchar DEFAULT 'base',
	"payment_proof" text,
	"facilitator_response" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"expires_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "xrp_cross_border_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_id" integer,
	"payment_id" varchar NOT NULL,
	"sender_address" varchar NOT NULL,
	"recipient_address" varchar NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"source_currency" varchar NOT NULL,
	"destination_currency" varchar NOT NULL,
	"exchange_rate" numeric(15, 8),
	"corridor_used" varchar,
	"status" varchar DEFAULT 'initiated',
	"estimated_settlement" timestamp,
	"actual_settlement" timestamp,
	"fees" jsonb,
	"compliance" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "xrp_cross_border_payments_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "xrp_liquidity_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_id" integer,
	"pool_id" varchar NOT NULL,
	"token_a" varchar NOT NULL,
	"token_b" varchar NOT NULL,
	"liquidity_amount" numeric(20, 8) NOT NULL,
	"share_percentage" numeric(5, 4),
	"rewards_earned" numeric(20, 8) DEFAULT '0',
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "xrp_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_id" integer,
	"order_type" varchar NOT NULL,
	"side" varchar NOT NULL,
	"base_currency" varchar NOT NULL,
	"quote_currency" varchar NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8),
	"filled_amount" numeric(20, 8) DEFAULT '0',
	"status" varchar DEFAULT 'open',
	"order_hash" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"filled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "xrp_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"wallet_id" integer,
	"transaction_hash" varchar,
	"transaction_type" varchar NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"fee" numeric(20, 8) DEFAULT '0',
	"from_address" varchar,
	"to_address" varchar NOT NULL,
	"currency" varchar DEFAULT 'XRP',
	"status" varchar DEFAULT 'pending',
	"ledger_index" integer,
	"confirmation_count" integer DEFAULT 0,
	"memo" text,
	"destination_tag" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp,
	CONSTRAINT "xrp_transactions_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE TABLE "xrp_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"address" varchar NOT NULL,
	"seed_encrypted" text NOT NULL,
	"public_key" varchar,
	"balance" numeric(20, 8) DEFAULT '0',
	"status" varchar DEFAULT 'active',
	"network" varchar DEFAULT 'mainnet',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "xrp_wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_message_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text,
	"files" jsonb DEFAULT '[]'::jsonb,
	"delivered_at" timestamp,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "deliveries_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "marketplace_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"service_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'pending',
	"payment_method" text DEFAULT 'stripe_card',
	"payment_intent_id" text,
	"transaction_hash" text,
	"escrow_amount" text,
	"platform_fee" text,
	"agent_payout" text,
	"accepted_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"from_id" text NOT NULL,
	"from_type" text NOT NULL,
	"to_id" text NOT NULL,
	"to_type" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text',
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "advanced_watchlist_assets" ADD CONSTRAINT "advanced_watchlist_assets_watchlist_id_advanced_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."advanced_watchlists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advanced_watchlists" ADD CONSTRAINT "advanced_watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_referrals" ADD CONSTRAINT "agent_referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_subscriptions" ADD CONSTRAINT "ai_agent_subscriptions_product_id_ai_agent_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."ai_agent_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_commissions" ADD CONSTRAINT "ai_marketplace_commissions_order_id_ai_marketplace_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ai_marketplace_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_commissions" ADD CONSTRAINT "ai_marketplace_commissions_agent_id_global_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."global_ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_deliveries" ADD CONSTRAINT "ai_marketplace_deliveries_order_id_ai_marketplace_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ai_marketplace_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_deliveries" ADD CONSTRAINT "ai_marketplace_deliveries_agent_id_global_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."global_ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_disputes" ADD CONSTRAINT "ai_marketplace_disputes_order_id_ai_marketplace_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."ai_marketplace_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_disputes" ADD CONSTRAINT "ai_marketplace_disputes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_disputes" ADD CONSTRAINT "ai_marketplace_disputes_agent_id_global_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."global_ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_orders" ADD CONSTRAINT "ai_marketplace_orders_agent_id_global_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."global_ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_orders" ADD CONSTRAINT "ai_marketplace_orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_performance" ADD CONSTRAINT "ai_marketplace_performance_agent_id_global_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."global_ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_services" ADD CONSTRAINT "ai_marketplace_services_agent_id_global_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."global_ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_services" ADD CONSTRAINT "ai_marketplace_services_category_id_ai_marketplace_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ai_marketplace_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_marketplace_suspensions" ADD CONSTRAINT "ai_marketplace_suspensions_agent_id_global_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."global_ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_integration_logs" ADD CONSTRAINT "api_integration_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_orders" ADD CONSTRAINT "bracket_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_transactions" ADD CONSTRAINT "bridge_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chain_selection_preferences" ADD CONSTRAINT "chain_selection_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_settings" ADD CONSTRAINT "chart_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_account_id_credits_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."credits_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits_accounts" ADD CONSTRAINT "credits_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_holdings" ADD CONSTRAINT "crypto_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_transactions" ADD CONSTRAINT "crypto_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_transfers" ADD CONSTRAINT "crypto_transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_transfers" ADD CONSTRAINT "crypto_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_verifications" ADD CONSTRAINT "delivery_verifications_order_id_service_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_outreach_campaigns" ADD CONSTRAINT "enterprise_outreach_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_outreach_objections" ADD CONSTRAINT "enterprise_outreach_objections_target_id_enterprise_outreach_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."enterprise_outreach_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_outreach_objections" ADD CONSTRAINT "enterprise_outreach_objections_campaign_id_enterprise_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."enterprise_outreach_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_outreach_targets" ADD CONSTRAINT "enterprise_outreach_targets_campaign_id_enterprise_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."enterprise_outreach_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_outreach_targets" ADD CONSTRAINT "enterprise_outreach_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_transactions" ADD CONSTRAINT "funding_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_transactions" ADD CONSTRAINT "funding_transactions_wallet_id_wallet_balances_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallet_balances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpt_auth_sessions" ADD CONSTRAINT "gpt_auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpt_auth_sessions" ADD CONSTRAINT "gpt_auth_sessions_credits_account_id_credits_accounts_id_fk" FOREIGN KEY ("credits_account_id") REFERENCES "public"."credits_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpt_oauth_codes" ADD CONSTRAINT "gpt_oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpt_oauth_tokens" ADD CONSTRAINT "gpt_oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_referral_rewards" ADD CONSTRAINT "human_referral_rewards_referrer_agent_id_global_ai_agents_id_fk" FOREIGN KEY ("referrer_agent_id") REFERENCES "public"."global_ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_referral_rewards" ADD CONSTRAINT "human_referral_rewards_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_to_human_referrals" ADD CONSTRAINT "human_to_human_referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_to_human_referrals" ADD CONSTRAINT "human_to_human_referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_to_human_referrals" ADD CONSTRAINT "human_to_human_referrals_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD CONSTRAINT "limit_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mev_protection_settings" ADD CONSTRAINT "mev_protection_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_prospect_wallet_id_prospect_wallets_id_fk" FOREIGN KEY ("prospect_wallet_id") REFERENCES "public"."prospect_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_transfers" ADD CONSTRAINT "p2p_transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_transactions" ADD CONSTRAINT "platform_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_analytics" ADD CONSTRAINT "portfolio_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_management_settings" ADD CONSTRAINT "risk_management_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdk_license_subscriptions" ADD CONSTRAINT "sdk_license_subscriptions_tier_id_sdk_license_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."sdk_license_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bundle_usage" ADD CONSTRAINT "service_bundle_usage_subscription_id_service_bundle_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."service_bundle_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_disputes" ADD CONSTRAINT "service_disputes_order_id_service_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_contract_audits" ADD CONSTRAINT "smart_contract_audits_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solana_processed_signatures" ADD CONSTRAINT "solana_processed_signatures_intent_id_solana_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."solana_payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_limit_orders" ADD CONSTRAINT "stop_limit_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_performance" ADD CONSTRAINT "trading_performance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_wallet_id_wallet_balances_id_fk" FOREIGN KEY ("from_wallet_id") REFERENCES "public"."wallet_balances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_wallet_id_wallet_balances_id_fk" FOREIGN KEY ("to_wallet_id") REFERENCES "public"."wallet_balances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usdc_conversions" ADD CONSTRAINT "usdc_conversions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_violations" ADD CONSTRAINT "user_violations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_watchlists" ADD CONSTRAINT "user_watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_assets" ADD CONSTRAINT "watchlist_assets_watchlist_id_user_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."user_watchlists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_cross_border_payments" ADD CONSTRAINT "xrp_cross_border_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_cross_border_payments" ADD CONSTRAINT "xrp_cross_border_payments_wallet_id_xrp_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."xrp_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_liquidity_positions" ADD CONSTRAINT "xrp_liquidity_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_liquidity_positions" ADD CONSTRAINT "xrp_liquidity_positions_wallet_id_xrp_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."xrp_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_orders" ADD CONSTRAINT "xrp_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_orders" ADD CONSTRAINT "xrp_orders_wallet_id_xrp_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."xrp_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_transactions" ADD CONSTRAINT "xrp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_transactions" ADD CONSTRAINT "xrp_transactions_wallet_id_xrp_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."xrp_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_wallets" ADD CONSTRAINT "xrp_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_a2a_outreach_agent" ON "a2a_outreach_logs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "IDX_a2a_outreach_status" ON "a2a_outreach_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_a2a_outreach_campaign" ON "a2a_outreach_logs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "IDX_a2a_outreach_task" ON "a2a_outreach_logs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "IDX_a2a_outreach_sent_at" ON "a2a_outreach_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "IDX_a2a_outreach_response_intent" ON "a2a_outreach_logs" USING btree ("response_intent");--> statement-breakpoint
CREATE INDEX "IDX_acp_orders_product" ON "acp_orders" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "IDX_acp_orders_status" ON "acp_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_acp_orders_customer" ON "acp_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "IDX_acp_orders_created" ON "acp_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_acp_orders_stripe_session" ON "acp_orders" USING btree ("checkout_session_id");--> statement-breakpoint
CREATE INDEX "IDX_acp_products_active" ON "acp_products" USING btree ("active");--> statement-breakpoint
CREATE INDEX "IDX_acp_products_type" ON "acp_products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "IDX_acp_products_sort" ON "acp_products" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "watchlist_symbol_idx" ON "advanced_watchlist_assets" USING btree ("watchlist_id","symbol");--> statement-breakpoint
CREATE INDEX "IDX_outreach_agent" ON "agent_outreach_messages" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "IDX_outreach_status" ON "agent_outreach_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_outreach_channel" ON "agent_outreach_messages" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "IDX_outreach_campaign" ON "agent_outreach_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "IDX_outreach_sent_at" ON "agent_outreach_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallet_events_wallet_id" ON "agent_wallet_events" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallet_events_event_type" ON "agent_wallet_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallet_events_created_at" ON "agent_wallet_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallets_agent_id" ON "agent_wallets" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallets_chain" ON "agent_wallets" USING btree ("chain");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallets_status" ON "agent_wallets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallets_purpose" ON "agent_wallets" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallets_tier" ON "agent_wallets" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "IDX_agent_wallets_payer_wallet" ON "agent_wallets" USING btree ("payer_wallet_address");--> statement-breakpoint
CREATE INDEX "ai_agent_products_name_idx" ON "ai_agent_products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ai_agent_products_category_idx" ON "ai_agent_products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ai_agent_products_active_idx" ON "ai_agent_products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ai_agent_subscriptions_agent_idx" ON "ai_agent_subscriptions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "ai_agent_subscriptions_product_idx" ON "ai_agent_subscriptions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ai_agent_subscriptions_status_idx" ON "ai_agent_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_agent_subscriptions_api_key_idx" ON "ai_agent_subscriptions" USING btree ("api_key_hash");--> statement-breakpoint
CREATE INDEX "ai_agent_subscriptions_stripe_sub_idx" ON "ai_agent_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "dataset_type_idx" ON "analytics_datasets" USING btree ("dataset_type");--> statement-breakpoint
CREATE INDEX "time_range_idx" ON "analytics_datasets" USING btree ("time_range");--> statement-breakpoint
CREATE INDEX "currency_analytics_idx" ON "analytics_datasets" USING btree ("currency");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_api_keys_hashed_key" ON "api_keys" USING btree ("hashed_key");--> statement-breakpoint
CREATE INDEX "IDX_api_keys_user_id" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_api_keys_status" ON "api_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_api_keys_key_prefix" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "client_usage_idx" ON "api_usage_tracking" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "endpoint_usage_idx" ON "api_usage_tracking" USING btree ("api_endpoint");--> statement-breakpoint
CREATE INDEX "usage_timestamp_idx" ON "api_usage_tracking" USING btree ("request_timestamp");--> statement-breakpoint
CREATE INDEX "idx_messages_chat" ON "chat_messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender" ON "chat_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_messages_timestamp" ON "chat_messages" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_messages_order" ON "chat_messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_chat_participants" ON "chat_rooms" USING btree ("participants");--> statement-breakpoint
CREATE INDEX "idx_chat_order" ON "chat_rooms" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_chat_updated" ON "chat_rooms" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_coinbase_address_unique" ON "coinbase_address_database" USING btree ("address");--> statement-breakpoint
CREATE INDEX "IDX_coinbase_domain_type" ON "coinbase_address_database" USING btree ("domain_type");--> statement-breakpoint
CREATE INDEX "IDX_coinbase_can_receive" ON "coinbase_address_database" USING btree ("can_receive_messages");--> statement-breakpoint
CREATE INDEX "IDX_coinbase_added_at" ON "coinbase_address_database" USING btree ("added_at");--> statement-breakpoint
CREATE INDEX "user_hash_credit_idx" ON "credit_scoring_data" USING btree ("user_hash");--> statement-breakpoint
CREATE INDEX "credit_score_idx" ON "credit_scoring_data" USING btree ("credit_score");--> statement-breakpoint
CREATE INDEX "risk_profile_idx" ON "credit_scoring_data" USING btree ("risk_profile");--> statement-breakpoint
CREATE INDEX "IDX_credit_transactions_account_id" ON "credit_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "IDX_credit_transactions_user_id" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_credit_transactions_type" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_credit_transactions_reference_id" ON "credit_transactions" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "IDX_credit_transactions_created_at" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_credits_accounts_user_id" ON "credits_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_credits_accounts_balance" ON "credits_accounts" USING btree ("balance");--> statement-breakpoint
CREATE INDEX "IDX_credits_transactions_user" ON "credits_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_credits_transactions_type" ON "credits_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_credits_transactions_created" ON "credits_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cross_chain_wallet_idx" ON "cross_chain_trades" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "cross_chain_source_idx" ON "cross_chain_trades" USING btree ("source_chain");--> statement-breakpoint
CREATE INDEX "cross_chain_status_idx" ON "cross_chain_trades" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_customer_idx" ON "customer_notifications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "notification_type_idx" ON "customer_notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notification_read_idx" ON "customer_notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notification_created_idx" ON "customer_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "customer_risk_idx" ON "customer_risk_profiles" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "risk_score_customer_idx" ON "customer_risk_profiles" USING btree ("risk_score");--> statement-breakpoint
CREATE INDEX "delivery_order_idx" ON "delivery_verifications" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "delivery_hash_idx" ON "delivery_verifications" USING btree ("delivery_hash");--> statement-breakpoint
CREATE INDEX "dispute_deadline_idx" ON "delivery_verifications" USING btree ("dispute_deadline");--> statement-breakpoint
CREATE INDEX "dex_revenue_date_idx" ON "dex_revenue" USING btree ("date");--> statement-breakpoint
CREATE INDEX "dex_subs_user_idx" ON "dex_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dex_subs_tier_idx" ON "dex_subscriptions" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "dex_subs_active_idx" ON "dex_subscriptions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "dex_trades_wallet_idx" ON "dex_trades" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "dex_trades_network_idx" ON "dex_trades" USING btree ("network");--> statement-breakpoint
CREATE INDEX "dex_trades_status_idx" ON "dex_trades" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dex_trades_created_idx" ON "dex_trades" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_discovered_agents_url_unique" ON "discovered_agents" USING btree ("url");--> statement-breakpoint
CREATE INDEX "IDX_discovered_agents_status" ON "discovered_agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_discovered_agents_source" ON "discovered_agents" USING btree ("source");--> statement-breakpoint
CREATE INDEX "IDX_discovered_agents_score" ON "discovered_agents" USING btree ("score");--> statement-breakpoint
CREATE INDEX "IDX_discovered_agents_xmtp_address" ON "discovered_agents" USING btree ("xmtp_address");--> statement-breakpoint
CREATE INDEX "IDX_discovered_agents_xmtp_can_message" ON "discovered_agents" USING btree ("xmtp_can_message");--> statement-breakpoint
CREATE INDEX "IDX_discovery_runs_status" ON "discovery_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_discovery_runs_started_at" ON "discovery_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "IDX_discovery_runs_run_type" ON "discovery_runs" USING btree ("run_type");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_campaigns_user_idx" ON "enterprise_outreach_campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_campaigns_status_idx" ON "enterprise_outreach_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_campaigns_market_idx" ON "enterprise_outreach_campaigns" USING btree ("target_market");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_campaigns_activity_idx" ON "enterprise_outreach_campaigns" USING btree ("last_activity");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_objections_target_idx" ON "enterprise_outreach_objections" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_objections_campaign_idx" ON "enterprise_outreach_objections" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_objections_category_idx" ON "enterprise_outreach_objections" USING btree ("objection_category");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_objections_severity_idx" ON "enterprise_outreach_objections" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_objections_resolved_idx" ON "enterprise_outreach_objections" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_campaign_idx" ON "enterprise_outreach_targets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_user_idx" ON "enterprise_outreach_targets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_status_idx" ON "enterprise_outreach_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_priority_idx" ON "enterprise_outreach_targets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_industry_idx" ON "enterprise_outreach_targets" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_company_idx" ON "enterprise_outreach_targets" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_domain_idx" ON "enterprise_outreach_targets" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_contact_idx" ON "enterprise_outreach_targets" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_followup_idx" ON "enterprise_outreach_targets" USING btree ("next_follow_up");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_score_idx" ON "enterprise_outreach_targets" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_tier_idx" ON "enterprise_outreach_targets" USING btree ("lead_tier");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_followup_status_idx" ON "enterprise_outreach_targets" USING btree ("follow_up_status");--> statement-breakpoint
CREATE INDEX "enterprise_outreach_targets_objection_idx" ON "enterprise_outreach_targets" USING btree ("objection_category");--> statement-breakpoint
CREATE INDEX "IDX_credit_usage_user" ON "fast_credit_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_credit_usage_package" ON "fast_credit_usage" USING btree ("credit_package_id");--> statement-breakpoint
CREATE INDEX "IDX_credit_usage_service" ON "fast_credit_usage" USING btree ("service");--> statement-breakpoint
CREATE INDEX "IDX_credit_usage_date" ON "fast_credit_usage" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX "IDX_premium_credits_user" ON "fast_premium_credits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_premium_credits_tier" ON "fast_premium_credits" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "IDX_premium_credits_expires" ON "fast_premium_credits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_premium_credits_purchase" ON "fast_premium_credits" USING btree ("purchase_transaction_id");--> statement-breakpoint
CREATE INDEX "IDX_fast_revenue_service" ON "fast_revenue_records" USING btree ("service");--> statement-breakpoint
CREATE INDEX "IDX_fast_revenue_user" ON "fast_revenue_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_fast_revenue_timestamp" ON "fast_revenue_records" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "IDX_fast_revenue_status" ON "fast_revenue_records" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "IDX_free_credits_ip" ON "free_credits_claim_log" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "IDX_free_credits_fingerprint" ON "free_credits_claim_log" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "IDX_free_credits_claimed_at" ON "free_credits_claim_log" USING btree ("claimed_at");--> statement-breakpoint
CREATE INDEX "IDX_free_wallet_blacklist_ip" ON "free_wallet_blacklist" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "IDX_free_wallet_blacklist_agent" ON "free_wallet_blacklist" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "IDX_free_wallet_blacklist_expires" ON "free_wallet_blacklist" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_free_wallet_rate_limits_ip" ON "free_wallet_rate_limits" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "IDX_free_wallet_rate_limits_window" ON "free_wallet_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "IDX_free_wallet_rate_limits_cooldown" ON "free_wallet_rate_limits" USING btree ("cooldown_until");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_gpt_auth_sessions_fingerprints" ON "gpt_auth_sessions" USING btree ("conversation_fingerprint","session_fingerprint");--> statement-breakpoint
CREATE INDEX "IDX_gpt_auth_sessions_conversation_fp" ON "gpt_auth_sessions" USING btree ("conversation_fingerprint");--> statement-breakpoint
CREATE INDEX "IDX_gpt_auth_sessions_user" ON "gpt_auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_gpt_auth_sessions_status" ON "gpt_auth_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_gpt_auth_sessions_expires" ON "gpt_auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_gpt_auth_sessions_email" ON "gpt_auth_sessions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "IDX_gpt_auth_sessions_email_hash" ON "gpt_auth_sessions" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "IDX_gpt_auth_sessions_gpt_id_hash" ON "gpt_auth_sessions" USING btree ("gpt_identifier_hash");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_codes_code_hash" ON "gpt_oauth_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_codes_user" ON "gpt_oauth_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_codes_status" ON "gpt_oauth_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_codes_expires" ON "gpt_oauth_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_tokens_user" ON "gpt_oauth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_tokens_access_hash" ON "gpt_oauth_tokens" USING btree ("access_token_hash");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_tokens_refresh_hash" ON "gpt_oauth_tokens" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_tokens_status" ON "gpt_oauth_tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_gpt_oauth_tokens_expires" ON "gpt_oauth_tokens" USING btree ("access_token_expires_at");--> statement-breakpoint
CREATE INDEX "IDX_gpt_sessions_user_id" ON "gpt_purchase_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_gpt_sessions_status" ON "gpt_purchase_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_gpt_sessions_stripe_session" ON "gpt_purchase_sessions" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "IDX_gpt_sessions_payment_intent" ON "gpt_purchase_sessions" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "IDX_guest_credits_ip" ON "guest_credits" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "IDX_guest_credits_fingerprint" ON "guest_credits" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "IDX_guest_credits_expires" ON "guest_credits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_guest_transactions_guest" ON "guest_credits_transactions" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "IDX_guest_transactions_ip" ON "guest_credits_transactions" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "IDX_guest_transactions_created" ON "guest_credits_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_instant_api_key_grants_wallet" ON "instant_api_key_grants" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "IDX_instant_api_key_grants_chain_token" ON "instant_api_key_grants" USING btree ("chain","token");--> statement-breakpoint
CREATE INDEX "IDX_instant_api_key_grants_granted_at" ON "instant_api_key_grants" USING btree ("granted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_instant_api_key_grants_tx_hash" ON "instant_api_key_grants" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "IDX_instant_api_key_grants_ip" ON "instant_api_key_grants" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "IDX_iot_accounts_owner_id" ON "iot_accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_accounts_owner_wallet" ON "iot_accounts" USING btree ("owner_wallet");--> statement-breakpoint
CREATE INDEX "IDX_iot_accounts_api_key_hash" ON "iot_accounts" USING btree ("api_key_hash");--> statement-breakpoint
CREATE INDEX "IDX_iot_accounts_status" ON "iot_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_iot_accounts_tier" ON "iot_accounts" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "IDX_iot_billable_events_device" ON "iot_billable_events" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_billable_events_account" ON "iot_billable_events" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_billable_events_type" ON "iot_billable_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "IDX_iot_billable_events_created" ON "iot_billable_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_iot_billable_events_service" ON "iot_billable_events" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_sales_product" ON "iot_data_sales" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_sales_device" ON "iot_data_sales" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_sales_account" ON "iot_data_sales" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_sales_buyer" ON "iot_data_sales" USING btree ("buyer_agent_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_sales_x402" ON "iot_data_sales" USING btree ("x402_payment_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_sales_status" ON "iot_data_sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_iot_sales_created" ON "iot_data_sales" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_iot_sales_x402_payment_unique" ON "iot_data_sales" USING btree ("x402_payment_id") WHERE x402_payment_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_iot_sales_tx_hash_unique" ON "iot_data_sales" USING btree ("tx_hash") WHERE tx_hash IS NOT NULL;--> statement-breakpoint
CREATE INDEX "IDX_iot_products_device" ON "iot_device_products" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_products_account" ON "iot_device_products" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_products_type" ON "iot_device_products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "IDX_iot_products_x402" ON "iot_device_products" USING btree ("x402_service_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_products_status" ON "iot_device_products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_iot_device_registry_account" ON "iot_device_registry" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_device_registry_wallet" ON "iot_device_registry" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "IDX_iot_device_registry_status" ON "iot_device_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_iot_device_registry_type" ON "iot_device_registry" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX "IDX_iot_topups_account" ON "iot_topups" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_topups_status" ON "iot_topups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_iot_topups_created" ON "iot_topups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_iot_topups_stripe" ON "iot_topups" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_transfers_from_device" ON "iot_transfers" USING btree ("from_device_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_transfers_from_account" ON "iot_transfers" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_transfers_to_device" ON "iot_transfers" USING btree ("to_device_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_transfers_to_account" ON "iot_transfers" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "IDX_iot_transfers_status" ON "iot_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_iot_transfers_created" ON "iot_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_iot_transfers_tx_hash" ON "iot_transfers" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "IDX_m2m_devices_device_id" ON "m2m_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "IDX_m2m_devices_device_type" ON "m2m_devices" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX "IDX_m2m_devices_status" ON "m2m_devices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_m2m_devices_api_key_hash" ON "m2m_devices" USING btree ("api_key_hash");--> statement-breakpoint
CREATE INDEX "currency_timeframe_idx" ON "market_intelligence" USING btree ("currency","timeframe");--> statement-breakpoint
CREATE INDEX "volume_intelligence_idx" ON "market_intelligence" USING btree ("volume");--> statement-breakpoint
CREATE INDEX "intelligence_created_idx" ON "market_intelligence" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_microservice_metrics_service_date" ON "microservice_metrics" USING btree ("service_id","date");--> statement-breakpoint
CREATE INDEX "IDX_microservice_metrics_date" ON "microservice_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "IDX_microservice_requests_service" ON "microservice_requests" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "IDX_microservice_requests_payment_status" ON "microservice_requests" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "IDX_microservice_requests_created" ON "microservice_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_microservice_requests_wallet" ON "microservice_requests" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "IDX_microservice_requests_payment_method" ON "microservice_requests" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "IDX_microservice_requests_client_ip" ON "microservice_requests" USING btree ("client_ip");--> statement-breakpoint
CREATE INDEX "IDX_microservice_requests_user_agent" ON "microservice_requests" USING btree ("user_agent");--> statement-breakpoint
CREATE INDEX "IDX_outreach_approvals_campaign_id" ON "outreach_approvals" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "IDX_outreach_approvals_status" ON "outreach_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_outreach_campaigns_status" ON "outreach_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_outreach_campaigns_ecosystem" ON "outreach_campaigns" USING btree ("target_ecosystem");--> statement-breakpoint
CREATE INDEX "IDX_outreach_messages_campaign" ON "outreach_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "IDX_outreach_messages_prospect" ON "outreach_messages" USING btree ("prospect_wallet_id");--> statement-breakpoint
CREATE INDEX "IDX_outreach_messages_status" ON "outreach_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_outreach_messages_protocol" ON "outreach_messages" USING btree ("protocol");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_payment_intent_tracking_unique" ON "payment_intent_tracking" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "IDX_payment_intent_tracking_customer" ON "payment_intent_tracking" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "IDX_payment_intent_tracking_purpose" ON "payment_intent_tracking" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "IDX_payment_intent_tracking_config" ON "payment_intent_tracking" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "payment_methods_user_idx" ON "payment_methods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_methods_type_idx" ON "payment_methods" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_pending_crypto_payments_guest_ip" ON "pending_crypto_payment_requests" USING btree ("guest_ip");--> statement-breakpoint
CREATE INDEX "IDX_pending_crypto_payments_status" ON "pending_crypto_payment_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_pending_crypto_payments_expires" ON "pending_crypto_payment_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_pending_crypto_payments_unique_amount" ON "pending_crypto_payment_requests" USING btree ("unique_payment_amount");--> statement-breakpoint
CREATE INDEX "IDX_testimonials_featured" ON "platform_testimonials" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "IDX_testimonials_platform" ON "platform_testimonials" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "portfolio_analytics_user_date_idx" ON "portfolio_analytics" USING btree ("user_id","analysis_date");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_prospect_wallets_chain_address" ON "prospect_wallets" USING btree ("chain","address");--> statement-breakpoint
CREATE INDEX "IDX_prospect_wallets_token" ON "prospect_wallets" USING btree ("token_label");--> statement-breakpoint
CREATE INDEX "IDX_prospect_wallets_xmtp" ON "prospect_wallets" USING btree ("can_receive_xmtp");--> statement-breakpoint
CREATE INDEX "IDX_prospect_wallets_rank" ON "prospect_wallets" USING btree ("holder_rank");--> statement-breakpoint
CREATE INDEX "idx_railz_purchases_wallet" ON "railz_purchases" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_railz_purchases_chain" ON "railz_purchases" USING btree ("source_chain");--> statement-breakpoint
CREATE INDEX "idx_railz_purchases_level1" ON "railz_purchases" USING btree ("level1_referrer");--> statement-breakpoint
CREATE INDEX "idx_railz_purchases_level2" ON "railz_purchases" USING btree ("level2_referrer");--> statement-breakpoint
CREATE INDEX "idx_railz_purchases_level3" ON "railz_purchases" USING btree ("level3_referrer");--> statement-breakpoint
CREATE INDEX "idx_railz_purchases_status" ON "railz_purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_railz_purchases_created" ON "railz_purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_railz_level1" ON "railz_referral_tree" USING btree ("level1_referrer");--> statement-breakpoint
CREATE INDEX "idx_railz_level2" ON "railz_referral_tree" USING btree ("level2_referrer");--> statement-breakpoint
CREATE INDEX "idx_railz_level3" ON "railz_referral_tree" USING btree ("level3_referrer");--> statement-breakpoint
CREATE INDEX "idx_railz_path" ON "railz_referral_tree" USING btree ("referral_path");--> statement-breakpoint
CREATE INDEX "idx_railz_active" ON "railz_referral_tree" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_railz_wallet_unique" ON "railz_referral_tree" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_railz_stats_wallet" ON "railz_user_stats" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_railz_stats_contributions" ON "railz_user_stats" USING btree ("total_contributions");--> statement-breakpoint
CREATE INDEX "idx_railz_stats_commissions" ON "railz_user_stats" USING btree ("total_commissions");--> statement-breakpoint
CREATE INDEX "idx_railz_stats_network" ON "railz_user_stats" USING btree ("total_network_size");--> statement-breakpoint
CREATE INDEX "risk_score_idx" ON "risk_assessment_data" USING btree ("risk_score");--> statement-breakpoint
CREATE INDEX "transaction_type_risk_idx" ON "risk_assessment_data" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "currency_risk_idx" ON "risk_assessment_data" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "IDX_sdk_demo_keys_install_id" ON "sdk_demo_keys" USING btree ("install_id");--> statement-breakpoint
CREATE INDEX "IDX_sdk_demo_keys_status" ON "sdk_demo_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_sdk_demo_keys_expires" ON "sdk_demo_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_sdk_installs_sdk_type" ON "sdk_installs" USING btree ("sdk_type");--> statement-breakpoint
CREATE INDEX "IDX_sdk_installs_first_seen" ON "sdk_installs" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "IDX_sdk_installs_converted" ON "sdk_installs" USING btree ("converted_to_paid");--> statement-breakpoint
CREATE INDEX "sdk_license_subs_key_idx" ON "sdk_license_subscriptions" USING btree ("license_key");--> statement-breakpoint
CREATE INDEX "sdk_license_subs_hash_idx" ON "sdk_license_subscriptions" USING btree ("license_key_hash");--> statement-breakpoint
CREATE INDEX "sdk_license_subs_company_idx" ON "sdk_license_subscriptions" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "sdk_license_subs_status_idx" ON "sdk_license_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sdk_license_subs_tier_idx" ON "sdk_license_subscriptions" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "sdk_license_subs_billing_idx" ON "sdk_license_subscriptions" USING btree ("next_billing_date");--> statement-breakpoint
CREATE INDEX "sdk_license_subs_stripe_idx" ON "sdk_license_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "sdk_license_tiers_name_idx" ON "sdk_license_tiers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "sdk_license_tiers_price_idx" ON "sdk_license_tiers" USING btree ("yearly_price");--> statement-breakpoint
CREATE INDEX "sdk_license_tiers_market_idx" ON "sdk_license_tiers" USING btree ("target_market");--> statement-breakpoint
CREATE INDEX "IDX_sdk_tx_transaction_id" ON "sdk_transactions" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "IDX_sdk_tx_api_key" ON "sdk_transactions" USING btree ("api_key_hash");--> statement-breakpoint
CREATE INDEX "IDX_sdk_tx_created" ON "sdk_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_sdk_tx_status" ON "sdk_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_sdk_tx_type" ON "sdk_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "IDX_bundle_subscriptions_bundle_id" ON "service_bundle_subscriptions" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "IDX_bundle_subscriptions_subscriber" ON "service_bundle_subscriptions" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "IDX_bundle_subscriptions_status" ON "service_bundle_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_bundle_subscriptions_stripe_sub" ON "service_bundle_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "IDX_bundle_usage_subscription" ON "service_bundle_usage" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "IDX_bundle_usage_service" ON "service_bundle_usage" USING btree ("service_slug");--> statement-breakpoint
CREATE INDEX "IDX_bundle_usage_timestamp" ON "service_bundle_usage" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "dispute_id_idx" ON "service_disputes" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_order_idx" ON "service_disputes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "dispute_status_idx" ON "service_disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dispute_filed_idx" ON "service_disputes" USING btree ("filed_at");--> statement-breakpoint
CREATE INDEX "order_id_idx" ON "service_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "agent_id_idx" ON "service_orders" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "customer_id_idx" ON "service_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "service_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "IDX_smart_contract_audits_customer" ON "smart_contract_audits" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "IDX_smart_contract_audits_status" ON "smart_contract_audits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_smart_contract_audits_blockchain" ON "smart_contract_audits" USING btree ("blockchain");--> statement-breakpoint
CREATE INDEX "IDX_smart_contract_audits_grade" ON "smart_contract_audits" USING btree ("grade");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_smart_contract_audits_certificate" ON "smart_contract_audits" USING btree ("certificate_id");--> statement-breakpoint
CREATE INDEX "IDX_solana_endpoint_timestamp" ON "solana_endpoint_interactions" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "IDX_solana_endpoint_endpoint" ON "solana_endpoint_interactions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "IDX_solana_endpoint_user_agent_cat" ON "solana_endpoint_interactions" USING btree ("user_agent_category");--> statement-breakpoint
CREATE INDEX "IDX_solana_endpoint_status" ON "solana_endpoint_interactions" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "IDX_solana_endpoint_success" ON "solana_endpoint_interactions" USING btree ("success");--> statement-breakpoint
CREATE INDEX "IDX_solana_endpoint_webhook" ON "solana_endpoint_interactions" USING btree ("is_webhook");--> statement-breakpoint
CREATE INDEX "IDX_solana_endpoint_service" ON "solana_endpoint_interactions" USING btree ("service_slug");--> statement-breakpoint
CREATE INDEX "IDX_solana_endpoint_ip" ON "solana_endpoint_interactions" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "IDX_solana_fee_tiers_active" ON "solana_fee_tiers" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_solana_intents_memo" ON "solana_payment_intents" USING btree ("memo_tag");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_status" ON "solana_payment_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_customer" ON "solana_payment_intents" USING btree ("customer_wallet");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_expires" ON "solana_payment_intents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_service" ON "solana_payment_intents" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_service_slug" ON "solana_payment_intents" USING btree ("service_slug");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_tx" ON "solana_payment_intents" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_created" ON "solana_payment_intents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_partner" ON "solana_payment_intents" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "IDX_solana_intents_test_mode" ON "solana_payment_intents" USING btree ("is_test_mode");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_solana_metrics_date" ON "solana_payment_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "IDX_solana_metrics_updated" ON "solana_payment_metrics" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_solana_sig_unique" ON "solana_processed_signatures" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "IDX_solana_sig_intent" ON "solana_processed_signatures" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_telegram_accounts_telegram_id_unique" ON "telegram_accounts" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "IDX_telegram_accounts_user_id" ON "telegram_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_telegram_accounts_referral_code" ON "telegram_accounts" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "IDX_telegram_accounts_referred_by" ON "telegram_accounts" USING btree ("referred_by_user_id");--> statement-breakpoint
CREATE INDEX "IDX_telegram_referrals_referrer" ON "telegram_referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "IDX_telegram_referrals_referee" ON "telegram_referrals" USING btree ("referee_user_id");--> statement-breakpoint
CREATE INDEX "IDX_telegram_referrals_credited_at" ON "telegram_referrals" USING btree ("credited_at");--> statement-breakpoint
CREATE INDEX "IDX_telegram_trades_user" ON "telegram_trades" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "IDX_telegram_trades_status" ON "telegram_trades" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_telegram_trades_created" ON "telegram_trades" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_telegram_users_chat_id" ON "telegram_users" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "IDX_telegram_users_subscription" ON "telegram_users" USING btree ("subscription_tier");--> statement-breakpoint
CREATE INDEX "IDX_token_campaigns_status" ON "token_launcher_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_token_campaigns_mode" ON "token_launcher_campaigns" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "IDX_token_campaigns_created" ON "token_launcher_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_token_launches_campaign" ON "token_launcher_launches" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "IDX_token_launches_status" ON "token_launcher_launches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_token_launches_token_mint" ON "token_launcher_launches" USING btree ("token_mint");--> statement-breakpoint
CREATE INDEX "IDX_token_launches_created" ON "token_launcher_launches" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_transaction_proofs_chain" ON "transaction_proofs" USING btree ("chain");--> statement-breakpoint
CREATE INDEX "IDX_transaction_proofs_campaign" ON "transaction_proofs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "IDX_transaction_proofs_timestamp" ON "transaction_proofs" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_transaction_proofs_signature" ON "transaction_proofs" USING btree ("tx_signature");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_unified_credits_owner" ON "unified_credits_accounts" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "IDX_unified_credits_status" ON "unified_credits_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_unified_links_account" ON "unified_credits_links" USING btree ("unified_account_id");--> statement-breakpoint
CREATE INDEX "IDX_unified_links_user" ON "unified_credits_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_unified_links_iot" ON "unified_credits_links" USING btree ("iot_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_unified_links_user_iot" ON "unified_credits_links" USING btree ("user_id","iot_account_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "IDX_unified_txn_account" ON "unified_credits_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "IDX_unified_txn_type" ON "unified_credits_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "IDX_unified_txn_source" ON "unified_credits_transactions" USING btree ("source");--> statement-breakpoint
CREATE INDEX "IDX_unified_txn_created" ON "unified_credits_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_unified_txn_reference" ON "unified_credits_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_used_tx_hash_unique" ON "used_transaction_hashes" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "IDX_used_tx_network" ON "used_transaction_hashes" USING btree ("network");--> statement-breakpoint
CREATE INDEX "IDX_used_tx_service" ON "used_transaction_hashes" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "IDX_used_tx_timestamp" ON "used_transaction_hashes" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX "IDX_user_wallets_telegram_user" ON "user_wallets" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "IDX_user_wallets_address" ON "user_wallets" USING btree ("address");--> statement-breakpoint
CREATE INDEX "IDX_verified_wallets_address" ON "verified_solana_wallets" USING btree ("address");--> statement-breakpoint
CREATE INDEX "IDX_verified_wallets_verification_level" ON "verified_solana_wallets" USING btree ("verification_level");--> statement-breakpoint
CREATE INDEX "IDX_verified_wallets_entity_type" ON "verified_solana_wallets" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "IDX_verified_wallets_reachable" ON "verified_solana_wallets" USING btree ("reachable");--> statement-breakpoint
CREATE INDEX "IDX_verified_wallets_last_active" ON "verified_solana_wallets" USING btree ("last_active");--> statement-breakpoint
CREATE INDEX "user_currency_idx" ON "wallet_balances" USING btree ("user_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_x402_discovery_metrics_date" ON "x402_discovery_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "IDX_x402_discovery_metrics_updated" ON "x402_discovery_metrics" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "IDX_x402_interactions_request_id" ON "x402_interactions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "IDX_x402_interactions_event_type" ON "x402_interactions" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "IDX_x402_interactions_service" ON "x402_interactions" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "IDX_x402_interactions_created" ON "x402_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_x402_interactions_source_ip" ON "x402_interactions" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "IDX_x402_interactions_offer_tracking" ON "x402_interactions" USING btree ("offer_tracking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_x402_offer_links_tracking_id" ON "x402_offer_links" USING btree ("tracking_id");--> statement-breakpoint
CREATE INDEX "IDX_x402_offer_links_outreach" ON "x402_offer_links" USING btree ("outreach_message_id");--> statement-breakpoint
CREATE INDEX "IDX_x402_offer_links_service" ON "x402_offer_links" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "IDX_x402_offer_links_campaign" ON "x402_offer_links" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "IDX_x402_offer_links_created" ON "x402_offer_links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_x402_offer_links_active" ON "x402_offer_links" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "IDX_payment_intents_tx_service" ON "x402_payment_intents" USING btree ("tx_hash","service_name");--> statement-breakpoint
CREATE INDEX "IDX_payment_intents_status" ON "x402_payment_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_payment_intents_payer" ON "x402_payment_intents" USING btree ("payer");--> statement-breakpoint
CREATE INDEX "IDX_payment_intents_expires" ON "x402_payment_intents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_payment_intents_created" ON "x402_payment_intents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_x402_payments_agent" ON "x402_payments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "IDX_x402_payments_status" ON "x402_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_x402_payments_network" ON "x402_payments" USING btree ("network");--> statement-breakpoint
CREATE INDEX "IDX_x402_payments_created" ON "x402_payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "xrp_cb_user_idx" ON "xrp_cross_border_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xrp_cb_payment_idx" ON "xrp_cross_border_payments" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "xrp_cb_status_idx" ON "xrp_cross_border_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "xrp_cb_corridor_idx" ON "xrp_cross_border_payments" USING btree ("corridor_used");--> statement-breakpoint
CREATE INDEX "xrp_lp_user_idx" ON "xrp_liquidity_positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xrp_lp_wallet_idx" ON "xrp_liquidity_positions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "xrp_lp_pool_idx" ON "xrp_liquidity_positions" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "xrp_lp_status_idx" ON "xrp_liquidity_positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "xrp_orders_user_idx" ON "xrp_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xrp_orders_wallet_idx" ON "xrp_orders" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "xrp_orders_status_idx" ON "xrp_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "xrp_orders_side_idx" ON "xrp_orders" USING btree ("side");--> statement-breakpoint
CREATE INDEX "xrp_orders_created_idx" ON "xrp_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "xrp_tx_user_idx" ON "xrp_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xrp_tx_wallet_idx" ON "xrp_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "xrp_tx_hash_idx" ON "xrp_transactions" USING btree ("transaction_hash");--> statement-breakpoint
CREATE INDEX "xrp_tx_status_idx" ON "xrp_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "xrp_tx_type_idx" ON "xrp_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "xrp_tx_created_idx" ON "xrp_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "xrp_wallets_user_idx" ON "xrp_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xrp_wallets_address_idx" ON "xrp_wallets" USING btree ("address");--> statement-breakpoint
CREATE INDEX "xrp_wallets_status_idx" ON "xrp_wallets" USING btree ("status");