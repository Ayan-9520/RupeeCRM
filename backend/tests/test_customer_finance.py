"""Disbursal and case-payout checks. Deletes only rows this script creates."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models import AuditEvent, CustomerCasePayout, CustomerDisbursal, CustomerProfile, User

API = "http://127.0.0.1:8000"
STAFF = {"admin", "ceo", "super_admin"}
ACCOUNT = "123456789012"


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
    started = datetime.now(timezone.utc) - timedelta(seconds=5)
    db = SessionLocal()
    purchase_id = None
    checks: list[tuple[str, bool]] = []

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    try:
        profile = db.query(CustomerProfile).order_by(CustomerProfile.created_at.asc()).first()
        if not profile:
            raise SystemExit("No customer profile exists.")
        purchase_id = profile.lead_purchase_id
        owner = db.query(User).filter(User.id == profile.dsa_id).first()
        other = (
            db.query(User)
            .filter(User.id != profile.dsa_id, User.role.notin_(list(STAFF)), User.is_active.is_(True))
            .first()
        )
        if not owner or not other:
            raise SystemExit("Need the purchase owner and a second non-staff user.")
        owner_token = create_access_token(str(owner.id))
        other_token = create_access_token(str(other.id))
        base = f"/api/my-leads/{purchase_id}"

        status, _ = call("GET", f"{base}/disbursals")
        check("disbursals require auth", status == 401)
        status, _ = call("GET", f"{base}/disbursals", other_token)
        check("other customer cannot list disbursals", status == 404)

        status, raw = call(
            "POST",
            f"{base}/disbursals",
            owner_token,
            {
                "dsa_id": str(other.id),
                "disbursal_status": "partially_disbursed",
                "sanctioned_amount": 100000,
                "disbursed_amount": 90000,
                "processing_fee": 1000,
                "insurance_amount": 500,
                "deductions": 200,
                "roi": 12,
                "tenure": 12,
                "payout_expected": 2000,
                "payout_received": 500,
                "disbursal_date": "2026-10-21",
                "credited_account_number": ACCOUNT,
                "credited_ifsc": "HDFC0001234",
                "password": "do-not-store",
            },
        )
        row = json.loads(raw) if status == 200 else {}
        check("disbursal created", status == 200 and row.get("disbursal_status") == "partially_disbursed")
        check("owner comes from the purchase", row.get("dsa_id") == str(profile.dsa_id))
        check("net disbursal is calculated", row.get("net_disbursal") == 98300)
        check("payout pending is calculated", row.get("payout_pending") == 1500)
        check("emi is calculated", isinstance(row.get("emi"), (int, float)) and row.get("emi", 0) > 0)
        check("password is not stored in the response", "password" not in raw.decode().lower())
        disbursal_id = row.get("id")

        status, _ = call("PATCH", f"/api/customer-disbursals/{disbursal_id}", owner_token, {"disbursal_status": "paid"})
        check("invalid disbursal status rejected", status == 400)
        status, _ = call("PATCH", f"/api/customer-disbursals/{disbursal_id}", owner_token, {"credited_ifsc": "BAD"})
        check("invalid IFSC rejected", status == 400)
        status, _ = call("PATCH", f"/api/customer-disbursals/{disbursal_id}", owner_token, {"sanctioned_amount": -1})
        check("negative amount rejected", status == 400)
        status, raw = call("GET", f"{base}/disbursals", owner_token)
        listed = json.loads(raw) if status == 200 else {"rows": []}
        check("disbursal persists", any(item["id"] == disbursal_id and item["net_disbursal"] == 98300 for item in listed["rows"]))
        status, _ = call("PATCH", f"/api/customer-disbursals/{disbursal_id}", other_token, {"disbursal_status": "rejected"})
        check("other customer cannot update disbursal", status == 404)

        status, raw = call(
            "POST",
            f"{base}/case-payouts",
            owner_token,
            {
                "dsa_id": str(other.id),
                "payout_type": "commission",
                "payout_status": "received",
                "payout_amount": 1500,
                "expected_date": "2026-10-22",
                "payout_reference": "REF-1",
                "otp": "999999",
            },
        )
        payout = json.loads(raw) if status == 200 else {}
        check("payout created", status == 200 and payout.get("payout_status") == "received" and payout.get("payout_amount") == 1500)
        check("payout response has no otp", "otp" not in raw.decode().lower() and "999999" not in raw.decode())
        payout_id = payout.get("id")
        status, _ = call("PATCH", f"/api/customer-case-payouts/{payout_id}", owner_token, {"payout_type": "bonus"})
        check("invalid payout type rejected", status == 400)
        status, raw = call("GET", f"{base}/case-payouts", owner_token)
        payouts = json.loads(raw) if status == 200 else {"rows": []}
        check("payout persists", any(item["id"] == payout_id and item["created_at"] for item in payouts["rows"]))
        status, _ = call("DELETE", f"/api/customer-case-payouts/{payout_id}", other_token)
        check("other customer cannot delete payout", status == 404)

        status, raw = call("GET", f"{base}/timeline", owner_token)
        timeline = raw.decode()
        check("timeline shows disbursal without the account number", "partially_disbursed" in timeline and ACCOUNT not in timeline)
        status, raw = call("GET", f"{base}/audit", owner_token)
        audit = raw.decode()
        check("audit records the disbursal without the account number", "disbursal_saved" in audit and ACCOUNT not in audit)
        status, raw = call("GET", "/api/los/finance-report", owner_token)
        report = json.loads(raw) if status == 200 else {}
        check("finance report includes the disbursal", status == 200 and report.get("totalDisbursal", 0) >= 90000)
        status, _ = call("GET", "/api/los/finance-report")
        check("finance report requires auth", status == 401)

        status, _ = call("DELETE", f"/api/customer-disbursals/{disbursal_id}", owner_token)
        check("disbursal deleted", status == 200)
        status, _ = call("DELETE", f"/api/customer-case-payouts/{payout_id}", owner_token)
        check("payout deleted", status == 200)
    finally:
        if purchase_id is not None:
            db.query(CustomerDisbursal).filter(
                CustomerDisbursal.lead_purchase_id == purchase_id,
                CustomerDisbursal.created_at >= started,
            ).delete(synchronize_session=False)
            db.query(CustomerCasePayout).filter(
                CustomerCasePayout.lead_purchase_id == purchase_id,
                CustomerCasePayout.created_at >= started,
            ).delete(synchronize_session=False)
            db.query(AuditEvent).filter(
                AuditEvent.entity_id == str(purchase_id),
                AuditEvent.created_at >= started,
                AuditEvent.entity_type.in_(["disbursal", "payout"]),
            ).delete(synchronize_session=False)
            db.commit()
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
