# Live website → Local Docker CRM

Cloudflare tunnel (PC pe chal raha hona chahiye):

```
https://appropriations-quick-prisoners-judges.trycloudflare.com
```

Docker CRM API is behind this URL. Tunnel band hua to naya URL milega — Hostinger `.env` update karna padega.

## Hostinger pe 2 cheezein update karo

### 1) File upload
Upload this local file to Hostinger:

`src/services/SupabaseService.php`

→ server path roughly:
`public_html/.../rupeedial-backend/src/services/SupabaseService.php`

(Purana Supabase REST wala file replace.)

### 2) `.env` on Hostinger
In `rupeedial-backend/src/config/.env` add/update:

```
CRM_API_URL=https://appropriations-quick-prisoners-judges.trycloudflare.com
CRM_PUBLIC_API_KEY=rupeedial-website-key-change-me
```

Save. Forms ab PHP → Cloudflare tunnel → tumhare PC Docker CRM pe lead bhejenge.

## Test
1. PC pe Docker + cloudflared dono ON
2. rupeedial.com pe koi loan form submit
3. CRM: http://localhost:8080/dashboard/website-leads → Connect → lead dikhe

## Note
Quick tunnel temporary hai. Permanent ke liye CRM API VPS pe deploy karo + Hostinger `CRM_API_URL` us fixed domain pe set karo.
