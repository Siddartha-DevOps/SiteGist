/**
 * Pure project-access helpers (safe for unit tests — no Prisma/auth imports).
 */

export type ProjectAccessRole = "OWNER" | "ADMIN" | "VIEWER";

const ROLE_RANK: Record<ProjectAccessRole, number> = {
  VIEWER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(role: ProjectAccessRole, min: ProjectAccessRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Prisma `where` fragment: projects the user owns or is a member of. */
export function projectMembershipWhere(userId: string, email?: string | null) {
  const normalized = (email || "").trim().toLowerCase();
  return {
    OR: [
      { userId },
      ...(normalized ? [{ members: { some: { email: normalized } } }] : []),
    ],
  };
}

export function appBaseUrl(request?: Request): string {
  const fromEnv = (process.env.APP_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }
  return "http://localhost:3000";
}
