#!/usr/bin/env bash
# MinIO stopped publishing its images to Docker Hub, so `minio/minio:latest`
# and `minio/mc:latest` (the tags docker-compose.yml asks for) now 401 with
# "pull access denied". The images are still published to MinIO's own registry
# at quay.io, so pull from there and retag to the names compose expects. This
# keeps docker-compose.yml and `pnpm local:up` working unmodified.
#
# Idempotent: skips the pull when the local tag already exists.
set -euo pipefail

ensure() {
  local target="$1" source="$2"
  if ! docker image inspect "$target" >/dev/null 2>&1; then
    docker pull "$source"
    docker tag "$source" "$target"
  fi
}

ensure minio/minio:latest quay.io/minio/minio:latest
ensure minio/mc:latest quay.io/minio/mc:latest
echo "minio images ready"
