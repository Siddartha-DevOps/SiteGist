import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useNavigation, useActionData, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { enforceChatbotQuota } from "~/lib/usage.server";
import { enqueueSourceIngestion } from "~/ai-layer/ingestion.server";
import { ChevronLeft, Bot, Loader2, Plus, Globe } from "lucide-react";

/** Add https:// when missing; return null if not a valid http(s) URL. */
function normalizeWebsiteUrl(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Ensure the user is authenticated
  await requireUserId(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const name = formData.get("name");
  const websiteRaw = formData.get("websiteUrl");

  if (typeof name !== "string" || name.trim().length < 3) {
    return json(
      { error: "Chatbot name must be at least 3 characters" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();

  let websiteUrl: string | null = null;
  if (typeof websiteRaw === "string" && websiteRaw.trim()) {
    websiteUrl = normalizeWebsiteUrl(websiteRaw);
    if (!websiteUrl) {
      return json(
        { error: "Enter a valid website URL (e.g. example.com or https://example.com)" },
        { status: 400 }
      );
    }
  }

  const quotaError = await enforceChatbotQuota(userId);
  if (quotaError) return quotaError;

  // Create the project in database with default settings
  const project = await prisma.project.create({
    data: {
      name: trimmedName,
      userId,
      settings: {
        systemPrompt: "You are a helpful customer support assistant for a website. Use the provided context to answer questions accurately and concisely.",
        branding: {
          primaryColor: "#6C5CE7",
          assistantName: trimmedName,
          greetingMessage: `Hi! I'm ${trimmedName}. How can I help you today?`,
        }
      }
    },
  });

  if (websiteUrl) {
    // Same pattern as crawl_single on the train page: queue a web source, then ingest.
    const src = await prisma.knowledgeSource.create({
      data: {
        projectId: project.id,
        type: "web",
        source: websiteUrl,
        title: websiteUrl,
        status: "queued",
      },
    });
    await enqueueSourceIngestion(project.id, src.id);
    return redirect(`/dashboard/projects/${project.id}/train?tab=web&onboarding=1`);
  }

  return redirect(`/dashboard/projects/${project.id}`);
}

export const meta = () => {
  return [{ title: "New Chatbot — SiteGist" }];
};

export default function NewProject() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isCreating = navigation.state === "submitting";

  return (
    <div className="max-w-xl mx-auto py-6">
      <Link 
        to="/dashboard" 
        className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> Back to dashboard
      </Link>
      
      <div className="mb-10">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-primary/20">
          <Bot className="text-primary w-7 h-7" />
        </div>
        <h1 className="text-4xl font-black text-brand-dark tracking-tight mb-2">Create New Chatbot</h1>
        <p className="text-zinc-500 font-medium">Deploy a new custom AI assistant to learn from your knowledge bases.</p>
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-bold mb-3 text-brand-dark">
              Chatbot Name
            </label>
            <input 
              id="name"
              type="text" 
              name="name" 
              placeholder="e.g. Acme Support Bot"
              required
              minLength={3}
              className="w-full px-4 py-3 text-sm font-medium border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-zinc-800 placeholder:text-zinc-400"
            />
            <p className="text-xs text-zinc-400 font-medium mt-3 leading-relaxed">
              Give your chatbot a name. You can customize the personality, greetings, and appearance in settings later.
            </p>
          </div>

          <div>
            <label htmlFor="websiteUrl" className="block text-sm font-bold mb-3 text-brand-dark">
              Website URL <span className="text-zinc-400 font-medium">(optional)</span>
            </label>
            <div className="relative">
              <input
                id="websiteUrl"
                type="text"
                name="websiteUrl"
                placeholder="e.g. example.com or https://docs.example.com"
                className="w-full px-4 py-3 pl-10 text-sm font-medium border border-brand-border rounded-xl outline-none focus:border-primary transition-colors bg-white text-zinc-800 placeholder:text-zinc-400"
              />
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xs text-zinc-400 font-medium mt-3 leading-relaxed">
              Paste a page to crawl now — you'll land on the train screen to watch it index.
            </p>
          </div>

          {actionData?.error && (
            <p className="text-red-600 text-xs font-semibold animate-in fade-in slide-in-from-top-1">
              {actionData.error}
            </p>
          )}

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isCreating}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-150 rounded-xl px-5 py-3.5 hover:bg-primary/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Assistant...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Chatbot
                </>
              )}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
