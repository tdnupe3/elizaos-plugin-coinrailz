# GitHub Setup Instructions for Coin Railz ElizaOS Plugin

## Quick Setup (5 minutes)

### Step 1: Create New GitHub Repository

1. Go to: https://github.com/new
2. Set repository name: **`coinrailz-eliza-plugin`**
3. Description: **"Coin Railz x402 micropayment infrastructure plugin for ElizaOS - 18 autonomous services on Base mainnet"**
4. Make it **Public** (required for ElizaOS submission)
5. **Do NOT** initialize with README (we already have one)
6. Click **"Create repository"**

### Step 2: Push This Code to GitHub

You'll see a page with commands. Use the "push an existing repository" section:

```bash
cd /home/runner/coinrailz-eliza-plugin
git init
git add .
git commit -m "Initial commit: Coin Railz ElizaOS Plugin - 18 x402 micropayment services"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/coinrailz-eliza-plugin.git
git push -u origin main
```

**Replace `YOUR_USERNAME` with your GitHub username** (tdnupe3)

### Step 3: Submit to ElizaOS

Once your repo is live, you have **two submission paths**:

#### **Option A: Direct PR to ElizaOS** (Preferred)
1. Open: https://github.com/ai16z/eliza/pulls
2. Click "New Pull Request"
3. Click "compare across forks"
4. Select your repo: `tdnupe3/coinrailz-eliza-plugin`
5. Use this PR title: **"Add Coin Railz Plugin - x402 Micropayment Infrastructure"**
6. Copy content from `PULL_REQUEST_TEMPLATE.md` into PR description
7. Submit!

#### **Option B: Submit as External Plugin** (Easier)
1. Open an issue: https://github.com/ai16z/eliza/issues/new
2. Title: **"Plugin Submission: Coin Railz x402 Micropayment Services"**
3. Include:
   - Link to your repo
   - Brief description (from README)
   - Mention it's production-ready with tests
   - Request addition to official plugin registry

---

## What's In This Package

✅ **18 Production Services** - All live on https://coinrailz.com/x402/*
✅ **Complete Documentation** - README, Quick Start, examples
✅ **Test Suite** - Jest tests for all services
✅ **TypeScript Types** - Full type safety
✅ **CI/CD Ready** - GitHub Actions workflows
✅ **Revenue Share** - 85% to agent builders, 15% platform fee

---

## Alternative: Upload via GitHub Web UI

If you can't use git commands:

1. Create new repo on GitHub (as above)
2. Click "uploading an existing file"
3. Drag all files from this directory
4. Commit with message: "Initial commit: Coin Railz ElizaOS Plugin"

---

## Need Help?

- GitHub docs: https://docs.github.com/en/get-started/importing-your-projects-to-github/importing-source-code-to-github/adding-locally-hosted-code-to-github
- ElizaOS plugin guide: See SUBMISSION_GUIDE.md in this directory
