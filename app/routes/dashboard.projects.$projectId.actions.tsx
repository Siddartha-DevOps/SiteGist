import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { useState } from "react";
import { Zap, Plus, Trash2, Loader2, ChevronLeft, Globe, Settings, ChevronDown, ChevronUp } from "lucide-react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });
  if (!project) return redirect("/dashboard");

  const actions = await prisma.aiAction.findMany({
    where: { projectId: params.projectId! },
    orderBy: { createdAt: "asc" },
  });

  return json({ project, actions });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });
  if (!project) return json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  if (_action === "create") {
    const name = (formData.get("name") as string || "").trim().replace(/\s+/g, "_").toLowerCase();
    const description = (formData.get("description") as string || "").trim();
    const endpoint = (formData.get("endpoint") as string || "").trim();
    const method = (formData.get("method") as string || "POST").trim().toUpperCase();
    const headersRaw = (formData.get("headers") as string || "").trim();
    const paramsRaw = (formData.get("parameters") as string || "[]").trim();

    if (!name || !description || !endpoint) {
      return json({ error: "Name, description, and endpoint are required" });
    }

    let parameters: unknown[] = [];
    try {
      parameters = JSON.parse(paramsRaw);
      if (!Array.isArray(parameters)) parameters = [];
    } catch {
      parameters = [];
    }

    let headers: Record<string, string> | null = null;
    if (headersRaw) {
      try {
        headers = JSON.parse(headersRaw);
      } catch {
        return json({ error: "Headers must be valid JSON (e.g. {\"Authorization\": \"Bearer token\"})" });
      }
    }

    await prisma.aiAction.create({
      data: {
        projectId: project.id,
        name,
        description,
        parameters,
        endpoint,
        method,
        headers,
      },
    });

    return json({ success: true });
  }

  if (_action === "toggle") {
    const id = formData.get("id") as string;
    const current = await prisma.aiAction.findFirst({ where: { id, projectId: project.id } });
    if (!current) return json({ error: "Not found" }, { status: 404 });
    await prisma.aiAction.update({ where: { id }, data: { enabled: !current.enabled } });
    return json({ success: true });
  }

  if (_action === "delete") {
    const id = formData.get("id") as string;
    await prisma.aiAction.deleteMany({ where: { id, projectId: project.id } });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const PARAM_TYPES = ["string", "number", "boolean"];

interface ParamRow {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

function ParamEditor({ initial }: { initial?: ParamRow[] }) {
  const [rows, setRows] = useState<ParamRow[]>(initial || []);

  const add = () => setRows(r => [...r, { name: "", type: "string", description: "", required: false }]);
  const remove = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof ParamRow, val: string | boolean) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  return (
    <div>
      <input type="hidden" name="parameters" value={JSON.stringify(rows)} />
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input
              type="text"
              placeholder="param_name"
              value={row.name}
              onChange={e => update(i, "name", e.target.value)}
              className="input text-sm flex-shrink-0 w-32"
            />
            <select
              value={row.type}
              onChange={e => update(i, "type", e.target.value)}
              className="input text-sm flex-shrink-0 w-24"
            >
              {PARAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="text"
              placeholder="Description for the AI"
              value={row.description}
              onChange={e => update(i, "description", e.target.value)}
              className="input text-sm flex-1 min-w-0"
            />
            <label className="flex items-center gap-1 text-xs text-zinc-500 flex-shrink-0 mt-2">
              <input
                type="checkbox"
                checked={row.required}
                onChange={e => update(i, "required", e.target.checked)}
                className="rounded"
              />
              req
            </label>
            <button type="button" onClick={() => remove(i)} className="text-zinc-400 hover:text-red-500 mt-1.5 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 text-xs text-primary font-semibold hover:underline flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add parameter
      </button>
    </div>
  );
}

export default function ProjectActionsPage() {
  const { project, actions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-8">
        <Link
          to={`/dashboard/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back to project
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black">AI Actions</h1>
              <p className="text-sm text-text-muted">Let your chatbot execute real-time actions via HTTP webhooks</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Action
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-zinc-100 rounded-[28px] p-8 mb-8 shadow-sm">
          <h2 className="text-lg font-black mb-6">Create AI Action</h2>
          {actionData && "error" in actionData && actionData.error && (
            <p className="text-red-600 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{actionData.error}</p>
          )}
          <Form method="post" className="space-y-5">
            <input type="hidden" name="_action" value="create" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="label">Action name <span className="text-zinc-400 font-normal">(snake_case)</span></label>
                <input
                  name="name"
                  required
                  placeholder="book_appointment"
                  className="input"
                />
                <p className="text-[11px] text-zinc-400 mt-1">Used as the function name for the AI. Letters, digits, underscores only.</p>
              </div>
              <div>
                <label className="label">HTTP method</label>
                <select name="method" className="input">
                  {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Description <span className="text-zinc-400 font-normal">(tell the AI when to use this)</span></label>
              <input
                name="description"
                required
                placeholder="Book a meeting or appointment for the user"
                className="input"
              />
            </div>
            <div>
              <label className="label">Endpoint URL</label>
              <input
                name="endpoint"
                required
                type="url"
                placeholder="https://your-app.com/api/book"
                className="input"
              />
            </div>
            <div>
              <label className="label">Parameters</label>
              <ParamEditor />
              <p className="text-[11px] text-zinc-400 mt-1">
                These become the JSON body (POST/PUT/PATCH) or query params (GET/DELETE).
              </p>
            </div>
            <div>
              <label className="label">
                Request headers <span className="text-zinc-400 font-normal">(optional JSON)</span>
              </label>
              <textarea
                name="headers"
                rows={2}
                placeholder='{"Authorization": "Bearer secret123", "X-Source": "sitegist"}'
                className="input font-mono text-xs"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Action
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline">
                Cancel
              </button>
            </div>
          </Form>
        </div>
      )}

      {/* Actions list */}
      {actions.length === 0 ? (
        <div className="bg-white border border-zinc-100 rounded-[28px] p-16 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-black mb-2">No AI actions yet</h3>
          <p className="text-text-muted text-sm max-w-sm mx-auto mb-6">
            AI actions let your chatbot trigger real-world operations — book meetings, look up order status, submit forms — by calling your API.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create your first action
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((act) => {
            const params = (act.parameters as any[]) || [];
            const isExpanded = expandedId === act.id;
            return (
              <div key={act.id} className="bg-white border border-zinc-100 rounded-[20px] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${act.enabled ? "bg-primary/10" : "bg-zinc-100"}`}>
                      <Zap className={`w-4 h-4 ${act.enabled ? "text-primary" : "text-zinc-400"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black font-mono text-sm">{act.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-bold uppercase">{act.method}</span>
                        {!act.enabled && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">disabled</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{act.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : act.id)}
                      className="text-zinc-400 hover:text-zinc-700 p-1"
                      title="Details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="toggle" />
                      <input type="hidden" name="id" value={act.id} />
                      <button
                        type="submit"
                        className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${act.enabled ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                      >
                        {act.enabled ? "Disable" : "Enable"}
                      </button>
                    </Form>
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="id" value={act.id} />
                      <button
                        type="submit"
                        className="text-zinc-400 hover:text-red-500 p-1 transition-colors"
                        onClick={e => { if (!confirm(`Delete action "${act.name}"?`)) e.preventDefault(); }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Form>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-100 px-6 py-4 bg-zinc-50 text-sm space-y-3">
                    <div>
                      <span className="font-semibold text-zinc-500 text-xs uppercase tracking-wide">Endpoint</span>
                      <p className="font-mono text-xs mt-0.5 break-all">{act.endpoint}</p>
                    </div>
                    {params.length > 0 && (
                      <div>
                        <span className="font-semibold text-zinc-500 text-xs uppercase tracking-wide">Parameters</span>
                        <div className="mt-1 space-y-1">
                          {params.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 font-mono text-xs">
                              <span className="text-primary font-bold">{p.name}</span>
                              <span className="text-zinc-400">{p.type}</span>
                              {p.required && <span className="text-red-500 text-[10px]">required</span>}
                              <span className="text-zinc-500">— {p.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {act.headers && (
                      <div>
                        <span className="font-semibold text-zinc-500 text-xs uppercase tracking-wide">Headers</span>
                        <pre className="text-xs mt-0.5 font-mono text-zinc-600 whitespace-pre-wrap">
                          {JSON.stringify(act.headers, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
        <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4" /> How AI Actions work
        </h3>
        <ul className="text-sm text-blue-800 space-y-1.5 list-disc list-inside">
          <li>The AI decides when to call an action based on the description you provide.</li>
          <li>It collects the required parameters from the conversation context.</li>
          <li>SiteGist sends an HTTP request to your endpoint with the collected data.</li>
          <li>The response is passed back to the AI, which summarises the result for the user.</li>
          <li>Actions run in real-time during the chat — keep endpoints fast (&lt;5s).</li>
        </ul>
      </div>
    </div>
  );
}
