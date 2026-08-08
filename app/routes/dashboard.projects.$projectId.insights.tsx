import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import {
  createOrGetKnowledgeQA,
  clearUnansweredForQuestion,
  findPrecedingUserQuestion,
} from "~/backend/knowledge-qa.server";
import { ChevronLeft, ThumbsUp, ThumbsDown, MessageSquare, AlertCircle, TrendingUp, BarChart3, Users, Clock, Calendar, Zap, Plus, Check, Loader2, X } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

export async function action({ params, request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    select: { id: true },
  });
  if (!project) return json({ error: "Project not found" }, { status: 404 });

  const formData = await request.formData();
  const intent = String(formData.get("_action") || "");

  if (intent === "promote_unanswered") {
    const unansweredId = String(formData.get("unansweredId") || "");
    const question = String(formData.get("question") || "");
    const answer = String(formData.get("answer") || "");

    const row = unansweredId
      ? await prisma.unansweredQuestion.findFirst({
          where: { id: unansweredId, projectId: project.id },
        })
      : null;
    if (unansweredId && !row) {
      return json({ error: "Unanswered question not found." }, { status: 404 });
    }

    const result = await createOrGetKnowledgeQA({
      projectId: project.id,
      question: question || row?.question || "",
      answer,
    });
    if (!result.ok) return json({ error: result.error }, { status: result.status });

    await clearUnansweredForQuestion(project.id, question || row?.question || "");
    if (row) {
      await prisma.unansweredQuestion.deleteMany({ where: { id: row.id, projectId: project.id } });
    }

    return json({
      success: true,
      qaId: result.qaId,
      created: result.created,
      message: result.created
        ? "Q&A saved — the bot will use this answer next time."
        : "Q&A updated — existing override refreshed.",
    });
  }

  if (intent === "promote_feedback") {
    const messageId = String(formData.get("messageId") || "");
    const question = String(formData.get("question") || "");
    const answer = String(formData.get("answer") || "");

    const msg = await prisma.message.findFirst({
      where: {
        id: messageId,
        feedback: -1,
        session: { projectId: project.id },
      },
      select: { id: true, sessionId: true, createdAt: true, content: true, role: true },
    });
    if (!msg) return json({ error: "Feedback message not found." }, { status: 404 });

    let q = question.trim();
    if (!q) {
      q =
        (await findPrecedingUserQuestion(msg.sessionId, msg.createdAt)) ||
        (msg.role === "user" ? msg.content : "");
    }
    if (!q) {
      return json(
        { error: "Could not find the visitor question for this feedback." },
        { status: 400 }
      );
    }

    const result = await createOrGetKnowledgeQA({
      projectId: project.id,
      question: q,
      answer,
    });
    if (!result.ok) return json({ error: result.error }, { status: result.status });

    await clearUnansweredForQuestion(project.id, q);

    return json({
      success: true,
      qaId: result.qaId,
      created: result.created,
      message: result.created
        ? "Q&A saved from thumbs-down — the bot will use this answer next time."
        : "Q&A updated from thumbs-down feedback.",
    });
  }

  if (intent === "dismiss_unanswered") {
    const unansweredId = String(formData.get("unansweredId") || "");
    if (!unansweredId) return json({ error: "Missing id" }, { status: 400 });
    await prisma.unansweredQuestion.deleteMany({
      where: { id: unansweredId, projectId: project.id },
    });
    return json({ success: true, message: "Dismissed." });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });

  if (!project) return redirect("/dashboard");

  const rawRange = Number(new URL(request.url).searchParams.get("range"));
  const range: 7 | 30 | 90 | 365 =
    rawRange === 30 ? 30 : rawRange === 90 ? 90 : rawRange === 365 ? 365 : 7;

  // Get messages with feedback
  const messagesWithFeedbackRaw = await prisma.message.findMany({
    where: { 
      session: { projectId: params.projectId },
      feedback: { not: null }
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const messagesWithFeedback = await Promise.all(
    messagesWithFeedbackRaw.map(async (msg) => {
      let userQuestion: string | null = null;
      if (msg.feedback === -1) {
        if (msg.role === "assistant") {
          userQuestion = await findPrecedingUserQuestion(msg.sessionId, msg.createdAt);
        } else if (msg.role === "user") {
          userQuestion = msg.content;
        }
      }
      return { ...msg, userQuestion };
    })
  );

  const thumbsUpCount = await prisma.message.count({
    where: { session: { projectId: params.projectId }, feedback: 1 }
  });

  const thumbsDownCount = await prisma.message.count({
    where: { session: { projectId: params.projectId }, feedback: -1 }
  });
  
  const unanswered = await prisma.unansweredQuestion.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" },
  });

  // For 90-day view use stored snapshots; for 7/30-day use live queries (more accurate for recent days)
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (range - 1));

  let chartData: { day: string; messages: number; leads: number }[];

  if (range === 365) {
    // 12-month usage: aggregate stored daily snapshots into calendar months.
    const monthStart = new Date(); monthStart.setHours(0, 0, 0, 0); monthStart.setDate(1);
    monthStart.setMonth(monthStart.getMonth() - 11);
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { projectId: params.projectId, date: { gte: monthStart } },
      orderBy: { date: "asc" },
      select: { date: true, messagesCount: true, leadsCaptured: true },
    });
    const monthBuckets: { day: string; key: string; messages: number; leads: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(1); d.setMonth(d.getMonth() - i);
      monthBuckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        day: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        messages: 0, leads: 0,
      });
    }
    const monthIndex = new Map(monthBuckets.map((b, i) => [b.key, i]));
    for (const s of snapshots) {
      const d = new Date(s.date);
      const i = monthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i != null) { monthBuckets[i].messages += s.messagesCount; monthBuckets[i].leads += s.leadsCaptured; }
    }
    chartData = monthBuckets.map(b => ({ day: b.day, messages: b.messages, leads: b.leads }));
  } else if (range === 90) {
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { projectId: params.projectId, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { date: true, messagesCount: true, leadsCaptured: true },
    });
    const buckets: { day: string; key: string; messages: number; leads: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      buckets.push({ key: d.toDateString(), day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), messages: 0, leads: 0 });
    }
    const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));
    for (const s of snapshots) {
      const d = new Date(s.date); d.setHours(0, 0, 0, 0);
      const i = bucketIndex.get(d.toDateString());
      if (i != null) { buckets[i].messages = s.messagesCount; buckets[i].leads = s.leadsCaptured; }
    }
    // Thin out to weekly labels for readability
    chartData = buckets.map((b, i) => ({ day: i % 7 === 0 ? b.day : "", messages: b.messages, leads: b.leads }));
  } else {
    const [recentMessages, recentLeads] = await Promise.all([
      prisma.message.findMany({
        where: { session: { projectId: params.projectId }, role: "user", createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.lead.findMany({
        where: { projectId: params.projectId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);
    const buckets: { day: string; key: string; messages: number; leads: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      buckets.push({
        key: d.toDateString(),
        day: range === 7
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        messages: 0, leads: 0,
      });
    }
    const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));
    for (const m of recentMessages) {
      const d = new Date(m.createdAt); d.setHours(0, 0, 0, 0);
      const i = bucketIndex.get(d.toDateString()); if (i != null) buckets[i].messages++;
    }
    for (const l of recentLeads) {
      const d = new Date(l.createdAt); d.setHours(0, 0, 0, 0);
      const i = bucketIndex.get(d.toDateString()); if (i != null) buckets[i].leads++;
    }
    chartData = buckets.map(b => ({ day: b.day, messages: b.messages, leads: b.leads }));
  }

  // Peak hours — messages by hour of day (last 30 days, live)
  const hourSince = new Date(); hourSince.setDate(hourSince.getDate() - 30);
  const hourMessages = await prisma.message.findMany({
    where: { session: { projectId: params.projectId }, role: "user", createdAt: { gte: hourSince } },
    select: { createdAt: true },
  });
  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: 0 }));
  for (const m of hourMessages) { hourBuckets[new Date(m.createdAt).getUTCHours()].count++; }
  const hourlyData = hourBuckets;

  // Latency trend from stored snapshots (last 30 snapshots)
  const latencySnapshots = await prisma.analyticsSnapshot.findMany({
    where: { projectId: params.projectId, avgLatency: { not: null } },
    orderBy: { date: "asc" },
    take: 30,
    select: { date: true, avgLatency: true },
  });
  const latencyTrend = latencySnapshots.map(s => ({
    day: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    latency: s.avgLatency != null ? parseFloat(s.avgLatency.toFixed(2)) : null,
  }));

  const totalSessions = await prisma.chatSession.count({
    where: { projectId: params.projectId }
  });

  const totalLeads = await prisma.lead.count({
    where: { projectId: params.projectId }
  });

  const conversionRate = totalSessions > 0 ? ((totalLeads / totalSessions) * 100).toFixed(1) : 0;

  // Real response speed from analytics snapshots (em-dash if none yet)
  const avgLatencyVal = latencySnapshots.length
    ? latencySnapshots.reduce((sum, s) => sum + (s.avgLatency ?? 0), 0) / latencySnapshots.length
    : null;
  const responseSpeed = avgLatencyVal != null ? `${avgLatencyVal.toFixed(1)}s` : "—";

  // Real CSAT from thumbs feedback
  const ratedTotal = thumbsUpCount + thumbsDownCount;
  const csatScore = ratedTotal > 0 ? Math.round((thumbsUpCount / ratedTotal) * 100) : 0;
  const csatLabel = ratedTotal > 0 ? `${csatScore}%` : "—";

  // Real sentiment split: classified per user message (see analyzeSentiment).
  const [positiveCount, negativeCount, neutralCount] = await Promise.all([
    prisma.message.count({ where: { session: { projectId: params.projectId }, role: "user", sentiment: "positive" } }),
    prisma.message.count({ where: { session: { projectId: params.projectId }, role: "user", sentiment: "negative" } }),
    prisma.message.count({ where: { session: { projectId: params.projectId }, role: "user", sentiment: "neutral" } }),
  ]);
  const sentimentDenom = (positiveCount + negativeCount + neutralCount) || 1;

  // Real knowledge coverage: answered vs unanswered user questions
  const totalUserQuestions = await prisma.message.count({
    where: { session: { projectId: params.projectId }, role: "user" },
  });
  const coverage = totalUserQuestions > 0
    ? Math.max(0, Math.min(100, Math.round((1 - unanswered.length / totalUserQuestions) * 100)))
    : 0;

  // Real conversion funnel (replaces fake source splits)
  const engagedSessions = await prisma.chatSession.count({
    where: { projectId: params.projectId, messages: { some: { role: "user" } } },
  });

  return json({
    project,
    messagesWithFeedback,
    unanswered,
    thumbsUpCount,
    thumbsDownCount,
    chartData,
    hourlyData,
    latencyTrend,
    sentimentData: [
      { name: "Positive", value: Math.round((positiveCount / sentimentDenom) * 100), color: "#22c55e" },
      { name: "Neutral", value: Math.round((neutralCount / sentimentDenom) * 100), color: "#94a3b8" },
      { name: "Negative", value: Math.round((negativeCount / sentimentDenom) * 100), color: "#ef4444" },
    ],
    totalSessions,
    totalLeads,
    conversionRate,
    responseSpeed,
    csatLabel,
    coverage,
    range,
    sourcePerformance: [
      { name: "Sessions Started", value: totalSessions },
      { name: "Engaged (sent msg)", value: engagedSessions },
      { name: "Leads Captured", value: totalLeads },
    ],
  });
}

export default function ProjectInsights() {
  const {
    project,
    messagesWithFeedback,
    unanswered,
    thumbsUpCount,
    thumbsDownCount,
    chartData,
    hourlyData,
    latencyTrend,
    sentimentData,
    totalSessions,
    totalLeads,
    conversionRate,
    responseSpeed,
    csatLabel,
    coverage,
    range,
    sourcePerformance
  } = useLoaderData<typeof loader>();

  const [searchParams, setSearchParams] = useSearchParams();
  const promoteFetcher = useFetcher<{ success?: boolean; error?: string; message?: string }>();
  const [editingUnansweredId, setEditingUnansweredId] = useState<string | null>(null);
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (promoteFetcher.state === "idle" && promoteFetcher.data) {
      if (promoteFetcher.data.success) {
        setBanner(promoteFetcher.data.message || "Saved.");
        setEditingUnansweredId(null);
        setEditingFeedbackId(null);
      } else if (promoteFetcher.data.error) {
        setBanner(promoteFetcher.data.error);
      }
    }
  }, [promoteFetcher.state, promoteFetcher.data]);

  const isPromoting = promoteFetcher.state !== "idle";

  return (
    <div className="max-w-6xl">
      <Link to={`/dashboard/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to project
      </Link>
      
      <div className="mb-12">
        <h1 className="text-4xl font-black mb-2 tracking-tight">Intelligence & ROI</h1>
        <p className="text-text-muted font-medium">Track your AI's effectiveness and the leads it's generating for your business.</p>
        {banner && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-medium text-brand-dark">
            <span>{banner}</span>
            <button type="button" onClick={() => setBanner(null)} className="text-zinc-400 hover:text-zinc-600" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* High Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Sessions", value: totalSessions, icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Leads Captured", value: totalLeads, icon: Users, color: "text-purple-500", bg: "bg-purple-50" },
          { label: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp, color: "text-green-500", bg: "bg-green-50" },
          { label: "Response Speed", value: responseSpeed, icon: Clock, color: "text-brand-orange", bg: "bg-brand-orange/5" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-zinc-100 shadow-sm">
            <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h4 className="text-2xl font-black">{stat.value}</h4>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Main Volume Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> User Engagement Trends
            </h2>
            <select
              value={String(range)}
              onChange={(e) => setSearchParams((prev) => { prev.set("range", e.target.value); return prev; }, { preventScrollReset: true })}
              className="bg-zinc-50 border-none text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last 12 Months</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#155DEE" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#155DEE" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600, fill: '#a1a1aa'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600, fill: '#a1a1aa'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px'}}
                />
                <Area type="monotone" dataKey="messages" name="Chats" stroke="#155DEE" strokeWidth={4} fillOpacity={1} fill="url(#colorMsgs)" />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#a855f7" strokeWidth={4} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Doughnut */}
        <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm flex flex-col">
          <h2 className="text-xl font-bold mb-8 flex items-center gap-2 text-brand-dark">
            <ThumbsUp className="w-5 h-5 text-green-500" /> User Satisfaction
          </h2>
          <div className="h-[200px] w-full relative mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={10}
                  dataKey="value"
                  stroke="none"
                >
                  {sentimentData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-3xl font-black">
                 {csatLabel}
               </span>
               <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">CSAT Score</span>
            </div>
          </div>
          <div className="space-y-4 px-2">
            {sentimentData.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{item.name}</span>
                </div>
                <span className="text-xs font-black">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Lead Sources / Funnel */}
         <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
           <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
             <BarChart3 className="w-5 h-5 text-purple-500" /> Conversion Funnel
           </h2>
           <div className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={sourcePerformance} layout="vertical">
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#18181b'}} width={80} />
                 <Tooltip />
                 <Bar dataKey="value" fill="#155DEE" radius={[0, 10, 10, 0]} barSize={20} />
               </BarChart>
             </ResponsiveContainer>
           </div>
         </div>

         {/* Training Coverage */}
         <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm flex flex-col justify-center text-center">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-[32px] flex items-center justify-center mb-6 mx-auto">
               <AlertCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black mb-3">Knowledge Coverage</h3>
            <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
              Your bot has answered{" "}
              <span
                className={`font-bold ${
                  coverage >= 90
                    ? "text-green-500"
                    : coverage >= 70
                    ? "text-amber-500"
                    : "text-red-500"
                }`}
              >
                {coverage}%
              </span>{" "}
              of questions from your indexed knowledge base.
            </p>
            <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden mb-8">
               <div
                 className={`h-full transition-all ${
                   coverage >= 90
                     ? "bg-green-500"
                     : coverage >= 70
                     ? "bg-amber-500"
                     : "bg-red-500"
                 }`}
                 style={{ width: `${coverage}%` }}
               />
            </div>
            <Link to={`/dashboard/projects/${project.id}/train`} className="text-primary font-black uppercase tracking-widest text-[11px] hover:underline">
               Expand Knowledge Base →
            </Link>
         </div>
      </div>

      {/* Peak Hours + Latency Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 mt-8">
        {/* Peak Hours */}
        <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-orange" /> Peak Hours
          </h2>
          <p className="text-xs font-bold text-zinc-400 mb-6 uppercase tracking-wide">Message volume by hour (UTC, last 30 days)</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} barSize={8}>
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }}
                  interval={3}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(v: any) => [v, 'Messages']}
                />
                <Bar dataKey="count" fill="#155DEE" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.count === Math.max(...hourlyData.map((h: any) => h.count)) ? '#f97316' : '#155DEE'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-zinc-400 font-bold text-center mt-2 uppercase tracking-wider">
            {hourlyData.reduce((a: any, b: any) => a.count > b.count ? a : b, hourlyData[0])?.count > 0
              ? `Busiest at ${hourlyData.reduce((a: any, b: any) => a.count > b.count ? a : b, hourlyData[0]).hour} UTC`
              : 'No data yet — send some test messages'}
          </p>
        </div>

        {/* Response Latency Trend */}
        <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Response Latency
          </h2>
          <p className="text-xs font-bold text-zinc-400 mb-6 uppercase tracking-wide">Average AI response time in seconds (from daily snapshots)</p>
          <div className="h-[220px]">
            {latencyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }} unit="s" />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(v: any) => [`${v}s`, 'Avg latency']}
                  />
                  <Line type="monotone" dataKey="latency" stroke="#155DEE" strokeWidth={3} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Zap className="w-8 h-8 text-zinc-200 mb-3" />
                <p className="text-sm font-bold text-zinc-400">No latency data yet</p>
                <p className="text-xs text-zinc-300 mt-1">Snapshots populate daily via the cron job</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Feedback */}
        <section>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
            <TrendingUp className="text-primary w-5 h-5" /> Recent Feedback
          </h2>
          <div className="space-y-4">
            {messagesWithFeedback.map((msg: any) => (
              <div key={msg.id} className="bg-white p-6 rounded-[24px] border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  {msg.feedback === 1 ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black uppercase">
                      <ThumbsUp className="w-3 h-3" /> Positive
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase">
                      <ThumbsDown className="w-3 h-3" /> Improvement Needed
                    </div>
                  )}
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">{new Date(msg.createdAt).toLocaleDateString()}</span>
                </div>
                {msg.feedback === -1 && msg.userQuestion && (
                  <p className="text-xs font-bold text-zinc-500 mb-2">Visitor asked: <span className="text-brand-dark italic font-medium">"{msg.userQuestion}"</span></p>
                )}
                <p className="text-sm text-brand-dark leading-relaxed italic border-l-2 border-zinc-100 pl-4 mb-4">"{msg.content}"</p>

                {msg.feedback === -1 && (
                  editingFeedbackId === msg.id ? (
                    <promoteFetcher.Form method="post" className="space-y-3 mt-2">
                      <input type="hidden" name="_action" value="promote_feedback" />
                      <input type="hidden" name="messageId" value={msg.id} />
                      <input type="hidden" name="question" value={msg.userQuestion || ""} />
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">Correct answer</label>
                      <textarea
                        name="answer"
                        required
                        rows={4}
                        defaultValue={msg.role === "assistant" ? msg.content : ""}
                        placeholder="Write the answer the bot should give next time…"
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={isPromoting || !msg.userQuestion}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
                        >
                          {isPromoting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Save as Q&amp;A
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFeedbackId(null)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-50"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                      {!msg.userQuestion && (
                        <p className="text-[11px] text-amber-600 font-medium">Couldn’t find the visitor’s question for this reply.</p>
                      )}
                    </promoteFetcher.Form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingFeedbackId(msg.id); setEditingUnansweredId(null); }}
                      className="text-xs font-black text-primary hover:underline inline-flex items-center gap-1.5 uppercase tracking-wider"
                    >
                      <Plus className="w-3.5 h-3.5" /> Fix with Q&amp;A override
                    </button>
                  )
                )}
              </div>
            ))}
            {messagesWithFeedback.length === 0 && (
              <div className="text-center py-20 bg-zinc-50 rounded-[32px] border border-dashed border-zinc-200">
                <MessageSquare className="w-8 h-8 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-400 font-bold">No feedback received yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* Unanswered Questions */}
        <section>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
            <AlertCircle className="text-brand-orange w-5 h-5" /> Missing Knowledge
          </h2>
          <div className="space-y-4">
            {unanswered.map((u: any) => (
              <div key={u.id} className="bg-white p-6 rounded-[24px] border border-zinc-100 shadow-sm">
                 <p className="text-sm font-bold text-brand-dark mb-2">User asked:</p>
                 <p className="text-sm text-zinc-600 leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-100 mb-4 italic">"{u.question}"</p>

                 {editingUnansweredId === u.id ? (
                   <promoteFetcher.Form method="post" className="space-y-3">
                     <input type="hidden" name="_action" value="promote_unanswered" />
                     <input type="hidden" name="unansweredId" value={u.id} />
                     <input type="hidden" name="question" value={u.question} />
                     <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">Answer</label>
                     <textarea
                       name="answer"
                       required
                       rows={4}
                       placeholder="Write the answer the bot should give…"
                       className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                       autoFocus
                     />
                     <div className="flex flex-wrap items-center gap-2">
                       <button
                         type="submit"
                         disabled={isPromoting}
                         className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
                       >
                         {isPromoting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                         Save as Q&amp;A
                       </button>
                       <button
                         type="button"
                         onClick={() => setEditingUnansweredId(null)}
                         className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-50"
                       >
                         <X className="w-3.5 h-3.5" /> Cancel
                       </button>
                     </div>
                   </promoteFetcher.Form>
                 ) : (
                   <div className="flex flex-wrap items-center gap-3">
                     <button
                       type="button"
                       onClick={() => { setEditingUnansweredId(u.id); setEditingFeedbackId(null); }}
                       className="text-xs font-black text-primary hover:underline inline-flex items-center gap-1.5 uppercase tracking-wider"
                     >
                       <Plus className="w-3.5 h-3.5" /> Add as Q&amp;A
                     </button>
                     <promoteFetcher.Form method="post">
                       <input type="hidden" name="_action" value="dismiss_unanswered" />
                       <input type="hidden" name="unansweredId" value={u.id} />
                       <button type="submit" className="text-[11px] font-bold text-zinc-400 hover:text-zinc-600 uppercase tracking-wider">
                         Dismiss
                       </button>
                     </promoteFetcher.Form>
                     <Link to={`/dashboard/projects/${project.id}/train`} className="text-[11px] font-bold text-zinc-400 hover:text-primary uppercase tracking-wider">
                       Open Train
                     </Link>
                   </div>
                 )}
              </div>
            ))}
            {unanswered.length === 0 && (
              <div className="text-center py-20 bg-zinc-50 rounded-[32px] border border-dashed border-zinc-200">
                <BarChart3 className="w-8 h-8 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-400 font-bold">Bot answered everything correctly so far!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
