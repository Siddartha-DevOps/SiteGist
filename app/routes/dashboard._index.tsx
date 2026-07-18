import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigation, Link } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { getUsageForUser, getBillingCycleStart, enforceChatbotQuota } from "~/lib/usage.server";
import { prisma } from "~/database/db.server";
import { DashboardIndexPage } from "~/frontend/pages/DashboardIndex";
import { Layout, AlertCircle } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  try {
    const projects = await prisma.project.findMany({
      where: { userId },
      include: { 
        _count: { 
          select: { 
            knowledgeSources: true, 
            sessions: true,
            leads: true
          } 
        } 
      },
      orderBy: { updatedAt: "desc" },
    });

    const projectIds = projects.map(p => p.id);

    // Fetch all leads for these projects from database
    const leads = await prisma.lead.findMany({
      where: {
        projectId: { in: projectIds }
      },
      select: {
        createdAt: true
      }
    });

    // Fetch all messages for the sessions of these projects from database
    const messages = await prisma.message.findMany({
      where: {
        session: {
          projectId: { in: projectIds }
        }
      },
      select: {
        createdAt: true
      }
    });

    // Generate the last 7 days dynamically
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      return {
        dateStr,
        name: daysOfWeek[d.getDay()],
        leads: 0,
        messages: 0
      };
    });

    leads.forEach(lead => {
      if (!lead.createdAt) return;
      const d = new Date(lead.createdAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayBucket = last7Days.find(day => day.dateStr === dateStr);
      if (dayBucket) {
        dayBucket.leads += 1;
      }
    });

    messages.forEach(message => {
      if (!message.createdAt) return;
      const d = new Date(message.createdAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayBucket = last7Days.find(day => day.dateStr === dateStr);
      if (dayBucket) {
        dayBucket.messages += 1;
      }
    });

    const totalTrendValues = last7Days.reduce((acc, curr) => acc + curr.leads + curr.messages, 0);
    const hasTrendData = totalTrendValues > 0;

    const user = await getUser(request);
    const usage = await getUsageForUser(userId, user?.subscriptionTier);
    const cycleStart = getBillingCycleStart();

    const breakdown = await Promise.all(
      projects.map(async (p) => {
        const count = await prisma.message.count({
          where: {
            session: { projectId: p.id },
            role: "assistant",
            createdAt: { gte: cycleStart },
          },
        });
        return {
          id: p.id,
          name: p.name,
          count,
        };
      })
    );

    return json({ 
      projects, 
      analyticsData: last7Days, 
      hasTrendData, 
      dbError: null, 
      errorMessage: null,
      usage,
      breakdown
    });
  } catch (error: any) {
    console.error("[Dashboard] Database error:", error.message);
    const isP6002 = error.message.includes("P6002") || error.message.includes("API Key is invalid");
    return json({ 
      projects: [], 
      analyticsData: [],
      hasTrendData: false,
      dbError: isP6002 ? "PRISMA_AUTH_ERROR" : "GENERAL_ERROR",
      errorMessage: error.message,
      usage: null,
      breakdown: null
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const name = formData.get("name");

  if (typeof name !== "string" || name.length < 3) {
    return json({ error: "Name must be at least 3 characters" }, { status: 400 });
  }

  const quotaError = await enforceChatbotQuota(userId);
  if (quotaError) return quotaError;

  const project = await prisma.project.create({
    data: {
      name,
      userId,
      settings: {
        systemPrompt: "You are a helpful assistant for the website. Answer based on the content provided.",
        branding: { primaryColor: "#6C5CE7" }
      }
    },
  });

  return redirect(`/dashboard/projects/${project.id}`);
}

export default function ProjectsIndex() {
  const { projects, analyticsData, hasTrendData, dbError, errorMessage, usage, breakdown } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isCreating = navigation.state === "submitting" && !!navigation.formData?.get("name");

  if (dbError) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[40px] border border-red-100 p-12 shadow-2xl shadow-red-500/5 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-pulse">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-brand-dark tracking-tight">Database Connection</h2>
          <p className="text-brand-gray text-sm mb-10 leading-relaxed font-medium">
            {dbError === "PRISMA_AUTH_ERROR" 
              ? "Your Prisma Accelerate API key is invalid. Please visit the Settings menu to update your DATABASE_URL with a valid key."
              : `System error while connecting to database: ${errorMessage}`}
          </p>
          <Link 
            to="/dashboard/settings"
            className="inline-block w-full py-5 bg-brand-dark text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand-dark/20"
          >
            Update Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DashboardIndexPage
      projects={projects}
      isCreating={isCreating}
      analyticsData={(analyticsData || []) as any}
      hasTrendData={!!hasTrendData}
      usage={usage as any}
      breakdown={breakdown as any}
    />
  );
}
