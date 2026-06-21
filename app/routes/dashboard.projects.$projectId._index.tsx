import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { Globe, Settings, Send, Code, Layers, Trash2, ChevronLeft, MessageSquare, Users, Share2, BarChart3, Zap, CheckCircle2, Circle, ArrowRight } from "lucide-react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  try {
    const findProject = () => prisma.project.findFirst({
      where: {
        id: params.projectId,
        OR: [
          { userId },
          { members: { some: { email: user?.email || "" } } }
        ]
      },
      include: {
        knowledgeSources: true,
        _count: { select: { sessions: true, leads: true } }
      },
    });

    let project = await findProject();

    // Retry once after a short delay to handle Prisma Accelerate read-after-write lag
    if (!project) {
      await new Promise(r => setTimeout(r, 600));
      project = await findProject();
    }

    if (!project) return redirect("/dashboard");

    const messageCount = await prisma.message.count({
      where: { session: { projectId: params.projectId } }
    });

    const unanswered = await prisma.unansweredQuestion.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      "app.sitegist.co";
    const baseUrl = `https://${host}`;

    return json({ project, messageCount, unanswered, baseUrl });
  } catch (error: any) {
    // Surface DB failures (e.g. schema drift on a db-push'd prod that is missing
    // migrated columns) through the root ErrorBoundary's "Database Connection
    // Offline" screen WITH the real message, instead of Remix's opaque
    // production-scrubbed "Unexpected Server Error".
    if (error instanceof Response) throw error; // preserve redirects / auth responses
    console.error("[Project detail] loader DB error:", error?.message);
    throw json(
      { dbError: true, message: error?.message || "Failed to load this project from the database." },
      { status: 503 }
    );
  }
}

export default function ProjectDetails() {
  const { project, messageCount, unanswered, baseUrl } = useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);

  // First-run onboarding checklist — derived from real project state; it disappears
  // once the core steps (train, customize, test) are done.
  const _settings = (project.settings as any) || {};
  const onboardingSteps = [
    { label: "Train your chatbot", desc: "Add a website, files, or text", done: project.knowledgeSources.length > 0, href: `/dashboard/projects/${project.id}/train`, cta: "Add sources" },
    { label: "Customize appearance", desc: "Name, color, and greeting", done: !!(_settings.systemPrompt || _settings.branding?.assistantName || _settings.branding?.primaryColor), href: `/dashboard/projects/${project.id}/settings`, cta: "Customize" },
    { label: "Test your AI", desc: "Try it in the Playground", done: messageCount > 0, href: `/dashboard/playground?projectId=${project.id}`, cta: "Open Playground" },
    { label: "Add to your website", desc: "Copy the embed snippet", done: false, href: "#embed-script", cta: "Get code" },
  ];
  const coreDone = onboardingSteps.slice(0, 3).every((s) => s.done);
  const doneCount = onboardingSteps.filter((s) => s.done).length;

  return (
    <div>
      <div className="mb-10">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-6">
          <ChevronLeft className="w-4 h-4" /> Back to projects
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center">
              <Globe className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black">{project.name}</h1>
              <p className="text-text-muted">Chatbot ID: <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-xs">{project.id}</code></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link to={`/dashboard/projects/${project.id}/train`} className="btn-primary flex items-center gap-2">
              <Layers className="w-4 h-4" /> Train Chatbot
            </Link>
            <Link to={`/dashboard/projects/${project.id}/integrations`} className="btn-outline flex items-center gap-2">
              <Share2 className="w-4 h-4" /> Integrations
            </Link>
            <Link to={`/dashboard/projects/${project.id}/leads`} className="btn-outline flex items-center gap-2">
              <Users className="w-4 h-4" /> Leads
              {project._count.leads > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-full">
                  {project._count.leads}
                </span>
              )}
            </Link>
            <Link to={`/dashboard/projects/${project.id}/insights`} className="btn-outline flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Insights
            </Link>
            <Link to={`/dashboard/projects/${project.id}/actions`} className="btn-outline flex items-center gap-2">
              <Zap className="w-4 h-4" /> AI Actions
            </Link>
            <Link id="nav-members-btn" to={`/dashboard/projects/${project.id}/members`} className="btn-outline flex items-center gap-2">
              <Users className="w-4 h-4" /> Members
            </Link>
            <Link to={`/dashboard/projects/${project.id}/settings`} className="btn-outline flex items-center gap-2">
              <Settings className="w-4 h-4" /> Settings
            </Link>
          </div>
        </div>
      </div>

      {!coreDone && (
        <div className="mb-12 bg-gradient-to-br from-primary/5 to-white border border-primary/15 rounded-[32px] p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-black text-brand-dark flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" /> Get your chatbot live
              </h2>
              <p className="text-sm text-text-muted mt-1">{doneCount} of {onboardingSteps.length} steps done</p>
            </div>
            <div className="w-40 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(doneCount / onboardingSteps.length) * 100}%` }} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {onboardingSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border bg-white border-zinc-100">
                {step.done
                  ? <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                  : <Circle className="w-6 h-6 text-zinc-300 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className={`font-bold text-sm ${step.done ? "text-zinc-400 line-through" : "text-brand-dark"}`}>{step.label}</p>
                  <p className="text-xs text-text-muted">{step.desc}</p>
                </div>
                {!step.done && (
                  <Link to={step.href} className="text-xs font-bold text-primary whitespace-nowrap inline-flex items-center gap-1 hover:gap-2 transition-all">
                    {step.cta} <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Total Chats</p>
          <div className="flex items-end justify-between">
             <h4 className="text-4xl font-black text-brand-dark">{project._count.sessions}</h4>
             <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <MessageSquare className="w-5 h-5" />
             </div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Total Messages</p>
          <div className="flex items-end justify-between">
             <h4 className="text-4xl font-black text-brand-dark">{messageCount}</h4>
             <div className="w-10 h-10 bg-brand-bg rounded-xl flex items-center justify-center text-brand-gray">
                <Send className="w-5 h-5" />
             </div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Leads Captured</p>
          <div className="flex items-end justify-between">
             <h4 className="text-4xl font-black text-brand-dark">{project._count.leads}</h4>
             <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-500">
                <Users className="w-5 h-5" />
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Stats */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-10 rounded-[40px] border border-zinc-100">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Share2 className="text-primary w-6 h-6" /> Share Chatbot
            </h2>
            <p className="text-text-muted mb-6">
              Share this single-page URL directly with your customers — no widget embedding or website setup required.
            </p>
            
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`${baseUrl}/chat/${project.id}`}
                className="flex-1 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-mono text-zinc-600 outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${baseUrl}/chat/${project.id}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="shrink-0 px-6 py-3 bg-zinc-900 border border-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-2xl transition-all"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          <div id="embed-script" className="bg-white p-10 rounded-[40px] border border-zinc-100 scroll-mt-24">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Code className="text-primary w-6 h-6" /> Embed Script
            </h2>
            <p className="text-text-muted mb-6">Copy and paste this code into your website's <code className="bg-zinc-50 px-1 rounded font-mono text-xs">&lt;head&gt;</code> or <code className="bg-zinc-50 px-1 rounded font-mono text-xs">&lt;body&gt;</code> tag.</p>
            
            <div className="relative">
              <pre className="p-6 bg-zinc-900 text-zinc-300 rounded-2xl font-mono text-sm overflow-x-auto">
                {`<script src="${baseUrl}/widget.js" data-project-id="${project.id}"></script>`}
              </pre>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`<script src="${baseUrl}/widget.js" data-project-id="${project.id}"></script>`);
                }}
                className="absolute top-4 right-4 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                Copy Code
              </button>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[40px] border border-zinc-100">
            <h2 className="text-2xl font-bold mb-6 flex items-center justify-between">
              Training Content
              <span className="text-sm font-medium text-text-muted">{project.knowledgeSources.length} Items Indexed</span>
            </h2>
            
            <div className="space-y-4">
              {project.knowledgeSources.map((source: any) => (
                <div key={source.id} className="flex items-center justify-between p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <Globe className="text-zinc-400 w-5 h-5 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <p className="font-bold truncate">{source.title || 'Untitled Item'}</p>
                      <p className="text-xs text-text-muted truncate">{source.source}</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {project.knowledgeSources.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-text-muted mb-4">No content indexed yet.</p>
                  <Link to={`/dashboard/projects/${project.id}/train`} className="text-primary font-bold">Start Training</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[40px] border border-zinc-100">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-orange" /> Unanswered Questions
            </h3>
            {unanswered.length > 0 ? (
              <div className="space-y-4">
                {unanswered.map((u: any) => (
                  <div key={u.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-xs font-medium text-zinc-600 italic">"{u.question}"</p>
                    <p className="text-[10px] text-zinc-400 mt-2 font-bold uppercase tracking-wider">{new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
                <p className="text-[10px] text-center text-zinc-400 font-bold uppercase tracking-widest pt-2">Add more content to fix these</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-text-muted">AI is answering everything! 🚀</p>
              </div>
            )}
          </div>

          <div className="bg-primary p-10 rounded-[40px] text-white">
            <h3 className="text-2xl font-bold mb-4">Try your bot</h3>
            <p className="text-primary-muted/80 text-sm mb-8 leading-relaxed">
              Test how your chatbot responds to questions before deploying.
            </p>
            <Link to={`/dashboard/playground?projectId=${project.id}`} className="w-full flex items-center justify-center gap-2 py-4 bg-white text-primary rounded-2xl font-black hover:bg-primary-muted transition-all">
              <Send className="w-4 h-4" /> Open Playground
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
