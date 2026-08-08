import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireApiKey, enforceApiRateLimit } from "~/backend/api-auth.server";

/** GET /api/v1/conversations/:id/messages — owner-only (project.userId === apiKey.userId). */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireApiKey(request);
  await enforceApiRateLimit(user.id);

  const sessionId = params.id;
  if (!sessionId) {
    return json({ error: "Conversation id is required." }, { status: 400 });
  }

  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, project: { userId: user.id } },
    select: { id: true },
  });
  if (!session) {
    return json({ error: "Conversation not found." }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  return json({ data: messages });
}
