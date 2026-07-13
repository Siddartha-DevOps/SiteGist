import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { enforceChatbotQuota } from "~/lib/usage.server";
import { Bot, ArrowLeft, Loader2, Sparkles, Globe, Shield } from "lucide-react";
import React from 'react';
import { Logo } from "~/frontend/components/Logo";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const name = formData.get("name");

  if (typeof name !== "string" || name.length < 3) {
    return json({ error: "Chatbot name must be at least 3 characters" }, { status: 400 });
  }

  const quotaError = await enforceChatbotQuota(userId);
  if (quotaError) return quotaError;

  try {
    const project = await prisma.project.create({
      data: {
        name,
        userId,
        settings: {
          systemPrompt: "You are a helpful AI assistant. Answer based on the knowledge provided.",
          branding: { 
            primaryColor: "#155DEE",
            botName: name,
            welcomeMessage: `Hi! I'm ${name}. How can I help you today?`
          }
        }
      },
    });

    // Redirect to dashboard so the project list loads fresh (avoids Prisma Accelerate read-after-write lag)
    return redirect(`/dashboard?new=${project.id}`);
  } catch (error) {
    return json({ error: "Failed to create chatbot. Please try again." }, { status: 500 });
  }
}

export default function CreateChatbot() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-brand-light/20 flex flex-col">
      <header className="p-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-brand-gray hover:text-brand-dark transition-colors font-bold text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 -mt-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-[28px] shadow-xl shadow-primary/10 mb-6 ring-1 ring-brand-border">
              <Bot className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-black text-brand-dark mb-3 tracking-tight">Create New Chatbot</h1>
            <p className="text-brand-gray font-medium text-lg">Give your digital assistant a name to get started.</p>
          </div>

          <Form method="post" className="space-y-8">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-brand-dark/5 border border-brand-border ring-1 ring-white">
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-[13px] font-black text-brand-gray uppercase tracking-widest mb-3 ml-1">
                    Chatbot Name
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="e.g. Sales Assistant, Support Bot"
                      required
                      autoFocus
                      className="w-full px-6 py-5 bg-brand-light/30 border-2 border-transparent rounded-[24px] text-lg font-bold text-brand-dark placeholder:text-brand-gray/40 focus:outline-none focus:border-primary focus:bg-white transition-all group-hover:bg-brand-light/50"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                      <Sparkles className="w-5 h-5 text-primary opacity-40 group-focus-within:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  {actionData?.error && (
                    <p className="mt-3 text-sm text-red-500 font-bold ml-1 flex items-center gap-2">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {actionData.error}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-brand-light/30 rounded-3xl border border-transparent hover:border-brand-border transition-all">
                    <Globe className="w-5 h-5 text-primary mb-3" />
                    <h3 className="text-sm font-bold text-brand-dark mb-1">Crawl Website</h3>
                    <p className="text-[11px] text-brand-gray font-medium">Train on your site's content automatically.</p>
                  </div>
                  <div className="p-5 bg-brand-light/30 rounded-3xl border border-transparent hover:border-brand-border transition-all">
                    <Shield className="w-5 h-5 text-primary mb-3" />
                    <h3 className="text-sm font-bold text-brand-dark mb-1">Secure Leads</h3>
                    <p className="text-[11px] text-brand-gray font-medium">Capture customer info with built-in validation.</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-10 py-5 bg-brand-dark text-white rounded-[24px] font-black text-lg shadow-xl shadow-brand-dark/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 group"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Creating digital twin...
                  </>
                ) : (
                  <>
                    Build My Chatbot
                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </Form>

          <p className="mt-8 text-center text-brand-gray text-sm font-medium">
            You'll be able to customize training and appearance in the next step.
          </p>
        </div>
      </main>

      <footer className="p-8 flex justify-center">
        <Logo size="sm" />
      </footer>
    </div>
  );
}
