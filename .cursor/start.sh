#!/usr/bin/env bash
# Cloud Agent start step for GenZen. Runs on every boot; must be idempotent and
# return once services are ready (the dev server itself runs as a terminal).
#
# Brings up the local stack the app talks to: Postgres + MinIO in docker-compose,
# the schema migrations, the private bucket, and the dev login. `pnpm local:up`
# owns all of that and is itself idempotent, so this is a thin wrapper that just
# guarantees the daemon and images are present first.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/.."

bash "$HERE/dockerd-up.sh"
bash "$HERE/ensure-minio-images.sh"

# Start Postgres + MinIO, run migrations, create the bucket and dev user, and
# write .env.local. --no-dev because the dev server runs as a terminal.
node scripts/local-up.mjs --no-dev

echo "start complete -- app dependencies are up"
