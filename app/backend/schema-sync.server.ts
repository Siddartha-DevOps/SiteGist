/**
 * In-app schema sync (operator escape hatch).
 *
 * Applies the committed Prisma migrations that the production database has not
 * received yet — directly against the DB the app is already connected to — without
 * relying on the `db-migrate` GitHub Action (which needs a separate secret that may
 * not be set). Owner-gated. Each statement runs independently and "already exists /
 * duplicate" errors are treated as benign skips, so it is safe to run repeatedly
 * against a drifted / `db push`'d database.
 *
 * This runs at RUNTIME via an authenticated request — NOT in the Vercel web build
 * (which must never run `migrate deploy`, per docs/ARCHITECTURE_ROADMAP.md).
 *
 * IMPORTANT: the SQL below is an inlined, idempotent copy of the pending migration
 * files under prisma/migrations. It is duplicated on purpose so it always ships in
 * the server bundle (a `?raw` glob of files outside app/ does NOT get bundled by the
 * Remix/Vite server build). This is a stopgap until the CI migration job is wired up
 * — when adding a new migration, append it here too, or rely on the GitHub Action.
 * It does not write Prisma's `_prisma_migrations` ledger; because every statement is
 * idempotent, a later real `migrate deploy` re-running them is harmless.
 */
import { prisma } from "~/database/db.server";

type PendingMigration = { name: string; sql: string };

// Mirrors (idempotently) the pending migrations the prod DB hasn't received.
const PENDING_MIGRATIONS: PendingMigration[] = [
  {
    name: "20260608000000_sync_schema_drift",
    sql: `
DO $$ BEGIN CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'TRAINING', 'ERROR'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MemberRole" AS ENUM ('VIEWER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "BillingSubscription" ADD COLUMN IF NOT EXISTS "nextBilledAt" TIMESTAMP(3);

ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "assignedTo" TEXT,
ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isStarred" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isStarred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notes" TEXT,
ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new';

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;

CREATE TABLE IF NOT EXISTS "KnowledgeQA" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeQA_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationTag" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadTag" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillingPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "invoiceUrl" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_projectId_email_key" ON "ProjectMember"("projectId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationTag_sessionId_label_key" ON "ConversationTag"("sessionId", "label");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadTag_leadId_label_key" ON "LeadTag"("leadId", "label");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPayment_transactionId_key" ON "BillingPayment"("transactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_sessionId_key" ON "Lead"("sessionId");

DO $$ BEGIN ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "KnowledgeQA" ADD CONSTRAINT "KnowledgeQA_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ConversationTag" ADD CONSTRAINT "ConversationTag_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
`,
  },
  {
    name: "20260608010000_knowledge_source_status",
    sql: `
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'indexed';
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "error" TEXT;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "lastIndexedAt" TIMESTAMP(3);
`,
  },
  {
    name: "20260608020000_source_incremental_progress",
    sql: `
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "chunksTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "chunksIndexed" INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    name: "20260609000000_add_user_addon",
    sql: `
CREATE TABLE IF NOT EXISTS "UserAddon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "externalSubscriptionId" TEXT,
    "externalCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserAddon_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UserAddon_userId_idx" ON "UserAddon"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserAddon_userId_type_key" ON "UserAddon"("userId", "type");
DO $$ BEGIN ALTER TABLE "UserAddon" ADD CONSTRAINT "UserAddon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
`,
  },
  {
    name: "20260616000000_sentiment_analytics",
    sql: `
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "sentiment" TEXT;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN IF NOT EXISTS "positiveCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN IF NOT EXISTS "neutralCount"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN IF NOT EXISTS "negativeCount" INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    name: "20260618000000_project_actions",
    sql: `
CREATE TABLE IF NOT EXISTS "ProjectAction" (
  "id"           TEXT NOT NULL,
  "projectId"    TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "parameters"   JSONB,
  "method"       TEXT NOT NULL DEFAULT 'GET',
  "urlTemplate"  TEXT NOT NULL,
  "headers"      JSONB,
  "bodyTemplate" TEXT,
  "timeoutMs"    INTEGER NOT NULL DEFAULT 8000,
  "enabled"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectAction_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN ALTER TABLE "ProjectAction" ADD CONSTRAINT "ProjectAction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAction_projectId_name_key" ON "ProjectAction"("projectId", "name");
CREATE INDEX IF NOT EXISTS "ProjectAction_projectId_idx" ON "ProjectAction"("projectId");
`,
  },
  {
    name: "20260621000000_audit_log",
    sql: `
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "projectId" TEXT,
  "action"    TEXT NOT NULL,
  "target"    TEXT,
  "metadata"  JSONB,
  "ip"        TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_projectId_idx" ON "AuditLog"("projectId");
`,
  },
];

/**
 * Split a SQL file into individual statements, respecting:
 *  - dollar-quoted blocks ($$ ... $$, used by DO/EXCEPTION guards),
 *  - single-quoted string literals (e.g. defaults like '#6366f1'),
 *  - `--` line comments.
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let dollarTag: string | null = null;
  let i = 0;
  while (i < sql.length) {
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { buf += dollarTag; i += dollarTag.length; dollarTag = null; }
      else { buf += sql[i++]; }
      continue;
    }
    const dq = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
    if (dq) { dollarTag = dq[0]; buf += dollarTag; i += dollarTag.length; continue; }
    const ch = sql[i];
    if (ch === "'") {
      buf += ch; i++;
      while (i < sql.length) { buf += sql[i]; const c = sql[i]; i++; if (c === "'") break; }
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") { while (i < sql.length && sql[i] !== "\n") i++; continue; }
    if (ch === ";") { const s = buf.trim(); if (s) out.push(s); buf = ""; i++; continue; }
    buf += ch; i++;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

function isBenign(err: unknown): boolean {
  const msg = String((err as any)?.message || err).toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate") ||
    msg.includes("42p07") || // duplicate_table
    msg.includes("42701") || // duplicate_column
    msg.includes("42710") || // duplicate_object
    msg.includes("42p06") || // duplicate_schema
    msg.includes("42p16")    // idempotent re-run edge
  );
}

export type MigrationReport = {
  migration: string;
  statements: number;
  applied: number;
  skipped: number;
  errors: { statement: string; error: string }[];
};

export async function applyPendingSchema(): Promise<{
  ok: boolean;
  pending: string[];
  reports: MigrationReport[];
}> {
  const reports: MigrationReport[] = [];
  let ok = true;

  for (const { name, sql } of PENDING_MIGRATIONS) {
    const statements = splitSqlStatements(sql);
    const report: MigrationReport = { migration: name, statements: statements.length, applied: 0, skipped: 0, errors: [] };
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        report.applied++;
      } catch (err) {
        if (isBenign(err)) {
          report.skipped++;
        } else {
          ok = false;
          report.errors.push({ statement: stmt.slice(0, 200), error: String((err as any)?.message || err).slice(0, 300) });
          console.error(`[Schema Sync] ${name}: statement failed:`, (err as any)?.message);
        }
      }
    }
    reports.push(report);
  }

  return { ok, pending: PENDING_MIGRATIONS.map((m) => m.name), reports };
}
