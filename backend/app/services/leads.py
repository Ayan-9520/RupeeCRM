from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.models import Lead
from app.plans import default_lead_price

KNOWN_FIELDS = {
    "applicant_name",
    "full_phone",
    "masked_phone",
    "email",
    "city",
    "state",
    "loan_amount",
    "monthly_income",
    "employment_type",
    "company_name",
    "loan_type",
    "product_category",
    "product_subtype",
    "product_type_id",
    "status",
    "score",
    "price",
    "source",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "is_marketplace",
    "sale_available",
    "workspace_id",
    "product_details",
}


def normalize_phone(phone: str | None) -> str:
    raw = (phone or "").strip()
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+91{digits}"
    if raw.startswith("+"):
        return raw
    return f"+{digits}" if digits else raw


def mask_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 10:
        local = digits[-10:]
        return f"{local[:2]}XXXXXX{local[-2:]}"
    if len(phone) >= 4:
        return f"{phone[:2]}****{phone[-2:]}"
    return "****"


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def create_lead_from_website_payload(db: Session, payload: dict[str, Any]) -> Lead:
    phone = normalize_phone(payload.get("full_phone") or payload.get("phone") or "")
    details = payload.get("product_details") or {}
    if isinstance(details, str):
        try:
            import json

            details = json.loads(details) if details.strip() else {}
        except Exception:
            details = {"raw": details}
    if not isinstance(details, dict):
        details = {}

    # Fold extra PHP fields into product_details so nothing is lost
    for key, value in payload.items():
        if key not in KNOWN_FIELDS and value is not None:
            details[key] = value
        if key in {"documents", "banks", "primary_bank", "interest_rate", "emi"} and value is not None:
            details[key] = value

    website_lead_id = None
    if isinstance(details.get("lead_id"), (str, int)):
        website_lead_id = str(details["lead_id"])

    name = (payload.get("applicant_name") or "").strip() or "Website Lead"
    city = (payload.get("city") or "").strip() or "Unknown"

    lead = Lead(
        applicant_name=name,
        full_phone=phone or "unknown",
        masked_phone=payload.get("masked_phone") or mask_phone(phone),
        email=(payload.get("email") or None) or None,
        city=city,
        state=payload.get("state"),
        loan_amount=_as_float(payload.get("loan_amount")),
        monthly_income=(
            _as_float(payload.get("monthly_income"))
            if payload.get("monthly_income") not in (None, "")
            else None
        ),
        employment_type=payload.get("employment_type") or None,
        company_name=payload.get("company_name") or None,
        loan_type=payload.get("loan_type") or "personal",
        product_category=payload.get("product_category") or "loan",
        product_subtype=payload.get("product_subtype"),
        product_type_id=str(payload["product_type_id"]) if payload.get("product_type_id") else None,
        status=payload.get("status") or "available",
        score=payload.get("score") or "cold",
        price=(
            _as_float(payload.get("price"))
            if payload.get("price") not in (None, "", 0, 0.0)
            else default_lead_price(payload.get("product_category") or "loan")
        ),
        source=payload.get("source") or "website",
        utm_source=payload.get("utm_source"),
        utm_medium=payload.get("utm_medium"),
        utm_campaign=payload.get("utm_campaign"),
        is_marketplace=bool(payload.get("is_marketplace", True)),
        sale_available=bool(payload.get("sale_available", True)),
        workspace_id=str(payload["workspace_id"]) if payload.get("workspace_id") else None,
        product_details=details,
        website_lead_id=website_lead_id,
        raw_payload=payload,
        phone_verified=False,
        fraud_risk="low",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
