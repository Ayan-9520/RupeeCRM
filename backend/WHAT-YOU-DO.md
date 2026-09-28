# Step-by-step — ALL products same flow

## LIVE NOW (26 Sep)
Tunnel: `https://fabrics-heard-september-acknowledge.trycloudflare.com`  
CRM UI: http://localhost:8080  
API health: OK | Tunnel lead create: OK

## Same rule EVERY product
1. MySQL save (Hostinger)
2. Email → lead@ + admin + user
3. Full form → CRM product_details
4. CRM fail ≠ form fail

## Partner apply → CRM → DSA login
1. Website `/partner-login` → MySQL `partner_applications` + push `/api/public/partners`
2. CRM → **Partner Applications** → Approve → shows email + temp password + DSA ID
3. Partner login at http://localhost:8080/auth (DSA role allowed)
4. Old MySQL rows: CRM → **Import from website DB** (paste lead_id / name / phone / email / city)

## Hostinger
Upload ZIP: `E:\Projects\rupeedial\HOSTINGER-UPLOAD.zip`  
Overwrite `rupeedial-backend`, then update `.env` CRM_API_URL to current tunnel.

## PC
```bash
cd E:\Projects\leadflowpro
docker compose up -d
cloudflared tunnel --url http://127.0.0.1:8000
npm run dev
```

Full guide: `backend/RUN-FULL.md`
