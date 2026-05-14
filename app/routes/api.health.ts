import { json } from "@remix-run/node";
import { pineconeIndex } from "~/lib/pinecone.server";
import { prisma } from "~/database/db.server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export async function loader() {
  const diagnostic: any = {
    services: {
      database: "unknown",
      pinecone: "unknown",
      gemini: "unknown",
      openai: "unknown",
    },
    env: {
      hasGemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      hasOpenAI: !!(process.env.OPENAI_API_KEY),
      hasPinecone: !!(process.env.PINECONE_API_KEY),
      hasCohere: !!(process.env.PORTKEY_COHERE_VIRTUAL_KEY),
    }
  };

  // 1. Check Database
  try {
    await prisma.user.count();
    diagnostic.services.database = "OK";
  } catch (e: any) {
    diagnostic.services.database = `ERROR: ${e.message}`;
  }

  // 2. Check Pinecone
  try {
    const stats = await pineconeIndex.describeIndexStats();
    diagnostic.services.pinecone = "OK";
    diagnostic.pineconeStats = stats;
  } catch (e: any) {
    diagnostic.services.pinecone = `ERROR: ${e.message}`;
  }

  // 3. Check Gemini
  try {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (key) {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      await model.generateContent("test");
      diagnostic.services.gemini = "OK";
    } else {
      diagnostic.services.gemini = "NOT_CONFIGURED";
    }
  } catch (e: any) {
    diagnostic.services.gemini = `ERROR: ${e.message}`;
  }

  // 4. Check OpenAI
  try {
    const key = process.env.OPENAI_API_KEY;
    if (key) {
      const openai = new OpenAI({ apiKey: key });
      await openai.models.list();
      diagnostic.services.openai = "OK";
    } else {
      diagnostic.services.openai = "NOT_CONFIGURED";
    }
  } catch (e: any) {
    diagnostic.services.openai = `ERROR: ${e.message}`;
  }

  // 5. Check Portkey/Cohere
  try {
    const pkKey = process.env.PORTKEY_API_KEY;
    const cohereKey = process.env.PORTKEY_COHERE_VIRTUAL_KEY;
    if (pkKey && cohereKey) {
      const response = await fetch("https://api.portkey.ai/v1/rerank", {
        method: "POST",
        headers: {
          "x-portkey-api-key": pkKey.trim(),
          "x-portkey-virtual-key": cohereKey.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "rerank-english-v3.0",
          query: "test",
          documents: ["test document"],
          top_n: 1,
        }),
      });
      if (response.ok) {
        diagnostic.services.portkey_rerank = "OK";
      } else {
        const errData = await response.json().catch(() => ({}));
        diagnostic.services.portkey_rerank = `ERROR: ${response.status} ${response.statusText} - ${JSON.stringify(errData)}`;
      }
    } else {
      diagnostic.services.portkey_rerank = "NOT_CONFIGURED";
    }
  } catch (e: any) {
    diagnostic.services.portkey_rerank = `ERROR: ${e.message}`;
  }

  return json(diagnostic);
}
