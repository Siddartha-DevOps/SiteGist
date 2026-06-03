import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useFetcher, useSearchParams } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import React, { useState } from "react";
import {
  ChevronLeft, Search, Star, Archive, Trash2, Download,
  Mail, Phone, Building2, Calendar, ChevronRight,
  CheckSquare, Square, Users, Tag
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });
  if (!project) return redirect("/dashboard");

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  // CSV Export — returns file download
  if (_action === "export_csv") {
    const leads = await prisma.lead.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
    });
    const rows = [
      ["Name", "Email", "Phone", "Company", "Status", "Date"].join(","),
      ...leads.map((l) =>
        [
          `"${l.name || ""}"`,
          `"${l.email || ""}"`,
          `"${l.phone || ""}"`,
          `"${l.company || ""}"`,
          `"${l.status}"`,
          `"${new Date(l.createdAt).toISOString()}"`,
        ].join(",")
      ),
    ].join("\n");
    return new Response(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leads-${params.projectId}.csv"`,
      },
    });
  }

  const leadId = formData.get("leadId") as string;

  // Single lead actions
  if (_action === "toggle_star" && leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return json({ error: "Not found" }, { status: 404 });
    await prisma.lead.update({
      where: { id: leadId },
      data: { isStarred: !lead.isStarred },
    });
    return json({ success: true });
  }

  if (_action === "toggle_archive" && leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return json({ error: "Not found" }, { status: 404 });
    await prisma.lead.update({
      where: { id: leadId },
      data: { isArchived: !lead.isArchived },
    });
    return json({ success: true });
  }

  if (_action === "update_status" && leadId) {
    const status = formData.get("status") as string;
    await prisma.lead.update({ where: { id: leadId }, data: { status } });
    return json({ success: true });
  }

  if (_action === "delete" && leadId) {
    await prisma.lead.delete({ where: { id: leadId } });
    return json({ success: true });
  }

  // Bulk actions
  const selectedIds = formData.getAll("selectedIds") as string[];
  if (selectedIds.length === 0) return json({ error: "No leads selected" }, { status: 400 });

  if (_action === "bulk_star") {
    await prisma.lead.updateMany({
      where: { id: { in: selectedIds }, projectId: params.projectId },
      data: { isStarred: true },
    });
    return json({ success: true });
  }
  if (_action === "bulk_unstar") {
    await prisma.lead.updateMany({
      where: { id: { in: selectedIds }, projectId: params.projectId },
      data: { isStarred: false },
    });
    return json({ success: true });
  }
  if (_action === "bulk_archive") {
    await prisma.lead.updateMany({
      where: { id: { in: selectedIds }, projectId: params.projectId },
      data: { isArchived: true },
    });
    return json({ success: true });
  }
  if (_action === "bulk_unarchive") {
    await prisma.lead.updateMany({
      where: { id: { in: selectedIds }, projectId: params.projectId },
      data: { isArchived: false },
    });
    return json({ success: true });
  }
  if (_action === "bulk_delete") {
    await prisma.lead.deleteMany({
      where: { id: { in: selectedIds }, projectId: params.projectId },
    });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });
  if (!project) return redirect("/dashboard");

  const url = new URL(request.url);
  const activeFilter = url.searchParams.get("filter") || "open";

  const where: any = { projectId: params.projectId };
  if (activeFilter === "open")     { where.isArchived = false; }
  if (activeFilter === "starred")  { where.isStarred = true; where.isArchived = false; }
  if (activeFilter === "archived") { where.isArchived = true; }
  if (activeFilter === "new")      { where.status = "new"; where.isArchived = false; }
  if (activeFilter === "contacted"){ where.status = "contacted"; where.isArchived = false; }
  if (activeFilter === "qualified"){ where.status = "qualified"; where.isArchived = false; }
  if (activeFilter === "converted"){ where.status = "converted"; where.isArchived = false; }

  const leads = await prisma.lead.findMany({
    where,
    include: { tags: true },
    orderBy: { createdAt: "desc" },
  });

  const totalCount = await prisma.lead.count({ where: { projectId: params.projectId } });

  return json({ leads, project, activeFilter, totalCount });
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  new:       { label: "New",       bg: "bg-blue-50",   text: "text-blue-600",   border: "border-blue-100" },
  contacted: { label: "Contacted", bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-100" },
  qualified: { label: "Qualified", bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" },
  converted: { label: "Converted", bg: "bg-green-50",  text: "text-green-600",  border: "border-green-100" },
};

export default function ProjectLeads() {
  const { leads, project, activeFilter, totalCount } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fetcher = useFetcher();

  const filterTabs = [
    { label: "All Open",  value: "open"      },
    { label: "Starred",   value: "starred"   },
    { label: "Archived",  value: "archived"  },
    { label: "New",       value: "new"       },
    { label: "Contacted", value: "contacted" },
    { label: "Qualified", value: "qualified" },
    { label: "Converted", value: "converted" },
  ];

  const filtered = leads.filter(
    (l: any) =>
      search === "" ||
      (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every((l: any) => selectedIds.includes(l.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(filtered.map((l: any) => l.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-6xl pb-20">
      {/* Header */}
      <Link
        to={`/dashboard/projects/${project.id}`}
        className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> Back to project
      </Link>

      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black mb-1">Leads</h1>
          <p className="text-text-muted font-medium">
            {totalCount} total lead{totalCount !== 1 ? "s" : ""} captured
          </p>
        </div>
        <fetcher.Form method="post">
          <input type="hidden" name="_action" value="export_csv" />
          <button
            type="submit"
            className="inline-flex items-center gap-2 border border-brand-border text-brand-gray rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-brand-light transition-all"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </fetcher.Form>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray/40" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedIds([]); }}
          className="w-full pl-11 pr-4 py-3 text-sm font-medium border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setSearchParams({ filter: tab.value }); setSelectedIds([]); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
              activeFilter === tab.value
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "bg-brand-light text-brand-gray hover:text-brand-dark border border-brand-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bulk action toolbar — visible when items are selected */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
          <span className="text-xs font-black text-primary uppercase tracking-widest">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2 ml-auto">
            {[
              { label: "Star",      action: "bulk_star"      },
              { label: "Unstar",    action: "bulk_unstar"    },
              { label: "Archive",   action: "bulk_archive"   },
              { label: "Unarchive", action: "bulk_unarchive" },
            ].map((btn) => (
              <fetcher.Form method="post" key={btn.action}>
                <input type="hidden" name="_action" value={btn.action} />
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="selectedIds" value={id} />
                ))}
                <button
                  type="submit"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 text-xs font-black border border-brand-border text-brand-gray rounded-xl hover:bg-white transition-all uppercase tracking-widest"
                >
                  {btn.label}
                </button>
              </fetcher.Form>
            ))}
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="bulk_delete" />
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="selectedIds" value={id} />
              ))}
              <button
                type="submit"
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 text-xs font-black bg-red-50 border border-red-100 text-red-500 rounded-xl hover:bg-red-100 transition-all uppercase tracking-widest"
              >
                Delete
              </button>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Leads table */}
      <div className="bg-white border border-zinc-100 rounded-[40px] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Users className="text-zinc-300 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No leads found</h2>
            <p className="text-text-muted">
              {search ? "No results for that search." : "Leads captured by your chatbot will appear here."}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-50 bg-zinc-50/50">
              <button onClick={toggleSelectAll} className="shrink-0 text-zinc-400 hover:text-primary transition-colors">
                {allSelected
                  ? <CheckSquare className="w-4 h-4 text-primary" />
                  : <Square className="w-4 h-4" />
                }
              </button>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex-1">Contact</span>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest w-28 hidden md:block">Status</span>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest w-24 hidden lg:block">Date</span>
              <span className="w-20" />
            </div>

            {/* Rows */}
            <div className="divide-y divide-zinc-50">
              {filtered.map((lead: any) => {
                const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                const isSelected = selectedIds.includes(lead.id);
                return (
                  <div
                    key={lead.id}
                    className={`flex items-center gap-4 px-6 py-5 hover:bg-zinc-50 transition-colors group ${isSelected ? "bg-primary/3" : ""}`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(lead.id)}
                      className="shrink-0 text-zinc-300 hover:text-primary transition-colors"
                    >
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>

                    {/* Contact info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-brand-dark truncate">
                        {lead.name || "Unknown"}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {lead.email && (
                          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                            <Mail className="w-3 h-3" /> {lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </span>
                        )}
                        {lead.company && (
                          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                            <Building2 className="w-3 h-3" /> {lead.company}
                          </span>
                        )}
                      </div>
                      {/* Tags */}
                      {lead.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {lead.tags.map((tag: any) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                              style={{ backgroundColor: tag.color + "20", color: tag.color, border: `1px solid ${tag.color}40` }}
                            >
                              <Tag className="w-2.5 h-2.5" /> {tag.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status dropdown */}
                    <div className="w-28 hidden md:block">
                      <fetcher.Form method="post">
                        <input type="hidden" name="_action" value="update_status" />
                        <input type="hidden" name="leadId" value={lead.id} />
                        <select
                          name="status"
                          defaultValue={lead.status}
                          onChange={(e) => {
                            const form = e.currentTarget.closest("form") as HTMLFormElement;
                            const fd = new FormData(form);
                            fd.set("status", e.target.value);
                            fetcher.submit(fd, { method: "post" });
                          }}
                          className={`w-full text-[10px] font-black px-2 py-1.5 rounded-xl border cursor-pointer outline-none uppercase tracking-widest ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="qualified">Qualified</option>
                          <option value="converted">Converted</option>
                        </select>
                      </fetcher.Form>
                    </div>

                    {/* Date */}
                    <div className="w-24 hidden lg:block">
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted font-medium">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Row actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-20 justify-end">
                      {/* Star */}
                      <fetcher.Form method="post">
                        <input type="hidden" name="_action" value="toggle_star" />
                        <input type="hidden" name="leadId" value={lead.id} />
                        <button
                          type="submit"
                          title={lead.isStarred ? "Unstar" : "Star"}
                          className={`p-1.5 rounded-lg transition-all hover:bg-zinc-100 ${lead.isStarred ? "text-yellow-400" : "text-zinc-300"}`}
                        >
                          <Star className="w-3.5 h-3.5" fill={lead.isStarred ? "currentColor" : "none"} />
                        </button>
                      </fetcher.Form>

                      {/* Archive */}
                      <fetcher.Form method="post">
                        <input type="hidden" name="_action" value="toggle_archive" />
                        <input type="hidden" name="leadId" value={lead.id} />
                        <button
                          type="submit"
                          title={lead.isArchived ? "Unarchive" : "Archive"}
                          className="p-1.5 rounded-lg transition-all hover:bg-zinc-100 text-zinc-300 hover:text-zinc-500"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </fetcher.Form>

                      {/* View detail */}
                      <Link
                        to={`/dashboard/projects/${project.id}/leads/${lead.id}`}
                        className="p-1.5 rounded-lg transition-all hover:bg-zinc-100 text-zinc-300 hover:text-primary"
                        title="View details"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
