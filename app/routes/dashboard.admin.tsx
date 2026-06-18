import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { requireOwner } from "~/backend/auth.server";
import { applyPendingSchema } from "~/backend/schema-sync.server";
import { Database, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOwner(request);
  return json({ ok: true });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireOwner(request);
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
    </div>
  );
}
