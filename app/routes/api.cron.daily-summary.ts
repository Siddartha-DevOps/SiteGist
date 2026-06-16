import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { sendEmail } from "~/lib/email.server";

// Hit this daily from an external scheduler (Cloud Scheduler, cron-job.org, etc.) or QStash / Vercel Crons
//   GET /api/cron/daily-summary?token=YOUR_CRON_SECRET
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Yesterday window (UTC). startOfToday = 00:00 today, startOfYesterday = 00:00 yesterday ---
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);
  const window = { gte: startOfYesterday, lt: startOfToday };

  const users = await prisma.user.findMany({
    include: { projects: { select: { id: true, name: true } } },
  });

  let usersProcessed = 0;
  let emailsSent = 0;
  let snapshotsWritten = 0;

  for (const user of users) {
    if (!user.projects.length) continue;
    const projectIds = user.projects.map((p) => p.id);
    usersProcessed++;

    // Write per-project AnalyticsSnapshot for yesterday
    for (const project of user.projects) {
      try {
        const [projMessages, projLeads, projUnanswered, projPositive, projNeutral, projNegative] = await Promise.all([
          prisma.message.count({
            where: { session: { projectId: project.id }, role: "user", createdAt: window },
          }),
          prisma.lead.count({ where: { projectId: project.id, createdAt: window } }),
          prisma.unansweredQuestion.count({ where: { projectId: project.id, createdAt: window } }),
          prisma.message.count({ where: { session: { projectId: project.id }, role: "user", sentiment: "positive", createdAt: window } }),
          prisma.message.count({ where: { session: { projectId: project.id }, role: "user", sentiment: "neutral", createdAt: window } }),
          prisma.message.count({ where: { session: { projectId: project.id }, role: "user", sentiment: "negative", createdAt: window } }),
        ]);

        await prisma.analyticsSnapshot.create({
          data: {
            projectId: project.id,
            date: startOfYesterday,
            messagesCount: projMessages,
            leadsCaptured: projLeads,
            unansweredCount: projUnanswered,
            positiveCount: projPositive,
            neutralCount: projNeutral,
            negativeCount: projNegative,
          },
        });
        snapshotsWritten++;
      } catch (err) {
        console.error(`[daily-summary] Snapshot failed for project ${project.id}:`, err);
      }
    }

    try {
      const [leads, sessions, messages, unansweredList, positive, neutral, negative] = await Promise.all([
        prisma.lead.count({ where: { projectId: { in: projectIds }, createdAt: window } }),
        prisma.chatSession.count({ where: { projectId: { in: projectIds }, createdAt: window } }),
        prisma.message.count({
          where: { session: { projectId: { in: projectIds } }, createdAt: window },
        }),
        prisma.unansweredQuestion.findMany({
          where: { projectId: { in: projectIds }, createdAt: window },
          select: { question: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.message.count({ where: { session: { projectId: { in: projectIds } }, role: "user", sentiment: "positive", createdAt: window } }),
        prisma.message.count({ where: { session: { projectId: { in: projectIds } }, role: "user", sentiment: "neutral", createdAt: window } }),
        prisma.message.count({ where: { session: { projectId: { in: projectIds } }, role: "user", sentiment: "negative", createdAt: window } }),
      ]);

      // Skip users with no activity yesterday — don't spam empty digests
      if (sessions === 0 && leads === 0 && messages === 0 && unansweredList.length === 0) {
        continue;
      }

      await sendEmail({
        to: user.email,
        subject: "Your daily SiteGist summary",
        html: buildDailyEmail({
          leads,
          sessions,
          messages,
          unanswered: unansweredList.map((u) => u.question),
          sentiment: { positive, neutral, negative },
        }),
      });
      emailsSent++;
    } catch (err) {
      console.error(`[daily-summary] Failed for user ${user.id}:`, err);
    }
  }

  return json({ ok: true, usersProcessed, emailsSent, snapshotsWritten });
}

function statCard(label: string, value: number) {
  return `
    <div style="flex:1; min-width:110px; background:#f4f4f5; border-radius:16px; padding:16px; text-align:center;">
      <div style="font-size:28px; font-weight:800; color:#155DEE;">${value}</div>
      <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#a1a1aa; margin-top:4px;">${label}</div>
    </div>`;
}

function buildDailyEmail({
  leads,
  sessions,
  messages,
  unanswered,
  sentiment,
}: {
  leads: number;
  sessions: number;
  messages: number;
  unanswered: string[];
  sentiment: { positive: number; neutral: number; negative: number };
}): string {
  const sentimentTotal = sentiment.positive + sentiment.neutral + sentiment.negative;
  const sentimentSection =
    sentimentTotal > 0
      ? `
        <div style="margin:20px 0; padding:16px; background:#f4f4f5; border-radius:16px;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#a1a1aa; margin-bottom:8px;">Visitor sentiment</div>
          <div style="font-size:14px; color:#18181b; font-weight:600;">
            😊 ${sentiment.positive} positive · 😐 ${sentiment.neutral} neutral · 😞 ${sentiment.negative} negative
          </div>
        </div>`
      : "";

  const unansweredSection =
    unanswered.length > 0
      ? `
        <h3 style="font-size:15px; font-weight:700; color:#18181b; margin:24px 0 12px;">Questions your bot couldn't answer</h3>
        <ul style="padding-left:20px; color:#52525b; font-size:14px; line-height:1.6; margin-bottom:12px;">
          ${unanswered.map((q) => `<li style="margin-bottom:8px;">"${escapeHtml(q)}"</li>`).join("")}
        </ul>
        <p style="font-size:13px; color:#71717a; margin-top:0;">Add answers for these in your knowledge base to improve your AI agent's coverage.</p>`
      : `<p style="font-size:14px; color:#16a34a; margin-top:24px; font-weight:500;">🎉 Your AI agent successfully handled every conversation yesterday!</p>`;

  return `
    <div style="max-width:540px; margin:0 auto; font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding:20px; border:1px solid #e4e4e7; border-radius:24px; background:#ffffff;">
      <div style="margin-bottom:24px;">
        <h2 style="font-size:20px; font-weight:800; color:#18181b; margin:0 0 6px 0;">Here's what happened yesterday 📊</h2>
        <p style="color:#52525b; font-size:14px; margin:0;">Daily updates and key performance stats for your chatbots.</p>
      </div>
      
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin:20px 0;">
        ${statCard("New Leads", leads)}
        ${statCard("Conversations", sessions)}
        ${statCard("Messages", messages)}
      </div>

      ${sentimentSection}

      <div style="border-top:1px solid #e4e4e7; padding-top:4px; margin-top:20px;">
        ${unansweredSection}
      </div>

      <div style="margin-top:32px; border-top:1px solid #e4e4e7; padding-top:24px; text-align:center;">
        <a href="https://sitegist.co/dashboard"
           style="display:inline-block; padding:12px 24px; background:#155DEE; color:#ffffff; text-decoration:none; border-radius:12px; font-weight:700; font-size:14px; box-shadow: 0 4px 6px -1px rgba(21, 93, 238, 0.1), 0 2px 4px -1px rgba(21, 93, 238, 0.06);">
          Open Dashboard
        </a>
        <p style="color:#a1a1aa; font-size:11px; margin-top:24px;">Sent by SiteGist · Daily digest notification. You can adjust your email alert configurations in settings.</p>
      </div>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
