import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireApiKey, enforceApiRateLimit } from "~/backend/api-auth.server";

/** GET /api/v1/leads?chatbotId= — owner-only (project.userId === apiKey.userId). */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireApiKey(request);
  await enforceApiRateLimit(user.id);

  const url = new URL(request.url);
  const chatbotId = url.searchParams.get("chatbotId");
  if (!chatbotId) {
    return json({ error: "chatbotId is required." }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: chatbotId, userId: user.id },
    select: { id: true },
  });
  if (!project) {
    return json({ error: "Chatbot not found." }, { status: 404 });
  }

  const leads = await prisma.lead.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      status: true,
      createdAt: true,
    },
  });

  return json({ data: leads });
}
