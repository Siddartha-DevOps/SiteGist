import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { generateSimpleAIStream } from "~/ai-layer/ai.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return json({ error: "Missing prompt" }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const aiStream = generateSimpleAIStream(prompt);
          for await (const chunk of aiStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }
        } catch (err) {
          console.error("[Tools API] Stream Error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "[ERROR] Stream failed" })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Tools API] Fatal Error:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}
