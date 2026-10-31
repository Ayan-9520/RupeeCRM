#!/usr/bin/env bash
set -e
cd /opt/leadflowpro
git pull --ff-only
if [ -f backend/.env ] && ! grep -q 'https://pro.rupeedial.com' backend/.env; then
  sed -i 's|^CORS_ORIGINS=\(.*\)|CORS_ORIGINS=\1,https://pro.rupeedial.com|' backend/.env
fi
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
docker compose -f docker-compose.prod.yml ps
echo "CRM updated: $(git log --oneline -1)"
