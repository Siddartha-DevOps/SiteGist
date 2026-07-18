import { prisma } from "~/database/db.server";

export type RoutingMode = "off" | "round_robin" | "first_admin";

/**
 * Pick an agent to assign an escalated conversation to, returning the agent's
 * email (ProjectMember is keyed by email; ChatSession.assignedTo stores it).
 *
 * - "first_admin": the earliest-added ADMIN member.
 * - "round_robin": the ADMIN currently handling the fewest live (human-mode)
 *   conversations, so new escalations spread across the team.
 *
 * Returns null when routing is off or the project has no ADMIN members — callers
 * then leave the conversation unassigned (existing behaviour).
 */
export async function pickAgentEmail(projectId: string, mode: RoutingMode): Promise<string | null> {
  if (!mode || mode === "off") return null;

  const admins = await prisma.projectMember.findMany({
    where: { projectId, role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  if (admins.length === 0) return null;
  if (mode === "first_admin") return admins[0].email;

  // round_robin: least-loaded ADMIN by current human-mode session assignment.
  const emails = admins.map((a) => a.email);
  let loadByEmail = new Map<string, number>();
  try {
    const loads = await prisma.chatSession.groupBy({
      by: ["assignedTo"],
      where: { projectId, mode: "human", assignedTo: { in: emails } },
      _count: { _all: true },
    });
    loadByEmail = new Map(loads.map((l: any) => [l.assignedTo as string, l._count._all as number]));
  } catch (e) {
    // If the aggregate fails, fall back to the first admin rather than nothing.
    return admins[0].email;
  }

  let best = emails[0];
  let bestLoad = Infinity;
  for (const email of emails) {
    const load = loadByEmail.get(email) ?? 0;
    if (load < bestLoad) {
      bestLoad = load;
      best = email;
    }
  }
  return best;
}
