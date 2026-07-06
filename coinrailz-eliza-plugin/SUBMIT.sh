#!/bin/bash

# ElizaOS Plugin Submission Script
# This automates most of the submission process

set -e  # Exit on error

echo "🚀 ElizaOS Plugin Submission Assistant"
echo "======================================"
echo ""

# Step 1: Check if ElizaOS repo is already forked/cloned
if [ ! -d "../eliza" ]; then
  echo "❌ ElizaOS repository not found at ../eliza"
  echo ""
  echo "📋 Manual steps required:"
  echo "1. Go to https://github.com/ai16z/eliza"
  echo "2. Click 'Fork' button (top right)"
  echo "3. Clone YOUR fork:"
  echo "   cd .."
  echo "   git clone https://github.com/YOUR_USERNAME/eliza.git"
  echo "   cd eliza"
  echo ""
  echo "After cloning, run this script again."
  exit 1
fi

echo "✅ Found ElizaOS repository"

# Step 2: Create feature branch
cd ../eliza
echo "📝 Creating feature branch..."
git checkout main
git pull origin main
git checkout -b feat/coinrailz-plugin

# Step 3: Copy plugin files
echo "📦 Copying plugin to ElizaOS..."
mkdir -p packages/plugin-coinrailz
cp -r ../elizaos-plugin-coinrailz/* packages/plugin-coinrailz/

# Step 4: Install dependencies (if pnpm exists)
if command -v pnpm &> /dev/null; then
  echo "📥 Installing dependencies..."
  pnpm install
else
  echo "⚠️  pnpm not found - skipping dependency install"
  echo "Install pnpm: npm install -g pnpm"
fi

# Step 5: Commit changes
echo "💾 Committing changes..."
git add packages/plugin-coinrailz
git commit -m "feat: add Coin Railz x402 payment plugin

Adds @elizaos/plugin-coinrailz with 66 production micropayment services on Base mainnet.

Features:
- x402 protocol support for autonomous AI payments
- 85% revenue share to agent builders  
- Zero backend infrastructure required
- Coinbase CDP and Base L2 integration
- 66 production-ready services ($0.10-$5.00 USDC)

Services include: multi-chain balance, gas prices, token data, wallet analysis, 
trading signals, contract scanning, and more.

Platform wallet: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"

# Step 6: Push to fork
echo "🚀 Pushing to your fork..."
git push origin feat/coinrailz-plugin

echo ""
echo "✅ Plugin code pushed to your fork!"
echo ""
echo "📋 FINAL MANUAL STEPS:"
echo "1. Go to https://github.com/ai16z/eliza/pulls"
echo "2. Click 'New Pull Request'"
echo "3. Select: base: main ← compare: YOUR_USERNAME:feat/coinrailz-plugin"
echo "4. Title: feat: add Coin Railz x402 payment plugin"
echo "5. Copy content from PULL_REQUEST_TEMPLATE.md as description"
echo "6. Click 'Create Pull Request'"
echo ""
echo "💬 After creating PR:"
echo "- Join ElizaOS Discord: https://discord.gg/elizaos"
echo "- Post in #plugins channel about your submission"
echo "- Tag maintainers: @cjft @shaw @elizalabs-team"
echo ""
echo "🎉 Good luck with your submission!"
