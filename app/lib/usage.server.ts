import { prisma } from "~/database/db.server";
import { getPlanForTier } from "~/lib/plans";

export function getBillingCycleStart(): Date {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function getUsageForUser(userId: string, tier: string | null | undefined) {
  const cycleStart = getBillingCycleStart();
  const plan = getPlanForTier(tier);

  const agg = await prisma.usageRecord.aggregate({
    where: { userId, type: "chat_message", createdAt: { gte: cycleStart } },
    _sum: { amount: true },
  });

  const used = agg._sum.amount ?? 0;
  const limit = plan.messageLimit;
  const unlimited = limit < 0;
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));

  return { used, limit, unlimited, percent, planName: plan.name, cycleStart };
}
