# SiteGist vs. SiteGPT Feature Audit

This document provides a comprehensive audit comparing the features of **SiteGist** (based on its current database schema and frontend capabilities) against the core feature set of **SiteGPT**, a popular no-code AI chatbot builder.

## Core Features & Training

| Feature | SiteGPT | SiteGist Current Implementation | Status |
| :--- | :--- | :--- | :--- |
| **Custom Training Sources** | Train on URLs, files (PDFs, docs), and raw text. | Supports `KnowledgeSource` with types: `web`, `file`, `youtube`, `text`. | ✅ Matching |
| **AI Responses** | GPT-4 powered conversational bot. | Supported via `ChatSession` and `Message` tables tracking `user` and `assistant` interactions. | ✅ Matching |
| **Human Handoff** | Seamless escalation to a human agent when AI cannot answer. | Supported. `ChatSession` includes a `mode` field (`ai` vs `human`). | ✅ Matching |
| **Feedback System** | Users can rate responses (thumbs up/down). | `Message` table includes a `feedback` integer field (1 for up, -1 for down). | ✅ Matching |

## Lead Generation & Analytics

| Feature | SiteGPT | SiteGist Current Implementation | Status |
| :--- | :--- | :--- | :--- |
| **Lead Capture** | Pre-chat forms to collect emails, names, etc. | Dedicated `Lead` model tracking `name`, `email`, `phone`, and `company` per project. | ✅ Matching |
| **Analytics Dashboard** | Usage insights, message counts, lead metrics. | `AnalyticsSnapshot` tracks `messagesCount`, `leadsCaptured`, `avgLatency`, and more per day. | ✅ Matching |
| **Unanswered Questions** | Log of questions the bot failed to answer. | Dedicated `UnansweredQuestion` model to track gaps in bot knowledge. | ✅ Matching |

## Deployment, Customization & Integrations

| Feature | SiteGPT | SiteGist Current Implementation | Status |
| :--- | :--- | :--- | :--- |
| **Customization** | Brand colors, logos, remove "Powered by" branding. | `Project.settings` JSON stores `branding`, `colors`, `theme`, and `removeBranding` options. | ✅ Matching |
| **Integrations** | Webhooks, Notion, Google Drive sync. | Dedicated `Integration` model (`notion`, `google_drive`) + `webhookUrl` for alerts. | ✅ Matching |
| **Billing & Usage Limits** | Usage-based pricing tiers. | `UsageRecord` tracks limits (`chat_message`, `crawled_page`) & `BillingSubscription` for Stripe. | ✅ Matching |

## Summary Conclusion

Based on the Prisma schema and the underlying data structures, **SiteGist has a near 1:1 feature parity mapping** with the core architecture of SiteGPT. 

The foundations for everything—from data ingestion (web, file, YouTube, text) to conversation handling, human handoff, and lead generation—are entirely in place and accurately modeled.
