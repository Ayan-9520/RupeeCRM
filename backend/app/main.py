from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin_trust,
    auth,
    billing,
    leads,
    partner_profile,
    partners,
    payouts,
    public_directory,
    public_leads,
    public_partners,
    purchases,
    users,
)
from app.core.config import settings

app = FastAPI(title="RupeeDial CRM API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(leads.router)
app.include_router(public_leads.router)
app.include_router(public_partners.router)
app.include_router(public_directory.router)
app.include_router(purchases.router)
app.include_router(partners.router)
app.include_router(users.router)
app.include_router(billing.router)
app.include_router(partner_profile.router)
app.include_router(payouts.router)
app.include_router(admin_trust.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "rupeedial-crm-api"}
