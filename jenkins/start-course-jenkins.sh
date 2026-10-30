#!/bin/sh
# Run inside an instructor-approved Course Container. No host Docker socket is mounted.
set -eu
HOME_DIR=/workspace/pawroster-jenkins-home
SECRET=/workspace/pawroster-jenkins-admin.secret
mkdir -p "$HOME_DIR"
if [ ! -f "$SECRET" ]; then umask 077; head -c 32 /dev/urandom | base64 > "$SECRET"; fi
docker build -t pawroster-jenkins ./jenkins
if ! docker container inspect pawroster-registry >/dev/null 2>&1; then
  docker run -d --name pawroster-registry -p 127.0.0.1:5000:5000 -v pawroster-registry-data:/var/lib/registry registry:2
fi
if ! docker container inspect pawroster-jenkins >/dev/null 2>&1; then
  docker run -d --name pawroster-jenkins --user root -p 8080:8080 \
    -e JENKINS_HOME="$HOME_DIR" -v "$HOME_DIR:$HOME_DIR" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$SECRET:/run/secrets/pawroster_admin:ro" pawroster-jenkins
fi
printf 'Jenkins started with authentication; username pawroster-admin. Password is in %s inside the course container.\n' "$SECRET"
