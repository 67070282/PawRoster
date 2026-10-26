#!/bin/sh
# Run INSIDE an instructor-approved course container, from the repository root.
set -eu
mkdir -p evidence/runtime
export COMPOSE_PROJECT_NAME=pawroster-course
docker version > evidence/runtime/course-engine.txt
docker compose version >> evidence/runtime/course-engine.txt
git rev-parse HEAD > evidence/runtime/course-commit.txt
git status --porcelain > evidence/runtime/course-worktree.txt
docker compose config --quiet
docker run --rm -v "$PWD:/app" -w /app node:24.14.0-alpine sh -c 'npm run check && node --test --test-reporter=tap --test-reporter-destination=evidence/runtime/course-tests.tap'
docker compose up -d --build --wait --wait-timeout 90
docker compose exec -T app node scripts/smoke.mjs seed > evidence/runtime/course-smoke.txt
docker compose exec -T app node scripts/verify-storage.mjs /tmp/course-backup.db >> evidence/runtime/course-smoke.txt
docker compose up -d --force-recreate --wait --wait-timeout 90
docker compose exec -T app node scripts/smoke.mjs verify >> evidence/runtime/course-smoke.txt
docker compose exec -T app node scripts/verify-storage.mjs >> evidence/runtime/course-smoke.txt
docker compose ps > evidence/runtime/course-compose.txt
docker compose logs --no-color > evidence/runtime/course-logs.txt
docker compose down
printf 'PASS: course Docker-in-Docker verification; services stopped, data volume retained\n'
