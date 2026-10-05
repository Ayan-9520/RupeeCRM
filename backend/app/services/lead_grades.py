"""RupeeDial lead grades. Computed from the lead so older rows keep working."""

from __future__ import annotations

GRADE_LABELS = {
    "L0": "Raw",
    "L1": "Contactable",
    "L2": "Interested",
    "L3": "Verified",
    "L4": "Eligible",
    "L5": "Document Ready",
    "L6": "Application Ready",
    "Login": "Login",
    "Sanction": "Sanction",
    "Disbursement": "Disbursement",
}

PIPELINE_GRADE = {
    "new": "L0",
    "contacted": "L1",
    "interested": "L2",
    "verified": "L3",
    "eligible": "L4",
    "docs_collected": "L5",
    "docs": "L5",
    "application_ready": "L6",
    "bank_submitted": "Login",
    "submitted": "Login",
    "sanctioned": "Sanction",
    "approved": "Sanction",
    "disbursed": "Disbursement",
}


def grade_label(code: str) -> str:
    return GRADE_LABELS.get(code, code)


def grade_code(lead, pipeline_stage: str | None = None) -> str:
    stage = (pipeline_stage or "").lower()
    if stage in PIPELINE_GRADE and stage not in {"", "new"}:
        return PIPELINE_GRADE[stage]

    details = getattr(lead, "product_details", None) or {}
    if isinstance(details, dict) and details.get("documents_ready"):
        return "L5"
    if getattr(lead, "phone_verified", False) and getattr(lead, "monthly_income", None) and getattr(lead, "loan_amount", 0):
        return "L4"
    if getattr(lead, "phone_verified", False) or (
        getattr(lead, "monthly_income", None) and getattr(lead, "employment_type", None)
    ):
        return "L3"
    if (getattr(lead, "score", "") or "") in {"warm", "hot"}:
        return "L2"
    if getattr(lead, "full_phone", None):
        return "L1"
    return "L0"


def listing_type(lead) -> str:
    details = getattr(lead, "product_details", None) or {}
    raw = ""
    if isinstance(details, dict):
        raw = str(details.get("listing_type") or "").lower()
    if raw in {"shared", "exclusive"}:
        return raw
    return "exclusive" if float(getattr(lead, "price", 0) or 0) >= 299 else "shared"


def property_label(lead) -> str | None:
    details = getattr(lead, "product_details", None) or {}
    if isinstance(details, dict):
        value = details.get("property_type") or details.get("property")
        if value:
            return str(value)
    subtype = (getattr(lead, "product_subtype", None) or "").lower()
    if "commercial" in subtype:
        return "Commercial"
    if "residential" in subtype:
        return "Residential"
    return None
