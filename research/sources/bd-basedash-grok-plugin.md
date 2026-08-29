Source: https://www.basedash.com/blog/introducing-basedash-for-grok-bot
Title: Introducing Basedash for Grok Bot | Basedash
Fetched: 2026-08-29T02:48:00.686Z

[Skip to content](https://www.basedash.com/blog/introducing-basedash-for-grok-bot#main-content)

[← Blog](https://www.basedash.com/blog)

# Introducing Basedash for Grok Bot

[Max Musing](https://www.basedash.com/authors/max-musing)[![Max Musing avatar](https://www.basedash.com/_astro/max-musing.Cj3EgyeQ.png)Max MusingFounder and CEO of Basedash](https://www.basedash.com/authors/max-musing) · August 26, 2026

![Introducing Basedash for Grok Bot](https://www.basedash.com/_blog-images/736c6cefadaeea8a/1600.webp)

Today we’re launching **Basedash for Grok Bot** — the official Basedash plugin for asking questions of governed company data without leaving your agent.

Introducing Basedash for Grok Bot - YouTube

Tap to unmute

[Introducing Basedash for Grok Bot](https://www.youtube.com/watch?v=HO31htO8iS8) [Basedash](https://www.youtube.com/channel/UCp8VNUV2IGWDfOi8j5UC2yQ)

Basedash381 subscribers

[Watch on](https://www.youtube.com/watch?v=HO31htO8iS8)

Open **Plugins**, add Basedash, sign in through OAuth, and ask a question. The answer comes back through Basedash from the sources your workspace already lets you access.

The plugin has been live on the official [Cursor Marketplace](https://cursor.com/marketplace/basedash) since August 24. It is also available in Cursor.

## Plugins, then OAuth

In Grok Bot, open **Plugins** in the sidebar, search for **Basedash**, and add it. Complete the sign-in flow. There are no API keys to copy, tokens to paste, or local servers to keep running.

![Add Basedash from Plugins, then connect through OAuth with no API keys.](https://www.basedash.com/_blog-images/bddfee61802d84b2/1600.webp)

Under the hood, the plugin connects to one hosted remote MCP at `https://charts.basedash.com/api/public/mcp`. The [plugin repo](https://github.com/Basedash/agent-plugin) defines the focused tools and skills Grok Bot uses to work with Basedash.

## Ask a governed company question

Once you’re signed in, ask the question where you’re already working:

> Which accounts drove this quarter’s NRR change?

The `ask_question` tool sends the question to Basedash and brings the answer back into Grok Bot. You can ask a quick lookup, investigate a change, or continue with a follow-up without moving the conversation to another app.

![Ask a company data question in Grok Bot and get the governed answer back through Basedash.](https://www.basedash.com/_blog-images/5b4a0958c1508320/1600.webp)

The plugin includes the `analyze-company-data` skill to guide this analysis. It gives Grok Bot a direct path from the question in chat to an answer grounded in company data.

## See which sources are available

Before asking, Grok Bot can call `get_data_sources` to list the connected sources available to your account. The `discover-company-data` skill helps it inspect that list and understand where a question can be answered.

That matters when a workspace has several databases, warehouses, or SaaS sources connected. You can see what is available instead of guessing which system holds the answer.

![List the connected sources available to your account while Basedash keeps workspace access controls in place.](https://www.basedash.com/_blog-images/9829c6c84c29b577/1600.webp)

Signing in does not widen your access. The same workspace access controls that apply in Basedash still apply inside Grok Bot. If your account cannot use a source in Basedash, the plugin does not make that source available.

## Plugin, MCP server, and MCP connectors

These three parts solve different jobs:

- **Basedash for Grok Bot** puts Basedash inside Grok Bot through an installable plugin.
- The **Basedash MCP server** lets agents connect to Basedash through its hosted remote MCP endpoint.
- **MCP connectors** bring external sources and tools into Basedash.

This launch is the first one: Basedash living inside Grok Bot, packaged with the tools and skills it needs.

## Getting started

1. Open [Basedash on the Cursor Marketplace](https://cursor.com/marketplace/basedash), or in Grok Bot open **Plugins** and search for Basedash
2. Add the plugin
3. Sign in to Basedash through OAuth
4. Ask a company data question or list the sources available to you

**Install Basedash for Grok Bot and ask your first governed company data question.**

Written by

![Max Musing avatar](https://www.basedash.com/_astro/max-musing.Cj3EgyeQ_Z1XQhYP.webp)

## [Max Musing](https://www.basedash.com/authors/max-musing)

Founder and CEO of Basedash

Max Musing is the founder and CEO of Basedash, an AI-native business intelligence platform designed to help teams explore analytics and build dashboards without writing SQL. His work focuses on applying large language models to structured data systems, improving query reliability, and building governed analytics workflows for production environments.

[View full author profile →](https://www.basedash.com/authors/max-musing)

## LookingforanAI-nativeBItool?LookingforanAI-nativeBItool?

Basedash lets you build charts, dashboards, and reports in seconds using all your data.

[Start free](https://charts.basedash.com/signup?referrerPage=https%3A%2F%2Fwww.google.com%2F&landingPage=https%3A%2F%2Fwww.basedash.com%2Fblog%2Fintroducing-basedash-for-grok-bot&conversionPage=https%3A%2F%2Fwww.basedash.com%2Fblog%2Fintroducing-basedash-for-grok-bot) [Book a demo](https://www.basedash.com/book/book-a-demo)