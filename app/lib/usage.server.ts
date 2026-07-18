import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { getPlanForTier } from "~/lib/plans";

export function getBillingCycleStart(): Date {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Chatbot-count quota. Single source of truth used by every project-creation path
 * (dashboard.projects.new, dashboard._index, create-chatbot) so the limit can't be
 * bypassed by hitting a different route. `atLimit` is true when the user already
 * owns >= their plan's chatbot allowance (negative limit = unlimited).
 */
export async function getChatbotQuota(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });
  const plan = getPlanForTier(user?.subscriptionTier);
  const count = await prisma.project.count({ where: { userId } });
  const limit = plan.chatbotLimit;
  const unlimited = limit < 0;
  return { count, limit, unlimited, atLimit: !unlimited && count >= limit, planName: plan.name };
}

/**
 * Throwable guard for chatbot creation. Returns null when allowed, or a ready-to-return
 * Remix json() 403 Response (with a user-facing upgrade message) when the quota is hit.
 */
export async function enforceChatbotQuota(userId: string): Promise<Response | null> {
  const q = await getChatbotQuota(userId);
  if (q.atLimit) {
    console.warn(`[Quota] user ${userId} blocked from creating a chatbot: ${q.count}/${q.limit} (${q.planName} plan)`);
    return json(
      {
        error: `You've reached your ${q.planName} plan limit of ${q.limit} chatbot${q.limit === 1 ? "" : "s"}. Upgrade your plan to add more.`,
        code: "chatbot_quota_exceeded",
      },
      { status: 403 }
    );
  }
  return null;
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
