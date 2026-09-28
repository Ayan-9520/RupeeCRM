#!/usr/bin/env bash
set -e
cd /opt/leadflowpro
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
docker compose -f docker-compose.prod.yml ps
echo "CRM updated: $(git log --oneline -1)"
