import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/database/db.server";
import { sendEmail } from "~/lib/email.server";

// Hit this weekly from an external scheduler (Cloud Scheduler, cron-job.org, etc.)
//   GET /api/cron/weekly-report?token=YOUR_CRON_SECRET
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const users = await prisma.user.findMany({
    include: { projects: { select: { id: true, name: true } } },
  });

  let sent = 0;
  for (const user of users) {
    if (!user.projects.length) continue;
    const projectIds = user.projects.map((p) => p.id);

    const [leads, sessions, messages, unanswered] = await Promise.all([
      prisma.lead.count({ where: { projectId: { in: projectIds }, createdAt: { gte: since } } }),
      prisma.chatSession.count({ where: { projectId: { in: projectIds }, createdAt: { gte: since } } }),
      prisma.message.count({ where: { session: { projectId: { in: projectIds } }, createdAt: { gte: since } } }),
      prisma.unansweredQuestion.count({ where: { projectId: { in: projectIds }, createdAt: { gte: since } } }),
    ]);

    // Skip users with no activity this week
    if (leads === 0 && sessions === 0 && messages === 0) continue;

    try {
      await sendEmail({
        to: user.email,
        subject: "Your weekly SiteGist report",
        html: `
          <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color:#155DEE; margin-bottom:4px;">Your week in review 📊</h2>
            <p style="color:#52525b; margin-top:0;">Here's how your chatbots performed over the last 7 days.</p>
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin:20px 0;">
              ${statCard("New Leads", leads)}
              ${statCard("Conversations", sessions)}
              ${statCard("Messages", messages)}
              ${statCard("Unanswered", unanswered)}
            </div>
            <a href="https://sitegist.co/dashboard" style="display:inline-block; background:#155DEE; color:#fff; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold;">Open dashboard</a>
            <p style="color:#a1a1aa; font-size:12px; margin-top:24px;">Sent by SiteGist · Weekly summary.</p>
          </div>
        `,
      });
      sent++;
    } catch (e) {
      console.error(`Weekly report failed for ${user.email}:`, e);
    }
  }

  return json({ ok: true, usersProcessed: users.length, emailsSent: sent });
}

function statCard(label: string, value: number) {
  return `
    <div style="flex:1; min-width:110px; background:#f4f4f5; border-radius:16px; padding:16px;">
      <div style="font-size:28px; font-weight:800; color:#18181b;">${value}</div>
      <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#a1a1aa;">${label}</div>
    </div>`;
}
