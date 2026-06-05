import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useFetcher, Form } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { useState } from "react";
import {
  ChevronLeft, Mail, Phone, Building2, Calendar,
  MessageSquare, Tag, X, Trash2, Star, User, Bot
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  new:       { label: "New",       bg: "bg-blue-50",   text: "text-blue-600",   border: "border-blue-100" },
  contacted: { label: "Contacted", bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-100" },
  qualified: { label: "Qualified", bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" },
  converted: { label: "Converted", bg: "bg-green-50",  text: "text-green-600",  border: "border-green-100" },
};

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });
  if (!project) return redirect("/dashboard");

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  if (_action === "update_status") {
    const status = formData.get("status") as string;
    await prisma.lead.update({ where: { id: params.leadId }, data: { status } });
    return json({ success: true });
  }

  if (_action === "save_notes") {
    const notes = formData.get("notes") as string;
    await prisma.lead.update({ where: { id: params.leadId }, data: { notes } });
    return json({ success: true });
  }

  if (_action === "toggle_star") {
    const lead = await prisma.lead.findUnique({ where: { id: params.leadId } });
    await prisma.lead.update({
      where: { id: params.leadId },
      data: { isStarred: !lead!.isStarred },
    });
    return json({ success: true });
  }

  if (_action === "add_tag") {
    const label = (formData.get("label") as string)?.trim().toLowerCase();
    const color = (formData.get("color") as string) || "#6366f1";
    if (!label) return json({ error: "Label required" }, { status: 400 });
    await prisma.leadTag.upsert({
      where: { leadId_label: { leadId: params.leadId!, label } },
      create: { leadId: params.leadId!, label, color },
      update: {},
    });
    return json({ success: true });
  }

  if (_action === "remove_tag") {
    const tagId = formData.get("tagId") as string;
    await prisma.leadTag.delete({ where: { id: tagId } });
    return json({ success: true });
  }

  if (_action === "delete") {
    await prisma.lead.delete({ where: { id: params.leadId } });
    return redirect(`/dashboard/projects/${params.projectId}/leads`);
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });
  if (!project) return redirect("/dashboard");

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: {
      tags: { orderBy: { createdAt: "asc" } },
      session: {
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!lead || lead.projectId !== params.projectId) {
    return redirect(`/dashboard/projects/${params.projectId}/leads`);
  }

  return json({ lead, project });
}

export default function LeadDetail() {
  const { lead, project } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;

  return (
    <div className="max-w-5xl pb-20">
      {/* Back nav */}
      <Link
        to={`/dashboard/projects/${project.id}/leads`}
        className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> Back to leads
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN — Contact info, status, tags, notes, actions */}
        <div className="space-y-6">

          {/* Contact card */}
          <div className="bg-white border border-zinc-100 rounded-[32px] p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-brand-dark">
                  {lead.name || "Unknown"}
                </h1>
                <p className="text-text-muted text-sm mt-1">
                  {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                </p>
              </div>
              {/* Star button */}
              <fetcher.Form method="post">
                <input type="hidden" name="_action" value="toggle_star" />
                <button
                  type="submit"
                  className={`p-2.5 rounded-xl border transition-all ${
                    lead.isStarred
                      ? "bg-yellow-50 border-yellow-200 text-yellow-500"
                      : "bg-zinc-50 border-zinc-100 text-zinc-400 hover:bg-zinc-100"
                  }`}
                >
                  <Star className="w-4 h-4" fill={lead.isStarred ? "currentColor" : "none"} />
                </button>
              </fetcher.Form>
            </div>

            <div className="space-y-3">
              {lead.email && (
                <div className="flex items-center gap-3 text-sm text-brand-dark">
                  <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="font-medium">{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3 text-sm text-brand-dark">
                  <Phone className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="font-medium">{lead.phone}</span>
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-3 text-sm text-brand-dark">
                  <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="font-medium">{lead.company}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-brand-dark">
                <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="font-medium">
                  {format(new Date(lead.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </div>

          {/* Status card */}
          <div className="bg-white border border-zinc-100 rounded-[32px] p-6">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">
              Lead Status
            </h3>
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="update_status" />
              <select
                name="status"
                defaultValue={lead.status}
                onChange={(e) => {
                  const form = e.currentTarget.closest("form") as HTMLFormElement;
                  const fd = new FormData(form);
                  fd.set("status", e.target.value);
                  fetcher.submit(fd, { method: "post" });
                }}
                className={`w-full text-sm font-black px-4 py-3 rounded-xl border cursor-pointer outline-none ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
              </select>
            </fetcher.Form>
          </div>

          {/* Tags card */}
          <div className="bg-white border border-zinc-100 rounded-[32px] p-6">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {lead.tags.map((tag: any) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest"
                  style={{ backgroundColor: tag.color + "20", color: tag.color, border: `1px solid ${tag.color}40` }}
                >
                  {tag.label}
                  <fetcher.Form method="post" className="inline">
                    <input type="hidden" name="_action" value="remove_tag" />
                    <input type="hidden" name="tagId" value={tag.id} />
                    <button type="submit" className="ml-0.5 hover:opacity-60">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </fetcher.Form>
                </span>
              ))}
            </div>
            {showTagInput ? (
              <fetcher.Form
                method="post"
                onSubmit={() => { setShowTagInput(false); setTagInput(""); }}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="_action" value="add_tag" />
                <input
                  name="label"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="tag name"
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-xs border border-brand-border rounded-xl outline-none focus:border-primary"
                />
                <button type="submit" className="text-xs font-black text-primary hover:underline">Add</button>
                <button type="button" onClick={() => setShowTagInput(false)} className="text-xs text-zinc-400">✕</button>
              </fetcher.Form>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="text-xs font-black text-zinc-400 hover:text-primary transition-colors flex items-center gap-1"
              >
                <Tag className="w-3 h-3" /> Add tag
              </button>
            )}
          </div>

          {/* Custom Answers card */}
          {lead.notes && (() => {
            try {
              const custom = JSON.parse(lead.notes);
              const entries = Object.entries(custom);
              if (entries.length === 0) return null;
              return (
                <div className="bg-white border border-zinc-100 rounded-[32px] p-6 space-y-4">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                    Form Submissions
                  </h3>
                  <div className="space-y-3.5 divide-y divide-zinc-50">
                    {entries.map(([label, value], i) => (
                      <div key={label} className={`text-sm ${i > 0 ? "pt-3" : ""}`}>
                        <span className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wide mb-0.5">{label}</span>
                        <span className="font-bold text-brand-dark">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            } catch {
              return null;
            }
          })()}

          {/* Notes card */}
          <div className="bg-white border border-zinc-100 rounded-[32px] p-6">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">
              Notes
            </h3>
            <Form method="post">
              <input type="hidden" name="_action" value="save_notes" />
              <textarea
                name="notes"
                defaultValue={lead.notes || ""}
                placeholder="Add notes about this lead..."
                rows={4}
                className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors resize-none bg-zinc-50 text-brand-dark placeholder:text-brand-gray/40"
              />
              <button
                type="submit"
                className="mt-3 w-full py-2.5 bg-primary text-white text-xs font-black rounded-xl uppercase tracking-widest hover:bg-primary/90 transition-all"
              >
                Save Notes
              </button>
            </Form>
          </div>

          {/* Delete */}
          <Form
            method="post"
            onSubmit={(e) => {
              if (!confirm("Permanently delete this lead? This cannot be undone.")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="_action" value="delete" />
            <button
              type="submit"
              className="w-full py-2.5 bg-red-50 text-red-500 border border-red-100 text-xs font-black rounded-xl uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Lead
            </button>
          </Form>
        </div>

        {/* RIGHT COLUMN — Conversation transcript */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-zinc-100 rounded-[32px] p-8 h-full">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" /> Conversation Transcript
            </h2>

            {lead.session ? (
              <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                {lead.session.messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div className="max-w-[80%]">
                      <div className="flex items-center gap-2 mb-1.5">
                        {msg.role === "user"
                          ? <User className="w-3 h-3 text-zinc-400" />
                          : <Bot className="w-3 h-3 text-primary" />
                        }
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                          {msg.role === "user" ? (lead.name || "Visitor") : "SiteGist AI"}
                        </span>
                        <span className="text-[10px] text-zinc-300">
                          {format(new Date(msg.createdAt), "h:mm a")}
                        </span>
                      </div>
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-zinc-50 border border-zinc-100 text-zinc-800 rounded-bl-none"
                          : "bg-primary text-white rounded-br-none"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="text-zinc-300 w-8 h-8" />
                </div>
                <p className="font-bold text-brand-dark mb-2">No transcript available</p>
                <p className="text-sm text-text-muted">
                  This lead was captured without a linked chat session.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
