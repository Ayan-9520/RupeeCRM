# RupeeDial FULL RUN — Website + CRM (26 Sep 2026)

## Status (checked OK)
| Piece | Status |
|--------|--------|
| Docker CRM API (`:8000`) | OK — health `ok` |
| Docker Postgres (`:5432`) | OK — healthy |
| Cloudflare tunnel | **RUNNING** |
| CRM UI (`:8080`) | **RUNNING** |
| Tunnel → CRM lead create | **TESTED OK** |

**NEW tunnel URL (Hostinger .env mein ye daalo):**
```
https://fabrics-heard-september-acknowledge.trycloudflare.com
```

---

## 1) PC pe hamesha ON (3 cheezein)

### Terminal A — Docker CRM
```bash
cd E:\Projects\leadflowpro
docker compose up -d
```
Docker Desktop mein sirf **leadflowpro** group green hona chahiye  
(`rupeedial-crm-api` + `rupeedial-crm-db`).  
`motorcart` / `kuberone` band chhod sakte ho — unka kaam nahi.

### Terminal B — Cloudflare tunnel (band mat karna)
```bash
cd E:\Projects\leadflowpro
cloudflared tunnel --url http://127.0.0.1:8000
```
Jo naya `https://xxxx.trycloudflare.com` aaye → Hostinger `.env` update.

### Terminal C — CRM website UI
```bash
cd E:\Projects\leadflowpro
npm run dev
```
Open: http://localhost:8080/auth  
Login: `admin@rupeedial.com` / `Admin@12345`

---

## 2) Hostinger update (website forms)

1. ZIP open / extract:  
   `E:\Projects\rupeedial\HOSTINGER-UPLOAD.zip`
2. Andar ka `rupeedial-backend` → server pe overwrite
3. File Manager → `rupeedial-backend/src/config/.env`  
   **sirf 2 lines** update (poori file mat mitao):
```
CRM_API_URL=https://fabrics-heard-september-acknowledge.trycloudflare.com
CRM_PUBLIC_API_KEY=rupeedial-website-key-change-me
```

---

## 3) Full flow (har product)

```
rupeedial.com form submit
    ↓
Hostinger PHP backend
    ├─① MySQL save (Hostinger DB)
    ├─② Email 3 jagah: lead@ + admin + user
    └─③ Tunnel → Docker CRM → Leadboard
            ↓
         Buy → My Leads (edit + pipeline)
```

**Pehle 10 (dedicated):** Home, Personal, Auto, Education, Credit, LAP, Insurance, MSME, Mudra, Machinery  
**Baad wale 13 (product pages):** Working Capital, Business, Startup, CGTMSE, PMEGP, Stand-Up India, Subsidy, Export/Import, LC-BG, Invoice, CC, OD  

Sab same: DB + email 3 + CRM.

---

## 4) Test checklist
1. https://rupeedial.com/subsidy-linked-msme → form submit  
2. Email check: `lead@rupeedial.com`, admin Gmail, user email  
3. CRM Leadboard → lead dikhe → **Buy** → **My Leads**  
4. Details tab pe form fields auto-fill + edit Save  

---

## 5) Agar CRM lead na aaye
- PC sleep mat karo; Docker + tunnel ON  
- Tunnel URL change hua ho to Hostinger `.env` update  
- PHP log: `rupeedial-backend/src/logs/`  
- Mail log: `rupeedial-backend/src/logs/mail-debug.txt`

## 6) Faltu containers
`motorcart` + `kuberone` = alag projects, **delete mat karo** unless tumhe chahiye. Sirf band rakhna OK.
