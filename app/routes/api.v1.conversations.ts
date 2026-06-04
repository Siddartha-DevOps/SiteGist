import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireApiKey } from "~/backend/api-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireApiKey(request);

  const url = new URL(request.url);
  const chatbotId = url.searchParams.get("chatbotId");

  const where: any = { project: { userId: user.id } };
  if (chatbotId) where.projectId = chatbotId;

  const sessions = await prisma.chatSession.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      projectId: true,
      customerEmail: true,
      status: true,
      mode: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  const data = sessions.map((s) => ({
    id: s.id,
    chatbotId: s.projectId,
    customerEmail: s.customerEmail,
    status: s.status,
    mode: s.mode,
    messageCount: s._count.messages,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  return json({ data });
}
