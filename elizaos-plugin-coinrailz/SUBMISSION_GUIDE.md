# ElizaOS Plugin Submission Guide

## 🎯 Objective
Submit `@elizaos/plugin-coinrailz` as a pull request to the ElizaOS repository to make Coin Railz micropayment services available to all Eliza agents.

## 📋 Pre-Submission Checklist

- [ ] Code complete and tested
- [ ] README.md comprehensive
- [ ] Examples working
- [ ] CI/CD configured
- [ ] No security vulnerabilities
- [ ] All dependencies legitimate

## 🚀 Submission Steps

### 1. Fork ElizaOS Repository

```bash
# Go to GitHub
https://github.com/ai16z/eliza

# Click "Fork" button
# Clone YOUR fork
git clone https://github.com/YOUR_USERNAME/eliza.git
cd eliza
```

### 2. Create Plugin Branch

```bash
git checkout -b feat/coinrailz-plugin
```

### 3. Add Plugin to ElizaOS

```bash
# Copy plugin to ElizaOS plugins directory
cp -r ../elizaos-plugin-coinrailz packages/plugin-coinrailz

# Install dependencies in ElizaOS monorepo
pnpm install
```

### 4. Update ElizaOS Plugin Registry

Edit `packages/core/src/plugins/index.ts`:

```typescript
// Add to exports
export { coinrailzPlugin } from '../plugin-coinrailz';
```

### 5. Test in ElizaOS

```bash
# Run ElizaOS tests
pnpm test

# Test plugin specifically
cd packages/plugin-coinrailz
pnpm test

# Build to verify no errors
pnpm build
```

### 6. Commit Changes

```bash
git add packages/plugin-coinrailz
git commit -m "feat: add Coin Railz x402 payment plugin

Adds @elizaos/plugin-coinrailz with 66 production micropayment services on Base mainnet.

- x402 protocol support for autonomous AI payments
- 85% revenue share to agent builders
- Zero backend infrastructure required
- Coinbase CDP and Base L2 integration"
```

### 7. Push to Your Fork

```bash
git push origin feat/coinrailz-plugin
```

### 8. Create Pull Request

1. Go to https://github.com/ai16z/eliza/pulls
2. Click "New Pull Request"
3. Select: `base: main` ← `compare: YOUR_USERNAME:feat/coinrailz-plugin`
4. Title: `feat: add Coin Railz x402 payment plugin`
5. Description: Use `PULL_REQUEST_TEMPLATE.md` content
6. Click "Create Pull Request"

## 💬 Maintainer Engagement

### After Submitting PR

1. **Tag Maintainers** (in PR comments):
   ```
   @cjft @shaw @elizalabs-team - This plugin adds x402 micropayment capabilities 
   to Eliza agents, enabling monetization via USDC on Base. Happy to make any 
   adjustments or answer questions!
   ```

2. **Join ElizaOS Discord**:
   - Channel: #plugins or #contributions
   - Message: "Just submitted PR #XXXX for Coin Railz payment plugin. Would appreciate feedback!"

3. **Monitor CI/CD**:
   - Watch for test failures
   - Fix any issues immediately
   - Keep PR updated

4. **Respond Quickly**:
   - Answer maintainer questions within 24 hours
   - Make requested changes promptly
   - Be respectful and collaborative

## 🎬 Expected Timeline

- **PR Submission**: Day 1
- **Initial Review**: 3-7 days
- **Feedback/Revisions**: 1-2 weeks
- **Final Approval**: 2-4 weeks
- **Merge**: Once approved

## ✅ What Happens After Merge

1. **Plugin Listed**: Appears in official ElizaOS plugin registry
2. **Documentation**: Added to ElizaOS docs automatically
3. **NPM Package**: Published as `@elizaos/plugin-coinrailz`
4. **Visibility**: Every ElizaOS user sees it in plugin list
5. **Revenue**: Agent builders start earning 85% of service fees

## 🔄 If PR Is Rejected

**Don't panic!** Options:

1. **External Package**: Publish as standalone NPM package
   ```bash
   npm publish
   # Users install: npm i @elizaos/plugin-coinrailz
   ```

2. **Community Fork**: Maintain as community plugin
3. **Feedback Loop**: Address concerns and resubmit
4. **Forum Discussion**: Propose in ElizaOS community forum first

## 📞 Support

- **ElizaOS Discord**: https://discord.gg/elizaos
- **GitHub Issues**: https://github.com/ai16z/eliza/issues
- **Documentation**: https://docs.elizaos.ai

## 🎯 Success Metrics

Track after merge:
- GitHub stars on ElizaOS repo
- Plugin downloads (NPM stats)
- Traffic to Coin Railz services
- Revenue generated for agent builders
- Community feedback

---

**Built with ❤️ by Coin Railz for the ElizaOS community**
