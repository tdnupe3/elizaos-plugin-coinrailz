Source: https://docs.x.ai/grok-bot/approvals-security-and-privacy
Title: Approvals, security, and privacy | SpaceXAI Docs
Fetched: 2026-08-29T02:40:36.625Z

#### [Manage and protect](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#manage-and-protect)

# [Approvals, security, and privacy](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#approvals-security-and-privacy)

Copy for LLM [View as Markdown](https://docs.x.ai/grok-bot/approvals-security-and-privacy.md)

[Create API key](https://console.x.ai/team/default/api-keys?utm_source=docs&utm_medium=referral&utm_campaign=grok-bot-approvals-security-and-privacy&utm_content=article-api-key) [Meet grok-4.6](https://x.ai/news/grok-4-6)

Grok Bot is designed to complete work while keeping sensitive inputs and
consequential actions under your control. Use approvals, secure handoffs, and
clear Bot boundaries together.

## [Set a boundary in the request](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#set-a-boundary-in-the-request)

Tell the Bot which actions it can take and where it must stop:

> Reconcile the campaign data and draft a recommended budget change. Do not
> change the campaign or message the agency. Ask for approval after showing the
> current value, proposed value, and expected impact.

Prefer explicit boundaries for:

- Sending messages or invitations
- Publishing content
- Purchases and financial transfers
- Deleting or overwriting data
- Changing permissions
- Production changes
- Accepting legal terms

An approval controls the proposed action. It does not reverse work already
completed.

## [Review an action](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#review-an-action)

When an action needs approval, the conversation shows the proposed operation
and its inputs. Review the target, scope, and values before approving.

- On desktop, **Allow once** lets the Bot continue with that action and
**Deny** blocks it. **Always allow** can save a matching rule.
- On iPhone, the equivalent controls are **Approve once** and **Deny**.

Do not approve an action whose target or effect you cannot identify. Ask the Bot
to explain it in plain language or produce a draft first.

## [Configure Auto Review](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#configure-auto-review)

When Auto Review enforcement is available, Grok Bot evaluates tool calls and
computer actions before they run. Open **Settings → General → Auto-review** to
add rules.

- **Require Approval** rules always stop matching actions for you.
- **Always Allow** rules let matching actions proceed only when the automated
review does not identify another reason to stop.
- If both kinds of rule match, **Require Approval** wins.

Write narrow rules around a known action and scope:

- Require approval before sending any external email.
- Require approval before changing a production dashboard.
- Always allow running `git status` in `/workspace/reports`.

Avoid broad rules such as “allow everything in the browser.” Websites and tool
behavior change over time. Auto Review is model-based and should complement,
not replace, least privilege and explicit approval boundaries.

Personal Auto-review rules are stored on the current desktop and synced to its
Grok Bot computer. Verify them separately on another desktop installation.

## [Enter passwords and verification codes yourself](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#enter-passwords-and-verification-codes-yourself)

For passwords, passkeys, two-factor codes, CAPTCHAs, and payment confirmations,
the Bot should hand you control of the computer.

1. Open **Agent Computer**.
2. Take control.
3. Complete the sensitive step.
4. Return control and tell the Bot to continue.

Do not send a password or one-time code in ordinary chat.

If the Bot presents a secure secret request for a supported connection, enter
the value in that request. It is not a general-purpose password manager. The
value is masked, excluded from the transcript, and not shown to the model.

## [Control access to your local computer](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#control-access-to-your-local-computer)

The shared Grok Bot computer runs in the cloud. Access to the Mac or Windows
computer in front of you is a separate capability.

In **Settings → General → Agent → Execution on Local Computer**, choose whether
local commands:

- Always require approval
- Are always allowed
- Are never allowed

The default is **Ask every time**. Use **Never allowed** unless a Bot has a
specific reason to work on your local files. These settings do not prevent the
Bot from using its cloud computer.

## [Understand the shared-computer boundary](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#understand-the-shared-computer-boundary)

All of your Bots share one cloud computer assigned to your user account. Files,
browser sessions, and command line credentials on that computer are available
across your Bot roster.

- Do not use separate Bots as a security boundary.
- Sign out of a service when it should no longer be available.
- Remove sensitive temporary files after the work is complete.
- Delete a connector or revoke its authorization in the source service when
access is no longer needed.

Do not treat this user assignment as a guarantee that is broader than Cursor's
published security documentation. Review current infrastructure and encryption
controls there.

## [Sharing a Bot is not a security boundary](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#sharing-a-bot-is-not-a-security-boundary)

A public share link lets others copy the Bot's configuration. It does not share
your computer or logins. Still, do not put secrets, customer data, or internal
URLs in a Bot you share. See [Share a Bot](https://docs.x.ai/grok-bot/bots#share-a-bot) and the
[third-party bot terms](https://x.ai/legal/bot-sharing-terms).

## [Cursor account and data settings](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#cursor-account-and-data-settings)

Grok Bot uses Cursor authentication and account data settings.

- Grok Bot requires data storage and does not support Legacy Privacy Mode.
- Privacy and data-sharing choices are managed through Cursor account settings
and, when required, the Grok Bot access flow.
- Training opt-out follows the applicable Cursor account and privacy settings.
- Review the current [Cursor Privacy Policy](https://cursor.com/privacy) and
[security information](https://cursor.com/security) for contractual details.

Organization administrators can restrict local-computer execution and may
provide managed setup for the cloud computer. Available controls depend on the
organization's rollout and plan.

## [Remove access and working data](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#remove-access-and-working-data)

When a project or login should no longer be available:

1. Pause or delete related routines.
2. Sign out of websites on the shared computer.
3. Uninstall connectors and revoke their authorization in the source service.
4. Remove sensitive project files from `/workspace`.
5. Hide or delete Bots that should no longer appear in Grok Bot.
6. Use the account settings flow if you need to delete the Cursor account.

Deleting a Bot does not remove shared-computer files or browser sessions.
Backend retention and account deletion follow the applicable Cursor terms.

## [Use a least-privilege setup](https://docs.x.ai/grok-bot/approvals-security-and-privacy\#use-a-least-privilege-setup)

- Connect only the tools a workflow needs.
- Use scoped service accounts where the source system supports them.
- Start with read-only tasks and draft outputs.
- Keep sending, publishing, purchasing, deletion, and production changes behind
approval.
- Review installed connectors and active routines regularly.
- Pause a routine when its source system or expected workflow changes.
- Preserve source links and an action log for important decisions.

* * *

Last updated: August 22, 2026