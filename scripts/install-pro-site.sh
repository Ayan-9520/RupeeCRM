#!/bin/sh
set -e
cd /opt/leadflowpro
mkdir -p /opt/leadflowpro/pro-site
tar -xzf /opt/leadflowpro/deploy/pro-site.tar.gz -C /opt/leadflowpro/pro-site
python3 -c 'open("/opt/leadflowpro/pro-nginx.conf","w").write("server {\n listen 80;\n root /usr/share/nginx/html;\n location / { try_files $uri $uri/ /index.html; }\n}\n")'
NET=$(python3 -c 'import json,subprocess; print(next(iter(json.loads(subprocess.check_output(["docker","inspect","kuberone-vps-caddy","-f","{{json .NetworkSettings.Networks}}"])))))')
echo "NET=$NET"
docker rm -f pro-rupeedial >/dev/null 2>&1 || true
docker run -d --name pro-rupeedial --restart unless-stopped --network "$NET" \
  -v /opt/leadflowpro/pro-site:/usr/share/nginx/html:ro \
  -v /opt/leadflowpro/pro-nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
CADDY=/opt/kuberone/deployment/docker/Caddyfile.vps
if ! grep -q 'pro.rupeedial.com' "$CADDY"; then
  printf '\npro.rupeedial.com {\n\tencode gzip\n\treverse_proxy pro-rupeedial:80\n}\n' >> "$CADDY"
fi
docker exec kuberone-vps-caddy caddy reload --config /etc/caddy/Caddyfile
echo DONE
