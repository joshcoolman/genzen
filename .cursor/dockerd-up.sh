#!/usr/bin/env bash
# Bring up the Docker daemon inside a Cloud Agent VM.
#
# Cloud Agent VMs run nested: there is no systemd (PID 1 is tini), so the daemon
# is launched by hand. Two things need handling that a normal host does not:
#
#   1. Storage driver. overlay2 needs a real overlay-capable backing fs; in the
#      nested VM fuse-overlayfs is the driver that works.
#   2. iptables. The base image ships an *iptables-legacy* FORWARD policy of DROP.
#      Docker 29 writes its real rules to nftables, so host->container published
#      ports work, but container->container traffic on a user-defined bridge
#      (what compose creates) is silently dropped by the leftover legacy policy.
#      Flipping the legacy FORWARD policy to ACCEPT lets compose services reach
#      each other (e.g. the bucket-create step reaching MinIO).
#
# Idempotent: safe to run on every boot and from the install step.
set -euo pipefail

sudo mkdir -p /etc/docker
printf '%s\n' '{ "storage-driver": "fuse-overlayfs" }' | sudo tee /etc/docker/daemon.json >/dev/null

if ! sudo docker info >/dev/null 2>&1; then
  sudo bash -c 'setsid dockerd >/var/log/dockerd.log 2>&1 < /dev/null &'
  for _ in $(seq 1 60); do
    if sudo docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if ! sudo docker info >/dev/null 2>&1; then
    echo "dockerd failed to start; see /var/log/dockerd.log" >&2
    sudo tail -n 40 /var/log/dockerd.log >&2 || true
    exit 1
  fi
fi

# Let the unprivileged user talk to the daemon without sudo (group membership
# would need a fresh login, so relax the socket instead).
sudo chmod 666 /var/run/docker.sock || true

# Allow bridge forwarding for compose's user-defined network (see header).
sudo iptables-legacy -P FORWARD ACCEPT 2>/dev/null || true

echo "docker daemon is up"
