# SiteGist Platform Documentation

## 1. Introduction
SiteGist is an AI-powered conversational platform designed to bridge the gap between static websites and interactive customer engagement. It allows business owners to "train" an AI on their website content and provide 24/7 intelligent support.

## 2. Brand Identity
- **Name:** SiteGist
- **Colors:**
  - Primary: #101828 (Dark Navy)
  - Accent: #155DEE (SaaS Blue)
  - Secondary: #EFF4FF (Light Blue tint)
- **Logo:** Friendly AI chatbot robot head icon.
- **Typography:** Inter (Sans-serif)

## 3. Technical Stack
- **Framework:** Remix (Full-stack React)
- **Language:** TypeScript
- **Database:** Prisma (SQL) + Pinecone (Vector)
- **AI Models:** Gemini 1.5 Flash (Default) + GPT-4o-mini (Fallback)
- **Real-time Engine:** PartyKit

## 3. Project Structure
- `/app/ai-layer`: Core AI logic.
  - `ai.server.ts`: Handles RAG flow, embeddings, and provider routing.
- `/app/routes`: Component pages and API routes.
  - `api.chat.ts`: Main messaging entry point.
  - `dashboard.projects.$projectId.train.tsx`: Website crawling logic.
- `/app/database`: Database initialization and Prisma client.
- `/app/lib`: Helper utilities and third-party clients (Pinecone, etc).

## 4. Logical Workflows

### A. Training Workflow
1. User provides a URL.
2. The `train` route triggers a crawler.
3. Content is broken into chunks.
4. Chunks are converted into "Vectors" (numbers representing meaning).
5. Vectors are stored in Pinecone for searching.

### B. Chat Workflow
1. User asks a question ("How much does it cost?").
2. The query is converted into a vector.
3. The system searches Pinecone for the most relevant part of the website.
4. The relevant text + the user's question are sent to the AI (Gemini/OpenAI).
5. The AI answers based *only* on your website's data.

## 5. Security & Validation
The system includes an **Answer Verification Layer** that cross-checks the AI's response against your source data to prevent "hallucinations" (making things up).

## 6. Environment Configuration
Required variables in `.env`:
- `GEMINI_API_KEY`: Google AI Studio secret.
- `OPENAI_API_KEY`: OpenAI Platform secret.
- `PINECONE_API_KEY`: Vector database access.
- `DATABASE_URL`: SQL database connection.
