#!/usr/bin/env bash
#
# Report the exact SQL the PRODUCTION database is missing relative to
# prisma/schema.prisma. READ-ONLY — it prints SQL, it does not apply anything.
#
# The recrawl outage happened because prod drifted from the schema. Run this to
# find any *other* gaps before they crash a page.
#
# Usage:
#   DATABASE_URL="postgresql://…DIRECT-prod-url…" ./scripts/audit-prod-drift.sh
#
# Use the DIRECT Postgres connection string, NOT the prisma:// Accelerate URL.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the DIRECT prod Postgres URL (not prisma://)}"

echo "→ Diffing prisma/schema.prisma against the live database…"
echo

npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script

echo
echo "───────────────────────────────────────────────────────────────"
echo "If the SQL above is empty → prod matches the schema (no drift)."
echo "If it is non-empty → apply it, either:"
echo "  • paste that SQL into your DB console, or"
echo "  • npx prisma db push        (DATABASE_URL = the direct prod URL), or"
echo "  • GitHub → Actions → 'Database schema sync' → Run workflow"
