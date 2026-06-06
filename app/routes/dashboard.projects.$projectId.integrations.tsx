import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useRevalidator, useFetcher } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { ChevronLeft, Share2, Database, Github, Globe, FileText, Check, AlertCircle, ExternalLink, MessageSquare, MessageCircle, Headphones } from "lucide-react";
import { useState, useEffect } from "react";

export async function action({ params, request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });
  if (!project) return json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  // --- SLACK ---
  if (_action === "connect_slack") {
    const webhookUrl = (formData.get("webhookUrl") as string)?.trim();
    if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
      return json(
        { error: "Enter a valid Slack Incoming Webhook URL (https://hooks.slack.com/...)" },
        { status: 400 }
      );
    }
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "slack" } },
      create: { projectId: project.id, provider: "slack", accessToken: webhookUrl, details: { webhookUrl } },
      update: { accessToken: webhookUrl, details: { webhookUrl } },
    });
    return json({ success: true });
  }

  if (_action === "disconnect_slack") {
    await prisma.integration.deleteMany({
      where: { projectId: project.id, provider: "slack" },
    });
    return json({ success: true });
  }

  // --- ZAPIER ---
  if (_action === "connect_zapier") {
    const webhookUrl = (formData.get("webhookUrl") as string)?.trim();
    if (!webhookUrl || !webhookUrl.startsWith("https://hooks.zapier.com/")) {
      return json(
        { error: "Enter a valid Zapier Webhook URL (https://hooks.zapier.com/...)" },
        { status: 400 }
      );
    }
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "zapier" } },
      create: { projectId: project.id, provider: "zapier", accessToken: webhookUrl, details: { webhookUrl } },
      update: { accessToken: webhookUrl, details: { webhookUrl } },
    });
    return json({ success: true });
  }

  if (_action === "disconnect_zapier") {
    await prisma.integration.deleteMany({
      where: { projectId: project.id, provider: "zapier" },
    });
    return json({ success: true });
  }

  // --- FRESHDESK ---
  if (_action === "connect_freshdesk") {
    const domain = (formData.get("freshdeskDomain") as string)?.trim().replace(/\/+$/, "");
    const apiKey = (formData.get("freshdeskApiKey") as string)?.trim();
    if (!domain || !apiKey) {
      return json({ error: "Domain and API key are required." }, { status: 400 });
    }

    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "freshdesk" } },
      create: {
        projectId: project.id,
        provider: "freshdesk",
        accessToken: apiKey,
        details: { domain },
      },
      update: { accessToken: apiKey, details: { domain } },
    });

    return json({ success: true });
  }

  if (_action === "disconnect_freshdesk") {
    await prisma.integration.deleteMany({
      where: { projectId: project.id, provider: "freshdesk" },
    });
    return json({ success: true });
  }

  // --- ZOHO DESK ---
  if (_action === "disconnect_zoho") {
    await prisma.integration.deleteMany({
      where: { projectId: project.id, provider: "zoho" },
    });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    include: { integrations: true },
  });

  if (!project) return redirect("/dashboard");

  return json({ project });
}

export default function ProjectIntegrations() {
  const { project } = useLoaderData<typeof loader>();
  const [connecting, setConnecting] = useState<string | null>(null);
  const revalidator = useRevalidator();
  const [slackInput, setSlackInput] = useState("");
  const [zapierInput, setZapierInput] = useState("");
  const [freshdeskDomain, setFreshdeskDomain] = useState("");
  const [freshdeskApiKey, setFreshdeskApiKey] = useState("");

  const slackFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const zapierFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const freshdeskFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const zohoFetcher = useFetcher<{ error?: string; success?: boolean }>();

  // Trigger revalidation/refresh when a fetcher finishes successfully
  useEffect(() => {
    if (slackFetcher.data?.success) {
      setSlackInput("");
      revalidator.revalidate();
    }
  }, [slackFetcher.data, revalidator]);

  useEffect(() => {
    if (zapierFetcher.data?.success) {
      setZapierInput("");
      revalidator.revalidate();
    }
  }, [zapierFetcher.data, revalidator]);

  useEffect(() => {
    if (freshdeskFetcher.data?.success) {
      setFreshdeskDomain("");
      setFreshdeskApiKey("");
      revalidator.revalidate();
    }
  }, [freshdeskFetcher.data, revalidator]);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        // Refresh data
        revalidator.revalidate();
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [revalidator]);

  const handleConnect = async (provider: string) => {
    if (provider !== 'notion' && provider !== 'google_drive' && provider !== 'crisp' && provider !== 'messenger' && provider !== 'intercom' && provider !== 'zoho') return;
    setConnecting(provider);
    try {
      const endpoint =
        provider === 'notion' ? 'notion' :
        provider === 'messenger' ? 'messenger' :
        provider === 'crisp' ? 'crisp' :
        provider === 'intercom' ? 'intercom' :
        provider === 'zoho' ? 'zoho' :
        'google';
      const response = await fetch(`/api/auth/${endpoint}/url?projectId=${project.id}`);
      const data = await response.json();
      if (data.url) {
        // Open OAuth in new window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(data.url, 'Connect Service', `width=${width},height=${height},left=${left},top=${top}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(null);
    }
  };

  const integrations = [
    {
      id: "notion",
      name: "Notion",
      description: "Auto-sync your Notion workspace pages and databases.",
      icon: <Database className="w-6 h-6 text-zinc-900" />,
      connected: project.integrations.some(i => i.provider === 'notion'),
    },
    {
      id: "google_drive",
      name: "Google Drive",
      description: "Extract knowledge from Docs, Sheets, and PDFs in your Drive.",
      icon: <FileText className="w-6 h-6 text-blue-600" />,
      connected: project.integrations.some(i => i.provider === 'google_drive'),
    },
    {
      id: "slack",
      name: "Slack",
      description: "Respond to inquiries directly from Slack threads.",
      icon: <Share2 className="w-6 h-6 text-purple-600" />,
      connected: project.integrations.some(i => i.provider === 'slack'),
    },
    {
      id: "zapier",
      name: "Zapier",
      description: "Connect triggers and actions to 5,000+ other apps.",
      icon: <ZapIcon className="w-6 h-6 text-orange-600" />,
      connected: project.integrations.some(i => i.provider === 'zapier'),
    },
    {
      id: "crisp",
      name: "Crisp",
      description: "Deploy your AI agent inside Crisp live chat to answer visitors automatically.",
      icon: <MessageSquare className="w-6 h-6 text-blue-500" />,
      connected: project.integrations.some(i => i.provider === 'crisp'),
    },
    {
      id: "intercom",
      name: "Intercom",
      description: "Deploy your AI agent inside Intercom Messenger and hand off escalated chats to human agents.",
      icon: <MessageCircle className="w-6 h-6 text-blue-500" />,
      connected: project.integrations.some(i => i.provider === 'intercom'),
    },
    {
      id: "messenger",
      name: "Facebook Messenger",
      description: "Deploy your AI agent inside Messenger to auto-reply to your Facebook Page DMs.",
      icon: <MessengerIcon className="w-6 h-6 text-blue-600" />,
      connected: project.integrations.some(i => i.provider === 'messenger'),
    },
    {
      id: "freshdesk",
      name: "Freshdesk",
      description: "Automatically create a Freshdesk ticket when a conversation is escalated.",
      icon: <Headphones className="w-6 h-6 text-green-600" />,
      connected: project.integrations.some(i => i.provider === 'freshdesk'),
    },
    {
      id: "zoho",
      name: "Zoho Desk",
      description: "Turn escalated conversations into Zoho Desk tickets automatically.",
      icon: <Headphones className="w-6 h-6 text-red-600" />,
      connected: project.integrations.some(i => i.provider === 'zoho'),
    }
  ];

  return (
    <div className="max-w-4xl">
      <Link to={`/dashboard/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-brand-gray transition-colors mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to project
      </Link>
      
      <div className="mb-12">
        <h1 className="text-4xl font-black mb-2">Integrations</h1>
        <p className="text-text-muted">Connect your favorite tools to keep your AI's knowledge up to date automatically.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((item) => (
          <div key={item.id} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm hover:border-primary/20 transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-zinc-50 border border-zinc-100 group-hover:bg-white group-hover:shadow-lg transition-all`}>
                {item.icon}
              </div>
              {item.connected ? (
                <div className="flex items-center gap-1 text-xs font-black text-green-500 uppercase">
                  <Check className="w-3 h-3" /> Connected
                </div>
              ) : (
                <div className="text-[10px] font-black text-brand-orange uppercase px-2 py-1 bg-brand-orange/5 rounded">Available</div>
              )}
            </div>
            <h3 className="text-xl font-bold mb-2">{item.name}</h3>
            <p className="text-sm text-zinc-500 mb-8 leading-relaxed">{item.description}</p>
            
            {item.id !== 'slack' && item.id !== 'zapier' && item.id !== 'freshdesk' && (
              <button 
                onClick={() => !item.connected && handleConnect(item.id)}
                disabled={item.connected || connecting === item.id}
                className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${
                  item.connected 
                    ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" 
                    : "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]"
                }`}
              >
                {connecting === item.id ? "Connecting..." : item.connected ? "Already Integrated" : `Connect ${item.name}`}
                {!item.connected && <ExternalLink className="w-4 h-4" />}
              </button>
            )}

            {item.id === 'slack' && (
              <div className="mt-0">
                {!item.connected ? (
                  <slackFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_slack" />
                    <input
                      type="url"
                      name="webhookUrl"
                      value={slackInput}
                      onChange={(e) => setSlackInput(e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2"
                    />
                    {slackFetcher.data?.error && (
                      <p className="text-xs text-red-500 font-bold mb-2">{slackFetcher.data.error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!slackInput || slackFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {slackFetcher.state === "submitting" ? "Saving..." : "Connect Slack"}
                    </button>
                    <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed text-center">
                      Get your Webhook URL from{" "}
                      <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold">
                        Slack App settings
                      </a>
                    </p>
                  </slackFetcher.Form>
                ) : (
                  <slackFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_slack" />
                    <button
                      type="submit"
                      className="w-full py-4 rounded-2xl font-black bg-zinc-100 text-zinc-400 cursor-not-allowed flex items-center justify-center"
                    >
                      Already Integrated
                    </button>
                    <button
                      type="submit"
                      className="w-full mt-2 py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all"
                    >
                      Disconnect Slack
                    </button>
                  </slackFetcher.Form>
                )}
              </div>
            )}

            {item.id === 'zapier' && (
              <div className="mt-0">
                {!item.connected ? (
                  <zapierFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_zapier" />
                    <input
                      type="url"
                      name="webhookUrl"
                      value={zapierInput}
                      onChange={(e) => setZapierInput(e.target.value)}
                      placeholder="https://hooks.zapier.com/hooks/catch/..."
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2"
                    />
                    {zapierFetcher.data?.error && (
                      <p className="text-xs text-red-500 font-bold mb-2">{zapierFetcher.data.error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!zapierInput || zapierFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {zapierFetcher.state === "submitting" ? "Saving..." : "Connect Zapier"}
                    </button>
                    <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed text-center">
                      Create a{" "}
                      <a href="https://zapier.com/apps/webhook" target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold">
                        Webhooks by Zapier
                      </a>
                      {" "}trigger and paste the URL above
                    </p>
                  </zapierFetcher.Form>
                ) : (
                  <zapierFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_zapier" />
                    <button
                      type="submit"
                      className="w-full py-4 rounded-2xl font-black bg-zinc-100 text-zinc-400 cursor-not-allowed flex items-center justify-center"
                    >
                      Already Integrated
                    </button>
                    <button
                      type="submit"
                      className="w-full mt-2 py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all"
                    >
                      Disconnect Zapier
                    </button>
                  </zapierFetcher.Form>
                )}
              </div>
            )}

            {item.id === 'freshdesk' && (
              <div className="mt-0">
                {!item.connected ? (
                  <freshdeskFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_freshdesk" />
                    <input
                      type="text"
                      name="freshdeskDomain"
                      value={freshdeskDomain}
                      onChange={(e) => setFreshdeskDomain(e.target.value)}
                      placeholder="Domain (e.g. yourcompany)"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2"
                    />
                    <input
                      type="password"
                      name="freshdeskApiKey"
                      value={freshdeskApiKey}
                      onChange={(e) => setFreshdeskApiKey(e.target.value)}
                      placeholder="Freshdesk API key"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2"
                    />
                    {freshdeskFetcher.data?.error && (
                      <p className="text-xs text-red-500 font-bold mb-2">{freshdeskFetcher.data.error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!freshdeskDomain || !freshdeskApiKey || freshdeskFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {freshdeskFetcher.state === "submitting" ? "Saving..." : "Connect Freshdesk"}
                    </button>
                    <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed text-center">
                      Find your API key under Freshdesk &rarr; Profile Settings &rarr; Your API Key.
                    </p>
                  </freshdeskFetcher.Form>
                ) : (
                  <freshdeskFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_freshdesk" />
                    <button
                      type="button"
                      className="w-full py-4 rounded-2xl font-black bg-zinc-100 text-zinc-400 cursor-not-allowed flex items-center justify-center"
                    >
                      Already Integrated
                    </button>
                    <button
                      type="submit"
                      className="w-full mt-2 py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer"
                    >
                      Disconnect Freshdesk
                    </button>
                  </freshdeskFetcher.Form>
                )}
              </div>
            )}

            {item.id === 'zoho' && item.connected && (
              <div className="mt-2">
                <zohoFetcher.Form method="post">
                  <input type="hidden" name="_action" value="disconnect_zoho" />
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer"
                  >
                    Disconnect Zoho Desk
                  </button>
                </zohoFetcher.Form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const MessengerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.814 1.27 5.33 3.285 7.066V22l3.007-1.652A10.8 10.8 0 0 0 12 20.517c5.523 0 10-4.144 10-9.258C22 6.145 17.523 2 12 2Zm1.018 12.456-2.545-2.714-4.97 2.714 5.467-5.8 2.607 2.714 4.908-2.714-5.467 5.8Z"/>
  </svg>
);

