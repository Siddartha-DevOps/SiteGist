/**
 * Audit log — records security-relevant actions for trust/compliance.
 *
 * Fire-and-forget and fully defensive: a logging failure (e.g. the AuditLog table
 * not yet created) must never break the action being audited.
 */
import { prisma } from "~/database/db.server";

export type AuditAction =
  | "apikey.create"
  | "apikey.revoke"
  | "member.invite"
  | "member.remove"
  | "integration.connect"
  | "integration.disconnect"
  | "project.settings.update"
  | "project.delete";

function clientIp(request?: Request): string | undefined {
  if (!request) return undefined;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || undefined;
}

export function recordAudit(opts: {
  userId: string;
  action: AuditAction;
  projectId?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
}): void {
  const { userId, action, projectId, target, metadata, request } = opts;
  // Intentionally not awaited — never block or fail the caller on audit writes.
  prisma.auditLog
    .create({
      data: {
        userId,
        action,
        projectId: projectId ?? null,
        target: target ?? null,
        metadata: (metadata ?? undefined) as any,
        ip: clientIp(request),
      },
    })
    .catch((err: any) => console.error(`[Audit] failed to record ${action}:`, err?.message));
}
