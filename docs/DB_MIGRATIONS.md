# Database migrations

Migrations apply to production via a **dedicated GitHub Action**
(`.github/workflows/db-migrate.yml`), **not** the Vercel web build.

> Guardrail: never run `prisma migrate deploy` inside the Vercel web build — the
> prod DB was provisioned with `prisma db push`, so a build-time deploy fails on
> existing tables and blocks the deployment.

## One-time setup
Add a repository secret with the **DIRECT (non-pooled)** Postgres connection string:

- GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**
- Name: `MIGRATE_DATABASE_URL`
- Value: your direct Postgres URL (for Neon use the non-pooled endpoint; for
  Supabase use the direct connection, not the PgBouncer/pooler URL).

Pooled/PgBouncer URLs can break DDL — always use the direct URL for migrations.

## How it works
On every push to `main` that changes `prisma/schema.prisma` or
`prisma/migrations/**`, the workflow:

1. Installs deps and generates the Prisma client.
2. **Baselines** the legacy migrations (`init`, `fts_gin_index`,
   `add_stored_search_vector`) as already-applied, because prod was created with
   `db push` and already has those objects. (`P3008 already recorded` on later
   runs is expected and ignored.)
3. Runs `prisma migrate deploy` to apply any pending migrations.

All migrations added after the baseline are written **idempotently**
(`IF NOT EXISTS` / guarded `DO` blocks), so a run is safe even if some objects
already exist (e.g. created earlier via the manual `prod_sync.sql`).

## Adding a new migration
1. Edit `prisma/schema.prisma`.
2. Generate the migration: `npx prisma migrate dev --name <change>` (against a dev DB).
3. Make the new `migration.sql` idempotent (`CREATE TABLE IF NOT EXISTS`,
   `ADD COLUMN IF NOT EXISTS`, guarded `DO $$ … $$` for enums/constraints) so it
   stays safe against the db-push'd prod.
4. Merge to `main` — the Action applies it automatically.

You can also trigger it manually from the Actions tab (**Run workflow**).
