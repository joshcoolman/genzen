#!/usr/bin/env bash
# Cloud Agent install step for GenZen.
#
# Runs once after checkout (and again on dependency changes). It must terminate
# and be idempotent, so it only *prepares* durable state: system packages, node
# modules, and the container images the local stack needs. Bringing services up
# lives in .cursor/start.sh, which runs on every boot.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/.."

# 1. Docker Engine + compose (GenZen's Postgres + MinIO run in docker-compose).
#    Not present in the default Cloud Agent image, so install it from Docker's
#    apt repo. Guarded so a re-run is a no-op.
if ! command -v docker >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  # --force-conf* keeps this non-interactive: some packages (fuse3) ship a
  # conffile (/etc/fuse.conf) that already exists on the base image, and the
  # default conffile prompt has no tty in a build, aborting dpkg.
  sudo apt-get install -y -qq \
    -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin fuse-overlayfs
fi
sudo usermod -aG docker "$USER" || true

# 2. Node dependencies. pnpm + Node come with the base image; corepack pins the
#    version from package.json's packageManager field.
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

# 3. Pre-pull the container images into this machine's image cache so a boot
#    does not wait on (or fail) a registry pull. Needs the daemon running.
bash "$HERE/dockerd-up.sh"
docker pull postgres:17-alpine
bash "$HERE/ensure-minio-images.sh"

echo "install complete"
