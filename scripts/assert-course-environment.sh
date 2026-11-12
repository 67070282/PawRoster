#!/bin/sh
# Source from course scripts; never accepts a host Docker socket as DinD proof.
set -eu
if [ ! -f /.dockerenv ]; then
  printf '%s\n' 'ERROR: Run this command inside the instructor devtools container after SSH.' >&2
  exit 1
fi
if ! command -v dockerd >/dev/null 2>&1 || ! pgrep -x dockerd >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: No local dockerd process. A Docker CLI or mounted host socket alone is not Docker-in-Docker.' >&2
  exit 1
fi
case "${DOCKER_HOST:-}" in
  ''|unix:///var/run/docker.sock|unix:///run/docker.sock) ;;
  *) printf '%s\n' 'ERROR: DOCKER_HOST must use the local daemon inside devtools.' >&2; exit 1 ;;
esac
course_endpoint=$(docker context inspect --format '{{.Endpoints.docker.Host}}')
case "$course_endpoint" in
  unix:///var/run/docker.sock|unix:///run/docker.sock) ;;
  *) printf '%s\n' 'ERROR: Docker context does not use the local Unix socket.' >&2; exit 1 ;;
esac
docker info >/dev/null
printf '%s\n' 'PASS: container environment, local dockerd, local Unix socket and daemon readiness'
