import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { Save, Settings, Loader2, ChevronLeft, Palette, MessageSquare, Bot, Zap, Users, Check, Trash2 } from "lucide-react";
import { useState } from "react";

const PERSONAS = [
  {
    id: "friendly-support",
    label: "Friendly Support Agent",
    description: "Warm, helpful, solution-focused",
    prompt: "You are a friendly and empathetic customer support agent. You speak in a warm, conversational tone and always aim to solve the user's problem. Use simple language, be patient, and reassure the user when they're frustrated. End every response with an offer to help further.",
  },
  {
    id: "formal-enterprise",
    label: "Formal Enterprise Assistant",
    description: "Professional, precise, corporate tone",
    prompt: "You are a professional enterprise assistant. Maintain a formal, business-appropriate tone at all times. Provide precise, well-structured answers. Avoid casual language or contractions. Prioritise accuracy and completeness in every response.",
  },
  {
    id: "casual-startup",
    label: "Casual Startup Helper",
    description: "Relaxed, direct, uses everyday language",
    prompt: "You are a casual, helpful assistant for a fast-moving startup. Keep things short and direct. Use everyday language, feel free to use contractions, and don't over-explain. If something's unclear, just ask.",
  },
  {
    id: "sales-focused",
    label: "Sales-Focused Agent",
    description: "Highlights value, encourages next step",
    prompt: "You are a knowledgeable sales assistant. Help visitors understand the product's benefits and guide them toward a decision. Highlight value over features. When appropriate, suggest a demo, free trial, or speaking with the sales team. Be enthusiastic but never pushy.",
  },
  {
    id: "technical-docs",
    label: "Technical Documentation Bot",
    description: "Precise, detailed, developer-friendly",
    prompt: "You are a technical assistant for developers. Provide precise, detailed answers. Use correct terminology. Include code examples when relevant. Be direct and skip pleasantries — developers want answers, not small talk.",
  },
] as const;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });

  if (!project) return redirect("/dashboard");

  return json({ project });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  const actionType = formData.get("_action") as string;
  if (actionType === "delete_project") {
    try {
      // Clear all child associations to prevent constraint issues on both real and fallback DBs
      await prisma.unansweredQuestion.deleteMany({ where: { projectId: params.projectId } });
      await prisma.knowledgeSource.deleteMany({ where: { projectId: params.projectId } });
      await prisma.knowledgeQA.deleteMany({ where: { projectId: params.projectId } });
      await prisma.integration.deleteMany({ where: { projectId: params.projectId } });
      await prisma.lead.deleteMany({ where: { projectId: params.projectId } });
      
      // Delete messages before sessions to clear dependencies
      const sessions = await prisma.chatSession.findMany({ where: { projectId: params.projectId } });
      const sessionIds = sessions.map(s => s.id);
      if (sessionIds.length > 0) {
        await prisma.message.deleteMany({ where: { sessionId: { in: sessionIds } } });
      }
      await prisma.chatSession.deleteMany({ where: { projectId: params.projectId } });
      
      // Finally, delete the project
      await prisma.project.delete({ where: { id: params.projectId } });
    } catch (err) {
      console.error("[Settings Delete Project] Safely cascading relations: ", err);
      try {
        await prisma.project.delete({ where: { id: params.projectId } });
      } catch (innerErr) {
        console.error("[Settings Delete Project] Force fallback delete failed:", innerErr);
      }
    }
    return redirect("/dashboard");
  }

  const name = formData.get("name") as string;
  const systemPrompt = formData.get("systemPrompt") as string;
  const model = formData.get("model") as string;
  const primaryColor = formData.get("primaryColor") as string;
  const assistantName = formData.get("assistantName") as string;
  const assistantLogo = formData.get("assistantLogo") as string;
  const greetingMessage = formData.get("greetingMessage") as string;
  const suggestionsString = formData.get("suggestions") as string;
  const webhookUrl = formData.get("webhookUrl") as string;
  const customDomain = formData.get("customDomain") as string;
  const allowedDomainsString = formData.get("allowedDomains") as string;
  const removeBranding = formData.get("removeBranding") === "true";
  
  const leadPolicy = formData.get("leadPolicy") as string; // 'none', 'pre-chat', 'keywords'
  
  const bubbleShape = formData.get("bubbleShape") as string;
  const position = formData.get("position") as string;
  const font = formData.get("font") as string;
  
  const chatMode = formData.get("chatMode") as string || "ai-only";
  
  const rateLimitPerUser = parseInt(formData.get("rateLimitPerUser") as string || "0", 10);
  const rateLimitWindow = formData.get("rateLimitWindow") as string || "day";

  const leadFieldsRaw = formData.get("leadFields") as string;
  let leadFields: any[] = [];
  try {
    leadFields = JSON.parse(leadFieldsRaw || "[]");
  } catch {
    leadFields = [];
  }
  
  const slackWebhookUrl = formData.get("slackWebhookUrl") as string || "";
  
  const suggestions = suggestionsString ? suggestionsString.split("\n").filter(s => s.trim() !== "") : [];
  const allowedDomains = allowedDomainsString ? allowedDomainsString.split(",").map(d => d.trim()).filter(d => d !== "") : [];

  const settings = {
    systemPrompt,
    model,
    allowedDomains,
    chatMode,
    rateLimitPerUser,
    rateLimitWindow,
    leadFields,
    slackWebhookUrl,
    branding: {
      primaryColor,
      assistantName,
      assistantLogo,
      greetingMessage,
      suggestions,
      bubbleShape,
      position,
      font,
      removeBranding,
      customDomain,
      leadPolicy,
    }
  };

  await prisma.project.update({
    where: { id: params.projectId },
    data: { 
      name,
      webhookUrl,
      settings: settings as any,
    },
  });

  return json({ success: true, message: "Bot settings updated successfully" });
}

interface LeadField {
  id: string;
  label: string;
  type: 'text' | 'dropdown' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export default function ProjectSettings() {
  const { project } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  
  const currentSettings = (project.settings as any) || {};
  const [leadFields, setLeadFields] = useState<LeadField[]>(
    currentSettings.leadFields || []
  );
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string>('');
  const [slackTestStatus, setSlackTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [slackTestError, setSlackTestError] = useState<string>('');
  const branding = currentSettings.branding || {};
  const removeBranding = branding.removeBranding || false;
  const customDomain = branding.customDomain || "";

  const [systemPrompt, setSystemPrompt] = useState<string>(
    currentSettings.systemPrompt || "You are a helpful customer support assistant for a website. Use the provided context to answer questions accurately and concisely."
  );
  const [selectedPersona, setSelectedPersona] = useState<string>(() => {
    const match = PERSONAS.find(p => p.prompt === (currentSettings.systemPrompt || ""));
    return match?.id ?? "custom";
  });

  return (
    <div className="max-w-4xl">
      <Link to={`/dashboard/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to project
      </Link>
      
      <div className="mb-12">
        <h1 className="text-4xl font-black mb-2">Bot Settings</h1>
        <p className="text-text-muted">Customize how your AI assistant behaves and looks.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
        <div className="lg:col-span-3">
          <Form method="post" className="space-y-8">
            {/* General Settings */}
            <section className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <Settings className="text-primary w-5 h-5" /> General Configuration
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Project Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    defaultValue={project.name}
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center justify-between">
                    System Instructions (Prompt)
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Core Personality</span>
                  </label>

                  {/* Persona Selector */}
                  <div className="flex flex-wrap gap-2 mb-3 font-sans">
                    {PERSONAS.map((persona) => (
                      <button
                        key={persona.id}
                        type="button" // IMPORTANT: prevents form submission
                        onClick={() => {
                          setSystemPrompt(persona.prompt);
                          setSelectedPersona(persona.id);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          selectedPersona === persona.id
                            ? "bg-primary text-white border-primary"
                            : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        {persona.label}
                      </button>
                    ))}
                    {selectedPersona !== "custom" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPersona("custom");
                        }}
                        className="px-3 py-1.5 rounded-full text-xs text-zinc-400 border border-zinc-100 hover:border-zinc-300 transition-all font-medium cursor-pointer"
                      >
                        Custom ✕
                      </button>
                    )}
                  </div>

                  {selectedPersona !== "custom" && (
                    <p className="text-xs text-primary font-medium mb-3 font-sans">
                      {PERSONAS.find(p => p.id === selectedPersona)?.description}
                    </p>
                  )}

                  <textarea 
                    name="systemPrompt" 
                    rows={6}
                    value={systemPrompt}
                    onChange={(e) => {
                      setSystemPrompt(e.target.value);
                      setSelectedPersona("custom"); // selecting a persona then editing = custom
                    }}
                    placeholder="E.g. You are a friendly sales rep..."
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all font-sans"
                  />
                  <p className="mt-2 text-xs text-zinc-400">This defines how the bot responds and its general persona.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">AI Model</label>
                  <select
                    name="model"
                    defaultValue={currentSettings.model || "auto"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all font-sans"
                  >
                    <option value="auto">Auto (Recommended — fastest available)</option>
                    <option value="gpt-4o">GPT-4o (most capable)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (fast & economical)</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (fast)</option>
                    <option value="gemini-3.5-pro">Gemini 3.5 Pro (advanced reasoning)</option>
                  </select>
                  <p className="mt-2 text-xs text-zinc-400">Choose which AI model generates this bot's answers. Auto picks the best available provider.</p>
                </div>
                <div>
                  <label htmlFor="chatMode" className="block text-sm font-bold mb-2">
                    Chat Mode
                  </label>
                  <select
                    id="chatMode"
                    name="chatMode"
                    defaultValue={currentSettings.chatMode || "ai-only"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all font-sans"
                  >
                    <option value="ai-only">AI Only — AI answers everything automatically</option>
                    <option value="hybrid">Hybrid — AI answers, human can step in anytime</option>
                    <option value="agent-only">Agent Only — All chats go to human agents</option>
                  </select>
                  <p className="mt-2 text-xs text-zinc-400">
                    Controls how incoming conversations are handled.
                  </p>
                </div>
              </div>
            </section>

            {/* Appearance & Branding */}
            <section className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <Palette className="text-primary w-5 h-5" /> Branding & Theme Builder
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Assistant Name</label>
                  <input 
                    type="text" 
                    name="assistantName" 
                    id="assistantName"
                    defaultValue={branding.assistantName || "Support AI"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
                <div>
                   <label className="block text-sm font-bold mb-2">Assistant Logo (URL)</label>
                   <input 
                     type="url" 
                     name="assistantLogo" 
                     placeholder="https://..."
                     defaultValue={branding.assistantLogo || ""}
                     className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                   />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Theme Color (Hex)</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      name="primaryColor" 
                      id="primaryColor"
                      defaultValue={branding.primaryColor || "#155DEE"}
                      className="h-14 w-20 bg-zinc-50 border border-zinc-100 rounded-2xl p-1 cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={branding.primaryColor || "#155DEE"}
                      readOnly
                      className="flex-1 px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-zinc-400 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-bold mb-2">Font Family</label>
                  <select 
                    name="font" 
                    defaultValue={branding.font || "sans"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  >
                    <option value="sans">Modern Sans (Inter)</option>
                    <option value="serif">Classic Serif</option>
                    <option value="mono">Technical Mono</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold mb-2">Greeting Message</label>
                  <input 
                    type="text" 
                    name="greetingMessage" 
                    id="greetingMessage"
                    defaultValue={branding.greetingMessage || "Hi there! How can I help you today?"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-bold mb-2">Bubble Shape</label>
                  <select 
                    name="bubbleShape" 
                    defaultValue={branding.bubbleShape || "rounded-2xl"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  >
                    <option value="rounded-none">Square</option>
                    <option value="rounded-2xl">Modern (Default)</option>
                    <option value="rounded-full">Pill</option>
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-bold mb-2">Widget Position</label>
                  <select 
                    name="position" 
                    defaultValue={branding.position || "bottom-right"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Whitelabeling */}
            <section className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Zap className="text-brand-orange w-5 h-5" /> Whitelabeling (Pro)
                </h2>
                <div className="bg-brand-orange/10 text-brand-orange text-[10px] font-black uppercase px-2 py-1 rounded">Pro Feature</div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      name="removeBranding" 
                      value="true"
                      defaultChecked={removeBranding}
                      className="w-5 h-5 rounded border-zinc-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="block text-sm font-bold">Remove "Powered by SiteGist"</span>
                      <span className="block text-xs text-zinc-400 group-hover:text-zinc-500">Hide the SiteGist logo and link from your widget.</span>
                    </div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-brand-dark">Custom CNAME Domain</label>
                  <input 
                    type="text" 
                    name="customDomain" 
                    placeholder="chat.yourdomain.com"
                    defaultValue={customDomain}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all font-mono text-sm"
                  />
                  <p className="mt-2 text-xs text-zinc-400 font-medium leading-relaxed">
                    Point your CNAME record to <code className="bg-zinc-100 px-1 py-0.5 rounded">custom.sitegist.co</code> to enable custom domain hosting.
                  </p>
                </div>
              </div>
            </section>

            {/* Behavior */}
            <section className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <Zap className="text-primary w-5 h-5" /> Advanced Features
              </h2>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="webhookUrl" className="block text-sm font-bold">
                      Zapier / Webhook URL
                    </label>
                    <button
                      type="button"
                      disabled={testStatus === 'loading'}
                      onClick={async () => {
                        setTestStatus('loading');
                        setTestError('');
                        try {
                          const res = await fetch('/api/webhook-test', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectId: project.id }),
                          });
                          const data = await res.json();
                          if (res.ok && data.ok) {
                            setTestStatus('success');
                            setTimeout(() => setTestStatus('idle'), 4000);
                          } else {
                            setTestStatus('error');
                            setTestError(data.error || 'Failed to send test event.');
                            setTimeout(() => {
                              setTestStatus('idle');
                              setTestError('');
                            }, 5000);
                          }
                        } catch (err) {
                          setTestStatus('error');
                          setTestError('Network error. Failed to trigger test.');
                          setTimeout(() => {
                            setTestStatus('idle');
                            setTestError('');
                          }, 5000);
                        }
                      }}
                      className="text-xs font-extrabold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {testStatus === 'loading' && 'Sending...'}
                      {testStatus === 'success' && '✅ Sent Test Event!'}
                      {testStatus === 'error' && '❌ Failed'}
                      {testStatus === 'idle' && 'Send Test Event'}
                    </button>
                  </div>
                  <input 
                    id="webhookUrl"
                    type="url" 
                    name="webhookUrl" 
                    defaultValue={project.webhookUrl || ""}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all font-mono text-sm"
                  />
                  {testError && (
                    <p className="mt-1.5 text-xs text-red-500 font-semibold">{testError}</p>
                  )}
                  <div className="mt-3 text-xs text-zinc-400 space-y-1.5 font-medium leading-relaxed">
                    <p>
                      Paste a <strong>Zapier webhook URL</strong> to connect SiteGist to 5,000+ apps.
                      In Zapier, create a new Zap → trigger: <em>Webhooks by Zapier → Catch Hook</em> → paste the URL here.
                    </p>
                    <p>
                      Events sent: <code className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono text-[10px]">lead.captured</code>,{' '}
                      <code className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono text-[10px]">conversation.escalated</code>,{' '}
                      <code className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono text-[10px]">conversation.resolved</code>
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="slackWebhookUrl" className="block text-sm font-bold flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042a2.528 2.528 0 0 1-2.522 2.52H8.824a2.528 2.528 0 0 1-2.521-2.52v-5.042zM8.824 5.043a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.824 0a2.528 2.528 0 0 1 2.521 2.523v2.52h-2.521zm0 1.261a2.528 2.528 0 0 1 2.521 2.52v5.043a2.528 2.528 0 0 1-2.521 2.522H3.78a2.528 2.528 0 0 1-2.522-2.522V8.824A2.528 2.528 0 0 1 3.78 6.304h5.043zm10.134 3.78a2.528 2.528 0 0 1 2.522-2.521 2.528 2.528 0 0 1 2.52 2.521 2.528 2.528 0 0 1-2.52 2.52h-2.522v-2.52zm-1.262 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52V5.043a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.042zm-3.78 10.134a2.528 2.528 0 0 1 2.522 2.521 2.528 2.528 0 0 1-2.522 2.52 2.528 2.528 0 0 1-2.52-2.52v-2.521h2.52zm0-1.262a2.528 2.528 0 0 1-2.52-2.52v-5.043c0-1.393 1.13-2.522 2.52-2.522h5.043a2.528 2.528 0 0 1 2.522 2.522v5.043a2.528 2.528 0 0 1-2.522 2.522h-5.043z"/>
                      </svg>
                      Slack Incoming Webhook URL
                    </label>
                    <button
                      type="button"
                      disabled={slackTestStatus === 'loading'}
                      onClick={async () => {
                        setSlackTestStatus('loading');
                        setSlackTestError('');
                        try {
                          const res = await fetch('/api/slack-test', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectId: project.id }),
                          });
                          const data = await res.json();
                          if (res.ok && data.ok) {
                            setSlackTestStatus('success');
                            setTimeout(() => setSlackTestStatus('idle'), 4000);
                          } else {
                            setSlackTestStatus('error');
                            setSlackTestError(data.error || 'Failed to send test message.');
                            setTimeout(() => {
                              setSlackTestStatus('idle');
                              setSlackTestError('');
                            }, 5000);
                          }
                        } catch (err) {
                          setSlackTestStatus('error');
                          setSlackTestError('Network error. Failed to trigger Slack test.');
                          setTimeout(() => {
                            setSlackTestStatus('idle');
                            setSlackTestError('');
                          }, 5000);
                        }
                      }}
                      className="text-xs font-extrabold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {slackTestStatus === 'loading' && 'Sending...'}
                      {slackTestStatus === 'success' && '✅ Sent Slack Test!'}
                      {slackTestStatus === 'error' && '❌ Failed'}
                      {slackTestStatus === 'idle' && 'Send Test Message'}
                    </button>
                  </div>
                  <input 
                    id="slackWebhookUrl"
                    type="url" 
                    name="slackWebhookUrl" 
                    defaultValue={currentSettings.slackWebhookUrl || ""}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all font-mono text-sm"
                  />
                  {slackTestError && (
                    <p className="mt-1.5 text-xs text-red-500 font-semibold">{slackTestError}</p>
                  )}
                  <div className="mt-3 text-xs text-zinc-400 space-y-1.5 font-medium leading-relaxed">
                    <p>
                      Sends interactive notifications directly to a Slack channel when a lead is captured or human assistance is requested.
                    </p>
                    <p>
                      To generate an incoming webhook:{' '}
                      <a
                        href="https://api.slack.com/messaging/webhooks"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-primary transition-colors font-bold"
                      >
                        Create a Slack app → Enable Incoming Webhooks → Copy URL
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Rate Limiting */}
            <section className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <Bot className="text-primary w-5 h-5" /> Rate Limiting
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="rateLimitPerUser" className="block text-sm font-bold mb-2">
                    Max messages per visitor
                  </label>
                  <input
                    id="rateLimitPerUser"
                    name="rateLimitPerUser"
                    type="number"
                    min="0"
                    defaultValue={currentSettings.rateLimitPerUser || 0}
                    placeholder="0 = unlimited"
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  />
                  <p className="mt-2 text-xs text-zinc-400">Set to 0 to disable rate limiting.</p>
                </div>
                <div>
                  <label htmlFor="rateLimitWindow" className="block text-sm font-bold mb-2">
                    Per Time Window
                  </label>
                  <select
                    id="rateLimitWindow"
                    name="rateLimitWindow"
                    defaultValue={currentSettings.rateLimitWindow || "day"}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all font-sans"
                  >
                    <option value="hour">Hour</option>
                    <option value="day">Day</option>
                  </select>
                  <p className="mt-2 text-xs text-zinc-400 font-medium">Reset interval for visitor rate limit count.</p>
                </div>
              </div>
            </section>

            {/* Lead Generation */}
            <section className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <Users className="text-primary w-5 h-5" /> Lead Generation
              </h2>
              <div className="space-y-6">
                <div>
                   <label className="block text-sm font-bold mb-2">Collection Strategy</label>
                   <select 
                     name="leadPolicy" 
                     defaultValue={branding.leadPolicy || "keywords"}
                     className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                   >
                     <option value="none">Disabled (No Form)</option>
                     <option value="pre-chat">Pre-Chat (Ask immediately)</option>
                     <option value="keywords">Intelligence (Ask when intent matches)</option>
                     <option value="handoff">Handoff (Ask when human requested)</option>
                   </select>
                   <p className="mt-2 text-xs text-zinc-400 font-medium leading-relaxed">
                     Choose when to show the lead collection form to your visitors.
                   </p>
                </div>
                <div>
                   <label className="block text-sm font-bold mb-2 text-brand-dark">Captured Fields</label>
                   <div className="flex flex-wrap gap-2">
                     {['Name', 'Email', 'Phone', 'Company'].map(field => (
                       <div key={field} className="px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-sm">
                         <Check className="w-3 h-3 text-green-500" /> {field}
                       </div>
                     ))}
                   </div>
                   <p className="mt-2 text-xs text-zinc-400 font-medium">Capture these details automatically when users request human help or special access.</p>
                </div>

                <div className="border-t border-zinc-100 pt-6 space-y-4">
                  <input type="hidden" name="leadFields" value={JSON.stringify(leadFields)} />
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-brand-dark">Custom Lead Fields</label>
                    <button
                      type="button"
                      onClick={() => setLeadFields(prev => [...prev, {
                        id: Math.random().toString(36).substring(2, 9),
                        label: '',
                        type: 'text',
                        required: false,
                        options: [],
                      }])}
                      className="text-xs font-bold text-primary hover:underline hover:brightness-110 flex items-center gap-1 cursor-pointer"
                    >
                      + Add Custom Field
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium">Configure extra answers you'd like to collect, such as Company size, Role, or Budget.</p>

                  <div className="space-y-4">
                    {leadFields.map((field, i) => (
                      <div key={field.id} className="border border-zinc-150 rounded-2xl p-4 space-y-3 bg-zinc-50/50">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Field label (e.g. Budget size)"
                            value={field.label}
                            onChange={e => setLeadFields(prev =>
                              prev.map((f, idx) => idx === i ? { ...f, label: e.target.value } : f)
                            )}
                            required
                            className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary/10 outline-none text-sm font-medium transition-all"
                          />
                          <select
                            value={field.type}
                            onChange={e => setLeadFields(prev =>
                              prev.map((f, idx) => idx === i ? { ...f, type: e.target.value as LeadField['type'] } : f)
                            )}
                            className="px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary/10 outline-none text-sm font-medium transition-all"
                          >
                            <option value="text">Text Input</option>
                            <option value="dropdown">Dropdown (Select)</option>
                            <option value="checkbox">Checkbox (Yes/No)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setLeadFields(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-zinc-400 hover:text-red-500 font-bold text-sm p-1 transition-colors cursor-pointer"
                            title="Remove Field"
                          >
                            ✕
                          </button>
                        </div>

                        {field.type === 'dropdown' && (
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">Dropdown Options (one per line)</label>
                            <textarea
                              placeholder={"Small (1–10)\nMedium (11–50)\nLarge (50+)"}
                              value={(field.options || []).join('\n')}
                              onChange={e => setLeadFields(prev =>
                                prev.map((f, idx) => idx === i
                                  ? { ...f, options: e.target.value.split('\n').filter(line => line.trim() !== "") }
                                  : f)
                              )}
                              rows={3}
                              required
                              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary/10 outline-none text-sm font-medium transition-all"
                            />
                          </div>
                        )}

                        <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 select-none cursor-pointer w-fit">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={e => setLeadFields(prev =>
                              prev.map((f, idx) => idx === i ? { ...f, required: e.target.checked } : f)
                            )}
                            className="w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary/10 cursor-pointer"
                          />
                          This field is required
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Behavior */}
            <section className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <MessageSquare className="text-primary w-5 h-5" /> Conversation Starters
              </h2>
              <div>
                <label className="block text-sm font-bold mb-2 uppercase tracking-widest text-zinc-400 text-[10px]">Suggestions (One per line)</label>
                <textarea 
                  name="suggestions" 
                  rows={4}
                  defaultValue={(branding.suggestions || []).join("\n")}
                  placeholder="What are your hours?&#10;How does pricing work?&#10;Talk to a human"
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-primary/10 outline-none transition-all font-sans"
                />
                <p className="mt-2 text-xs text-zinc-400">These chips appear when the chat first opens to help users start a conversation.</p>
              </div>
            </section>

            <div className="flex items-center justify-between gap-4 pt-4">
              {actionData?.success && <p className="text-green-500 font-bold">{actionData.message}</p>}
              <div className="flex-1" />
              <button 
                type="submit" 
                disabled={isSaving}
                className="px-10 py-5 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-primary/20"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Bot Settings
              </button>
            </div>
          </Form>

          {/* Danger Zone */}
          <section className="bg-red-50/20 p-8 rounded-[32px] border border-red-100/60 mt-12">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-3 text-red-700">
              <Trash2 className="w-5 h-5 text-red-500" /> Danger Zone
            </h2>
            <p className="text-xs text-red-600/85 mb-6 font-medium leading-relaxed">
              Permanently delete this chatbot, along with all of its custom trained knowledge files, crawled URLs, manual Q&As, feedback stats, capture leads, and live inbox history. This process is irreversible.
            </p>
            <Form method="post" onSubmit={(e) => {
              if (!confirm("Are you absolutely sure you want to delete this chatbot? This will permanently wipe all training data and live history. This action cannot be undone.")) {
                e.preventDefault();
              }
            }}>
              <input type="hidden" name="_action" value="delete_project" />
              <button
                type="submit"
                className="px-6 py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black rounded-2xl flex items-center gap-2 transition-all shadow-md shadow-red-200 uppercase tracking-widest"
              >
                <Trash2 className="w-4 h-4" /> Delete Chatbot Permanently
              </button>
            </Form>
          </section>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="sticky top-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-black uppercase tracking-[0.2em] text-brand-gray text-[11px]">Studio Preview</h3>
              <div className="flex items-center gap-2 text-[10px] font-bold text-brand-online">
                <div className="w-1.5 h-1.5 bg-brand-online rounded-full animate-pulse" />
                Live Sync
              </div>
            </div>

            <div className="bg-[#F8F9FA] rounded-[48px] p-8 border border-brand-border aspect-[4/5] flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-50" />
              
              {/* Mock Widget UI */}
              <div className="relative z-10 w-full max-w-xs bg-white rounded-[32px] shadow-2xl border border-zinc-100 overflow-hidden flex flex-col h-full translate-y-4">
                <div className="p-4 flex items-center justify-between border-b border-zinc-50" style={{ backgroundColor: branding.primaryColor || '#155DEE' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{branding.assistantName || "Support AI"}</h4>
                      <p className="text-[10px] text-white/70 font-bold">Online</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-zinc-50/50">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-zinc-100 rounded-full flex-shrink-0 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-zinc-100 text-xs font-medium text-brand-dark">
                      {branding.greetingMessage || "Hi there! How can I help you today?"}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white border-t border-zinc-50">
                  <div className="p-3 bg-zinc-50 rounded-xl text-xs text-text-muted flex items-center justify-between">
                    Type a message...
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: branding.primaryColor || '#155DEE' }}>
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Trigger Button */}
              <div className="absolute bottom-12 right-12 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transform hover:scale-110 transition-transform cursor-pointer" style={{ backgroundColor: branding.primaryColor || '#155DEE' }}>
                <MessageSquare className="text-white w-8 h-8" />
              </div>
            </div>

            <div className="mt-8 p-6 bg-primary/5 border border-primary/10 rounded-3xl">
              <p className="text-xs text-primary font-medium leading-relaxed">
                <span className="font-black uppercase tracking-widest text-[9px] block mb-1">Pro Tip</span>
                Changes are reflected in the live preview instantly. Tap "Save Bot Settings" to apply them to your live website widget.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-20 p-10 bg-zinc-900 rounded-[40px] text-white overflow-hidden relative group">
        <Bot className="absolute -right-10 -bottom-10 w-64 h-64 opacity-5 group-hover:scale-110 transition-transform duration-700" />
        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-4">Preview your Bot</h3>
          <p className="text-zinc-400 mb-8 max-w-md">Remember to test your changes in the playground to ensure the instructions are working as expected.</p>
          <Link to={`/dashboard/playground?projectId=${project.id}`} className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-bold transition-all">
            Open Playground <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);
