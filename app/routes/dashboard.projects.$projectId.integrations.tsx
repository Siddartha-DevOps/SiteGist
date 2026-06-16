import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useRevalidator, useFetcher } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { ChevronLeft, Share2, Database, Globe, FileText, Check, ExternalLink, MessageSquare, MessageCircle, Headphones, BookOpen } from "lucide-react";
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

  // --- ZENDESK ---
  if (_action === "connect_zendesk") {
    const subdomain = (formData.get("zendeskSubdomain") as string)?.trim();
    const email = (formData.get("zendeskEmail") as string)?.trim();
    const apiToken = (formData.get("zendeskApiToken") as string)?.trim();
    if (!subdomain || !email || !apiToken) {
      return json({ error: "Subdomain, email, and API token are required." }, { status: 400 });
    }
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "zendesk" } },
      create: {
        projectId: project.id,
        provider: "zendesk",
        accessToken: apiToken,
        details: { subdomain, email },
      },
      update: { accessToken: apiToken, details: { subdomain, email } },
    });
    return json({ success: true });
  }

  if (_action === "disconnect_zendesk") {
    await prisma.integration.deleteMany({
      where: { projectId: project.id, provider: "zendesk" },
    });
    return json({ success: true });
  }

  // --- HUBSPOT ---
  if (_action === "connect_hubspot") {
    const apiKey = (formData.get("hubspotApiKey") as string)?.trim();
    if (!apiKey) return json({ error: "API key is required." }, { status: 400 });
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "hubspot" } },
      create: { projectId: project.id, provider: "hubspot", accessToken: apiKey },
      update: { accessToken: apiKey },
    });
    return json({ success: true });
  }
  if (_action === "disconnect_hubspot") {
    await prisma.integration.deleteMany({ where: { projectId: project.id, provider: "hubspot" } });
    return json({ success: true });
  }

  // --- SHOPIFY ---
  if (_action === "connect_shopify") {
    const shop = (formData.get("shopifyShop") as string)?.trim().replace(/\.myshopify\.com$/, "");
    const token = (formData.get("shopifyToken") as string)?.trim();
    if (!shop || !token) return json({ error: "Shop name and token are required." }, { status: 400 });
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "shopify" } },
      create: { projectId: project.id, provider: "shopify", accessToken: token, details: { shop } },
      update: { accessToken: token, details: { shop } },
    });
    return json({ success: true });
  }
  if (_action === "disconnect_shopify") {
    await prisma.integration.deleteMany({ where: { projectId: project.id, provider: "shopify" } });
    return json({ success: true });
  }
  if (_action === "sync_shopify") {
    const shopifyInteg = await prisma.integration.findUnique({
      where: { projectId_provider: { projectId: project.id, provider: "shopify" } },
    });
    if (!shopifyInteg) return json({ error: "Shopify not connected." }, { status: 400 });
    const { syncShopifyProducts } = await import("~/lib/shopify.server");
    const count = await syncShopifyProducts(
      project.id,
      (shopifyInteg.details as any).shop,
      shopifyInteg.accessToken
    );
    return json({ success: true, message: `Synced ${count} products from Shopify.` });
  }

  // --- GITBOOK ---
  if (_action === "connect_gitbook") {
    const apiToken = (formData.get("gitbookToken") as string)?.trim();
    const spaceId = (formData.get("gitbookSpaceId") as string)?.trim();
    if (!apiToken || !spaceId) return json({ error: "API token and space ID are required." }, { status: 400 });
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "gitbook" } },
      create: { projectId: project.id, provider: "gitbook", accessToken: apiToken, details: { spaceId } },
      update: { accessToken: apiToken, details: { spaceId } },
    });
    return json({ success: true });
  }
  if (_action === "disconnect_gitbook") {
    await prisma.integration.deleteMany({ where: { projectId: project.id, provider: "gitbook" } });
    return json({ success: true });
  }
  if (_action === "sync_gitbook") {
    const gitbookInteg = await prisma.integration.findUnique({
      where: { projectId_provider: { projectId: project.id, provider: "gitbook" } },
    });
    if (!gitbookInteg) return json({ error: "GitBook not connected." }, { status: 400 });
    const { syncGitbookSpace } = await import("~/lib/gitbook.server");
    const count = await syncGitbookSpace(
      project.id,
      gitbookInteg.accessToken,
      (gitbookInteg.details as any).spaceId
    );
    return json({ success: true, message: `Synced ${count} GitBook pages.` });
  }

  // --- SLACK BOT ---
  if (_action === "connect_slack_bot") {
    const botToken = (formData.get("slackBotToken") as string)?.trim();
    const signingSecret = (formData.get("slackSigningSecret") as string)?.trim();
    if (!botToken || !signingSecret) return json({ error: "Bot token and signing secret are required." }, { status: 400 });
    // Verify token and auto-fetch workspace info
    const authRes = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const authData = await authRes.json();
    if (!authData.ok) return json({ error: `Invalid bot token: ${authData.error}` }, { status: 400 });
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "slack_bot" } },
      create: {
        projectId: project.id,
        provider: "slack_bot",
        accessToken: botToken,
        details: { signingSecret, workspaceId: authData.team_id, botUserId: authData.user_id, teamName: authData.team },
      },
      update: {
        accessToken: botToken,
        details: { signingSecret, workspaceId: authData.team_id, botUserId: authData.user_id, teamName: authData.team },
      },
    });
    return json({ success: true });
  }
  if (_action === "disconnect_slack_bot") {
    await prisma.integration.deleteMany({ where: { projectId: project.id, provider: "slack_bot" } });
    return json({ success: true });
  }

  // --- GOOGLE CHAT ---
  if (_action === "connect_google_chat") {
    const verificationToken = (formData.get("googleChatToken") as string)?.trim();
    if (!verificationToken) return json({ error: "Verification token is required." }, { status: 400 });
    await prisma.integration.upsert({
      where: { projectId_provider: { projectId: project.id, provider: "google_chat" } },
      create: { projectId: project.id, provider: "google_chat", accessToken: verificationToken },
      update: { accessToken: verificationToken },
    });
    return json({ success: true });
  }
  if (_action === "disconnect_google_chat") {
    await prisma.integration.deleteMany({ where: { projectId: project.id, provider: "google_chat" } });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    include: {
      integrations: true,
      _count: { select: { zapierHooks: true } },
    },
  });

  if (!project) return redirect("/dashboard");

  const appUrl = process.env.APP_URL || "https://app.sitegist.co";
  return json({ project, appUrl });
}

export default function ProjectIntegrations() {
  const { project, appUrl } = useLoaderData<typeof loader>();
  const [connecting, setConnecting] = useState<string | null>(null);
  const revalidator = useRevalidator();
  const [slackInput, setSlackInput] = useState("");
  const [zapierInput, setZapierInput] = useState("");
  const [freshdeskDomain, setFreshdeskDomain] = useState("");
  const [freshdeskApiKey, setFreshdeskApiKey] = useState("");
  const [zendeskSubdomain, setZendeskSubdomain] = useState("");
  const [zendeskEmail, setZendeskEmail] = useState("");
  const [zendeskApiToken, setZendeskApiToken] = useState("");
  const [hubspotApiKey, setHubspotApiKey] = useState("");
  const [shopifyShop, setShopifyShop] = useState("");
  const [shopifyToken, setShopifyToken] = useState("");
  const [gitbookToken, setGitbookToken] = useState("");
  const [gitbookSpaceId, setGitbookSpaceId] = useState("");
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const [googleChatToken, setGoogleChatToken] = useState("");

  const slackFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const zapierFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const freshdeskFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const zohoFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const zendeskFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const hubspotFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const shopifyFetcher = useFetcher<{ error?: string; success?: boolean; message?: string }>();
  const gitbookFetcher = useFetcher<{ error?: string; success?: boolean; message?: string }>();
  const slackBotFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const googleChatFetcher = useFetcher<{ error?: string; success?: boolean }>();

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
    if (zendeskFetcher.data?.success) {
      setZendeskSubdomain("");
      setZendeskEmail("");
      setZendeskApiToken("");
      revalidator.revalidate();
    }
  }, [zendeskFetcher.data, revalidator]);

  useEffect(() => {
    if (hubspotFetcher.data?.success) { setHubspotApiKey(""); revalidator.revalidate(); }
  }, [hubspotFetcher.data, revalidator]);

  useEffect(() => {
    if (shopifyFetcher.data?.success) { setShopifyShop(""); setShopifyToken(""); revalidator.revalidate(); }
  }, [shopifyFetcher.data, revalidator]);

  useEffect(() => {
    if (gitbookFetcher.data?.success) { setGitbookToken(""); setGitbookSpaceId(""); revalidator.revalidate(); }
  }, [gitbookFetcher.data, revalidator]);

  useEffect(() => {
    if (slackBotFetcher.data?.success) { setSlackBotToken(""); setSlackSigningSecret(""); revalidator.revalidate(); }
  }, [slackBotFetcher.data, revalidator]);

  useEffect(() => {
    if (googleChatFetcher.data?.success) { setGoogleChatToken(""); revalidator.revalidate(); }
  }, [googleChatFetcher.data, revalidator]);

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
    },
    {
      id: "zendesk",
      name: "Zendesk",
      description: "Automatically create a Zendesk ticket when a conversation is escalated to a human agent.",
      icon: <Headphones className="w-6 h-6 text-green-700" />,
      connected: project.integrations.some(i => i.provider === 'zendesk'),
    },
    {
      id: "hubspot",
      name: "HubSpot",
      description: "Auto-sync leads captured by your chatbot directly into HubSpot CRM as contacts.",
      icon: <HubspotIcon className="w-6 h-6 text-orange-500" />,
      connected: project.integrations.some(i => i.provider === 'hubspot'),
    },
    {
      id: "shopify",
      name: "Shopify",
      description: "Sync your Shopify product catalog as AI knowledge so your bot can answer product questions.",
      icon: <ShopifyIcon className="w-6 h-6 text-green-600" />,
      connected: project.integrations.some(i => i.provider === 'shopify'),
    },
    {
      id: "gitbook",
      name: "GitBook",
      description: "Sync your GitBook documentation space so your AI always has the latest content.",
      icon: <BookOpen className="w-6 h-6 text-blue-600" />,
      connected: project.integrations.some(i => i.provider === 'gitbook'),
    },
    {
      id: "slack_bot",
      name: "Slack Bot",
      description: "Deploy your AI assistant directly inside Slack — answer @mentions and DMs automatically.",
      icon: <SlackBotIcon className="w-6 h-6 text-indigo-600" />,
      connected: project.integrations.some(i => i.provider === 'slack_bot'),
    },
    {
      id: "google_chat",
      name: "Google Chat",
      description: "Add your AI assistant as a Google Chat bot to answer questions in your workspace.",
      icon: <GoogleChatIcon className="w-6 h-6 text-blue-500" />,
      connected: project.integrations.some(i => i.provider === 'google_chat'),
    },
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
            
            {item.id !== 'slack' && item.id !== 'zapier' && item.id !== 'freshdesk' && item.id !== 'zendesk' && item.id !== 'hubspot' && item.id !== 'shopify' && item.id !== 'gitbook' && item.id !== 'slack_bot' && item.id !== 'google_chat' && (
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
              <div className="mt-0 space-y-4">
                {/* Simple webhook paste approach */}
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
                      Use a{" "}
                      <span className="text-primary font-bold">Webhooks by Zapier</span>
                      {" "}trigger and paste the catch URL above
                    </p>
                  </zapierFetcher.Form>
                ) : (
                  <zapierFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_zapier" />
                    <button
                      type="button"
                      className="w-full py-4 rounded-2xl font-black bg-zinc-100 text-zinc-400 cursor-not-allowed flex items-center justify-center"
                    >
                      Webhook Connected
                    </button>
                    <button
                      type="submit"
                      className="w-full mt-2 py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer"
                    >
                      Disconnect Zapier
                    </button>
                  </zapierFetcher.Form>
                )}

                {/* REST Hooks API guide */}
                <details className="group">
                  <summary className="cursor-pointer text-xs font-bold text-zinc-500 hover:text-zinc-700 flex items-center gap-1 select-none list-none">
                    <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                    Developer: REST Hooks API
                    {(project as any)._count?.zapierHooks > 0 && (
                      <span className="ml-auto bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {(project as any)._count.zapierHooks} active
                      </span>
                    )}
                  </summary>
                  <div className="mt-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100 space-y-2">
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Register multiple Zaps per event type using the REST Hooks API. Authenticate with your{" "}
                      <a href="/dashboard/settings/api-keys" className="text-primary underline font-bold">SiteGist API key</a>.
                    </p>
                    <div className="space-y-1 font-mono text-[10px] text-zinc-600 bg-white border border-zinc-200 rounded-lg p-2">
                      <p className="text-zinc-400 font-sans font-bold text-[9px] uppercase mb-1">Subscribe</p>
                      <p>POST {appUrl}/api/zapier/hooks</p>
                      <p className="text-zinc-400 mt-1">{"{ projectId, hookUrl, event }"}</p>
                    </div>
                    <div className="space-y-1 font-mono text-[10px] text-zinc-600 bg-white border border-zinc-200 rounded-lg p-2">
                      <p className="text-zinc-400 font-sans font-bold text-[9px] uppercase mb-1">Unsubscribe</p>
                      <p>DELETE {appUrl}/api/zapier/hooks?hookId=…</p>
                    </div>
                    <div className="space-y-1 font-mono text-[10px] text-zinc-600 bg-white border border-zinc-200 rounded-lg p-2">
                      <p className="text-zinc-400 font-sans font-bold text-[9px] uppercase mb-1">Polling (sample data)</p>
                      <p>GET {appUrl}/api/zapier/leads?projectId=…</p>
                      <p>GET {appUrl}/api/zapier/conversations?projectId=…</p>
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      Supported events: <code className="bg-zinc-100 px-1 rounded">all</code>{" "}
                      <code className="bg-zinc-100 px-1 rounded">lead.captured</code>{" "}
                      <code className="bg-zinc-100 px-1 rounded">conversation.escalated</code>{" "}
                      <code className="bg-zinc-100 px-1 rounded">conversation.resolved</code>
                    </p>
                  </div>
                </details>
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

            {item.id === 'zendesk' && (
              <div className="mt-0">
                {!item.connected ? (
                  <zendeskFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_zendesk" />
                    <input
                      type="text"
                      name="zendeskSubdomain"
                      value={zendeskSubdomain}
                      onChange={(e) => setZendeskSubdomain(e.target.value)}
                      placeholder="Subdomain (e.g. yourcompany)"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2"
                    />
                    <input
                      type="email"
                      name="zendeskEmail"
                      value={zendeskEmail}
                      onChange={(e) => setZendeskEmail(e.target.value)}
                      placeholder="Admin email"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2"
                    />
                    <input
                      type="password"
                      name="zendeskApiToken"
                      value={zendeskApiToken}
                      onChange={(e) => setZendeskApiToken(e.target.value)}
                      placeholder="API token"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2"
                    />
                    {zendeskFetcher.data?.error && (
                      <p className="text-xs text-red-500 font-bold mb-2">{zendeskFetcher.data.error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!zendeskSubdomain || !zendeskEmail || !zendeskApiToken || zendeskFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {zendeskFetcher.state === "submitting" ? "Saving..." : "Connect Zendesk"}
                    </button>
                    <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed text-center">
                      Find your API token under Zendesk &rarr; Admin Center &rarr; Apps &amp; Integrations &rarr; API tokens.
                    </p>
                  </zendeskFetcher.Form>
                ) : (
                  <zendeskFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_zendesk" />
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
                      Disconnect Zendesk
                    </button>
                  </zendeskFetcher.Form>
                )}
              </div>
            )}

            {/* HUBSPOT */}
            {item.id === 'hubspot' && (
              <div className="mt-0">
                {!item.connected ? (
                  <hubspotFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_hubspot" />
                    <input
                      type="password"
                      name="hubspotApiKey"
                      value={hubspotApiKey}
                      onChange={(e) => setHubspotApiKey(e.target.value)}
                      placeholder="HubSpot Private App token"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2"
                    />
                    {hubspotFetcher.data?.error && <p className="text-xs text-red-500 font-bold mb-2">{hubspotFetcher.data.error}</p>}
                    <button type="submit" disabled={!hubspotApiKey || hubspotFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
                      {hubspotFetcher.state === "submitting" ? "Saving..." : "Connect HubSpot"}
                    </button>
                    <p className="text-[11px] text-zinc-400 mt-2 text-center">Create a Private App in HubSpot → Settings → Integrations → Private Apps.</p>
                  </hubspotFetcher.Form>
                ) : (
                  <hubspotFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_hubspot" />
                    <button type="button" className="w-full py-4 rounded-2xl font-black bg-zinc-100 text-zinc-400 cursor-not-allowed flex items-center justify-center">Already Integrated</button>
                    <button type="submit" className="w-full mt-2 py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer">Disconnect HubSpot</button>
                  </hubspotFetcher.Form>
                )}
              </div>
            )}

            {/* SHOPIFY */}
            {item.id === 'shopify' && (
              <div className="mt-0 space-y-3">
                {!item.connected ? (
                  <shopifyFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_shopify" />
                    <input type="text" name="shopifyShop" value={shopifyShop} onChange={(e) => setShopifyShop(e.target.value)}
                      placeholder="Shop name (e.g. mystore)"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2" />
                    <input type="password" name="shopifyToken" value={shopifyToken} onChange={(e) => setShopifyToken(e.target.value)}
                      placeholder="Admin API access token"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2" />
                    {shopifyFetcher.data?.error && <p className="text-xs text-red-500 font-bold mb-2">{shopifyFetcher.data.error}</p>}
                    <button type="submit" disabled={!shopifyShop || !shopifyToken || shopifyFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
                      {shopifyFetcher.state === "submitting" ? "Saving..." : "Connect Shopify"}
                    </button>
                    <p className="text-[11px] text-zinc-400 mt-2 text-center">Get an Admin API token from Shopify Admin → Settings → Apps → Develop apps.</p>
                  </shopifyFetcher.Form>
                ) : (
                  <shopifyFetcher.Form method="post">
                    <input type="hidden" name="_action" value="sync_shopify" />
                    <button type="submit" disabled={shopifyFetcher.state === "submitting"}
                      className="w-full py-3 rounded-2xl font-black bg-primary text-white hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                      {shopifyFetcher.state === "submitting" ? "Syncing…" : "Sync Products Now"}
                    </button>
                    {shopifyFetcher.data?.message && <p className="text-xs text-green-600 font-bold mt-1 text-center">{shopifyFetcher.data.message}</p>}
                  </shopifyFetcher.Form>
                )}
                {item.connected && (
                  <shopifyFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_shopify" />
                    <button type="submit" className="w-full py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer">Disconnect Shopify</button>
                  </shopifyFetcher.Form>
                )}
              </div>
            )}

            {/* GITBOOK */}
            {item.id === 'gitbook' && (
              <div className="mt-0 space-y-3">
                {!item.connected ? (
                  <gitbookFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_gitbook" />
                    <input type="password" name="gitbookToken" value={gitbookToken} onChange={(e) => setGitbookToken(e.target.value)}
                      placeholder="GitBook API token"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2" />
                    <input type="text" name="gitbookSpaceId" value={gitbookSpaceId} onChange={(e) => setGitbookSpaceId(e.target.value)}
                      placeholder="Space ID (from GitBook URL)"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2" />
                    {gitbookFetcher.data?.error && <p className="text-xs text-red-500 font-bold mb-2">{gitbookFetcher.data.error}</p>}
                    <button type="submit" disabled={!gitbookToken || !gitbookSpaceId || gitbookFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
                      {gitbookFetcher.state === "submitting" ? "Saving..." : "Connect GitBook"}
                    </button>
                    <p className="text-[11px] text-zinc-400 mt-2 text-center">Find your API token in GitBook → Settings → Developer → API tokens.</p>
                  </gitbookFetcher.Form>
                ) : (
                  <gitbookFetcher.Form method="post">
                    <input type="hidden" name="_action" value="sync_gitbook" />
                    <button type="submit" disabled={gitbookFetcher.state === "submitting"}
                      className="w-full py-3 rounded-2xl font-black bg-primary text-white hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                      {gitbookFetcher.state === "submitting" ? "Syncing…" : "Sync Pages Now"}
                    </button>
                    {gitbookFetcher.data?.message && <p className="text-xs text-green-600 font-bold mt-1 text-center">{gitbookFetcher.data.message}</p>}
                  </gitbookFetcher.Form>
                )}
                {item.connected && (
                  <gitbookFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_gitbook" />
                    <button type="submit" className="w-full py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer">Disconnect GitBook</button>
                  </gitbookFetcher.Form>
                )}
              </div>
            )}

            {/* SLACK BOT */}
            {item.id === 'slack_bot' && (
              <div className="mt-0">
                {!item.connected ? (
                  <slackBotFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_slack_bot" />
                    <input type="password" name="slackBotToken" value={slackBotToken} onChange={(e) => setSlackBotToken(e.target.value)}
                      placeholder="xoxb-... Bot User OAuth Token"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2" />
                    <input type="password" name="slackSigningSecret" value={slackSigningSecret} onChange={(e) => setSlackSigningSecret(e.target.value)}
                      placeholder="Signing Secret"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2" />
                    {slackBotFetcher.data?.error && <p className="text-xs text-red-500 font-bold mb-2">{slackBotFetcher.data.error}</p>}
                    <button type="submit" disabled={!slackBotToken || !slackSigningSecret || slackBotFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
                      {slackBotFetcher.state === "submitting" ? "Verifying…" : "Connect Slack Bot"}
                    </button>
                    <details className="mt-3">
                      <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 font-bold">Setup instructions ▶</summary>
                      <div className="mt-2 text-[11px] text-zinc-500 space-y-1 leading-relaxed">
                        <p>1. Create a Slack app at <span className="font-mono bg-zinc-100 px-1 rounded">api.slack.com/apps</span></p>
                        <p>2. Add Bot Token Scopes: <span className="font-mono bg-zinc-100 px-1 rounded">app_mentions:read</span>, <span className="font-mono bg-zinc-100 px-1 rounded">chat:write</span>, <span className="font-mono bg-zinc-100 px-1 rounded">im:history</span>, <span className="font-mono bg-zinc-100 px-1 rounded">im:read</span></p>
                        <p>3. Enable Event Subscriptions. Set Request URL to:</p>
                        <p className="font-mono bg-zinc-100 px-2 py-1 rounded text-[10px] break-all">{appUrl}/api/slack-events</p>
                        <p>4. Subscribe to: <span className="font-mono bg-zinc-100 px-1 rounded">app_mention</span>, <span className="font-mono bg-zinc-100 px-1 rounded">message.im</span></p>
                        <p>5. Install the app to your workspace and paste the Bot Token + Signing Secret above.</p>
                      </div>
                    </details>
                  </slackBotFetcher.Form>
                ) : (
                  <slackBotFetcher.Form method="post">
                    <input type="hidden" name="_action" value="disconnect_slack_bot" />
                    <button type="button" className="w-full py-4 rounded-2xl font-black bg-zinc-100 text-zinc-400 cursor-not-allowed flex items-center justify-center">Bot Active</button>
                    <button type="submit" className="w-full mt-2 py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer">Disconnect Slack Bot</button>
                  </slackBotFetcher.Form>
                )}
              </div>
            )}

            {/* GOOGLE CHAT */}
            {item.id === 'google_chat' && (
              <div className="mt-0">
                {!item.connected ? (
                  <googleChatFetcher.Form method="post">
                    <input type="hidden" name="_action" value="connect_google_chat" />
                    <input type="password" name="googleChatToken" value={googleChatToken} onChange={(e) => setGoogleChatToken(e.target.value)}
                      placeholder="Verification token (optional)"
                      className="w-full px-4 py-3 text-sm border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-brand-dark placeholder:text-brand-gray/40 mb-2" />
                    {googleChatFetcher.data?.error && <p className="text-xs text-red-500 font-bold mb-2">{googleChatFetcher.data.error}</p>}
                    <button type="submit" disabled={googleChatFetcher.state === "submitting"}
                      className="w-full py-4 rounded-2xl font-black transition-all bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
                      {googleChatFetcher.state === "submitting" ? "Saving..." : "Activate Google Chat Bot"}
                    </button>
                    <details className="mt-3">
                      <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 font-bold">Setup instructions ▶</summary>
                      <div className="mt-2 text-[11px] text-zinc-500 space-y-1 leading-relaxed">
                        <p>1. Go to Google Cloud Console → APIs → Google Chat API → Configuration</p>
                        <p>2. Set the bot endpoint URL to:</p>
                        <p className="font-mono bg-zinc-100 px-2 py-1 rounded text-[10px] break-all">{appUrl}/api/google-chat-events?projectId={project.id}</p>
                        <p>3. Set connection type to "HTTP endpoint"</p>
                        <p>4. Click "Activate" above to enable this bot for your project</p>
                      </div>
                    </details>
                  </googleChatFetcher.Form>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-zinc-50 rounded-xl text-[11px] text-zinc-500 break-all">
                      <p className="font-bold text-zinc-700 mb-1">Bot Endpoint URL</p>
                      <p className="font-mono">{appUrl}/api/google-chat-events?projectId={project.id}</p>
                    </div>
                    <googleChatFetcher.Form method="post">
                      <input type="hidden" name="_action" value="disconnect_google_chat" />
                      <button type="submit" className="w-full py-2 rounded-xl text-xs font-black bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all cursor-pointer">Disconnect Google Chat</button>
                    </googleChatFetcher.Form>
                  </div>
                )}
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

const HubspotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.76 7.54V5.13A1.74 1.74 0 0 0 17.88 3.5V3.4a1.74 1.74 0 0 0-1.74-1.74h-.1a1.74 1.74 0 0 0-1.74 1.74v.1c0 .7.42 1.3 1.02 1.58v2.44c-.6.1-1.15.36-1.6.73L8.1 4.12a2.01 2.01 0 1 0-.66.86l5.5 3.8a4.18 4.18 0 0 0-.65 2.24A4.2 4.2 0 0 0 15.33 15l-1.8 2.53a1.86 1.86 0 0 0-.52-.08 1.9 1.9 0 1 0 1.9 1.9 1.87 1.87 0 0 0-.32-1.05l1.76-2.48A4.2 4.2 0 1 0 16.76 7.54zm-.64 5.64a2.12 2.12 0 1 1 0-4.24 2.12 2.12 0 0 1 0 4.24z"/>
  </svg>
);

const ShopifyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.34 2.05a.5.5 0 0 0-.48-.05C14.78 2 14 2.52 13.29 3.7c-.68-.2-1.38-.3-2.1-.3C7.27 3.4 4 6.8 4 11c0 4.4 3.62 8 8.08 8 4.5 0 8.17-3.6 8.17-8 0-3.16-1.9-5.9-4.91-8.95zm-4.7 15.6a6.63 6.63 0 0 1-6.56-6.65c0-3.6 2.77-6.52 6.2-6.59.42 0 .84.04 1.25.13-.6 1.3-.95 2.83-.95 4.43 0 2.63.87 4.9 2.26 6.38a6.47 6.47 0 0 1-2.2.3zM14.6 15.7c-1.05-1.2-1.68-3.13-1.68-5.28 0-1.28.25-2.48.68-3.52.27.23.53.5.77.78a9.38 9.38 0 0 1 2.3 6.02 6.62 6.62 0 0 1-2.07 1.98v.02z"/>
  </svg>
);

const SlackBotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.04 15.31a2.18 2.18 0 0 1-2.18 2.18 2.18 2.18 0 0 1-2.18-2.18 2.18 2.18 0 0 1 2.18-2.18h2.18v2.18zm1.09 0a2.18 2.18 0 0 1 2.18-2.18 2.18 2.18 0 0 1 2.18 2.18v5.45a2.18 2.18 0 0 1-2.18 2.18 2.18 2.18 0 0 1-2.18-2.18v-5.45zm2.18-10.27a2.18 2.18 0 0 1-2.18-2.18 2.18 2.18 0 0 1 2.18-2.18 2.18 2.18 0 0 1 2.18 2.18v2.18H8.31zm0 1.09a2.18 2.18 0 0 1 2.18 2.18 2.18 2.18 0 0 1-2.18 2.18H2.86a2.18 2.18 0 0 1-2.18-2.18 2.18 2.18 0 0 1 2.18-2.18h5.45zm10.27 2.18a2.18 2.18 0 0 1 2.18-2.18 2.18 2.18 0 0 1 2.18 2.18 2.18 2.18 0 0 1-2.18 2.18h-2.18V8.31zm-1.09 0a2.18 2.18 0 0 1-2.18 2.18 2.18 2.18 0 0 1-2.18-2.18V2.86a2.18 2.18 0 0 1 2.18-2.18 2.18 2.18 0 0 1 2.18 2.18v5.45zm-2.18 10.27a2.18 2.18 0 0 1 2.18 2.18 2.18 2.18 0 0 1-2.18 2.18 2.18 2.18 0 0 1-2.18-2.18v-2.18h2.18zm0-1.09a2.18 2.18 0 0 1-2.18-2.18 2.18 2.18 0 0 1 2.18-2.18h5.45a2.18 2.18 0 0 1 2.18 2.18 2.18 2.18 0 0 1-2.18 2.18h-5.45z"/>
  </svg>
);

const GoogleChatIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z"/>
  </svg>
);

