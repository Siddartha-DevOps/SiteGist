import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link } from "@remix-run/react";
import { requireUserId, getUserSession, destroySession } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { Download, ShieldCheck, Trash2, Loader2, ChevronLeft, AlertTriangle } from "lucide-react";
import { useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, createdAt: true },
  });

  // Lightweight counts so the page can show the user what's about to be exported/deleted.
  const [projects, knowledgeSources, leads, sessions] = await Promise.all([
    prisma.project.count({ where: { userId } }),
    prisma.knowledgeSource.count({ where: { project: { userId } } }),
    prisma.lead.count({ where: { project: { userId } } }),
    prisma.chatSession.count({ where: { project: { userId } } }),
  ]);

  return json({ user, counts: { projects, knowledgeSources, leads, sessions } });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const method = formData.get("_action");

  // ---------------------------------------------------------------------------
  // GDPR right to access — export everything we hold for this user as JSON.
  // ---------------------------------------------------------------------------
  if (method === "export_data") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        role: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    });

    const projects = await prisma.project.findMany({
      where: { userId },
      select: { id: true, name: true, settings: true, createdAt: true },
    });
    const projectIds = projects.map((p) => p.id);

    const [knowledgeSources, leads, sessions] = await Promise.all([
      prisma.knowledgeSource.findMany({
        where: { projectId: { in: projectIds } },
        select: { projectId: true, title: true, type: true, source: true, createdAt: true },
      }),
      prisma.lead.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          projectId: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          notes: true,
          status: true,
          createdAt: true,
          tags: { select: { label: true } },
        },
      }),
      prisma.chatSession.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          id: true,
          projectId: true,
          customerEmail: true,
          status: true,
          createdAt: true,
          messages: {
            select: { role: true, content: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    ]);

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      profile: {
        // The User model has no separate display name; email is the identifier.
        name: null,
        email: user?.email ?? null,
        role: user?.role ?? null,
        subscriptionTier: user?.subscriptionTier ?? null,
        subscriptionStatus: user?.subscriptionStatus ?? null,
        createdAt: user?.createdAt ?? null,
      },
      projects,
      knowledgeSources,
      leads: leads.map((l) => ({ ...l, tags: l.tags.map((t) => t.label) })),
      sessions,
    };

    const body = JSON.stringify(exportPayload, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=sitegist-export.json",
        "Cache-Control": "no-store",
      },
    });
  }

  // ---------------------------------------------------------------------------
  // GDPR right to be forgotten — permanently delete the account and all data.
  // ---------------------------------------------------------------------------
  if (method === "delete_account") {
    const confirm = (formData.get("confirm") as string || "").trim();
    if (confirm !== "DELETE") {
      return json({ error: 'Please type "DELETE" exactly to confirm.' }, { status: 400 });
    }

    try {
      const projects = await prisma.project.findMany({
        where: { userId },
        select: { id: true },
      });
      const projectIds = projects.map((p) => p.id);

      if (projectIds.length > 0) {
        const sessions = await prisma.chatSession.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true },
        });
        const sessionIds = sessions.map((s) => s.id);

        const sources = await prisma.knowledgeSource.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true, type: true, source: true, title: true },
        });

        // Remove vectors from Pinecone first (best-effort; never block deletion on it).
        try {
          const { deleteSourceChunks } = await import("~/ai-layer/ai.server");
          for (const s of sources) {
            const key = s.type === "web" ? s.source : s.title || s.source;
            await deleteSourceChunks(s.projectId, key);
          }
        } catch (e) {
          console.warn("[Privacy Delete] Pinecone cleanup skipped:", e);
        }

        // Delete relational data in FK-safe order (children before parents). Some
        // relations cascade at the DB level, but we delete explicitly so the order
        // is correct regardless of how the schema was pushed.
        const leadIds = (
          await prisma.lead.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } })
        ).map((l) => l.id);

        await prisma.$transaction([
          // 1. Messages (reference sessions)
          prisma.message.deleteMany({ where: { sessionId: { in: sessionIds } } }),
          prisma.conversationTag.deleteMany({ where: { sessionId: { in: sessionIds } } }),
          // 2. Leads + tags (lead.sessionId references sessions, so delete before sessions)
          prisma.leadTag.deleteMany({ where: { leadId: { in: leadIds } } }),
          prisma.lead.deleteMany({ where: { projectId: { in: projectIds } } }),
          // 3. Chat sessions
          prisma.chatSession.deleteMany({ where: { projectId: { in: projectIds } } }),
          // 4. Knowledge + project-scoped data
          prisma.knowledgeSource.deleteMany({ where: { projectId: { in: projectIds } } }),
          prisma.knowledgeQA.deleteMany({ where: { projectId: { in: projectIds } } }),
          prisma.unansweredQuestion.deleteMany({ where: { projectId: { in: projectIds } } }),
          prisma.analyticsSnapshot.deleteMany({ where: { projectId: { in: projectIds } } }),
          prisma.integration.deleteMany({ where: { projectId: { in: projectIds } } }),
          prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } }),
          prisma.projectAction.deleteMany({ where: { projectId: { in: projectIds } } }),
          // 5. Projects
          prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
        ]);
      }

      // 6. User-level records, then the user itself.
      await prisma.$transaction([
        prisma.apiKey.deleteMany({ where: { userId } }),
        prisma.userAddon.deleteMany({ where: { userId } }),
        prisma.auditLog.deleteMany({ where: { userId } }),
        prisma.usageRecord.deleteMany({ where: { userId } }),
        prisma.billingSubscription.deleteMany({ where: { userId } }),
        prisma.billingPayment.deleteMany({ where: { userId } }),
        prisma.blogPost.deleteMany({ where: { authorId: userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);

      // 7. Destroy the session and redirect home.
      const session = await getUserSession(request);
      return redirect("/", {
        headers: { "Set-Cookie": await destroySession(session) },
      });
    } catch (err: any) {
      console.error("[Privacy Delete] Account deletion failed:", err);
      return json(
        { error: `Account deletion failed: ${err?.message || String(err)}` },
        { status: 500 }
      );
    }
  }

  return json({ error: "Unknown action." }, { status: 400 });
}

export default function PrivacySettings() {
  const { user, counts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const navigation = useNavigation();
  const [confirmText, setConfirmText] = useState("");

  const isExporting =
    navigation.state === "submitting" && navigation.formData?.get("_action") === "export_data";
  const isDeleting =
    navigation.state === "submitting" && navigation.formData?.get("_action") === "delete_account";

  return (
    <div className="max-w-2xl">
      <Link
        to="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-zinc-700 transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> Back to settings
      </Link>

      <div className="mb-10">
        <h1 className="text-4xl font-black mb-2 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" /> Privacy & Your Data
        </h1>
        <p className="text-zinc-500">
          Download everything we hold for {user?.email}, or permanently delete your account.
        </p>
      </div>

      {/* Export My Data */}
      <div className="bg-white p-10 rounded-[40px] border border-zinc-100 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Download className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Export My Data</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-6">
          Download a JSON file with your profile, projects, knowledge sources, leads, and
          conversation history. (GDPR right to access.)
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Chatbots", value: counts.projects },
            { label: "Sources", value: counts.knowledgeSources },
            { label: "Leads", value: counts.leads },
            { label: "Conversations", value: counts.sessions },
          ].map((c) => (
            <div key={c.label} className="p-4 bg-zinc-50/60 rounded-2xl border border-zinc-100 text-center">
              <span className="block text-xl font-black text-zinc-800">{c.value}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{c.label}</span>
            </div>
          ))}
        </div>

        <Form method="post" reloadDocument>
          <input type="hidden" name="_action" value="export_data" />
          <button
            type="submit"
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-zinc-900 text-white rounded-2xl font-black hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            Export My Data
          </button>
        </Form>
      </div>

      {/* Delete My Account */}
      <div className="bg-white p-10 rounded-[40px] border border-red-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-xl font-bold text-red-600">Delete My Account</h2>
        </div>
        <p className="text-sm text-zinc-600 mb-2 leading-relaxed">
          This will permanently delete your account, all chatbots, all conversations, all leads,
          and all knowledge. This cannot be undone.
        </p>
        <p className="text-xs text-zinc-400 mb-6">
          Type <strong className="text-red-600 font-black select-all">DELETE</strong> below to confirm.
        </p>

        <Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="delete_account" />
          <input
            type="text"
            name="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isDeleting}
            placeholder="Type DELETE to confirm"
            className="w-full max-w-md px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/15 disabled:opacity-60 transition-all text-sm font-semibold text-zinc-800 placeholder:text-zinc-400"
          />

          {actionData?.error && (
            <p className="text-red-500 font-bold text-xs">{actionData.error}</p>
          )}

          <button
            type="submit"
            disabled={confirmText !== "DELETE" || isDeleting}
            className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-wider text-xs hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-red-200/60"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Deleting Account…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" /> Permanently Delete Account
              </>
            )}
          </button>
        </Form>
      </div>
    </div>
  );
}
