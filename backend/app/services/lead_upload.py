"""CSV upload → a private CRM lead, or a leadboard lead when an admin asks to publish."""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Lead, LeadPurchase
from app.plans import default_lead_price
from app.services.leads import mask_phone, normalize_phone

MAX_ROWS = 200
UPLOAD_ROLES = {"ceo", "super_admin", "admin", "dsa", "affiliate", "caller"}
ADMIN_ROLES = {"ceo", "super_admin", "admin"}

PRODUCTS: dict[str, tuple[str, str, str]] = {
    "personal-loan": ("loan", "loan_personal", "personal"),
    "home-loan": ("loan", "home_loan", "home"),
    "lap-loan": ("loan", "loan_lap", "lap"),
    "auto-loan": ("loan", "loan_auto_new", "auto"),
    "msme-loan": ("loan", "loan_msme", "msme"),
    "mudra-loan": ("loan", "loan_mudra", "mudra"),
    "education-loan": ("loan", "education_loan", "education"),
    "machinery-loan": ("loan", "machinery_loan", "machinery"),
    "business-loan": ("loan", "business-loan", "business"),
    "bnpl": ("loan", "bnpl-pay-later", "bnpl"),
    "credit-card": ("credit_card", "credit_card", "credit_card"),
    "insurance": ("insurance", "insurance", "insurance"),
    "investment": ("investment", "investment", "investment"),
}

HEADER_ALIASES = {
    "name": "name",
    "applicant_name": "name",
    "full_name": "name",
    "phone": "phone",
    "mobile": "phone",
    "full_phone": "phone",
    "phone_number": "phone",
    "city": "city",
    "product": "product",
    "product_name": "product",
    "loan_type": "product",
    "loan_amount": "loan_amount",
    "amount": "loan_amount",
    "monthly_income": "monthly_income",
    "income": "monthly_income",
    "employment": "employment",
    "employment_type": "employment",
    "email": "email",
}


def _digits(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return digits[-10:] if len(digits) >= 10 else digits


def _money(value: str) -> float:
    cleaned = re.sub(r"[^\d.]", "", value or "")
    if not cleaned:
        return 0
    try:
        return float(cleaned)
    except ValueError:
        return 0


def _product(value: str) -> tuple[str, str, str] | None:
    key = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    if key in PRODUCTS:
        return PRODUCTS[key]
    for known, mapped in PRODUCTS.items():
        if known.replace("-", "") in key.replace("-", ""):
            return mapped
    return None


def parse_csv(raw: bytes) -> list[dict[str, str]]:
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("The file needs a header row: name, phone, city, product.")
    rows: list[dict[str, str]] = []
    for raw_row in reader:
        item = {name: "" for name in ("name", "phone", "city", "product", "loan_amount", "monthly_income", "employment", "email")}
        for header, value in raw_row.items():
            canonical = HEADER_ALIASES.get(re.sub(r"[^a-z0-9]+", "_", (header or "").strip().lower()).strip("_"))
            if canonical:
                item[canonical] = (value or "").strip()
        if any(item.values()):
            rows.append(item)
    return rows


def upload_csv(db: Session, user, raw: bytes, campaign: str, publish: bool) -> dict:
    if user.role not in UPLOAD_ROLES:
        raise PermissionError("Only an admin, partner, or telecaller can upload leads.")
    if publish and user.role not in ADMIN_ROLES:
        raise PermissionError("Only an admin can put an uploaded file on the leadboard.")
    rows = parse_csv(raw)
    if not rows:
        raise ValueError("The file has no leads.")
    if len(rows) > MAX_ROWS:
        raise ValueError(f"A file can hold {MAX_ROWS} leads. Split the rest into another file.")

    owned_phones = {
        _digits(phone)
        for (phone,) in (
            db.query(Lead.full_phone)
            .join(LeadPurchase, LeadPurchase.lead_id == Lead.id)
            .filter(LeadPurchase.buyer_user_id == user.id)
            .all()
        )
        if _digits(phone)
    }
    board_phones: set[str] = set()
    if publish:
        board_phones = {
            _digits(phone)
            for (phone,) in (
                db.query(Lead.full_phone)
                .filter(Lead.is_marketplace.is_(True), Lead.sale_available.is_(True), Lead.status == "available")
                .all()
            )
            if _digits(phone)
        }

    label = (campaign or "").strip()[:120]
    added = 0
    skipped: list[dict] = []
    seen: set[str] = set()
    now = datetime.now(timezone.utc).isoformat()

    for index, row in enumerate(rows, start=2):
        phone = _digits(row["phone"])
        if not row["name"]:
            skipped.append({"row": index, "reason": "Name is missing"})
            continue
        if len(phone) != 10:
            skipped.append({"row": index, "reason": "Phone must be 10 digits"})
            continue
        if not row["city"]:
            skipped.append({"row": index, "reason": "City is missing"})
            continue
        product = _product(row["product"])
        if not product:
            skipped.append({"row": index, "reason": "Unknown product. Use personal-loan, home-loan, credit-card, insurance, or investment."})
            continue
        if phone in seen:
            skipped.append({"row": index, "reason": "This phone is repeated in the file"})
            continue
        if phone in owned_phones:
            skipped.append({"row": index, "reason": "This phone is already in your leads"})
            continue
        if publish and phone in board_phones:
            skipped.append({"row": index, "reason": "This phone is already on the leadboard"})
            continue
        seen.add(phone)
        category, subtype, loan_type = product
        on_board = bool(publish)
        lead = Lead(
            applicant_name=row["name"][:200],
            full_phone=normalize_phone(phone),
            masked_phone=mask_phone(phone),
            email=row["email"][:255] or None,
            city=row["city"][:120],
            loan_amount=_money(row["loan_amount"]),
            monthly_income=_money(row["monthly_income"]) or None,
            employment_type=row["employment"][:80] or None,
            loan_type=loan_type[:40],
            product_category=category,
            product_subtype=subtype,
            status="available" if on_board else "sold",
            score="warm",
            price=default_lead_price(category) if on_board else 0,
            source="upload",
            utm_source=user.role,
            utm_medium="csv",
            utm_campaign=label or None,
            is_marketplace=on_board,
            sale_available=on_board,
            phone_verified=False,
            product_details={"origin": "upload", "campaign": label, "uploaded_by": str(user.id)},
            quality_factors={},
        )
        db.add(lead)
        db.flush()
        if not on_board:
            db.add(
                LeadPurchase(
                    lead_id=lead.id,
                    buyer_user_id=user.id,
                    price_paid=0,
                    pipeline_stage="new",
                    notes=[{"at": now, "text": "Uploaded from a sheet", "by": user.email, "kind": "system"}],
                )
            )
            owned_phones.add(phone)
        else:
            board_phones.add(phone)
        added += 1

    db.commit()
    return {
        "added": added,
        "skipped": skipped,
        "published": bool(publish),
        "campaign": label,
        "source": "upload",
    }
