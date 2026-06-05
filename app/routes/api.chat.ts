import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { streamRAG } from "~/ai-layer/ai.server";
import { getRedis } from "~/lib/redis.server";

export async function action({ request }: ActionFunctionArgs) {
  console.log(`[Chat Action] Incoming request: ${request.method} ${request.url}`);
  
  // Verify it's a POST request
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json().catch(err => {
      console.error("[Chat] Failed to parse JSON body:", err);
      return null;
    });

    if (!body) {
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { projectId, message, sessionId } = body;

    if (!projectId || !message) {
      return json({ error: "Missing required fields (projectId, message)" }, { status: 400 });
    }

    // --- Domain Whitelisting ---
    const origin = request.headers.get("origin") || request.headers.get("referer");
    // ---------------------------

    console.log(`[Chat] Processing request for project: ${projectId}, session: ${sessionId || 'new'}`);

    let project = null;
    let systemPrompt = "You are a helpful AI assistant for SiteGist, a platform that builds AI chatbots from website content.";
    let modelPreference: string | undefined = undefined;

    if (projectId !== "demo-project") {
      try {
        project = await prisma.project.findUnique({
          where: { id: projectId },
        });

        if (!project) {
          console.warn(`[Chat] Project not found: ${projectId}`);
          return json({ error: "Project not found" }, { status: 404 });
        }
        const settings = project.settings as any;
        systemPrompt = settings?.systemPrompt || systemPrompt;
        modelPreference = settings?.model || undefined;

        // Domain whitelisting check
        if (settings?.allowedDomains && settings.allowedDomains.length > 0 && origin) {
          const isAllowed = settings.allowedDomains.some((d: string) => origin.includes(d));
          if (!isAllowed) {
            console.warn(`[Chat] Unauthorized domain access: ${origin}`);
            return json({ error: "Unauthorized domain" }, { status: 403 });
          }
        }
      } catch (dbError) {
        console.error("[Chat] Database error fetching project:", dbError);
      }
    }

    // 1. Get or create session
    let session: any = null;
    let formattedHistory: { role: string, content: string }[] = [];

    if (projectId !== "demo-project") {
      try {
        if (sessionId) {
          session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
        }
        
        if (!session) {
          session = await prisma.chatSession.create({
            data: { projectId },
          });
        }

        // If session is in human mode, AI should not respond
        if (session.mode === "human") {
          console.log(`[Chat] Session ${session.id} is in HUMAN mode. Skipping AI.`);
          // Log user message first
          await prisma.message.create({
            data: {
              sessionId: session.id,
              role: "user",
              content: message,
            },
          });

          // Broadcast visitor message to PartyKit room live
          const partykitHost = process.env.PARTYKIT_HOST;
          if (partykitHost) {
            const cleanHost = partykitHost.replace(/\/$/, "");
            const roomUrl = `${cleanHost.startsWith("http") ? "" : "http://"}${cleanHost}/parties/main/${session.id}`;
            console.log(`[api.chat.ts] Human mode live broadcast visitor message to PartyKit: ${roomUrl}`);
            fetch(roomUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "message",
                role: "user",
                content: message,
              }),
            }).catch((err) => {
              console.error("[api.chat.ts] PartyKit broadcast error:", err);
            });
          }
          
          return new Response(new ReadableStream({
             start(controller) {
               const data = JSON.stringify({ content: "Our support team has taken over this chat and will respond shortly." });
               controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
               controller.close();
             }
          }), { headers: { "Content-Type": "text/event-stream" } });
        }

        // 2. Fetch history
        const history = await prisma.message.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        formattedHistory = history.reverse().map(m => ({ role: m.role, content: m.content }));

        // 3. Log user message
        await prisma.message.create({
          data: {
            sessionId: session.id,
            role: "user",
            content: message,
          },
        });
      } catch (dbError) {
        console.error("[Chat] Database error in session management:", dbError);
      }
    }

    const encoder = new TextEncoder();
    
    // Create the ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        console.log(`[Chat] Stream started for project: ${projectId}`);
        let fullAnswer = "";
        
        try {
          // Send initial session event
          const initialData = JSON.stringify({ sessionId: session?.id || "demo-session" });
          controller.enqueue(encoder.encode(`event: session\ndata: ${initialData}\n\n`));

          console.log(`[Chat] Initiating RAG for project: ${projectId}`);
          const ragStream = streamRAG(projectId, message, systemPrompt, formattedHistory, modelPreference);
          
          // Check for handoff intent
          const handoffKeywords = ["human", "agent", "real person", "support rep", "talk to someone", "help me"];
          const isHandoffRequested = handoffKeywords.some(keyword => message.toLowerCase().includes(keyword));

          if (isHandoffRequested && project?.webhookUrl) {
            console.log(`[Chat] Handoff requested for project: ${projectId}. Triggering webhook.`);
            fetch(project.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "human_handoff_requested",
                projectId: project.id,
                projectName: project.name,
                sessionId: session?.id,
                message: message,
                timestamp: new Date().toISOString(),
              }),
            }).catch(e => console.error("[Chat] Webhook error:", e));
            
            // Optionally insert a marker in the stream or modify the response
            controller.enqueue(encoder.encode(`event: handoff\ndata: ${JSON.stringify({ requested: true })}\n\n`));
          }

          for await (const chunk of ragStream) {
            if (chunk.startsWith("METADATA:")) {
              const metadata = chunk.slice(9);
              controller.enqueue(encoder.encode(`event: metadata\ndata: ${metadata}\n\n`));
              continue;
            }
            fullAnswer += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }
          
          console.log(`[Chat] RAG finished, total length: ${fullAnswer.length}`);

          if (projectId !== "demo-project" && session && project) {
            try {
              const assistantMsg = await prisma.message.create({
                data: {
                  sessionId: session.id,
                  role: "assistant",
                  content: fullAnswer,
                },
              });
              controller.enqueue(encoder.encode(`event: messageId\ndata: ${JSON.stringify({ messageId: assistantMsg.id })}\n\n`));
              
              await prisma.usageRecord.create({
                data: {
                  userId: project.userId,
                  type: "chat_message",
                  amount: 1,
                },
              });
            } catch (saveError) {
              console.error("[Chat] Error saving assistant response:", saveError);
            }
          }
        } catch (streamError) {
          console.error("[Chat] error in ReadableStream execution:", streamError);
          const msg = streamError instanceof Error ? streamError.message : "Internal streaming error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `[ERROR] ${msg}` })}\n\n`));
        } finally {
          console.log(`[Chat] Closing stream for project: ${projectId}`);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
      status: 200,
    });
  } catch (fatalError) {
    console.error("[Chat Action] Fatal Error:", fatalError);
    return json({ 
      error: "Internal Server Error", 
      details: fatalError instanceof Error ? fatalError.message : String(fatalError) 
    }, { status: 500 });
  }
}
