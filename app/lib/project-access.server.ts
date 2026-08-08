/**
 * Shared project access — owner OR ProjectMember (by email).
 * Use on every dashboard project route so invitees can open shared chatbots.
 */
import { redirect } from "@remix-run/node";
import { getUser, requireUserId } from "~/backend/auth.server";
import { prisma } from "~/database/db.server";
import {
  type ProjectAccessRole,
  projectMembershipWhere,
  roleAtLeast,
} from "~/lib/project-access";

export type { ProjectAccessRole };
export { projectMembershipWhere, roleAtLeast, appBaseUrl } from "~/lib/project-access";

export type ProjectAccess = {
  userId: string;
  email: string | null;
  project: {
    id: string;
    name: string;
    userId: string;
    settings: unknown;
    webhookUrl: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  role: ProjectAccessRole;
  isOwner: boolean;
  canWrite: boolean;
};

/**
 * Authenticate + authorize project access.
 * @param minRole VIEWER (default) for loaders; ADMIN for mutations; OWNER for destructive owner-only ops.
 */
export async function requireProjectAccess(
  request: Request,
  projectId: string | undefined,
  opts: { minRole?: ProjectAccessRole; redirectTo?: string } = {}
): Promise<ProjectAccess> {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const email = user?.email?.trim().toLowerCase() || null;
  const minRole = opts.minRole ?? "VIEWER";

  if (!projectId) {
    throw redirect(opts.redirectTo || "/dashboard");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...projectMembershipWhere(userId, email),
    },
    include: {
      members: email ? { where: { email }, take: 1 } : { take: 0 },
    },
  });

  if (!project) {
    throw redirect(opts.redirectTo || "/dashboard");
  }

  const isOwner = project.userId === userId;
  const memberRole = project.members[0]?.role;
  const role: ProjectAccessRole = isOwner
    ? "OWNER"
    : memberRole === "ADMIN"
      ? "ADMIN"
      : "VIEWER";

  if (!roleAtLeast(role, minRole)) {
    throw redirect(opts.redirectTo || `/dashboard/projects/${projectId}`);
  }

  const { members: _members, ...projectFields } = project;
  return {
    userId,
    email,
    project: projectFields,
    role,
    isOwner,
    canWrite: role === "OWNER" || role === "ADMIN",
  };
}

/** Resolve current user + membership filter for multi-project queries (inbox, dashboard). */
export async function getAccessibleProjectScope(request: Request) {
  const userId = await requireUserId(request);
  const user = await getUser(request);
  const email = user?.email?.trim().toLowerCase() || null;
  return {
    userId,
    email,
    projectWhere: projectMembershipWhere(userId, email),
  };
}
