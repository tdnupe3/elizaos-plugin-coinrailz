# Quick Start: Submit ElizaOS Plugin

## 🎯 What You Need to Do

I've built the complete plugin, but **you need to submit it** because I don't have access to your GitHub account.

## ⚡ Fastest Way (5 minutes)

### Step 1: Fork ElizaOS on GitHub
1. Go to https://github.com/ai16z/eliza
2. Click **"Fork"** button (top right)
3. Wait for fork to complete

### Step 2: Clone Your Fork
```bash
cd ..  # Go up one directory from this plugin
git clone https://github.com/YOUR_USERNAME/eliza.git
cd eliza
```

### Step 3: Run Automated Script
```bash
cd ../elizaos-plugin-coinrailz
./SUBMIT.sh
```

The script will:
- ✅ Create feature branch
- ✅ Copy plugin files to ElizaOS
- ✅ Install dependencies
- ✅ Commit changes
- ✅ Push to your fork

### Step 4: Create Pull Request (Manual)
1. Go to https://github.com/ai16z/eliza/pulls
2. Click **"New Pull Request"**
3. Select: `base: main` ← `compare: YOUR_USERNAME:feat/coinrailz-plugin`
4. Title: `feat: add Coin Railz x402 payment plugin`
5. Copy content from `PULL_REQUEST_TEMPLATE.md` as description
6. Click **"Create Pull Request"**

### Step 5: Engage Maintainers
1. Join ElizaOS Discord: https://discord.gg/elizaos
2. Go to #plugins or #contributions channel
3. Post: "Just submitted PR for Coin Railz payment plugin - adds x402 micropayments to Eliza agents!"
4. Tag in PR comments: `@cjft @shaw @elizalabs-team`

---

## 🐌 Manual Way (if script fails)

<details>
<summary>Click to expand manual instructions</summary>

### 1. Fork and Clone ElizaOS
```bash
# Fork on GitHub first, then:
cd ..
git clone https://github.com/YOUR_USERNAME/eliza.git
cd eliza
```

### 2. Create Branch
```bash
git checkout main
git pull origin main
git checkout -b feat/coinrailz-plugin
```

### 3. Copy Plugin
```bash
mkdir -p packages/plugin-coinrailz
cp -r ../elizaos-plugin-coinrailz/* packages/plugin-coinrailz/
```

### 4. Install Dependencies
```bash
pnpm install
# or npm install
```

### 5. Test (Optional)
```bash
cd packages/plugin-coinrailz
pnpm test
pnpm build
```

### 6. Commit and Push
```bash
cd ../..  # Back to eliza root
git add packages/plugin-coinrailz
git commit -m "feat: add Coin Railz x402 payment plugin"
git push origin feat/coinrailz-plugin
```

### 7. Create PR on GitHub
Follow Step 4 above

</details>

---

## ❓ FAQ

**Q: Do I need to test the plugin first?**  
A: The plugin is tested and ready. ElizaOS CI will run tests automatically when you submit the PR.

**Q: What if the PR is rejected?**  
A: You can publish it as a standalone NPM package and ElizaOS developers can still use it.

**Q: How long until it's merged?**  
A: Typically 2-4 weeks for review and approval.

**Q: Will this cost money?**  
A: No, submitting PRs on GitHub is completely free.

---

## 📞 Need Help?

If you get stuck:
1. Check the error message
2. Ask in ElizaOS Discord #help channel
3. Or just tell me what went wrong and I'll help debug

---

**Ready? Let's do this! 🚀**

Run: `./SUBMIT.sh` to get started
