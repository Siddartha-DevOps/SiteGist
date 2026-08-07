#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

# Start PostgreSQL if not already accepting connections.
if ! pg_isready -h localhost -q 2>/dev/null; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || sudo service postgresql start
fi

until pg_isready -h localhost -q; do
  sleep 1
done

# Ensure local dev database and role exist (idempotent).
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='sitegist'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER sitegist WITH PASSWORD 'sitegist' CREATEDB;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='sitegist'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE sitegist OWNER sitegist;"

# Default local DATABASE_URL when no hosted Postgres secret is configured.
export DATABASE_URL="${DATABASE_URL:-postgresql://sitegist:sitegist@localhost:5432/sitegist}"

# Generate a dev session secret when not provided via environment secrets.
if [[ -z "${SESSION_SECRET:-}" || "${SESSION_SECRET}" == "DEFAULT_SESSION_SECRET" ]]; then
  export SESSION_SECRET="$(openssl rand -hex 32)"
fi

# Apply Prisma schema to the local database.
npx prisma db push --skip-generate

echo "PostgreSQL ready at ${DATABASE_URL}"
