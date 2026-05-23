import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { 
  Save, 
  User, 
  Loader2, 
  Database, 
  Cpu, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Sparkles, 
  Server, 
  Key 
} from "lucide-react";
import { useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  
  // Fetch projects owned by this user
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, name: true }
  });

  // Get Prisma/SQL database statistics
  let dbStats = {
    connected: false,
    error: null as string | null,
    counts: {
      projects: 0,
      knowledgeSources: 0,
      leads: 0,
      chatSessions: 0,
      messages: 0
    }
  };

  try {
    const [pCount, ksCount, lCount, sCount, mCount] = await Promise.all([
      prisma.project.count({ where: { userId } }),
      prisma.knowledgeSource.count({ where: { project: { userId } } }),
      prisma.lead.count({ where: { project: { userId } } }),
      prisma.chatSession.count({ where: { project: { userId } } }),
      prisma.message.count({ where: { session: { project: { userId } } } })
    ]);
    
    dbStats.connected = true;
    dbStats.counts = {
      projects: pCount,
      knowledgeSources: ksCount,
      leads: lCount,
      chatSessions: sCount,
      messages: mCount
    };
  } catch (err: any) {
    dbStats.error = err.message || "Failed to query database statistics.";
  }

  // Get Pinecone connection status
  let pineconeStats = {
    connected: false,
    error: null as string | null,
    metrics: null as any,
    indexName: process.env.PINECONE_INDEX || "quickstart",
    apiKeyConfigured: !!(process.env.PINECONE_API_KEY && process.env.PINECONE_API_KEY.trim() !== "")
  };

  if (pineconeStats.apiKeyConfigured) {
    try {
      const { pineconeIndex } = await import("~/lib/pinecone.server");
      const stats = await pineconeIndex.describeIndexStats();
      pineconeStats.connected = true;
      pineconeStats.metrics = stats;
    } catch (err: any) {
      pineconeStats.error = err.message || "Could not fetch Pinecone index stats.";
    }
  }

  return json({ 
    user, 
    projects, 
    diagnostics: { 
      dbStats, 
      pineconeStats 
    } 
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.clone().formData();
  const method = formData.get("_action");

  if (method === "save_profile") {
    const name = formData.get("name") as string;
    // Simple simulated update
    return json({ success: true, message: "Profile settings updated successfully!", activeTab: "profile" });
  }

  if (method === "test_retrieval") {
    const projectId = formData.get("projectId") as string;
    const query = formData.get("query") as string;
    
    if (!projectId || !query) {
      return json({ error: "Project and Search Query are required.", activeTab: "database" });
    }

    try {
      const { prisma } = await import("~/database/db.server");
      const { pineconeIndex } = await import("~/lib/pinecone.server");
      const { embedText } = await import("~/ai-layer/ai.server");

      // 1. Keyword search inside SQL
      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const sqlResults = await prisma.knowledgeSource.findMany({
        where: {
          projectId,
          OR: [
            { content: { contains: query, mode: "insensitive" as any } },
            ...keywords.map(kw => ({ content: { contains: kw, mode: "insensitive" as any } }))
          ]
        },
        take: 3
      });

      // 2. Vector search inside Pinecone (if keys exist and connect succeeds)
      let vectorResults: any = null;
      let vectorError: string | null = null;
      try {
        const embedding = await embedText(query);
        const pineconeQuery = await pineconeIndex.namespace(projectId).query({
          vector: embedding,
          topK: 3,
          includeMetadata: true
        });
        vectorResults = pineconeQuery.matches || [];
      } catch (err: any) {
        vectorError = err.message || "Failed to query Pinecone vector DB.";
      }

      return json({
        success: true,
        activeTab: "database",
        retrievalData: {
          query,
          sqlSearch: sqlResults.map(source => ({
            id: source.id,
            title: source.title || source.source,
            type: source.type,
            content: source.content ? (source.content.substring(0, 300) + (source.content.length > 300 ? "..." : "")) : ""
          })),
          vectorSearch: vectorResults ? vectorResults.map((m: any) => ({
            id: m.id,
            score: m.score,
            text: m.metadata?.text ? (m.metadata.text.substring(0, 300) + (m.metadata.text.length > 300 ? "..." : "")) : "No text payload key in chunk metadata",
            title: m.metadata?.title || m.metadata?.source || "Chunk segment"
          })) : [],
          vectorError
        }
      });
    } catch (e: any) {
      return json({ error: `Retrieval Playground Error: ${e.message}`, activeTab: "database" });
    }
  }

  return json({ success: true, message: "Settings updated", activeTab: "profile" });
}

export default function Settings() {
  const { user, projects, diagnostics } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>() as any;
  
  const defaultTab = actionData?.activeTab || "profile";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  const isSavingProfile = navigation.state === "submitting" && navigation.formData?.get("_action") === "save_profile";
  const isTestingRetrieval = navigation.state === "submitting" && navigation.formData?.get("_action") === "test_retrieval";

  const dbConnected = diagnostics?.dbStats?.connected;
  const dbCounts = diagnostics?.dbStats?.counts;
  const pineconeConnected = diagnostics?.pineconeStats?.connected;
  const pineconeMetrics = diagnostics?.pineconeStats?.metrics;
  const isPineconeKeyConfigured = diagnostics?.pineconeStats?.apiKeyConfigured;

  return (
    <div id="settings_root">
      <div className="mb-12">
        <h1 className="text-4xl font-black mb-2" id="settings_title">Settings & Diagnostics</h1>
        <p className="text-zinc-500" id="settings_subtitle">
          Manage your profile and inspect your custom full-stack database integrations.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-8" id="settings_tabs">
        <button
          id="tab_profile_btn"
          onClick={() => setActiveTab("profile")}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <User className="w-4 h-4" />
          Profile Settings
        </button>
        <button
          id="tab_database_btn"
          onClick={() => setActiveTab("database")}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "database"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Database className="w-4 h-4" />
          Prisma & Pinecone Engine
        </button>
      </div>

      {/* TAB 1: Profile */}
      {activeTab === "profile" && (
        <div className="max-w-2xl bg-white p-10 rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/20" id="profile_form_card">
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
            <User className="text-primary w-6 h-6" /> Profile Information
          </h2>
          
          <Form method="post" className="space-y-8">
            <input type="hidden" name="_action" value="save_profile" />
            <div>
              <label className="block text-sm font-bold mb-2 text-zinc-500">Email Address</label>
              <input 
                type="email" 
                value={user?.email} 
                disabled 
                className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-zinc-400 outline-none cursor-not-allowed"
              />
              <p className="mt-2 text-xs text-zinc-400">Email cannot be changed.</p>
            </div>
            
            <div>
              <label className="block text-sm font-bold mb-2">Display Name</label>
              <input 
                type="text" 
                name="name" 
                placeholder="Your Name"
                defaultValue={user?.email ? user.email.split('@')[0] : ""}
                className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            
            {actionData?.success && actionData.activeTab === "profile" && (
              <p className="text-green-500 font-bold text-sm bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {actionData.message}
              </p>
            )}
            
            <button 
              type="submit" 
              disabled={isSavingProfile}
              className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200/50"
            >
              {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
          </Form>

          <div className="mt-12 pt-12 border-t border-zinc-50">
            <h3 className="text-lg font-bold text-red-500 mb-4">Danger Zone</h3>
            <p className="text-sm text-zinc-500 mb-6">Once you delete your account, there is no going back. Please be certain.</p>
            <button className="px-6 py-3 border border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all">
              Delete Account
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Database & Pinecone Vector Console */}
      {activeTab === "database" && (
        <div className="space-y-8" id="database_monitor_container">
          {/* Top Diagnostics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* CARD 1: PostgreSQL relational database via Prisma */}
            <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/10 flex flex-col justify-between" id="db_postgres_status_card">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Prisma Postgres DB</h3>
                      <p className="text-xs text-zinc-400">Structured storage provider</p>
                    </div>
                  </div>
                  {dbConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" /> LIVE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-black">
                      <XCircle className="w-3.5 h-3.5" /> ERROR
                    </span>
                  )}
                </div>

                {diagnostics?.dbStats?.error ? (
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-600 font-mono mb-4 break-words">
                    {diagnostics.dbStats.error}
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    <p className="text-sm text-zinc-500">
                      Stores project properties, chatbot configuration, conversation history, and captured customer leads.
                    </p>
                    <div className="grid grid-cols-2 gap-3" id="db_stats_metrics">
                      <div className="p-4 bg-zinc-50/60 rounded-2xl border border-zinc-100">
                        <span className="block text-xs font-bold text-zinc-400 uppercase">My Chatbots</span>
                        <span className="text-xl font-black text-zinc-800">{dbCounts?.projects || 0}</span>
                      </div>
                      <div className="p-4 bg-zinc-50/60 rounded-2xl border border-zinc-100">
                        <span className="block text-xs font-bold text-zinc-400 uppercase">Documents Synced</span>
                        <span className="text-xl font-black text-zinc-800">{dbCounts?.knowledgeSources || 0}</span>
                      </div>
                      <div className="p-4 bg-zinc-50/60 rounded-2xl border border-zinc-100">
                        <span className="block text-xs font-bold text-zinc-400 uppercase">Leads Captured</span>
                        <span className="text-xl font-black text-zinc-800 text-primary">{dbCounts?.leads || 0}</span>
                      </div>
                      <div className="p-4 bg-zinc-50/60 rounded-2xl border border-zinc-100">
                        <span className="block text-xs font-bold text-zinc-400 uppercase">Chat Messages</span>
                        <span className="text-xl font-black text-zinc-800">{dbCounts?.messages || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t border-zinc-50 flex items-center justify-between text-xs text-zinc-400 bg-zinc-50/40 p-4 -mx-8 -mb-8 rounded-b-[40px] border-t border-zinc-100">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-zinc-400" />
                  Provider: Neon/PostgreSQL
                </span>
                <span className="font-mono">ORM: Prisma V5</span>
              </div>
            </div>

            {/* CARD 2: Pinecone Vector Database */}
            <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/10 flex flex-col justify-between" id="db_pinecone_status_card">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-pink-50 text-pink-600 rounded-2xl">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Pinecone Vector DB</h3>
                      <p className="text-xs text-zinc-400">High-performance custom vector engine</p>
                    </div>
                  </div>
                  {!isPineconeKeyConfigured ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 text-zinc-500 rounded-full text-xs font-black">
                      NOT CONFIG
                    </span>
                  ) : pineconeConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" /> CONNECTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-black">
                      <XCircle className="w-3.5 h-3.5" /> ERROR
                    </span>
                  )}
                </div>

                {!isPineconeKeyConfigured ? (
                  <div className="space-y-4 mb-4">
                    <p className="text-sm text-zinc-500">
                      Pinecone manages the semantic document retrieval layer. Documents are vector-embedded and searched for contextual AI matching.
                    </p>
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-start gap-3">
                      <Key className="w-4.5 h-4.5 text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-zinc-600">PINECONE_API_KEY Missing</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Configure your Pinecone key in Settings to index web scrapings and documents semantically.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : diagnostics?.pineconeStats?.error ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-xs text-amber-700 font-mono mb-4 break-words">
                    <p className="font-bold mb-1">Retrieval failed:</p>
                    {diagnostics.pineconeStats.error}
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    <p className="text-sm text-zinc-500">
                      RAG indexing is completely live! Documents are safely partitioned inside Pinecone namespaces per project.
                    </p>
                    <div className="space-y-2 bg-zinc-50 rounded-2xl p-4 border border-zinc-100 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-400 text-xs">Target Index:</span>
                        <span className="font-bold text-zinc-800">{diagnostics?.pineconeStats?.indexName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 text-xs">Vector Dimension:</span>
                        <span className="font-bold text-zinc-800">{pineconeMetrics?.dimension || "1536 (OpenAI / Gemini)"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 text-xs">Active Namespaces:</span>
                        <span className="font-bold text-primary">{Object.keys(pineconeMetrics?.namespaces || {}).length || 0} projects</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 text-xs">Total Segment Count:</span>
                        <span className="font-semibold text-zinc-800">{pineconeMetrics?.totalRecordCount || 0} chunks</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t border-zinc-50 flex items-center justify-between text-xs text-zinc-400 bg-zinc-50/40 p-4 -mx-8 -mb-8 rounded-b-[40px] border-t border-zinc-100 w-full">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  Index Serverless: AWS
                </span>
                <span className="font-mono">Namespaced RAG</span>
              </div>
            </div>

          </div>

          {/* Interactive Hybrid Search Simulator Playground */}
          <div className="bg-white p-10 rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-200/20" id="hybrid_search_simulator">
            <div className="flex items-center justify-between mb-8 border-b border-zinc-50 pb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Hybrid Storage Retrieval Playground</h3>
                  <p className="text-xs text-zinc-400">Simulate visual queries against PostgreSQL and Pinecone vector namespaces simultaneously</p>
                </div>
              </div>
              <span className="text-xs font-black bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full uppercase tracking-wider">
                Full-Stack Simulator
              </span>
            </div>

            <Form method="post" className="space-y-6">
              <input type="hidden" name="_action" value="test_retrieval" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">1. Select Chatbot Project Namespace</label>
                  <select 
                    name="projectId" 
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl font-semibold outline-none focus:ring-2 focus:ring-primary/15"
                  >
                    {projects && projects.length > 0 ? (
                      projects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))
                    ) : (
                      <option value="">-- No Projects Created --</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">2. Enter Test Search Prompt / Query</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      name="query" 
                      required
                      placeholder="e.g. features, pricing plans, contact email"
                      className="w-full pl-12 pr-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/15"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                  </div>
                </div>
              </div>

              {actionData?.error && (
                <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-sm">
                  {actionData.error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isTestingRetrieval}
                className="w-full py-4.5 bg-zinc-950 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-300"
              >
                {isTestingRetrieval ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    Querying Prisma & Pinecone Vector Indices...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Execute Hybrid Retrieval Query
                  </>
                )}
              </button>
            </Form>

            {/* SIMULATOR OUTPUT PANEL */}
            {actionData?.retrievalData && (
              <div className="mt-8 pt-8 border-t border-zinc-100 space-y-6 animate-fadeIn" id="retrieval_output_stage">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-600">Simulated Prompts:</span>
                  <span className="font-mono text-sm font-black text-brand-dark bg-white px-3 py-1 rounded-xl shadow-sm border border-brand-border">
                    &quot;{actionData.retrievalData.query}&quot;
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* SQL Chunk Output */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 font-black text-zinc-800 text-sm">
                      <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>
                      Prisma SQL Keyword Matches (Hybrid Component 1)
                    </div>
                    
                    <div className="space-y-3">
                      {actionData.retrievalData.sqlSearch && actionData.retrievalData.sqlSearch.length > 0 ? (
                        actionData.retrievalData.sqlSearch.map((item: any, i: number) => (
                          <div key={item.id || i} className="p-5 bg-zinc-50/70 border border-zinc-100 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-zinc-500 truncate max-w-[200px]">
                                {item.title}
                              </span>
                              <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                                {item.type}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-600 leading-relaxed font-mono whitespace-pre-wrap">{item.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center bg-zinc-50/40 border border-zinc-100/60 rounded-3xl text-zinc-400 text-xs">
                          No direct SQL matches. Relies completely on vector semantic index.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vector Pinecone Chunk Output */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 font-black text-zinc-800 text-sm">
                      <div className="w-2.5 h-2.5 bg-pink-500 rounded-full"></div>
                      Pinecone Semantic Vector Matches (Hybrid Component 2)
                    </div>

                    <div className="space-y-3">
                      {actionData.retrievalData.vectorError ? (
                        <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs text-amber-800">
                          <p className="font-black mb-1">Vector Search is unavailable:</p>
                          {actionData.retrievalData.vectorError}
                        </div>
                      ) : actionData.retrievalData.vectorSearch && actionData.retrievalData.vectorSearch.length > 0 ? (
                        actionData.retrievalData.vectorSearch.map((item: any, i: number) => (
                          <div key={item.id || i} className="p-5 bg-zinc-50/70 border border-zinc-100 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-zinc-500 truncate max-w-[200px]">
                                {item.title || "Embedded Chunk"}
                              </span>
                              <span className="text-[10px] font-black uppercase text-pink-600 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-100">
                                Cosine Score: {(item.score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-xs text-zinc-600 leading-relaxed font-mono whitespace-pre-wrap">{item.text}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center bg-zinc-50/40 border border-zinc-100/60 rounded-3xl text-zinc-400 text-xs">
                          No vector embedding matches. Confirm you have scrapings or document training added to this project namespace.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

