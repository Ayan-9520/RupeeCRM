from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import require_public_api_key
from app.core.rate_limit import check_rate_limit
from app.db.session import get_db
from app.models import Lead
from app.plans import CATEGORY_LEAD_PRICES, PLANS, cycle_price, default_lead_price
from app.schemas import PublicLeadIn, PublicLeadOut
from app.services.leads import create_lead_from_website_payload, mask_phone, normalize_phone

router = APIRouter(prefix="/api/public", tags=["public"])


class MarketplaceLeadOut(BaseModel):
    """Masked lead for public LeadBoard — never exposes full phone / email / real name."""

    id: UUID
    display_name: str
    masked_phone: str
    city: str
    state: str | None = None
    loan_amount: float
    product_category: str
    product_subtype: str | None = None
    score: str
    price: float
    employment_type: str | None = None
    created_at: str | None = None


class MarketplaceListOut(BaseModel):
    items: list[MarketplaceLeadOut]
    total: int
    category_prices: dict[str, float] = Field(default_factory=dict)


class PublicPlansOut(BaseModel):
    activation_fee: int = 999
    recharge_min: int = 500
    payout_min: int = 1000
    plans: list[dict[str, Any]]
    category_prices: dict[str, float]


def _mask_name(name: str | None) -> str:
    raw = (name or "Customer").strip()
    if len(raw) <= 2:
        return raw[0] + "***" if raw else "Customer"
    parts = raw.split()
    if len(parts) == 1:
        return parts[0][:1] + "***"
    return f"{parts[0][:1]}*** {parts[-1][:1]}***"


def _to_marketplace(lead: Lead) -> MarketplaceLeadOut:
    return MarketplaceLeadOut(
        id=lead.id,
        display_name=_mask_name(lead.applicant_name),
        masked_phone=lead.masked_phone or mask_phone(lead.full_phone),
        city=lead.city or "",
        state=lead.state,
        loan_amount=float(lead.loan_amount or 0),
        product_category=lead.product_category or "loan",
        product_subtype=lead.product_subtype,
        score=lead.score or "cold",
        price=float(lead.price or default_lead_price(lead.product_category)),
        employment_type=lead.employment_type,
        created_at=lead.created_at.isoformat() if lead.created_at else None,
    )


@router.get("/marketplace/leads", response_model=MarketplaceListOut)
def list_marketplace_leads(
    q: str | None = Query(default=None),
    product_category: str | None = Query(default=None),
    city: str | None = Query(default=None),
    limit: int = Query(default=48, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> MarketplaceListOut:
    """Public browse — masked only. No API key (CORS-limited)."""
    query = db.query(Lead).filter(
        Lead.is_marketplace.is_(True),
        Lead.sale_available.is_(True),
        Lead.status == "available",
    )
    if product_category:
        query = query.filter(Lead.product_category == product_category.strip().lower())
    if city:
        query = query.filter(Lead.city.ilike(f"%{city.strip()}%"))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Lead.city.ilike(like),
                Lead.product_subtype.ilike(like),
                Lead.product_category.ilike(like),
            )
        )
    total = query.with_entities(func.count(Lead.id)).scalar() or 0
    rows = query.order_by(Lead.created_at.desc()).offset(offset).limit(limit).all()
    return MarketplaceListOut(
        items=[_to_marketplace(r) for r in rows],
        total=total,
        category_prices=dict(CATEGORY_LEAD_PRICES),
    )


@router.get("/plans", response_model=PublicPlansOut)
def list_public_plans() -> PublicPlansOut:
    plans_out: list[dict[str, Any]] = []
    for pid, p in PLANS.items():
        monthly = int(p["monthly"])
        plans_out.append(
            {
                "id": pid,
                "name": p["name"],
                "seats": p["seats"],
                "lead_credits_monthly": p["lead_credits_monthly"],
                "modules": p["modules"],
                "price": {
                    "monthly": cycle_price(monthly, "monthly"),
                    "quarterly": cycle_price(monthly, "quarterly"),
                    "yearly": cycle_price(monthly, "yearly"),
                },
            }
        )
    return PublicPlansOut(plans=plans_out, category_prices=dict(CATEGORY_LEAD_PRICES))


@router.post("/leads", response_model=PublicLeadOut, dependencies=[Depends(require_public_api_key)])
def ingest_public_lead(
    body: PublicLeadIn,
    request: Request,
    db: Session = Depends(get_db),
) -> PublicLeadOut:
    check_rate_limit(request, limit=40, window_sec=60)
    payload = body.model_dump(exclude_none=False)
    if not payload.get("price"):
        payload["price"] = default_lead_price(str(payload.get("product_category") or "loan"))
    payload.setdefault("is_marketplace", True)
    payload.setdefault("sale_available", True)
    lead = create_lead_from_website_payload(db, payload)
    return PublicLeadOut(id=lead.id)


@router.patch("/leads/{lead_id}", response_model=PublicLeadOut, dependencies=[Depends(require_public_api_key)])
def patch_public_lead(lead_id: UUID, body: PublicLeadIn, db: Session = Depends(get_db)) -> PublicLeadOut:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    payload = body.model_dump(exclude_none=True)
    if "applicant_name" in payload and payload["applicant_name"]:
        lead.applicant_name = str(payload["applicant_name"]).strip()
    if "full_phone" in payload and payload["full_phone"]:
        phone = normalize_phone(str(payload["full_phone"]))
        lead.full_phone = phone
        lead.masked_phone = mask_phone(phone)
    if "email" in payload:
        lead.email = payload["email"] or None
    if "city" in payload and payload["city"]:
        lead.city = str(payload["city"]).strip()
    if "monthly_income" in payload:
        lead.monthly_income = float(payload["monthly_income"]) if payload["monthly_income"] is not None else None
    if "employment_type" in payload:
        lead.employment_type = payload["employment_type"]
    if "loan_amount" in payload and payload["loan_amount"] is not None:
        lead.loan_amount = float(payload["loan_amount"])
    if "phone_verified" in payload:
        lead.phone_verified = bool(payload["phone_verified"])
    if "price" in payload and payload["price"] is not None:
        lead.price = float(payload["price"])

    db.commit()
    db.refresh(lead)
    return PublicLeadOut(id=lead.id, message="Lead updated")
