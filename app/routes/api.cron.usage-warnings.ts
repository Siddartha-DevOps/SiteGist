import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { getUsageForUser, getBillingCycleStart } from "~/lib/usage.server";
import { sendEmail } from "~/lib/email.server";
import { getRedis } from "~/lib/redis.server";

// Fallback memory cache for local development if Redis is not active/configured
const localDedupeCache = new Set<string>();

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({ 
    select: { id: true, email: true, subscriptionTier: true } 
  });
  const cycleKey = getBillingCycleStart().toISOString().slice(0, 7); // "2026-06"
  let sent = 0;

  const redis = getRedis();

  for (const user of users) {
    try {
      const usage = await getUsageForUser(user.id, user.subscriptionTier);
      if (usage.unlimited) {
        continue;
      }

      const threshold = usage.percent >= 100 ? 100 : usage.percent >= 80 ? 80 : 0;
      if (threshold === 0) {
        continue;
      }

      // Dedupe: only send each threshold once per billing cycle
      const dedupeKey = `usage-warning:${user.id}:${cycleKey}:${threshold}`;
      
      let isNew = false;
      if (redis) {
        // Redis check and lock
        const lockValue = await redis.set(dedupeKey, "1", { nx: true, ex: 60 * 60 * 24 * 35 });
        isNew = lockValue === "OK";
      } else {
        // Fallback for local tests/development
        if (!localDedupeCache.has(dedupeKey)) {
          localDedupeCache.add(dedupeKey);
          isNew = true;
        }
      }

      if (!isNew) {
        continue;
      }

      const subject = threshold === 100
        ? "You've reached your SiteGist message limit"
        : "You're at 80% of your SiteGist message limit";

      await sendEmail({
        to: user.email,
        subject,
        html: buildUsageWarningEmail(usage, threshold),
      });
      sent++;
    } catch (userErr) {
      console.error(`Status warning failed for ${user.email}:`, userErr);
    }
  }

  return json({ ok: true, sent });
}

function buildUsageWarningEmail(usage: { used: number; limit: number; percent: number; planName: string }, threshold: number) {
  const is100 = threshold === 100;
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e4e4e7; border-radius: 24px; background-color: #fafafa;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="background: ${is100 ? '#fee2e2' : '#ffedd5'}; color: ${is100 ? '#ef4444' : '#f97316'}; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; padding: 6px 12px; border-radius: 999px;">
          Usage Threshold Alert
        </span>
      </div>
      <h2 style="color: #18181b; margin-top: 0; margin-bottom: 12px; font-size: 20px; font-weight: 800; text-align: center; tracking: -0.025em;">
        ${is100 ? "You've reached your message limit!" : "You're at 80% of your message limit!"}
      </h2>
      <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
        This is an automated usage alert for user account. 
        ${is100 
          ? `You have utilized <strong>${usage.used.toLocaleString()}</strong> of your <strong>${usage.limit.toLocaleString()}</strong> monthly messaging quota. To ensure your AI agents continue responding to customer queries seamlessly, you need to upgrade your subscription plan.`
          : `You have utilized <strong>${usage.used.toLocaleString()}</strong> of your monthly message allocation (<strong>${usage.limit.toLocaleString()}</strong> messages). You are currently at <strong>${usage.percent}%</strong> of your plan capacity.`
        }
      </p>
      
      <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 20px; padding: 24px; margin-bottom: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #18181b;">
          <span>Monthly Message Cap Tracker</span>
          <span style="font-family: monospace; color: ${is100 ? '#dc2626' : '#ea580c'}; font-size: 13px;">${usage.percent}%</span>
        </div>
        <div style="width: 100%; height: 8px; background: #f4f4f5; border-radius: 999px; overflow: hidden; border: 1px solid #e4e4e7; margin-bottom: 12px;">
          <div style="width: ${Math.min(100, usage.percent)}%; height: 100%; background: ${is100 ? '#ef4444' : '#ea580c'}; border-radius: 999px;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #a1a1aa; font-weight: 600;">
          <span>Used: ${usage.used.toLocaleString()}</span>
          <span>Limit: ${usage.limit.toLocaleString()}</span>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 16px;">
        <a href="https://sitegist.co/dashboard/billing" style="display: inline-block; background: #18181b; color: #ffffff; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 13px; box-shadow: 0 4px 12px rgba(24,24,27,0.15); transition: background 0.2s;">
          Upgrade Your Subscription
        </a>
      </div>
      
      <p style="color: #a1a1aa; font-size: 11px; margin-top: 32px; text-align: center; border-top: 1px solid #e4e4e7; padding-top: 24px; font-weight: 500;">
        Sent automatically by SiteGist &middot; Your AI Chatbot Portal
      </p>
    </div>
  `;
}
