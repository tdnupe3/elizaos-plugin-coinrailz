#!/bin/bash

# 🔋 CONNECTIVITY BATTERY - ChatGPT's exact specification
# Run this first in your Replit shell; don't proceed to A2A routing unless all pass.

echo "🔋 Starting ChatGPT Connectivity Battery Test..."

# openai
echo "Testing OpenAI..."
curl -sS https://api.openai.com/v1/responses \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{"model":"gpt-4o-mini","input":"ping"}' | jq -r '.id,.error // empty'

# anthropic
echo "Testing Anthropic..."
curl -sS https://api.anthropic.com/v1/messages \
 -H "x-api-key: $ANTHROPIC_API_KEY" \
 -H "anthropic-version: 2023-06-01" \
 -H "content-type: application/json" \
 -d '{"model":"claude-3-haiku-20240307","max_tokens":32,"messages":[{"role":"user","content":"ping"}]}' | jq -r '.id,.error // empty'

# cohere
echo "Testing Cohere..."
curl -sS https://api.cohere.ai/v1/chat \
 -H "Authorization: Bearer $COHERE_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{"model":"command-r-plus","message":"ping"}' | jq -r '.id,.message,.error // empty'

# dexscreener (public)
echo "Testing DexScreener..."
curl -sS -H "User-Agent: a2a-bot/1.0 (support@yourdomain)" \
 "https://api.dexscreener.com/latest/dex/search?q=ethereum" | jq -r '.pairs[0].dexId,.error // empty'

# ibm (iam+infer)
echo "Testing IBM..."
export IBM_IAM_TOKEN=$(curl -s -X POST \
 "https://iam.cloud.ibm.com/identity/token" \
 -H "Content-Type: application/x-www-form-urlencoded" \
 -d "grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=$IBM_API_KEY" | jq -r .access_token)

curl -sS "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-10-15" \
 -H "Authorization: Bearer $IBM_IAM_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"model_id":"ibm/granite-3-8b-instruct","input":"ping","parameters":{"max_new_tokens":16}}' | jq -r '.model_id,.errors // empty'

echo "🔋 Connectivity Battery Test Complete!"
echo "If any provider printed an error, fix that provider before re-running your outreach loop."