import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { Globe, Settings, Send, Code, Layers, Trash2, ChevronLeft, MessageSquare, Users, Share2, BarChart3 } from "lucide-react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    include: { 
      knowledgeSources: true,
      _count: {
        select: {
          sessions: true,
          leads: true,
        }
      }
    },
  });

  if (!project) return redirect("/dashboard");

  const messageCount = await prisma.message.count({
    where: { session: { projectId: params.projectId } }
  });

  const unanswered = await prisma.unansweredQuestion.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  return json({ project, messageCount, unanswered });
}

export default function ProjectDetails() {
  const { project, messageCount, unanswered } = useLoaderData<typeof loader>();

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
            <Link to={`/dashboard/projects/${project.id}/insights`} className="btn-outline flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Insights
            </Link>
            <Link to={`/dashboard/projects/${project.id}/settings`} className="btn-outline flex items-center gap-2">
              <Settings className="w-4 h-4" /> Settings
            </Link>
          </div>
        </div>
      </div>

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
              <Code className="text-primary w-6 h-6" /> Embed Script
            </h2>
            <p className="text-text-muted mb-6">Copy and paste this code into your website's <code className="bg-zinc-50 px-1 rounded font-mono text-xs">&lt;head&gt;</code> or <code className="bg-zinc-50 px-1 rounded font-mono text-xs">&lt;body&gt;</code> tag.</p>
            
            <div className="relative">
              <pre className="p-6 bg-zinc-900 text-zinc-300 rounded-2xl font-mono text-sm overflow-x-auto">
                {`<script src="https://ais-pre-qbay4p7eaak6juns2gztaa-767982023487.asia-southeast1.run.app/widget.js" data-project-id="${project.id}"></script>`}
              </pre>
              <button 
                onClick={() => navigator.clipboard.writeText(`<script src="https://ais-pre-qbay4p7eaak6juns2gztaa-767982023487.asia-southeast1.run.app/widget.js" data-project-id="${project.id}"></script>`)}
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
            <Link to={`/dashboard/projects/${project.id}/playground`} className="w-full flex items-center justify-center gap-2 py-4 bg-white text-primary rounded-2xl font-black hover:bg-primary-muted transition-all">
              <Send className="w-4 h-4" /> Open Playground
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
