from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Lead, LeadPurchase, PartnerApplication, PayoutRequest, User

router = APIRouter(prefix="/api/admin/overview", tags=["admin-overview"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}
DAYS = 14


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.get("")
def overview(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> dict:
    total_leads = db.query(func.count(Lead.id)).scalar() or 0
    verified_leads = db.query(func.count(Lead.id)).filter(Lead.phone_verified.is_(True)).scalar() or 0
    sales = db.query(func.count(LeadPurchase.id)).scalar() or 0
    revenue = float(db.query(func.coalesce(func.sum(LeadPurchase.price_paid), 0)).scalar() or 0)
    conversions = db.query(func.count(LeadPurchase.id)).filter(LeadPurchase.converted.is_(True)).scalar() or 0
    disbursed_value = float(
        db.query(func.coalesce(func.sum(LeadPurchase.deal_value), 0)).filter(LeadPurchase.converted.is_(True)).scalar() or 0
    )

    role_counts = dict(db.query(User.role, func.count(User.id)).filter(User.is_active.is_(True)).group_by(User.role).all())
    pending_partners = (
        db.query(func.count(PartnerApplication.id))
        .filter(PartnerApplication.status.in_(("pending", "under_review")))
        .scalar()
        or 0
    )
    pending_payouts = float(
        db.query(func.coalesce(func.sum(PayoutRequest.amount), 0)).filter(PayoutRequest.status == "pending").scalar() or 0
    )

    by_product = [
        {"name": (cat or "other").replace("_", " ").title(), "value": int(n)}
        for cat, n in db.query(Lead.product_category, func.count(Lead.id)).group_by(Lead.product_category).all()
    ]

    since = datetime.now(timezone.utc) - timedelta(days=DAYS - 1)
    start = since.replace(hour=0, minute=0, second=0, microsecond=0)
    daily: dict[str, dict] = {}
    for i in range(DAYS):
        d = (start + timedelta(days=i)).date().isoformat()
        daily[d] = {"day": d[5:], "leads": 0, "sales": 0}
    for (created,) in db.query(Lead.created_at).filter(Lead.created_at >= start).all():
        key = created.date().isoformat()
        if key in daily:
            daily[key]["leads"] += 1
    for (created,) in db.query(LeadPurchase.created_at).filter(LeadPurchase.created_at >= start).all():
        key = created.date().isoformat()
        if key in daily:
            daily[key]["sales"] += 1

    perf: dict = defaultdict(lambda: {"conversions": 0, "revenue": 0.0, "purchases": 0})
    for buyer, converted, deal in db.query(LeadPurchase.buyer_user_id, LeadPurchase.converted, LeadPurchase.deal_value).all():
        row = perf[buyer]
        row["purchases"] += 1
        if converted:
            row["conversions"] += 1
            row["revenue"] += float(deal or 0)
    names = {u.id: u.full_name for u in db.query(User.id, User.full_name).filter(User.id.in_(list(perf.keys()))).all()} if perf else {}
    top = sorted(
        (
            {"name": names.get(uid, "Partner"), **vals}
            for uid, vals in perf.items()
        ),
        key=lambda r: (r["conversions"], r["revenue"], r["purchases"]),
        reverse=True,
    )[:5]

    return {
        "kpis": {
            "total_leads": int(total_leads),
            "verified_leads": int(verified_leads),
            "marketplace_sales": int(sales),
            "lead_revenue": round(revenue, 2),
            "conversions": int(conversions),
            "disbursed_value": round(disbursed_value, 2),
            "active_partners": int(role_counts.get("dsa", 0) + role_counts.get("affiliate", 0)),
            "team_members": int(sum(v for k, v in role_counts.items() if k not in ("dsa", "affiliate", "customer"))),
            "pending_partner_applications": int(pending_partners),
            "pending_payout_amount": round(pending_payouts, 2),
        },
        "roles": {k: int(v) for k, v in role_counts.items()},
        "by_product": by_product,
        "daily": list(daily.values()),
        "top_performers": top,
    }
