"""Login, role guard, lead purchase with wallet, and workspace profile persistence.

Creates two temporary partner users and two temporary leads, then deletes only those rows
and anything created for them.
"""

from __future__ import annotations

import json
import secrets
import urllib.error
import urllib.request
import uuid

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    AuditEvent,
    CustomerBankAccount,
    CustomerCoApplicant,
    CustomerLoanRequirement,
    CustomerObligation,
    CustomerProfile,
    Lead,
    LeadPurchase,
    PayoutRequest,
    User,
)

API = "http://127.0.0.1:8000"


def call(method: str, path: str, token: str | None = None, payload: dict | None = None):
    headers: dict[str, str] = {}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def main() -> None:
    db = SessionLocal()
    tag = uuid.uuid4().hex[:8]
    password = secrets.token_urlsafe(16)
    checks: list[tuple[str, bool]] = []
    profiles_before = db.query(CustomerProfile).count()
    payouts_before = db.query(PayoutRequest).count()
    user_ids: list[uuid.UUID] = []
    lead_ids: list[uuid.UUID] = []

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    try:
        buyer = User(
            email=f"verify-buyer-{tag}@verify.rupeedial.in",
            full_name="Verify Buyer",
            password_hash=hash_password(password),
            role="dsa",
            wallet_balance=200,
        )
        broke = User(
            email=f"verify-broke-{tag}@verify.rupeedial.in",
            full_name="Verify Broke",
            password_hash=hash_password(password),
            role="dsa",
            wallet_balance=0,
        )
        db.add_all([buyer, broke])
        db.flush()
        user_ids += [buyer.id, broke.id]
        lead_a = Lead(applicant_name="Verify Lead A", full_phone="9000000001", masked_phone="90XXXXXX01", city="Pune", price=149)
        lead_b = Lead(applicant_name="Verify Lead B", full_phone="9000000002", masked_phone="90XXXXXX02", city="Pune", price=149)
        db.add_all([lead_a, lead_b])
        db.commit()
        lead_ids += [lead_a.id, lead_b.id]

        status, _ = call("POST", "/api/auth/login", payload={"email": buyer.email, "password": "wrong-password"})
        check("wrong password rejected", status == 401)
        status, raw = call("POST", "/api/auth/login", payload={"email": buyer.email, "password": password})
        token = json.loads(raw).get("access_token") if status == 200 else None
        check("correct password returns a token", status == 200 and bool(token))
        status, raw = call("POST", "/api/auth/login", payload={"email": broke.email, "password": password})
        broke_token = json.loads(raw).get("access_token") if status == 200 else None

        status, raw = call("GET", "/api/auth/me", token)
        check("session resolves to the signed-in user", status == 200 and json.loads(raw).get("email") == buyer.email)
        status, _ = call("GET", "/api/auth/me")
        check("no token is rejected", status == 401)
        status, _ = call("GET", "/api/auth/me", "garbage")
        check("bad token is rejected", status == 401)

        status, _ = call("GET", "/api/billing/admin/subscriptions", token)
        check("partner cannot open admin subscriptions", status in (401, 403))
        status, _ = call("GET", "/api/payouts/admin/requests", token)
        check("partner cannot open admin invoices", status == 403)

        status, raw = call("POST", f"/api/leads/{lead_b.id}/purchase", broke_token)
        check("insufficient wallet returns 402", status == 402 and b"Insufficient wallet balance" in raw)
        db.expire_all()
        check("402 leaves the lead available", db.get(Lead, lead_b.id).status == "available")
        check("402 creates no purchase", db.query(LeadPurchase).filter(LeadPurchase.lead_id == lead_b.id).count() == 0)

        status, raw = call("POST", f"/api/leads/{lead_a.id}/purchase", token)
        bought = json.loads(raw) if status == 200 else {}
        purchase_id = bought.get("purchase_id")
        check("purchase succeeds with enough balance", status == 200 and bool(purchase_id))
        check("purchase reveals the full phone", bought.get("full_phone") == "9000000001")
        status, raw = call("GET", "/api/billing/me", token)
        wallet = json.loads(raw)["entitlements"]["wallet_balance"] if status == 200 else None
        check("wallet deducted by the lead price", wallet is not None and abs(float(wallet) - 51) < 0.01)

        status, raw = call("POST", f"/api/leads/{lead_a.id}/purchase", token)
        check("repeat purchase is not charged again", status == 200 and json.loads(raw).get("message") == "Already purchased")
        status, raw = call("GET", "/api/billing/me", token)
        check("wallet unchanged after repeat", abs(float(json.loads(raw)["entitlements"]["wallet_balance"]) - 51) < 0.01)
        status, _ = call("POST", f"/api/leads/{lead_a.id}/purchase", broke_token)
        check("sold lead cannot be bought by another partner", status in (402, 409))

        base = f"/api/my-leads/{purchase_id}/workspace"
        status, _ = call("GET", base)
        check("workspace requires auth", status == 401)
        status, _ = call("GET", base, broke_token)
        check("another partner cannot open the workspace", status == 404)
        status, raw = call("GET", base, token)
        ws = json.loads(raw) if status == 200 else {}
        profile_id = (ws.get("profile") or {}).get("id")
        check("owner opens the workspace", status == 200 and bool(profile_id))

        patch_path = f"/api/customer-workspace/profiles/{profile_id}"
        status, _ = call("PATCH", patch_path, broke_token, {"city": "Mumbai"})
        check("another partner cannot edit the profile", status == 404)
        status, _ = call("PATCH", patch_path, token, {"pan": "BAD"})
        check("invalid PAN rejected", status == 400 or status == 422)
        status, _ = call("PATCH", patch_path, token, {"city": "Nashik", "pan": "ABCDE1234F", "monthly_income": 55000})
        check("owner saves the profile", status == 200)
        status, raw = call("GET", base, token)
        prof = (json.loads(raw).get("profile") or {}) if status == 200 else {}
        check(
            "profile persists after reload",
            prof.get("city") == "Nashik" and prof.get("pan") == "ABCDE1234F" and float(prof.get("monthly_income") or 0) == 55000,
        )

        status, _ = call("PATCH", f"/api/my-leads/{purchase_id}", token, {"deal_value": 123456})
        status2, raw = call("GET", base, token)
        purchase_out = (json.loads(raw).get("purchase") or {}) if status2 == 200 else {}
        check("workspace shows the saved deal value and lead stage", status == 200 and purchase_out.get("deal_value") == 123456 and purchase_out.get("pipeline_stage") == "new")

        db.query(User).filter(User.id == buyer.id).update({User.is_active: False})
        db.commit()
        status, _ = call("GET", "/api/auth/me", token)
        check("deactivated user's token stops working", status == 401)
    finally:
        db.rollback()
        purchase_ids = [p.id for p in db.query(LeadPurchase).filter(LeadPurchase.lead_id.in_(lead_ids)).all()] if lead_ids else []
        if purchase_ids:
            for model in (CustomerBankAccount, CustomerCoApplicant, CustomerLoanRequirement, CustomerObligation, CustomerProfile):
                db.query(model).filter(model.lead_purchase_id.in_(purchase_ids)).delete(synchronize_session=False)
            db.query(LeadPurchase).filter(LeadPurchase.id.in_(purchase_ids)).delete(synchronize_session=False)
        if user_ids:
            db.query(AuditEvent).filter(AuditEvent.actor_user_id.in_(user_ids)).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        if lead_ids:
            db.query(Lead).filter(Lead.id.in_(lead_ids)).delete(synchronize_session=False)
        db.commit()
        check("existing customer profiles unchanged", db.query(CustomerProfile).count() == profiles_before)
        check("partner payout requests unchanged", db.query(PayoutRequest).count() == payouts_before)
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
