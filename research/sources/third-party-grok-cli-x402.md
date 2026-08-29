Source: https://github.com/superagent-ai/grok-cli/pull/252
Title: feat: add x402 payment protocol support via AgentKit by homanp · Pull Request #252 · superagent-ai/grok-cli · GitHub
Fetched: 2026-08-29T02:41:00.799Z

[Skip to content](https://github.com/superagent-ai/grok-cli/pull/252#start-of-content)

You signed in with another tab or window. [Reload](https://github.com/superagent-ai/grok-cli/pull/252) to refresh your session.You signed out in another tab or window. [Reload](https://github.com/superagent-ai/grok-cli/pull/252) to refresh your session.You switched accounts on another tab or window. [Reload](https://github.com/superagent-ai/grok-cli/pull/252) to refresh your session.Dismiss alert

{{ message }}

### Uh oh!

There was an error while loading. [Please reload this page](https://github.com/superagent-ai/grok-cli/pull/252).

[superagent-ai](https://github.com/superagent-ai)/ **[grok-cli](https://github.com/superagent-ai/grok-cli)** Public

- [Notifications](https://github.com/login?return_to=%2Fsuperagent-ai%2Fgrok-cli) You must be signed in to change notification settings
- [Fork\\
422](https://github.com/login?return_to=%2Fsuperagent-ai%2Fgrok-cli)
- [Star\\
3.4k](https://github.com/login?return_to=%2Fsuperagent-ai%2Fgrok-cli)


## Conversation

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=80&v=4)](https://github.com/homanp)

### ![@homanp](https://avatars.githubusercontent.com/u/2464556?s=48&v=4)**[homanp](https://github.com/homanp)**     commented   [on Apr 7Apr 7, 2026](https://github.com/superagent-ai/grok-cli/pull/252\#issue-4216013938)


Copy link


Copy Markdown

Contributor

## What does this PR do?

- Add wallet management (init, balance, history) via CLI and agent tools
- Add x402 payment tools (fetch\_payment\_info, paid\_request, wallet\_info, wallet\_history)
- Use @x402/fetch + @x402/evm directly to avoid Privy browser-env conflicts
- Add /wallet TUI modal for payment settings (enabled, chain, auto-approve)
- Add inline payment approval panel when auto-approve is disabled
- Add JSONL audit trail at ~/.grok/payment\_log.jsonl
- Add payment settings in ~/.grok/user-settings.json
- Support Base mainnet and Base Sepolia chains

Fixes [#251](https://github.com/superagent-ai/grok-cli/pull/251)

## Checklist

- [x]  I tested my changes
- [x]  I reviewed my own code

Sorry, something went wrong.


### Uh oh!

There was an error while loading. [Please reload this page](https://github.com/superagent-ai/grok-cli/pull/252).

All reactions

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=40&v=4)](https://github.com/homanp)

`
          feat: add x402 payment protocol support via AgentKit
` …

Loading

Loading status checks…

### Uh oh!

There was an error while loading. [Please reload this page](https://github.com/superagent-ai/grok-cli/pull/252).

`
          a294dcb
`

```
- Add wallet management (init, balance, history) via CLI and agent tools
- Add x402 payment tools (fetch_payment_info, paid_request, wallet_info, wallet_history)
- Use @x402/fetch + @x402/evm directly to avoid Privy browser-env conflicts
- Add /wallet TUI modal for payment settings (enabled, chain, auto-approve)
- Add inline payment approval panel when auto-approve is disabled
- Add JSONL audit trail at ~/.grok/payment_log.jsonl
- Add payment settings in ~/.grok/user-settings.json
- Support Base mainnet and Base Sepolia chains
```

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=40&u=4d6150c38daf305b43153112d1f2815d287273ea&v=4)](https://github.com/homanp)[homanp](https://github.com/homanp)

self-assigned this

[on Apr 7Apr 7, 2026](https://github.com/superagent-ai/grok-cli/pull/252#event-24247106360)

[![@superagent-security](https://avatars.githubusercontent.com/in/3287076?s=40&v=4)](https://github.com/apps/superagent-security)[superagent-security](https://github.com/apps/superagent-security) Bot

added
the [contributor:verified](https://github.com/superagent-ai/grok-cli/issues?q=state%3Aopen%20label%3Acontributor%3Averified) Contributor passed trust analysis.
label

[on Apr 7Apr 7, 2026](https://github.com/superagent-ai/grok-cli/pull/252#event-24247108992)

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=80&u=4d6150c38daf305b43153112d1f2815d287273ea&v=4)](https://github.com/homanp)

### **[homanp](https://github.com/homanp)**     commented   [on Apr 7Apr 7, 2026](https://github.com/superagent-ai/grok-cli/pull/252\#issuecomment-4197110725)


Copy link


Copy Markdown

ContributorAuthor

|     |
| --- |
| [@cursor](https://github.com/cursor) review |

👍1cursor\[bot\] reacted with thumbs up emoji

All reactions

- 👍1 reaction

Sorry, something went wrong.


### Uh oh!

There was an error while loading. [Please reload this page](https://github.com/superagent-ai/grok-cli/pull/252).

[![cursor[bot]](https://avatars.githubusercontent.com/in/1210556?s=60&v=4)](https://github.com/apps/cursor)

**[cursor](https://github.com/apps/cursor) Bot**

reviewed

[on Apr 7Apr 7, 2026](https://github.com/superagent-ai/grok-cli/pull/252#pullrequestreview-4066270801)

[View reviewed changes](https://github.com/superagent-ai/grok-cli/pull/252/files/a294dcb8c3bc65cb87ec637840114aac8f85a199)

### ![@cursor](https://avatars.githubusercontent.com/in/1210556?s=48&v=4)**[cursor](https://github.com/apps/cursor) Bot**     left a comment


Copy link


Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).


Choose a reason
SpamAbuseOff TopicOutdatedDuplicateResolvedLow QualityHide comment

✅ Bugbot reviewed your changes and found no new issues!

_Comment `@cursor review` or `bugbot run` to trigger another review on this PR_

Reviewed by [Cursor Bugbot](https://cursor.com/bugbot) for commit [`a294dcb`](https://github.com/superagent-ai/grok-cli/commit/a294dcb8c3bc65cb87ec637840114aac8f85a199). Configure [here](https://www.cursor.com/dashboard/bugbot).

Sorry, something went wrong.


### Uh oh!

There was an error while loading. [Please reload this page](https://github.com/superagent-ai/grok-cli/pull/252).

All reactions

[![@github-actions](https://avatars.githubusercontent.com/in/15368?s=80&v=4)](https://github.com/apps/github-actions)

### **[github-actions](https://github.com/apps/github-actions) Bot**     commented   [on Apr 7Apr 7, 2026](https://github.com/superagent-ai/grok-cli/pull/252\#issuecomment-4197116346)


Copy link


Copy Markdown

|     |
| --- |
| ### Brin PR Security Scan<br>This PR has findings that should be reviewed.<br>- **Score:** 40/100<br>- **Verdict:** suspicious<br>**Findings:**<br>- obfuscation: High-entropy addition detected (entropy=5.70, 217 chars)<br>- security\_sabotage: Two security-related CI workflows were entirely deleted: '.github/workflows/contributor-check.yml' (which ran contributor trust analysis via the Brin API on every PR) and '.github/workflows/pr-security-scan.yml' (which scanned PRs for security threats and could block dangerous PRs from merging). Removing both workflows in the same PR that introduces significant new code eliminates automated security gates that would otherwise scrutinize this very PR.<br>- supply\_chain\_mod: The PR adds '@coinbase/agentkit@^0.10.4' to package.json, which pulls in an extremely large transitive dependency tree (3318 additions to bun.lock). The dependency tree includes packages with broad, sensitive capabilities: '@privy-io/server-auth', '@metamask/sdk', '@coinbase/cdp-sdk', '@coinbase/coinbase-sdk', 'twitter-api-v2', '@solana/web3.js', and many wallet/DeFi SDKs. This is a substantial and difficult-to-audit supply chain expansion introduced alongside the removal of the security scanning workflows.<br>- supply\_chain\_mod: The new dependency '@alloralabs/allora-sdk@0.1.1' is an early-stage SDK (0.1.x) from a relatively unknown publisher pulled in as a transitive dependency of @coinbase/agentkit. Low-version SDKs from less-established orgs carry elevated risk of malicious or insecure code.<br>- ci\_tampering: Deleting '.github/workflows/pr-security-scan.yml' removes a CI step that explicitly failed builds when a PR was scored as 'dangerous' (score < 30) by the Brin security scanner. This workflow would have triggered on this PR and potentially blocked it. Its removal directly enables this PR to merge without that gate.<br>Analyzed by [Brin](https://brin.sh/) |

All reactions

Sorry, something went wrong.


### Uh oh!

There was an error while loading. [Please reload this page](https://github.com/superagent-ai/grok-cli/pull/252).

[![@superagent-security](https://avatars.githubusercontent.com/in/3287076?s=40&v=4)](https://github.com/apps/superagent-security)[superagent-security](https://github.com/apps/superagent-security) Bot

added
the [pr:flagged](https://github.com/superagent-ai/grok-cli/issues?q=state%3Aopen%20label%3Apr%3Aflagged) PR flagged for review by security analysis.
label

[on Apr 7Apr 7, 2026](https://github.com/superagent-ai/grok-cli/pull/252#event-24247142973)

Hide detailsView details

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=40&u=4d6150c38daf305b43153112d1f2815d287273ea&v=4)](https://github.com/homanp)

[homanp](https://github.com/homanp)

merged commit [`5843fc1`](https://github.com/superagent-ai/grok-cli/commit/5843fc1b6052db2f3a8a65bfa15a876464a0dde8)
into

main[on Apr 7Apr 7, 2026](https://github.com/superagent-ai/grok-cli/pull/252#event-24247165780)

10 checks passed


### Uh oh!

There was an error while loading. [Please reload this page](https://github.com/superagent-ai/grok-cli/pull/252).

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=40&u=4d6150c38daf305b43153112d1f2815d287273ea&v=4)](https://github.com/homanp)[homanp](https://github.com/homanp)

linked an issue
[on Apr 8Apr 8, 2026](https://github.com/superagent-ai/grok-cli/pull/252#event-24299031955)
that may be
closed
by this pull request

[\[Feature\]: Autonomous agent payments via x402 protocol\\
#250](https://github.com/superagent-ai/grok-cli/issues/250)

Closed

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=40&u=4d6150c38daf305b43153112d1f2815d287273ea&v=4)](https://github.com/homanp)[homanp](https://github.com/homanp)

mentioned this pull request
[on Apr 15Apr 15, 2026](https://github.com/superagent-ai/grok-cli/pull/252#ref-pullrequest-4267097100)

[docs: update CHANGELOG from merged PRs since v1.1.3\\
#260](https://github.com/superagent-ai/grok-cli/pull/260)

Merged

This file contains hidden or bidirectional Unicode text that may be interpreted or compiled differently than what appears below. To review, open the file in an editor that reveals hidden Unicode characters.
[Learn more about bidirectional Unicode characters](https://github.co/hiddenchars)

[Show hidden characters](https://github.com/superagent-ai/grok-cli/pull/252)

[Sign up for free](https://github.com/join?source=comment-repo) **to join this conversation on GitHub**.
Already have an account?
[Sign in to comment](https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fsuperagent-ai%2Fgrok-cli%2Fpull%2F252)

### Reviewers

[![@cursor](https://avatars.githubusercontent.com/in/1210556?s=40&v=4)](https://github.com/apps/cursor)[cursor\[bot\]](https://github.com/apps/cursor)cursor\[bot\] left review comments

### Assignees

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=40&v=4)](https://github.com/homanp)[homanp](https://github.com/homanp)

### Labels

[contributor:verified](https://github.com/superagent-ai/grok-cli/issues?q=state%3Aopen%20label%3Acontributor%3Averified) Contributor passed trust analysis. [pr:flagged](https://github.com/superagent-ai/grok-cli/issues?q=state%3Aopen%20label%3Apr%3Aflagged) PR flagged for review by security analysis.

### Projects

None yet

### Milestone

No milestone

### Development

Successfully merging this pull request may close these issues.

[\[Feature\]: Autonomous agent payments via x402 protocol](https://github.com/superagent-ai/grok-cli/issues/250)

### 1 participant

[![@homanp](https://avatars.githubusercontent.com/u/2464556?s=52&v=4)](https://github.com/homanp)

Add this suggestion to a batch that can be applied as a single commit.This suggestion is invalid because no changes were made to the code.Suggestions cannot be applied while the pull request is closed.Suggestions cannot be applied while viewing a subset of changes.Only one suggestion per line can be applied in a batch.Add this suggestion to a batch that can be applied as a single commit.Applying suggestions on deleted lines is not supported.You must change the existing code in this line in order to create a valid suggestion.Outdated suggestions cannot be applied.This suggestion has been applied or marked resolved.Suggestions cannot be applied from pending reviews.Suggestions cannot be applied on multi-line comments.Suggestions cannot be applied while the pull request is queued to merge.Suggestion cannot be applied right now. Please check back later.

You can’t perform that action at this time.