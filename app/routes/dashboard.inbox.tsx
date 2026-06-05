import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, useFetcher } from "@remix-run/react";
import React from "react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { MessageSquare, ChevronRight, User, Bot, Calendar, Search, Star, Archive, AlertTriangle, Tag, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  // CSV Export — returns file download (respects the active filter)
  if (_action === "export_csv") {
    const filter = (formData.get("filter") as string) || "open";
    const baseWhere: any = { project: { userId } };
    if (filter === "open")      { baseWhere.isArchived = false; baseWhere.status = "active"; }
    if (filter === "resolved")  { baseWhere.isArchived = false; baseWhere.status = "resolved"; }
    if (filter === "starred")   { baseWhere.isStarred = true; baseWhere.isArchived = false; }
    if (filter === "escalated") { baseWhere.mode = "human"; baseWhere.isArchived = false; }
    if (filter === "archived")  { baseWhere.isArchived = true; }
    if (filter === "all")       { baseWhere.isArchived = false; }

    const rowsData = await prisma.chatSession.findMany({
      where: baseWhere,
      include: {
        project: { select: { name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const csv = [
      ["Customer Email", "Chatbot", "Status", "Mode", "Messages", "Started", "Last Activity"].join(","),
      ...rowsData.map((s) =>
        [
          `"${s.customerEmail || "Guest"}"`,
          `"${s.project?.name || ""}"`,
          `"${s.status}"`,
          `"${s.mode}"`,
          `"${s._count.messages}"`,
          `"${new Date(s.createdAt).toISOString()}"`,
          `"${new Date(s.updatedAt).toISOString()}"`,
        ].join(",")
      ),
    ].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="conversations-${filter}.csv"`,
      },
    });
  }

  const sessionId = formData.get("sessionId") as string;

  // Verify this session belongs to this user
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, project: { userId } },
  });
  if (!session) return json({ error: "Not found" }, { status: 404 });

  if (_action === "toggle_star") {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { isStarred: !session.isStarred },
    });
    return json({ success: true });
  }

  if (_action === "toggle_archive") {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { isArchived: !session.isArchived },
    });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const activeFilter = url.searchParams.get("filter") || "open";

  const baseWhere: any = { project: { userId } };

  if (activeFilter === "open")      { baseWhere.isArchived = false; baseWhere.status = "active"; }
  if (activeFilter === "resolved")  { baseWhere.isArchived = false; baseWhere.status = "resolved"; }
  if (activeFilter === "starred")   { baseWhere.isStarred = true; baseWhere.isArchived = false; }
  if (activeFilter === "escalated") { baseWhere.mode = "human"; baseWhere.isArchived = false; }
  if (activeFilter === "archived")  { baseWhere.isArchived = true; }
  if (activeFilter === "all")       { baseWhere.isArchived = false; }

  const sessions = await prisma.chatSession.findMany({
    where: baseWhere,
    include: {
      project: { select: { name: true, settings: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      tags: true,
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Count unread for badge
  const unreadCount = await prisma.chatSession.count({
    where: { project: { userId }, isRead: false, isArchived: false },
  });

  // Count active escalated sessions for badge
  const escalatedCount = await prisma.chatSession.count({
    where: { project: { userId }, mode: "human", status: "active", isArchived: false },
  });

  return json({ sessions, activeFilter, unreadCount, escalatedCount });
}

export default function Inbox() {
  const { sessions, activeFilter, unreadCount, escalatedCount } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = React.useState("");
  const fetcher = useFetcher();

  const filterTabs = [
    { label: "Open",      value: "open"      },
    { label: "All",       value: "all"        },
    { label: "Resolved",  value: "resolved"   },
    { label: "Starred",   value: "starred"    },
    { label: "Escalated", value: "escalated"  },
    { label: "Archived",  value: "archived"   },
  ];

  const filtered = sessions.filter((s: any) =>
    search === "" ||
    (s.customerEmail || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-black">Conversations</h1>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-primary text-white text-xs font-black rounded-full">
                {unreadCount} unread
              </span>
            )}
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="export_csv" />
              <input type="hidden" name="filter" value={activeFilter} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl bg-brand-light text-brand-gray hover:text-brand-dark border border-brand-border transition-all"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </fetcher.Form>
          </div>
        </div>
        <p className="text-text-muted">Monitor and respond to customer chats.</p>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray/40" />
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 text-sm font-medium border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSearchParams({ filter: tab.value })}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${
              activeFilter === tab.value
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "bg-brand-light text-brand-gray hover:text-brand-dark border border-brand-border"
            }`}
          >
            {tab.label}
            {tab.value === "escalated" && escalatedCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-black tracking-normal animate-pulse">
                {escalatedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white border border-zinc-100 rounded-[40px] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="text-zinc-300 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No conversations found</h2>
            <p className="text-text-muted">
              {search
                ? "No results for that search."
                : "When customers chat with your bot, they'll show up here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {filtered.map((session: any) => (
              <div key={session.id} className="flex items-center gap-4 p-6 hover:bg-zinc-50 transition-colors group">
                
                {/* Avatar with unread dot */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center">
                    <User className="text-zinc-400 w-6 h-6" />
                  </div>
                  {!session.isRead && (
                    <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Main content — clicking navigates to session */}
                <Link
                  to={`/dashboard/inbox/${session.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className={`truncate ${!session.isRead ? "font-black text-brand-dark" : "font-bold text-brand-dark"} flex items-center gap-2 flex-wrap`}>
                      {session.customerEmail || "Guest User"}
                      <span className="text-xs font-medium px-2 py-0.5 bg-zinc-50 text-zinc-400 rounded-full border border-zinc-100">
                        {session.project.name}
                      </span>
                      {session.mode === "human" && (
                        <span className="bg-red-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-red-600 tracking-widest animate-pulse inline-flex items-center gap-1">
                          ● Live
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted font-medium whitespace-nowrap ml-4">
                      {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                    </p>
                  </div>

                  <p className={`text-sm truncate mb-2 ${!session.isRead ? "text-brand-dark font-medium" : "text-text-muted"}`}>
                    {session.messages[0]?.content || "No messages yet"}
                  </p>

                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {session.status === "resolved" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 uppercase tracking-widest">
                        Resolved
                      </span>
                    )}
                    {session.mode === "human" && (session.project?.settings as any)?.chatMode === "agent-only" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-widest animate-pulse">
                        ● Agent Queue
                      </span>
                    ) : session.mode === "human" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-widest">
                        <AlertTriangle className="w-2.5 h-2.5" /> Escalated
                      </span>
                    ) : null}
                    {session.tags?.map((tag: any) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                        style={{ backgroundColor: tag.color + "20", color: tag.color, border: `1px solid ${tag.color}40` }}
                      >
                        <Tag className="w-2.5 h-2.5" /> {tag.label}
                      </span>
                    ))}
                    {session.assignedTo && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase tracking-widest">
                        → {session.assignedTo}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Message count */}
                <div className="text-xs font-bold text-zinc-300 bg-zinc-50 px-2.5 py-1 rounded-lg shrink-0">
                  {session._count.messages} msg
                </div>

                {/* Quick action buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <fetcher.Form method="post">
                    <input type="hidden" name="_action" value="toggle_star" />
                    <input type="hidden" name="sessionId" value={session.id} />
                    <button
                      type="submit"
                      title={session.isStarred ? "Unstar" : "Star"}
                      className={`p-2 rounded-xl transition-all hover:bg-zinc-100 ${session.isStarred ? "text-yellow-400" : "text-zinc-300"}`}
                    >
                      <Star className="w-4 h-4" fill={session.isStarred ? "currentColor" : "none"} />
                    </button>
                  </fetcher.Form>

                  <fetcher.Form method="post">
                    <input type="hidden" name="_action" value="toggle_archive" />
                    <input type="hidden" name="sessionId" value={session.id} />
                    <button
                      type="submit"
                      title={session.isArchived ? "Unarchive" : "Archive"}
                      className="p-2 rounded-xl transition-all hover:bg-zinc-100 text-zinc-300 hover:text-zinc-500"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </fetcher.Form>
                </div>

                <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-primary transition-colors shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

