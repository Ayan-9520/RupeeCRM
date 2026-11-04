"""Short campaign payload → the same marketplace lead the website forms create."""

from __future__ import annotations

import re
from typing import Any

_PRODUCTS: list[tuple[tuple[str, ...], str, str, str]] = [
    (("credit card", "creditcard", "card"), "credit_card", "cc_lifetime_free", "credit_card"),
    (("cash credit", "business cash"), "loan", "loan_business_cash_credit", "business"),
    (("home",), "loan", "loan_home", "home"),
    (("lap", "loan against property", "property"), "loan", "loan_lap", "lap"),
    (("msme", "mudra"), "loan", "loan_msme", "msme"),
    (("business",), "loan", "loan_business", "business"),
    (("auto", "car"), "loan", "loan_auto", "auto"),
    (("education",), "loan", "loan_education", "education"),
    (("personal", "pl"), "loan", "loan_personal", "personal"),
    (("insurance",), "insurance", "insurance", "insurance"),
    (("investment",), "investment", "investment", "investment"),
]


def _first(data: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _digits(phone: str) -> str:
    return re.sub(r"\D", "", phone)


def campaign_to_lead_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Name, phone, city, and product are enough. Missing card fields stay hidden."""
    phone = _first(data, "full_phone", "phone", "mobile", "phone_number", "contact")
    if len(_digits(phone)) < 10:
        raise ValueError("phone is required")

    product = _first(data, "product", "product_name", "loan_type", "product_subtype").lower()
    category, subtype, loan_type = "loan", "loan_personal", "personal"
    for words, cat, sub, loan in _PRODUCTS:
        if any(word in product for word in words):
            category, subtype, loan_type = cat, sub, loan
            break
    if data.get("product_category"):
        category = str(data["product_category"]).strip().lower() or category
    if data.get("product_subtype"):
        subtype = str(data["product_subtype"]).strip() or subtype

    amount = data.get("loan_amount", data.get("amount", data.get("requirement")))
    campaign = _first(data, "utm_campaign", "campaign", "campaign_name")
    utm_source = _first(data, "utm_source", "ad_source", "platform") or "campaign"

    payload: dict[str, Any] = {
        "applicant_name": _first(data, "applicant_name", "name", "full_name") or "Campaign Lead",
        "full_phone": phone,
        "email": _first(data, "email") or None,
        "city": _first(data, "city") or "Unknown",
        "state": _first(data, "state") or None,
        "loan_amount": amount if amount not in (None, "") else 0,
        "loan_type": loan_type,
        "product_category": category,
        "product_subtype": subtype,
        "source": "campaign",
        "utm_source": utm_source,
        "utm_medium": _first(data, "utm_medium", "medium") or "campaign",
        "utm_campaign": campaign or None,
        "is_marketplace": True,
        "sale_available": True,
        "status": "available",
    }
    if data.get("price") not in (None, ""):
        payload["price"] = data.get("price")
    return payload
