Source: https://stripe.com/blog/giving-agents-the-ability-to-pay
Title: Giving agents the ability to pay
Fetched: 2026-08-29T02:40:45.968Z

Chat with Stripe sales


![](https://stripe.com/blog/giving-agents-the-ability-to-pay)![](https://stripe.com/blog/giving-agents-the-ability-to-pay)

8 sales reps available


We're here to discuss your business needs.

Chat now with sales

Giving agents the ability to pay

![](https://images.stripeassets.com/fzn2n1nzq965/gPr30kRyLU6mRINAWv6Rq/a85940b289333183c5ddfd338db19fbc/Blog_Link_Agent_Wallet_Cover_Image_UPDATE.png?w=1620&fm=webp)

In the [Sessions keynote](https://stripe.com/blog/everything-we-announced-at-sessions-2026), we talked about how agents are becoming active participants in the internet economy, and how we’re building the infrastructure to support them.

Agents have become increasingly capable in recent months, but making purchases across the internet remains difficult. While [machine payments protocols](https://stripe.com/blog/machine-payments-protocol) are still gaining adoption, agents need to work with the payment options sellers and consumers use today.

Today we’re launching [Link](https://link.com/)’s wallet for agents, built on top of Stripe’s new Issuing for agents. You can now give agents programmatic access to Link and the ability to get a one-time-use card or a [Shared Payment Token](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens) (SPT), backed by the cards and bank accounts already in your wallet. The agent never gets access to your raw payment credentials.

You can review and approve each spend request from the agent on the web, or in Link’s new [iOS](https://apps.apple.com/us/app/link-a-smarter-wallet/id1623228342) and [Android](https://play.google.com/store/apps/details?id=com.stripe.link.android) apps. This makes it easy for consumers to enable personal AI agents such as OpenClaw to make an authorized purchase on their behalf.

If you’re a developer or business building consumer-facing agents, such as personal assistants, Link’s wallet for agents removes the need to build wallet infrastructure from scratch. Link handles the abstraction across payment options your agent might need—like cards and SPTs (with stablecoins and other payment methods coming soon). It also takes care of fund flow complexity and helps you reach Link’s customer base of more than 200 million consumers.

## How Link’s wallet for agents works

Imagine you are building a shopping agent that recommends apparel to your consumers. First, the consumer grants your agent access to their Link wallet via a standard OAuth flow.

![Blog > Giving AI agents the ability to pay > Image 1](https://images.stripeassets.com/fzn2n1nzq965/7t1lvpLNBCLOuqxWvhecn/2fd55ec65969f67fc9ac787ceec056e8/Blog-inline-access-account-mobile.jpg?w=1616&q=80)

Once your agent has access, it can create a spend request to get either a one-time-use card or an SPT to complete the transaction. Your agent provides context on the transaction, so the person can understand and approve the request. In both card and machine-native flows, the payment credential can be scoped with controls like amount, currency, and merchant. Support for agentic tokens, stablecoins, and other payment types are coming soon.

link-cli spend-request create \
payment-method-id csmrpd\_12345 \
merchant-name "Powdur" \
merchant-url "https://powdur.com" \
amount 3500 \
context "Purchasing the Powdur Glow Renewal Vitamin C Serum as a gift for $35." \
request-approval

`

`

The consumer gets a notification and approves the spend request in Link (on the web, or in the Link [iOS](https://apps.apple.com/us/app/link-a-smarter-wallet/id1623228342) or [Android](https://play.google.com/store/apps/details?id=com.stripe.link.android) app). Today, each request requires the person’s review before the credential is shared with your agent. We’re planning on expanding these controls to let people set spending limits, and choose when agents can act without additional approval.

![Blog > Giving agents the ability to pay > Image 2](https://images.stripeassets.com/fzn2n1nzq965/5EweExhDQ2XnXmoaAcQHxN/96934c4364e7fa43cae704bc358ab5fc/Blog-inline-spend-request-mobile.jpg?w=1616&q=80)

After approval, Link returns the one-time-use card or SPT to your agent for it to complete the purchase. The person can track agent spending and manage connected agents directly in Link.

## Stripe Issuing for agents

Link’s wallet for agents is built directly on top of Stripe’s Issuing primitives. For businesses that want to build and customize their own agentic wallets and cards, Issuing for agents gives developers access to the full set of [Issuing APIs](https://docs.stripe.com/issuing) to power agentic spending and custom financial workflows for agents and their users.

Businesses can design user-facing experiences to fit their product, including onboarding, fund flows, and spending controls. They can define when and how agents move funds, set permissions at the card level, introduce fraud controls at transaction authorization, and gain visibility into historical and real-time card activity.

Issuing for agents provides the underlying infrastructure for these experiences, from single-use virtual cards and fund storage to spending controls, transaction monitoring, and advanced fraud tools. This infrastructure supports a range of use cases:

- Developers can use agents to automate their own business spend, allowing them to create programmatic workflows and recurring purchases.
- Fintech providers can embed agent-issued cards to control and reconcile spend for expense management in real time.
- Vertical SaaS platforms can issue agent cards to SMB customers, letting agents automate spend under the platform’s own brand.
- Marketplaces can issue cards to sellers, so their agents can automate supplier payments, logistics, and fulfillment purchases.

## Get started

[Get started today](https://link.com/agents) with Link’s wallet for agents, and [read our docs](https://docs.stripe.com/issuing/agents) to learn more about Issuing for agents.

Stay connected with Stripe and receive new blog posts in your inbox.


Stripe builds financial tools and economic infrastructure for the internet.


We’d love to hear from you.