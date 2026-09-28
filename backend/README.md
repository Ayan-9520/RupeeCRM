# RupeeDial CRM (Docker)

## Start

```bash
cd E:\Projects\leadflowpro
docker compose up --build -d
```

- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health
- Postgres: `localhost:5432` (user/pass/db: `rupeedial` / `rupeedial` / `rupeedial_crm`)

Admin seed:
- Email: `admin@rupeedial.com`
- Password: `Admin@12345`

Public website key (PHP → CRM):
- Header `X-API-Key: rupeedial-website-key-change-me`
- `POST /api/public/leads`

## CRM UI (React)

```bash
npm run dev
```

Open **Admin → Website Leads** (`/dashboard/website-leads`), connect with the admin above.

## Live website (rupeedial.com)

Hosted PHP cannot reach your PC's `127.0.0.1:8000`.

On Hostinger `src/config/.env` set a **public** CRM URL when you deploy, e.g.:

```
CRM_API_URL=https://crm-api.yourdomain.com
CRM_PUBLIC_API_KEY=rupeedial-website-key-change-me
```

Until then, local Docker CRM works for API tests and the React Website Leads page.
