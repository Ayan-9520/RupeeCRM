"""Partner ranking from real converted deals. No emails or phone numbers."""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import LeadPurchase, User
from app.services.sales_grades import grade_title

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

VIEW_ROLES = {"ceo", "super_admin", "admin", "dsa", "affiliate"}
CLOSED = {"disbursed", "collected"}


@router.get("")
def leaderboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Not allowed")

    partners = (
        db.query(User)
        .filter(User.role.in_(("dsa", "affiliate")), User.is_active.is_(True))
        .all()
    )
    partner_ids = {p.id for p in partners}
    stats: dict = defaultdict(lambda: {"purchases": 0, "conversions": 0, "disbursed_value": 0.0})
    rows = db.query(
        LeadPurchase.buyer_user_id,
        LeadPurchase.converted,
        LeadPurchase.pipeline_stage,
        LeadPurchase.deal_value,
    ).all()
    for buyer, converted, stage, deal in rows:
        if buyer not in partner_ids:
            continue
        bucket = stats[buyer]
        bucket["purchases"] += 1
        closed = bool(converted) or (stage or "") in CLOSED
        if closed:
            bucket["conversions"] += 1
            bucket["disbursed_value"] += float(deal or 0)

    ranked = sorted(
        partners,
        key=lambda p: (
            -stats[p.id]["disbursed_value"],
            -stats[p.id]["conversions"],
            -stats[p.id]["purchases"],
            (p.full_name or "").lower(),
        ),
    )
    return {
        "items": [
            {
                "name": p.full_name or "Partner",
                "dsa_id": p.dsa_id or "",
                "role": p.role,
                "sales_title": grade_title(p.sales_grade) or "",
                "purchases": stats[p.id]["purchases"],
                "conversions": stats[p.id]["conversions"],
                "disbursed_value": round(stats[p.id]["disbursed_value"], 2),
            }
            for p in ranked
        ]
    }
