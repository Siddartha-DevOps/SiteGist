import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { ChevronLeft, Plus, Trash2, MessageSquare } from "lucide-react";
import { useState } from "react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    select: { id: true, name: true },
  });
  if (!project) return redirect("/dashboard");

  const cannedResponses = await prisma.cannedResponse.findMany({
    where: { projectId: project.id },
    orderBy: { title: "asc" },
  });

  return json({ project, cannedResponses });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    select: { id: true },
  });
  if (!project) return json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  if (_action === "create") {
    const title = (formData.get("title") as string)?.trim();
    const body = (formData.get("body") as string)?.trim();
    if (!title || !body) return json({ error: "Title and body are required" }, { status: 400 });
    await prisma.cannedResponse.create({
      data: { projectId: project.id, title, body },
    });
    return json({ success: true });
  }

  if (_action === "delete") {
    const id = formData.get("id") as string;
    await prisma.cannedResponse.deleteMany({
      where: { id, projectId: project.id },
    });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function CannedResponses() {
  const { project, cannedResponses } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const deleteFetcher = useFetcher();
  const [showForm, setShowForm] = useState(cannedResponses.length === 0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    createFetcher.submit(
      { _action: "create", title, body },
      { method: "post" }
    );
    setTitle("");
    setBody("");
    setShowForm(false);
  };

  return (
    <div className="max-w-3xl">
      <Link
        to={`/dashboard/projects/${project.id}`}
        className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> Back to project
      </Link>

      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black mb-1">Canned Responses</h1>
          <p className="text-text-muted text-sm">
            Quick-reply templates for your support agents in the inbox.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Add Response
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white p-6 rounded-[24px] border border-zinc-100 shadow-sm mb-6 space-y-4"
        >
          <h2 className="font-bold text-lg">New Canned Response</h2>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
              Title / Shortcut
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Greeting, Pricing, Refund Policy"
              required
              className="w-full px-4 py-3 border border-brand-border rounded-xl outline-none focus:border-primary transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
              Response Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type the full response text…"
              required
              rows={5}
              className="w-full px-4 py-3 border border-brand-border rounded-xl outline-none focus:border-primary transition-colors text-sm resize-none"
            />
          </div>
          {createFetcher.data?.error && (
            <p className="text-xs text-red-500 font-bold">{createFetcher.data.error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createFetcher.state === "submitting" || !title.trim() || !body.trim()}
              className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-black hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createFetcher.state === "submitting" ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {cannedResponses.length === 0 && !showForm ? (
        <div className="bg-white p-12 rounded-[32px] border border-zinc-100 text-center">
          <div className="w-14 h-14 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="font-bold text-lg mb-2">No canned responses yet</h3>
          <p className="text-sm text-zinc-500 mb-6">
            Create quick-reply templates to speed up your support agents.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Add First Response
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {cannedResponses.map((cr) => (
            <div
              key={cr.id}
              className="bg-white p-6 rounded-[24px] border border-zinc-100 shadow-sm hover:border-primary/20 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm mb-2 text-zinc-800">{cr.title}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed whitespace-pre-wrap line-clamp-3">
                    {cr.body}
                  </p>
                </div>
                <deleteFetcher.Form method="post">
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={cr.id} />
                  <button
                    type="submit"
                    className="p-2 rounded-xl text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </deleteFetcher.Form>
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-4 border-2 border-dashed border-zinc-200 rounded-[24px] text-sm font-bold text-zinc-400 hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Another
          </button>
        </div>
      )}
    </div>
  );
}
