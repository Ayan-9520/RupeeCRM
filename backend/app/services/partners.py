"""Partner application ingest + approve → DSA user."""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import PartnerApplication, User
from app.services.leads import normalize_phone
from app.services.network import attach_sponsor


def _city_code(city: str) -> str:
    clean = "".join(c for c in (city or "IND").upper() if c.isalpha())[:3]
    return (clean or "IND").ljust(3, "X")


def generate_dsa_id(city: str) -> str:
    return f"DSA-{_city_code(city)}-{secrets.randbelow(9000) + 1000}"


def login_role_for_type(dsa_type: str | None) -> str:
    if (dsa_type or "").lower() in {"telecaller", "telecalling_agency"}:
        return "caller"
    return "dsa"


def mark_partner_activated(app: PartnerApplication) -> None:
    docs = dict(app.documents or {})
    journey = dict(docs.get("journey") or {})
    journey["verification"] = "verified"
    journey["training"] = "assigned"
    journey["activation"] = "active"
    docs["journey"] = journey
    docs["login_role"] = login_role_for_type(app.dsa_type)
    app.documents = docs


def generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    raw = "".join(secrets.choice(alphabet) for _ in range(length))
    return f"Rd{raw}!"


def upsert_partner_from_website(db: Session, payload: dict) -> PartnerApplication:
    website_id = str(payload.get("website_lead_id") or payload.get("lead_id") or "").strip()
    if not website_id:
        website_id = f"DSA-WEB-{uuid4().hex[:10].upper()}"

    full_name = str(payload.get("full_name") or "").strip()
    phone = normalize_phone(str(payload.get("phone") or payload.get("mobile") or ""))
    email = str(payload.get("email") or "").strip().lower()
    city = str(payload.get("city") or "").strip()

    if len(full_name) < 2:
        raise ValueError("full_name is required")
    if len(phone) < 10:
        raise ValueError("Valid phone is required")
    if "@" not in email:
        raise ValueError("Valid email is required")
    if len(city) < 2:
        raise ValueError("city is required")

    docs = payload.get("documents") or {}
    if isinstance(docs, list):
        docs = {str(i): d for i, d in enumerate(docs)}
    if not isinstance(docs, dict):
        docs = {}

    existing = (
        db.query(PartnerApplication)
        .filter(PartnerApplication.website_lead_id == website_id)
        .first()
    )
    if existing:
        if existing.status == "approved":
            return existing
        existing.full_name = full_name
        existing.phone = phone
        existing.email = email
        existing.city = city
        existing.state = payload.get("state")
        existing.ref_code = payload.get("ref_code") or existing.ref_code
        existing.dsa_type = payload.get("dsa_type") or existing.dsa_type
        if docs:
            existing.documents = {**(existing.documents or {}), **docs}
        existing.raw_payload = payload
        if existing.status == "rejected":
            existing.status = "pending"
            existing.rejection_reason = None
        db.commit()
        db.refresh(existing)
        return existing

    row = PartnerApplication(
        website_lead_id=website_id,
        ref_code=payload.get("ref_code"),
        dsa_type=payload.get("dsa_type"),
        full_name=full_name,
        phone=phone,
        email=email,
        city=city,
        state=payload.get("state"),
        status="pending",
        documents=docs,
        raw_payload=payload,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def approve_partner(db: Session, app: PartnerApplication, admin: User, notes: str | None = None) -> tuple[PartnerApplication, User, str]:
    if app.status == "approved" and app.user_id:
        user = db.query(User).filter(User.id == app.user_id).first()
        if user:
            # Re-issue password so admin can share login again
            temp = generate_temp_password()
            user.password_hash = hash_password(temp)
            user.is_active = True
            user.role = login_role_for_type(app.dsa_type)
            mark_partner_activated(app)
            _link_sponsor(db, app, user)
            db.commit()
            return app, user, temp
        raise ValueError("Approved but user missing")

    if app.status == "approved":
        raise ValueError("Already approved")

    dsa_id = app.generated_dsa_id or generate_dsa_id(app.city)
    temp = generate_temp_password()

    user = db.query(User).filter(User.email == app.email.lower()).first()
    if user:
        user.full_name = app.full_name
        user.password_hash = hash_password(temp)
        user.role = login_role_for_type(app.dsa_type)
        user.phone = app.phone
        user.dsa_id = dsa_id
        user.is_active = True
    else:
        user = User(
            email=app.email.lower(),
            full_name=app.full_name,
            password_hash=hash_password(temp),
            role=login_role_for_type(app.dsa_type),
            phone=app.phone,
            dsa_id=dsa_id,
            is_active=True,
        )
        db.add(user)
        db.flush()

    app.status = "approved"
    app.generated_dsa_id = dsa_id
    app.user_id = user.id
    app.reviewed_by = admin.id
    app.reviewed_at = datetime.now(timezone.utc)
    if notes:
        app.internal_notes = notes
    mark_partner_activated(app)
    _link_sponsor(db, app, user)

    db.commit()
    db.refresh(app)
    db.refresh(user)
    return app, user, temp


def _link_sponsor(db: Session, app: PartnerApplication, user: User) -> None:
    documents = app.documents if isinstance(app.documents, dict) else {}
    code = (app.ref_code or "").strip() or str(documents.get("sponsor_code") or "").strip()
    if code:
        attach_sponsor(db, user, code)


def reject_partner(db: Session, app: PartnerApplication, admin: User, reason: str) -> PartnerApplication:
    if app.status == "approved":
        raise ValueError("Cannot reject an approved partner")
    app.status = "rejected"
    app.rejection_reason = reason.strip()
    app.reviewed_by = admin.id
    app.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(app)
    return app
