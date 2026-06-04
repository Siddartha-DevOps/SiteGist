import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireApiKey } from "~/backend/api-auth.server";
import { streamRAG } from "~/ai-layer/ai.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, { status: 405 });
  }

  const user = await requireApiKey(request);

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body." }, { status: 400 });

  const { chatbotId, message, sessionId } = body;
  if (!chatbotId || !message) {
    return json({ error: "chatbotId and message are required." }, { status: 400 });
  }

  // Verify the chatbot belongs to the API key owner
  const project = await prisma.project.findFirst({
    where: { id: chatbotId, userId: user.id },
  });
  if (!project) return json({ error: "Chatbot not found." }, { status: 404 });

  const settings = (project.settings as any) || {};
  const systemPrompt = settings.systemPrompt || "You are a helpful assistant.";

  // Get or create the session
  let session = sessionId
    ? await prisma.chatSession.findFirst({ where: { id: sessionId, projectId: project.id } })
    : null;
  if (!session) {
    session = await prisma.chatSession.create({ data: { projectId: project.id } });
  }

  // Build short history + log the incoming user message
  const history = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const formattedHistory = history.reverse().map((m) => ({ role: m.role, content: m.content }));

  await prisma.message.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  // Generate the answer (non-streaming for API consumers)
  let answer = "";
  for await (const chunk of streamRAG(project.id, message, systemPrompt, formattedHistory, settings.model)) {
    if (chunk.startsWith("METADATA:")) continue;
    if (chunk.startsWith("[ERROR]")) {
      return json({ error: chunk.slice(7).trim() || "Generation failed." }, { status: 502 });
    }
    answer += chunk;
  }

  await prisma.message.create({
    data: { sessionId: session.id, role: "assistant", content: answer },
  });

  // Count toward the user's monthly quota (same as the widget)
  await prisma.usageRecord.create({
    data: { userId: user.id, type: "chat_message", amount: 1 },
  });

  return json({ sessionId: session.id, answer });
}
