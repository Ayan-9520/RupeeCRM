"""Partner payout contract used by the earnings, admin invoice, and connector screens.

Uses one temporary payout_requests row and deletes only that row.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models import CustomerCasePayout, PayoutRequest, User

API = "http://127.0.0.1:8000"
STAFF = ["admin", "ceo", "super_admin"]


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
    temp_id = uuid.uuid4()
    checks: list[tuple[str, bool]] = []
    before = {str(r.id): (r.status, float(r.amount), r.utr) for r in db.query(PayoutRequest).all()}
    case_payouts_before = db.query(CustomerCasePayout).count()

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    try:
        partners = (
            db.query(User)
            .filter(User.role.notin_(STAFF), User.is_active.is_(True))
            .order_by(User.created_at.asc())
            .limit(2)
            .all()
        )
        admin = db.query(User).filter(User.role.in_(STAFF), User.is_active.is_(True)).first()
        if len(partners) < 2 or not admin:
            raise SystemExit("Need two non-staff users and one admin user.")
        partner, other = partners
        partner_token = create_access_token(str(partner.id))
        other_token = create_access_token(str(other.id))
        admin_token = create_access_token(str(admin.id))

        db.add(
            PayoutRequest(
                id=temp_id,
                user_id=partner.id,
                amount=1234.0,
                status="pending",
                bank_snapshot={"invoice_number": "RD-INV-TEST", "case_ids": []},
                note="Invoice RD-INV-TEST",
            )
        )
        db.commit()
        path = f"/api/payouts/admin/requests/{temp_id}"

        status, _ = call("GET", "/api/payouts/requests")
        check("partner request list requires auth", status == 401)
        status, _ = call("GET", "/api/payouts/centre")
        check("invoice centre requires auth", status == 401)

        status, raw = call("GET", "/api/payouts/requests", other_token)
        ids = {row["id"] for row in json.loads(raw)} if status == 200 else {str(temp_id)}
        check("another partner cannot see the invoice", status == 200 and str(temp_id) not in ids)

        status, _ = call("GET", "/api/payouts/admin/requests", partner_token)
        check("partner cannot open the admin list", status == 403)
        status, _ = call("POST", path, partner_token, {"action": "approve"})
        check("partner cannot approve their own invoice", status == 403)

        status, _ = call("POST", f"/api/payouts/admin/requests/{uuid.uuid4()}", admin_token, {"action": "approve"})
        check("unknown invoice returns 404", status == 404)
        status, _ = call("POST", path, admin_token, {"action": "settle"})
        check("unsupported action rejected", status == 422)
        status, _ = call("POST", path, admin_token, {"action": "processing"})
        check("processing before approval rejected", status == 400)

        status, raw = call("POST", path, admin_token, {"action": "approve"})
        check("admin approves a raised invoice", status == 200 and json.loads(raw).get("status") == "approved")

        status, raw = call("GET", "/api/payouts/requests", partner_token)
        mine = {row["id"]: row for row in json.loads(raw)} if status == 200 else {}
        check("partner sees the approved status", mine.get(str(temp_id), {}).get("status") == "approved")

        status, raw = call("GET", "/api/payouts/summary", partner_token)
        summary = json.loads(raw) if status == 200 else {}
        check(
            "summary paid_out still counts approved invoices (dashboard uses request status instead)",
            status == 200 and summary.get("paid_out", 0) >= 1234.0,
        )

        status, raw = call("POST", path, admin_token, {"action": "processing"})
        check("approved invoice moves to processing", status == 200 and json.loads(raw).get("status") == "processing")
        status, _ = call("POST", path, admin_token, {"action": "query", "rejection_reason": "x"})
        check("query not allowed while processing", status == 400)
        status, raw = call("POST", path, admin_token, {"action": "paid", "utr": "UTRTEST123"})
        paid = json.loads(raw) if status == 200 else {}
        check("processing invoice marked paid with UTR", status == 200 and paid.get("status") == "paid" and paid.get("utr") == "UTRTEST123")
        status, _ = call("POST", path, admin_token, {"action": "reject"})
        check("paid invoice cannot be rejected", status == 400)

        status, raw = call("GET", "/api/payouts/centre", partner_token)
        centre = json.loads(raw) if status == 200 else {}
        check("invoice centre reports the paid amount", status == 200 and centre.get("paid", 0) >= 1234.0)
    finally:
        db.query(PayoutRequest).filter(PayoutRequest.id == temp_id).delete(synchronize_session=False)
        db.commit()
        after = {str(r.id): (r.status, float(r.amount), r.utr) for r in db.query(PayoutRequest).all()}
        check("existing partner payout requests unchanged", after == before)
        check("customer case payouts untouched", db.query(CustomerCasePayout).count() == case_payouts_before)
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
