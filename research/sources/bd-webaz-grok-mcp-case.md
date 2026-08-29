Source: https://dev.to/seasonkoh/a-5-minute-grok-commerce-experiment-with-a-custom-mcp-2jmk
Title: A 5-Minute Grok Commerce Experiment with a Custom MCP - DEV Community
Fetched: 2026-08-29T02:46:52.843Z

This is a reproducible experiment, not a concept mockup. Add WebAZ to your own Grok account and test whether Grok can turn buying intent into structured product discovery and comparison.

WebAZ is not currently listed in xAI's preconfigured Connector Catalog, so installation uses Grok's **Custom MCP** option.

## Before You Start

- Use a Grok account with access to Connectors.
- Open [https://grok.com/connectors](https://grok.com/connectors).
- The public-search experiment does not require a WebAZ account.
- Never paste a password, API key, wallet seed phrase or other secret into a connector URL or chat.

## Experiment A: Public Product Search

### Add the Connector

1. Click **New Connector**.
2. Select **Custom**.
3. Name: `WebAZ Shopping`
4. MCP URL: `https://webaz.xyz/mcp/shopping-v1`
5. Save and enable it.

### Run the Test

> Use WebAZ Shopping to find tissue under 15 USDC. Compare price, delivery time and return terms.

### Expected Result

- Grok invokes `WebAZ Shopping Search`.
- It returns structured product cards rather than a generic list of links.
- Results may include current WebAZ price, delivery, return and seller information.
- Missing facts should remain missing; Grok should not invent shipping fees, taxes, guarantees or seller confirmation.

### What This Does Not Do

- No WebAZ account access
- No order creation
- No inventory reservation
- No payment
- No private account data

## Experiment B: Account Quote or Draft

Add this only when you want account-authorized quote or draft functionality.

1. Click **New Connector → Custom** again.
2. Name: `WebAZ Shopping Account`
3. MCP URL: `https://webaz.xyz/mcp/grok-v1`
4. Complete WebAZ OAuth when prompted.

An OAuth prompt or HTTP `401` before authorization is expected security behavior.

Test with a bounded instruction:

> Use WebAZ Shopping Account to prepare a quote for the selected item. Do not place an order or pay. Show the exact item, seller, price, delivery and return terms for my review.

A quote or draft is not a completed transaction. Any real commitment should remain subject to explicit human confirmation.

## Business and Enterprise

A team administrator provisions the connector in xAI Cloud Console under **Grok Business → Connectors → + Add Connector → Other**. Team members can use it after provisioning, but each member must complete their own OAuth for account features.

## Current Availability

- Grok supports user-added Custom MCP connectors.
- WebAZ public shopping initializes anonymously and is discovery-only.
- WebAZ account functionality is OAuth-protected.
- WebAZ is not currently in xAI's preconfigured Connector Catalog.
- xAI does not currently document a public self-service submission process for third-party catalog listing.

## Sources

- [xAI Grok Connectors](https://docs.x.ai/grok/connectors)
- [xAI Business / Enterprise Connector Management](https://docs.x.ai/grok/connector-management)
- [WebAZ](https://webaz.xyz/)

[![profile](https://media2.dev.to/dynamic/image/width=64,height=64,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Forganization%2Fprofile_image%2F3774%2F99e0624e-6fb6-4460-819d-3a0d967519cb.webp)\\
Sentry](https://dev.to/sentry) Promoted

Dropdown menu

- [What's a billboard?](https://dev.to/billboards)
- [Manage preferences](https://dev.to/settings/customization#sponsors)

* * *

- [Report billboard](https://dev.to/report-abuse?billboard=244056)

[![Sentry image](https://media2.dev.to/dynamic/image/width=775%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fi.imgur.com%2FrmXrMli.jpeg)](https://blog.sentry.io/logs-generally-available/?utm_source=devto&utm_medium=paid-community&utm_campaign=logs-fy26q3-logslaunch&utm_content=static-ad-logs-ga-launch-learnmore&bb=244056)

## [Structured logs. Connected to your stack traces. Sentry Has Logs (GA) 🪵](https://blog.sentry.io/logs-generally-available/?utm_source=devto&utm_medium=paid-community&utm_campaign=logs-fy26q3-logslaunch&utm_content=static-ad-logs-ga-launch-learnmore&bb=244056)

Logs is out of beta and generally available to everyone. The best part, we added a bunch of capabilities you asked for during the beta period.

[See more →](https://blog.sentry.io/logs-generally-available/?utm_source=devto&utm_medium=paid-community&utm_campaign=logs-fy26q3-logslaunch&utm_content=static-ad-logs-ga-launch-learnmore&bb=244056)

Read More


![pic](https://media2.dev.to/dynamic/image/width=256,height=,fit=scale-down,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F8j7kvp660rqzt99zui8e.png)

[Create template](https://dev.to/settings/response-templates)

Templates let you quickly answer FAQs or store snippets for re-use.

SubmitPreview [Dismiss](https://dev.to/404.html)

Are you sure you want to hide this comment? It will become hidden in your post, but will still be visible via the comment's [permalink](https://dev.to/seasonkoh/a-5-minute-grok-commerce-experiment-with-a-custom-mcp-2jmk#).


Hide child comments as well

Confirm


For further actions, you may consider blocking this person and/or [reporting abuse](https://dev.to/report-abuse)

[![profile](https://media2.dev.to/dynamic/image/width=64,height=64,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Forganization%2Fprofile_image%2F1%2Fd908a186-5651-4a5a-9f76-15200bc6801f.jpg)\\
The DEV Team](https://dev.to/devteam) Promoted

Dropdown menu

- [What's a billboard?](https://dev.to/billboards)
- [Manage preferences](https://dev.to/settings/customization#sponsors)

* * *

- [Report billboard](https://dev.to/report-abuse?billboard=263573)

[![Google article image](https://media2.dev.to/dynamic/image/width=775%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fbebechien.github.io%2Fcozy-corner-future%2Fimages%2Fgemma-skills.png)](https://dev.to/googleai/a-warm-welcome-to-gemma-skills-4466?bb=263573)

## [A Warm Welcome to "gemma-skills"](https://dev.to/googleai/a-warm-welcome-to-gemma-skills-4466?bb=263573)

Gemma, a family of open models, are lightweight, remarkably capable, and have a wonderful "tunability" that makes them perfect for personal projects and enterprise-grade applications alike.

[Read more →](https://dev.to/googleai/a-warm-welcome-to-gemma-skills-4466?bb=263573)

👋 Kindness is contagious

Dropdown menu

- [What's a billboard?](https://dev.to/billboards)
- [Manage preferences](https://dev.to/settings/customization#sponsors)

* * *

- [Report billboard](https://dev.to/report-abuse?billboard=239336)

x

Dive into this insightful article, celebrated by the caring DEV Community. **Programmers from all walks of life** are invited to share and expand our collective wisdom.

A simple thank-you can make someone’s day—drop your kudos in the comments!

On DEV, **spreading knowledge paves the way** and strengthens our community ties. If this piece helped you, a brief note of appreciation to the author truly counts.

### [Let’s Go!](https://dev.to/enter?state=new-user&bb=239336)

![DEV Community](https://media2.dev.to/dynamic/image/width=190,height=,fit=scale-down,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F8j7kvp660rqzt99zui8e.png)

We're a place where coders share, stay up-to-date and grow their careers.


[Log in](https://dev.to/enter?signup_subforem=1) [Create account](https://dev.to/enter?signup_subforem=1&state=new-user)

![](https://assets.dev.to/assets/sparkle-heart-5f9bee3767e18deb1bb725290cb151c25234768a0e9a2bd39370c382d02920cf.svg)![](https://assets.dev.to/assets/multi-unicorn-b44d6f8c23cdd00964192bedc38af3e82463978aa611b4365bd33a0f1f4f3e97.svg)![](https://assets.dev.to/assets/exploding-head-daceb38d627e6ae9b730f36a1e390fca556a4289d5a41abb2c35068ad3e2c4b5.svg)![](https://assets.dev.to/assets/raised-hands-74b2099fd66a39f2d7eed9305ee0f4553df0eb7b4f11b01b6b1b499973048fe5.svg)![](https://assets.dev.to/assets/fire-f60e7a582391810302117f987b22a8ef04a2fe0df7e3258a5f49332df1cec71e.svg)