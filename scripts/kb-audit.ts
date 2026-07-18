/**
 * Throwaway READ-ONLY audit of KnowledgeSource rows.
 *
 * Uses the app's existing Prisma client (so it connects to the same Prisma
 * Postgres / Accelerate database the app uses). It only reads — it performs no
 * writes, updates, deletes, or re-indexing.
 *
 * Run:  npx tsx scripts/kb-audit.ts
 *
 * Prints:
 *   1. A count of sources grouped by status.
 *   2. Every source where status = 'indexed' but chunksIndexed = 0
 *      (id, name, chunksIndexed, chunksTotal).
 *
 * Note: the Notion/Google sync path (ids prefixed `notion-` / `gdrive-`) writes
 * vectors but never populates chunksIndexed, so those rows are expected false
 * positives here — they're flagged as legacySync so you can ignore them.
 */
import { prisma } from "~/database/db.server";

async function main() {
  // 1) Counts grouped by status (read-only).
  const grouped = await prisma.knowledgeSource.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);

  console.log("\n=== KnowledgeSource count by status ===");
  for (const g of grouped.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${String(g.status).padEnd(12)} ${g._count._all}`);
  }
  console.log(`  ${"TOTAL".padEnd(12)} ${total}`);

  // 2) Indexed but zero embedded chunks (the status/vector mismatch signal).
  const suspects = await prisma.knowledgeSource.findMany({
    where: { status: "indexed", chunksIndexed: 0 },
    select: {
      id: true,
      type: true,
      title: true,
      source: true,
      chunksIndexed: true,
      chunksTotal: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows = suspects.map((s) => {
    const legacySync = s.id.startsWith("notion-") || s.id.startsWith("gdrive-");
    return {
      id: s.id,
      name: (s.title || s.source || "").slice(0, 70),
      type: s.type,
      chunksIndexed: s.chunksIndexed,
      chunksTotal: s.chunksTotal,
      legacySync, // Notion/Google path doesn't track chunksIndexed -> expected false positive
    };
  });

  const realSuspects = rows.filter((r) => !r.legacySync);
  const legacyRows = rows.filter((r) => r.legacySync);

  console.log(`\n=== status='indexed' AND chunksIndexed=0 : ${rows.length} row(s) ===`);
  console.log(`  (${realSuspects.length} real suspect(s), ${legacyRows.length} legacy Notion/Google row(s) to ignore)\n`);

  if (rows.length === 0) {
    console.log("  none — every 'indexed' source reports at least one embedded chunk.");
  } else {
    console.table(rows);
  }

  // Best-effort disconnect; ignore any error so the script still exits cleanly.
  await (prisma as any).$disconnect?.().catch(() => {});
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[kb-audit] failed:", err);
    process.exit(1);
  });
