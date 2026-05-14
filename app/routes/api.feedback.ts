import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const { messageId, feedback } = body;

  if (!messageId || (feedback !== 1 && feedback !== -1)) {
    return json({ error: "Invalid feedback data" }, { status: 400 });
  }

  try {
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { feedback }
    });

    return json({ success: true, messageId: updated.id });
  } catch (error) {
    return json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
