import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { requireApiKey, enforceApiRateLimit } from "~/backend/api-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireApiKey(request);
  await enforceApiRateLimit(user.id);

  const chatbots = await prisma.project.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return json({ data: chatbots });
}
