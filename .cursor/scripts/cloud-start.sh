#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

# Generate a dev session secret when not provided via environment secrets.
if [[ -z "${SESSION_SECRET:-}" || "${SESSION_SECRET}" == "DEFAULT_SESSION_SECRET" ]]; then
  export SESSION_SECRET="$(openssl rand -hex 32)"
fi

# Namespaced PORTKEY_MODEL values (e.g. @org/model) 400 against the direct OpenAI
# client unless PORTKEY_API_KEY is configured. Fall back to a safe default.
if [[ -n "${PORTKEY_MODEL:-}" && -z "${PORTKEY_API_KEY:-}" ]]; then
  if [[ "$PORTKEY_MODEL" == @* ]] || [[ "$PORTKEY_MODEL" == */* ]]; then
    export PORTKEY_MODEL="gpt-4o-mini"
    echo "PORTKEY_MODEL overridden to gpt-4o-mini (namespaced model without PORTKEY_API_KEY)"
  fi
fi

# Prefer hosted Postgres from Vercel/Neon/Accelerate secrets. Fall back to a
# local cluster only when DATABASE_URL is not configured.
if [[ -z "${DATABASE_URL:-}" ]]; then
  if ! pg_isready -h localhost -q 2>/dev/null; then
    sudo pg_ctlcluster 16 main start 2>/dev/null || sudo service postgresql start
  fi
  until pg_isready -h localhost -q; do
    sleep 1
  done
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='sitegist'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE USER sitegist WITH PASSWORD 'sitegist' CREATEDB;"
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='sitegist'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE sitegist OWNER sitegist;"
  export DATABASE_URL="postgresql://sitegist:sitegist@localhost:5432/sitegist"
  echo "Using local PostgreSQL at ${DATABASE_URL}"
else
  echo "Using hosted DATABASE_URL from environment secrets"
fi

# prisma db push needs a direct Postgres URL (not prisma:// Accelerate).
MIGRATE_URL="${DIRECT_DATABASE_URL:-${MIGRATE_DATABASE_URL:-$DATABASE_URL}}"
if [[ "$MIGRATE_URL" == prisma://* ]]; then
  echo "Warning: DATABASE_URL is a Prisma Accelerate URL; set DIRECT_DATABASE_URL for schema sync."
  MIGRATE_URL="${DIRECT_DATABASE_URL:-}"
fi
if [[ -n "$MIGRATE_URL" ]]; then
  DATABASE_URL="$MIGRATE_URL" npx prisma db push --skip-generate
else
  npx prisma db push --skip-generate
fi

echo "Database ready"
