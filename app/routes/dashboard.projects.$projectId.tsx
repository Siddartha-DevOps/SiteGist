import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useLocation, Link, Outlet } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import {
  ChevronLeft, LayoutDashboard, Link2, FileText, Type, HelpCircle,
  Tag, Layers, Palette, MessageSquare, SlidersHorizontal, Zap,
  Share2, Users, BarChart3, Settings, Bot,
} from "lucide-react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      OR: [{ userId }, { members: { some: { email: user?.email || "" } } }],
    },
    select: { id: true, name: true },
  });
  if (!project) return redirect("/dashboard");
  return json({ project });
}

type Item = { label: string; icon: any; to: string; tab?: string };

export default function ProjectWorkspace() {
  const { project } = useLoaderData<typeof loader>();
  const location = useLocation();
  const base = `/dashboard/projects/${project.id}`;

  const groups: { heading?: string; items: Item[] }[] = [
    { items: [{ label: "Dashboard", icon: LayoutDashboard, to: base }] },
    {
      heading: "Content",
      items: [
        { label: "Links", icon: Link2, to: `${base}/train?tab=web`, tab: "web" },
        { label: "Files", icon: FileText, to: `${base}/train?tab=files`, tab: "files" },
        { label: "Text", icon: Type, to: `${base}/train?tab=text`, tab: "text" },
        { label: "Q&A", icon: HelpCircle, to: `${base}/train?tab=qa`, tab: "qa" },
      ],
    },
    {
      heading: "Customizations",
      items: [
        { label: "Quick Prompts", icon: Tag, to: `${base}/settings` },
        { label: "Personas", icon: Layers, to: `${base}/settings` },
        { label: "Appearance", icon: Palette, to: `${base}/settings` },
      ],
    },
    {
      heading: "Advanced",
      items: [
        { label: "Chat History", icon: MessageSquare, to: `/dashboard/inbox` },
        { label: "Playground", icon: SlidersHorizontal, to: `/dashboard/playground?projectId=${project.id}` },
        { label: "Functions", icon: Zap, to: `${base}/actions` },
        { label: "Integrations", icon: Share2, to: `${base}/integrations` },
        { label: "Leads", icon: Users, to: `${base}/leads` },
        { label: "Insights", icon: BarChart3, to: `${base}/insights` },
        { label: "Members", icon: Users, to: `${base}/members` },
        { label: "Settings", icon: Settings, to: `${base}/settings` },
      ],
    },
  ];

  const isActive = (item: Item) => {
    const path = item.to.split("?")[0];
    if (location.pathname !== path) return false;
    if (item.tab) {
      const cur = new URLSearchParams(location.search).get("tab") || "web";
      return cur === item.tab;
    }
    return true;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Per-chatbot sidebar */}
      <aside className="lg:w-60 shrink-0">
        <div className="lg:sticky lg:top-6 space-y-5">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-brand-gray transition-colors mb-3">
              <ChevronLeft className="w-3.5 h-3.5" /> All chatbots
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <p className="font-black text-brand-dark truncate text-sm">{project.name}</p>
            </div>
          </div>

          <nav className="space-y-5">
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.heading && (
                  <p className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-widest text-brand-gray/40">{group.heading}</p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item, ii) => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={`${gi}-${ii}`}
                        to={item.to}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                          active ? "bg-primary/10 text-primary" : "text-brand-gray hover:bg-zinc-100 hover:text-brand-dark"
                        }`}
                      >
                        <item.icon className={`w-4.5 h-4.5 shrink-0 ${active ? "text-primary" : "text-brand-gray/50 group-hover:text-brand-dark"}`} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Page content */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
