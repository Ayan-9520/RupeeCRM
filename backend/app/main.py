from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin_overview,
    automation_rules,
    admin_trust,
    assistant,
    auth,
    billing,
    business,
    commission,
    customer,
    customer_activity,
    customer_documents,
    customer_finance,
    customer_los,
    customer_ops,
    customer_workspace,
    invoice_approvals,
    leads,
    leaderboard,
    learn,
    loan_cases,
    partner_profile,
    network,
    partners,
    performance,
    pipeline,
    payout_grids,
    payouts,
    public_community,
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
app.include_router(public_community.router)
app.include_router(purchases.router)
app.include_router(partners.router)
app.include_router(performance.router)
app.include_router(users.router)
app.include_router(billing.router)
app.include_router(partner_profile.router)
app.include_router(payouts.router)
app.include_router(invoice_approvals.router)
app.include_router(payout_grids.router)
app.include_router(network.router)
app.include_router(customer.router)
app.include_router(customer_workspace.router)
app.include_router(customer_documents.router)
app.include_router(customer_activity.router)
app.include_router(customer_los.router)
app.include_router(customer_finance.router)
app.include_router(customer_ops.router)
app.include_router(assistant.router)
app.include_router(pipeline.router)
app.include_router(commission.router)
app.include_router(admin_trust.router)
app.include_router(business.public_router)
app.include_router(business.router)
app.include_router(learn.router)
app.include_router(loan_cases.router)
app.include_router(admin_overview.router)
app.include_router(leaderboard.router)
app.include_router(automation_rules.router)


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "rupeedial-crm-api"}
