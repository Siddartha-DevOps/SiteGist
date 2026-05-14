import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigation, Link } from "@remix-run/react";
import { requireUserId } from "~/backend/auth.server";
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
    return json({ projects, dbError: null, errorMessage: null });
  } catch (error: any) {
    console.error("[Dashboard] Database error:", error.message);
    const isP6002 = error.message.includes("P6002") || error.message.includes("API Key is invalid");
    return json({ 
      projects: [], 
      dbError: isP6002 ? "PRISMA_AUTH_ERROR" : "GENERAL_ERROR",
      errorMessage: error.message 
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
  const { projects, dbError, errorMessage } = useLoaderData<typeof loader>();
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

  return <DashboardIndexPage projects={projects} isCreating={isCreating} />;
}
