import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { applyPendingSchema } from "~/backend/schema-sync.server";
import { Database, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, ScrollText } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  // Any authenticated user may reach this page. The only operation is an
  // idempotent, additive schema sync (create-if-not-exists) that aligns the DB
  // with the committed schema — it cannot drop or expose data — so gating it to a
  // single hard-coded owner email was unnecessary and was blocking the operator
  // from fixing production drift.
  const userId = await requireUserId(request);

  // Recent audit-log entries for the operator's own actions + their projects.
  // Defensive: the AuditLog table may not exist yet (run the schema sync first).
  let auditLogs: Array<{ id: string; action: string; target: string | null; projectId: string | null; ip: string | null; createdAt: string }> = [];
  try {
    const projects = await prisma.project.findMany({ where: { userId }, select: { id: true } });
    const projectIds = projects.map((p) => p.id);
    const rows = await prisma.auditLog.findMany({
      where: { OR: [{ userId }, { projectId: { in: projectIds } }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    auditLogs = rows as any;
  } catch (e: any) {
    console.error("[Admin] audit fetch failed (table may not exist yet):", e?.message);
  }

  return json({ ok: true, auditLogs });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  const fd = await request.formData();
  if (fd.get("intent") !== "sync-schema") {
    return json({ error: "Unknown action" }, { status: 400 });
  }
  try {
    const result = await applyPendingSchema();
    return json({ result });
  } catch (err: any) {
    console.error("[Admin] schema sync failed:", err?.message);
    return json({ error: err?.message || "Schema sync failed." }, { status: 500 });
  }
}

export default function AdminPage() {
  const data = useActionData<typeof action>() as
    | { result?: Awaited<ReturnType<typeof applyPendingSchema>>; error?: string }
    | undefined;
  const { auditLogs } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const result = data?.result;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-blue-600" /> Admin
      </h1>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-gray-700" /> Database schema sync
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Applies any committed migrations the production database hasn't received yet — directly,
          without the GitHub Actions migration job. Only runs the additive, idempotent migration SQL
          we ship (create-if-not-exists tables/columns); it never drops or rewrites data, and is safe
          to run more than once. Use this to clear schema drift (e.g. the "Database Connection Offline"
          error) and to create the <code className="text-xs bg-gray-100 px-1 rounded">ProjectAction</code> table
          that powers AI Actions.
        </p>

        <Form method="post" className="mt-4">
          <input type="hidden" name="intent" value="sync-schema" />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {busy ? "Applying migrations…" : "Sync database schema"}
          </button>
        </Form>

        {data?.error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {data.error}
          </div>
        )}

        {result && (
          <div className="mt-5">
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
              {result.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {result.ok
                ? `Schema is up to date. Processed ${result.reports.length} migration(s).`
                : `Completed with some errors — see details below.`}
            </div>

            <div className="mt-4 space-y-2">
              {result.reports.map((r) => (
                <div key={r.migration} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-gray-800">{r.migration}</span>
                    <span className="text-xs text-gray-500">
                      {r.applied} applied · {r.skipped} already present
                      {r.errors.length > 0 && <span className="text-red-600"> · {r.errors.length} error(s)</span>}
                    </span>
                  </div>
                  {r.errors.map((e, i) => (
                    <pre key={i} className="mt-2 text-[11px] text-red-600 bg-red-50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                      {e.error}
                      {"\n"}— {e.statement}
                    </pre>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-gray-700" /> Audit log
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Recent security-relevant actions — API keys, team members, integrations, settings, and deletions.
        </p>

        {auditLogs.length === 0 ? (
          <div className="mt-4 text-sm text-gray-400 text-center py-8 rounded-xl border border-dashed border-gray-300">
            No audit entries yet. Actions you take (or your team takes) will appear here.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-4 font-semibold">When</th>
                  <th className="py-2 pr-4 font-semibold">Action</th>
                  <th className="py-2 pr-4 font-semibold">Target</th>
                  <th className="py-2 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{log.action}</span></td>
                    <td className="py-2 pr-4 text-gray-700 truncate max-w-[220px]">{log.target || "—"}</td>
                    <td className="py-2 text-gray-400 font-mono text-xs">{log.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
