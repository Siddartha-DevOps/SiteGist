import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, Link, useNavigation, useActionData } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { ArrowLeft, Plus, Trash2, Zap, Loader2, Power, Pencil, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,48}$/;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const projectId = params.projectId;
  if (!projectId) throw new Response("Not Found", { status: 404 });

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [{ userId }, { members: { some: { email: user?.email || "" } } }],
      },
      select: { id: true, name: true, userId: true },
    });
    if (!project) return redirect("/dashboard");

    const actions = await prisma.projectAction.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return json({ project, actions });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("[Actions] loader DB error:", error?.message);
    throw json(
      { dbError: true, message: error?.message || "Failed to load actions from the database." },
      { status: 503 }
    );
  }
}

function parseJsonField(raw: string | null, label: string): { value: any | null; error?: string } {
  if (!raw || !raw.trim()) return { value: null };
  try {
    const v = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return { value: null, error: `${label} must be a JSON object.` };
    return { value: v };
  } catch {
    return { value: null, error: `${label} is not valid JSON.` };
  }
}

export async function action({ params, request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const projectId = params.projectId;
  if (!projectId) return json({ error: "No project specified" }, { status: 400 });

  // Only the owner or an ADMIN member may manage actions (they can carry secrets).
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ userId }, { members: { some: { email: user?.email || "", role: "ADMIN" } } }],
    },
    select: { id: true },
  });
  if (!project) return json({ error: "Unauthorized to manage actions for this project" }, { status: 403 });

  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "delete") {
    const id = fd.get("id") as string;
    await prisma.projectAction.deleteMany({ where: { id, projectId } });
    return json({ ok: true });
  }

  if (intent === "toggle") {
    const id = fd.get("id") as string;
    const existing = await prisma.projectAction.findFirst({ where: { id, projectId } });
    if (existing) {
      await prisma.projectAction.update({ where: { id }, data: { enabled: !existing.enabled } });
    }
    return json({ ok: true });
  }

  if (intent === "create" || intent === "update") {
    const name = ((fd.get("name") as string) || "").trim();
    const description = ((fd.get("description") as string) || "").trim();
    const method = ((fd.get("method") as string) || "GET").toUpperCase();
    const urlTemplate = ((fd.get("urlTemplate") as string) || "").trim();
    const bodyTemplate = ((fd.get("bodyTemplate") as string) || "").trim() || null;
    const timeoutMs = Math.min(Math.max(parseInt((fd.get("timeoutMs") as string) || "8000", 10) || 8000, 1000), 15000);

    if (!NAME_RE.test(name)) {
      return json({ error: "Name must start with a letter and contain only letters, numbers, or underscores (max 49 chars)." }, { status: 400 });
    }
    if (!description) return json({ error: "Description is required — it tells the AI when to use this action." }, { status: 400 });
    if (!METHODS.includes(method)) return json({ error: "Invalid HTTP method." }, { status: 400 });
    if (!/^https?:\/\//i.test(urlTemplate)) return json({ error: "URL must start with http:// or https://" }, { status: 400 });

    const params_ = parseJsonField(fd.get("parameters") as string, "Parameters (JSON Schema)");
    if (params_.error) return json({ error: params_.error }, { status: 400 });
    const headers_ = parseJsonField(fd.get("headers") as string, "Headers");
    if (headers_.error) return json({ error: headers_.error }, { status: 400 });

    const data = {
      name, description, method, urlTemplate, bodyTemplate, timeoutMs,
      parameters: params_.value, headers: headers_.value,
    };

    try {
      if (intent === "update") {
        const id = fd.get("id") as string;
        await prisma.projectAction.updateMany({ where: { id, projectId }, data });
      } else {
        await prisma.projectAction.create({ data: { projectId, enabled: true, ...data } });
      }
    } catch (e: any) {
      if (e?.code === "P2002") return json({ error: `An action named "${name}" already exists.` }, { status: 400 });
      throw e;
    }
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

type ActionRow = ReturnType<typeof useLoaderData<typeof loader>>["actions"][number];

export default function ProjectActions() {
  const { project, actions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { ok?: boolean; error?: string } | undefined;
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  const [editing, setEditing] = useState<ActionRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Collapse the form after a successful save.
  useEffect(() => {
    if (actionData?.ok) { setShowForm(false); setEditing(null); }
  }, [actionData]);

  const startEdit = (a: ActionRow) => { setEditing(a); setShowForm(true); };
  const startNew = () => { setEditing(null); setShowForm(true); };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to={`/dashboard/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to {project.name}
      </Link>

      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-600" /> AI Actions
          </h1>
          <p className="text-gray-500 mt-1 text-sm max-w-2xl">
            Let your chatbot do more than answer — call your APIs at chat time to look up an order,
            book a demo, or fetch live data, then reply grounded in the result.
          </p>
        </div>
        {!showForm && (
          <button onClick={startNew} className="shrink-0 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New action
          </button>
        )}
      </div>

      {actionData?.error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {actionData.error}
        </div>
      )}
      {actionData?.ok && !showForm && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4" /> Saved.
        </div>
      )}

      {showForm && (
        <Form method="post" className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{editing ? "Edit action" : "New action"}</h2>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="block text-gray-700 font-medium mb-1">Function name</span>
              <input name="name" defaultValue={editing?.name} placeholder="lookup_order" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700 font-medium mb-1">HTTP method</span>
              <select name="method" defaultValue={editing?.method || "GET"} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>

          <label className="text-sm block">
            <span className="block text-gray-700 font-medium mb-1">Description (tells the AI when to use it)</span>
            <input name="description" defaultValue={editing?.description} required
              placeholder="Look up the status of a customer's order by their order ID."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>

          <label className="text-sm block">
            <span className="block text-gray-700 font-medium mb-1">URL template</span>
            <input name="urlTemplate" defaultValue={editing?.urlTemplate} required
              placeholder="https://api.yourshop.com/orders/{orderId}"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm" />
            <span className="text-xs text-gray-400">Use {"{paramName}"} placeholders — they are filled from the parameters below.</span>
          </label>

          <label className="text-sm block">
            <span className="block text-gray-700 font-medium mb-1">Parameters — JSON Schema (optional)</span>
            <textarea name="parameters" rows={5} defaultValue={editing?.parameters ? JSON.stringify(editing.parameters, null, 2) : ""}
              placeholder={'{\n  "type": "object",\n  "properties": { "orderId": { "type": "string", "description": "The order ID" } },\n  "required": ["orderId"]\n}'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs" />
          </label>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm block">
              <span className="block text-gray-700 font-medium mb-1">Headers — JSON (optional, kept server-side)</span>
              <textarea name="headers" rows={3} defaultValue={editing?.headers ? JSON.stringify(editing.headers, null, 2) : ""}
                placeholder={'{ "Authorization": "Bearer YOUR_API_KEY" }'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs" />
            </label>
            <label className="text-sm block">
              <span className="block text-gray-700 font-medium mb-1">Body template (optional, non-GET)</span>
              <textarea name="bodyTemplate" rows={3} defaultValue={editing?.bodyTemplate || ""}
                placeholder={'{ "email": "{email}", "topic": "{topic}" }'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs" />
            </label>
          </div>

          <label className="text-sm block max-w-[200px]">
            <span className="block text-gray-700 font-medium mb-1">Timeout (ms)</span>
            <input name="timeoutMs" type="number" min={1000} max={15000} defaultValue={editing?.timeoutMs || 8000}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? "Save changes" : "Create action"}
            </button>
          </div>
        </Form>
      )}

      <div className="mt-8 space-y-3">
        {actions.length === 0 && !showForm && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-gray-300 text-gray-400">
            <Zap className="w-8 h-8 mx-auto mb-3 opacity-50" />
            No actions yet. Create one to let your chatbot call your APIs.
          </div>
        )}
        {actions.map((a) => (
          <div key={a.id} className="rounded-2xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-gray-900">{a.name}</span>
                <span className="text-[11px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{a.method}</span>
                {!a.enabled && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">disabled</span>}
              </div>
              <p className="text-sm text-gray-600 mt-1">{a.description}</p>
              <p className="text-xs text-gray-400 font-mono mt-1 truncate">{a.urlTemplate}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Form method="post">
                <input type="hidden" name="intent" value="toggle" />
                <input type="hidden" name="id" value={a.id} />
                <button title={a.enabled ? "Disable" : "Enable"} className={`p-2 rounded-lg hover:bg-gray-100 ${a.enabled ? "text-green-600" : "text-gray-400"}`}>
                  <Power className="w-4 h-4" />
                </button>
              </Form>
              <button onClick={() => startEdit(a)} title="Edit" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                <Pencil className="w-4 h-4" />
              </button>
              <Form method="post" onSubmit={(e) => { if (!confirm(`Delete action "${a.name}"?`)) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={a.id} />
                <button title="Delete" className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </Form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
