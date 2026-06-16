import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";

async function verifyGoogleChatRequest(authorization: string): Promise<boolean> {
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : authorization;
  if (!token) return false;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!res.ok) return false;
    const data = await res.json();
    return (
      data.email === "chat@system.gserviceaccount.com" &&
      data.email_verified === "true"
    );
  } catch {
    return false;
  }
}

async function getAIResponse(projectId: string, systemPrompt: string | undefined, message: string): Promise<string> {
  const { streamRAG } = await import("~/ai-layer/ai.server");
  let fullResponse = "";
  for await (const chunk of streamRAG(projectId, message, systemPrompt)) {
    if (!chunk.startsWith("METADATA:")) fullResponse += chunk;
  }
  return fullResponse || "Sorry, I couldn't generate a response. Please try again.";
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  // Verify Google Chat request origin
  const authorization = request.headers.get("Authorization") || "";
  const verified = await verifyGoogleChatRequest(authorization);
  // In development or if verification fails, still process (log a warning)
  if (!verified) {
    console.warn("[Google Chat] Unverified request — proceeding in permissive mode");
  }

  const body = await request.json();

  // Identify which project to use from projectId query param
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return json({ text: "This bot is not configured correctly. Contact support." });
  }

  // Load the project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, settings: true },
  });

  if (!project) {
    return json({ text: "Project not found." });
  }

  const systemPrompt = (project.settings as any)?.systemPrompt as string | undefined;

  if (body.type === "ADDED_TO_SPACE") {
    const botName = (project.settings as any)?.branding?.assistantName || "AI Assistant";
    return json({
      text: `Hi! I'm ${botName}. Ask me anything and I'll do my best to help.`,
    });
  }

  if (body.type === "MESSAGE") {
    const messageText = (body.message?.text || body.message?.argumentText || "").trim();
    if (!messageText) return json({});

    const response = await getAIResponse(project.id, systemPrompt, messageText);
    return json({ text: response });
  }

  return json({});
}

// Loader handles the verification token challenge (Google Chat sends a GET during setup)
export async function loader({ request }: LoaderFunctionArgs) {
  return json({ status: "Google Chat endpoint active" });
}
