import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, Link, useNavigation, useActionData } from "@remix-run/react";
import { requireUserId, getUser } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import { recordAudit } from "~/lib/audit.server";
import { ArrowLeft, UserPlus, Trash2, Shield, Eye, Loader2, Bot, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import React, { useEffect, useState } from "react";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const projectId = params.projectId;

  if (!projectId) {
    throw new Response("Not Found", { status: 404 });
  }

  // Find the project and verify access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { members: { some: { email: user?.email || "" } } }
      ]
    },
    include: {
      members: true,
      user: {
        select: {
          email: true
        }
      }
    }
  });

  if (!project) {
    throw new Response("Unauthorized or Project Not Found", { status: 403 });
  }

  const isOwner = project.userId === userId;
  const currentUserRole = isOwner ? "OWNER" : (project.members.find(m => m.email === user?.email)?.role || "VIEWER");

  return json({
    project,
    members: project.members,
    isOwner,
    currentUserRole,
    userEmail: user?.email
  });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const projectId = params.projectId;

  if (!projectId) {
    return json({ error: "No project specified" }, { status: 400 });
  }

  // Ensure user is project Owner or an ADMIN member to make changes
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { members: { some: { email: user?.email || "", role: "ADMIN" } } }
      ]
    }
  });

  if (!project) {
    return json({ error: "Unauthorized to manage members of this project" }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "invite") {
    const email = (formData.get("email") as string || "").trim().toLowerCase();
    const roleInput = formData.get("role") as string || "VIEWER";

    if (!email) {
      return json({ error: "Email Address is required" }, { status: 400 });
    }

    if (email === project.userId || email === user?.email) {
      return json({ error: "You cannot invite the owner/yourself as a generic team member" }, { status: 400 });
    }

    // Check if member already exists
    const existing = await prisma.projectMember.findFirst({
      where: { projectId, email }
    });

    if (existing) {
      return json({ error: "This user is already a member of this chatbot" }, { status: 400 });
    }

    try {
      await prisma.projectMember.create({
        data: {
          projectId,
          email,
          role: roleInput === "ADMIN" ? "ADMIN" : "VIEWER"
        }
      });
      recordAudit({ userId, action: "member.invite", projectId, target: email, metadata: { role: roleInput === "ADMIN" ? "ADMIN" : "VIEWER" }, request });
      return json({ success: "Member invited successfully" });
    } catch (err: any) {
      return json({ error: err?.message || "Failed to invite member" }, { status: 500 });
    }
  }

  if (intent === "remove") {
    const memberId = formData.get("memberId") as string;

    if (!memberId) {
      return json({ error: "No member specified" }, { status: 400 });
    }

    try {
      await prisma.projectMember.delete({
        where: { id: memberId }
      });
      recordAudit({ userId, action: "member.remove", projectId, target: memberId, request });
      return json({ success: "Member removed successfully" });
    } catch (err: any) {
      return json({ error: err?.message || "Failed to remove member" }, { status: 500 });
    }
  }

  return json({ error: "Invalid Action" }, { status: 400 });
}

export default function ProjectMembers() {
  const { project, members, isOwner, currentUserRole, userEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState("VIEWER");

  const isSubmitting = navigation.state === "submitting";
  const canManage = isOwner || currentUserRole === "ADMIN";

  // Clear email input on success
  useEffect(() => {
    if (actionData && 'success' in actionData) {
      setEmailInput("");
    }
  }, [actionData]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      {/* Back to Chatbot Details */}
      <div className="mb-6">
        <Link 
          to={`/dashboard/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 font-bold text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to chatbot details</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Bot className="text-primary w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-primary font-mono bg-primary/10 px-2.5 py-0.5 rounded-full">
              Access Control
            </span>
            <h1 className="text-2xl font-black text-brand-dark mt-0.5">
              {project.name} • Team Members
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Invite Form Card */}
        {canManage && (
          <div className="md:col-span-1 bg-white p-6 border border-brand-border rounded-[32px] shadow-sm flex flex-col justify-between h-fit">
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="invite" />
              <div>
                <h2 className="text-lg font-black text-brand-dark flex items-center gap-1.5 mb-1">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Invite Member
                </h2>
                <p className="text-xs text-brand-gray">Grant another user secure access to view or manage this chatbot.</p>
              </div>

              {actionData && 'error' in actionData && (
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionData.error}</span>
                </div>
              )}

              {actionData && 'success' in actionData && (
                <div className="p-3.5 bg-green-50 border border-green-100 rounded-xl text-green-600 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionData.success}</span>
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-wider text-brand-gray mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      id="email"
                      type="email"
                      name="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 rounded-xl border border-brand-border text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-brand-dark transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="role" className="block text-[10px] font-black uppercase tracking-wider text-brand-gray mb-1">
                    Role Privilege
                  </label>
                  <select 
                    id="role"
                    name="role"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 rounded-xl border border-brand-border text-sm font-bold text-brand-dark focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="VIEWER">Viewer (Read-Only)</option>
                    <option value="ADMIN">Admin (Full Access)</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </Form>
          </div>
        )}

        {/* Member List Card */}
        <div className={`${canManage ? 'md:col-span-2' : 'md:col-span-3'} bg-white p-6 border border-brand-border rounded-[32px] shadow-sm h-fit`}>
          <div>
            <h2 className="text-xl font-black text-brand-dark mb-1">
              Active Members ({members.length + 1})
            </h2>
            <p className="text-xs text-brand-gray mb-6">These people currently have secure login privileges to this chatbot workspace.</p>
          </div>

          <div className="space-y-3">
            {/* Owner Section */}
            <div className="flex items-center justify-between p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-brand-dark truncate">{project.user?.email || "Owner"}</p>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 font-mono">Owner</span>
                </div>
              </div>
              <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold ring-1 ring-indigo-100/50">
                Creator
              </div>
            </div>

            {/* Other Members */}
            {members.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-zinc-100 rounded-2xl flex flex-col items-center">
                <Mail className="w-8 h-8 text-zinc-300 mb-2" />
                <h3 className="text-sm font-bold text-brand-dark">No other members added</h3>
                <p className="text-xs text-brand-gray max-w-[240px] mt-0.5 mx-auto">Invite colleagues by email above to collaborate with you.</p>
              </div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-100 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      member.role === "ADMIN" ? "bg-amber-50" : "bg-zinc-50"
                    }`}>
                      {member.role === "ADMIN" ? (
                        <Shield className="w-5 h-5 text-amber-600" />
                      ) : (
                        <Eye className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-brand-dark truncate">{member.email}</p>
                      <span className={`text-[10px] font-black uppercase tracking-wider font-mono ${
                        member.role === "ADMIN" ? "text-amber-600" : "text-zinc-500"
                      }`}>
                        {member.role === "ADMIN" ? "Admin" : "Viewer"}
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <Form method="post" onSubmit={(e) => {
                      if (!confirm(`Are you sure you want to remove ${member.email} from this chatbot?`)) {
                        e.preventDefault();
                      }
                    }}>
                      <input type="hidden" name="intent" value="remove" />
                      <input type="hidden" name="memberId" value={member.id} />
                      <button 
                        type="submit"
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Form>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
