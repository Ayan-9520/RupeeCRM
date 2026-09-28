# Production checklist — RupeeDial CRM + website

Use this before pointing Hostinger / live traffic at the stack.

## Secrets (rotate from defaults)

- [ ] `JWT_SECRET` — long random string (`backend/.env`)
- [ ] `PUBLIC_LEAD_API_KEY` / Hostinger `CRM_API_KEY` — same value both sides
- [ ] `ADMIN_PASSWORD` — change seed admin after first login
- [ ] Postgres password if exposed beyond Docker network

## CRM API (Docker / VPS)

- [ ] Public HTTPS URL (Cloudflare tunnel now, or `https://api…` on VPS)
- [ ] CORS includes `https://rupeedial.com` and `https://www.rupeedial.com`
- [ ] `GET /health` → `{"status":"ok"}`
- [ ] Run without `--reload` in production (`uvicorn` workers / compose override)
- [ ] Alembic at `head` (compose runs `alembic upgrade head` on start)

## Website PHP (Hostinger)

See `HOSTINGER-WEBSITE-BACKEND.md`

- [ ] Upload `rupeedial-backend/`
- [ ] `CRM_API_URL` = public CRM HTTPS (not `127.0.0.1`)
- [ ] Matching API key
- [ ] PHP health / form smoke test

## Frontend website

- [ ] Build with `.env.production` → `VITE_CRM_API_URL` = same public CRM
- [ ] Upload `dist/`
- [ ] `/leadboard`, `/pricing`, `/partners` load from CRM

## Trust gates (Phase 7)

- [ ] Admin → Trust & Audit → Verify KYC for partners before publish/payout
- [ ] Suspend abusive profiles from Trust page
- [ ] Dead-number: credit wallet + reopen lead when needed
- [ ] Public ingest rate-limited (429 if abused)

## Deferred (not blocking go-live)

- Razorpay plan checkout / RazorpayX payouts
- Wildcard DNS `*.rupeedial.com` (path `/p/:slug` works now)
- Full CI pipeline
