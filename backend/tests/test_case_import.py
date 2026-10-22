"""Disbursed My Leads purchases → Case Files import. Deletes only rows this script creates."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token, hash_password
from app.db.session import SessionLocal
from app.models import AuditEvent, Lead, LeadPurchase, LoanCase, PayoutRequest, User
from app.services.loan_cases import lead_deal_no

API = "http://127.0.0.1:8000"
STAFF = ["admin", "ceo", "super_admin"]


def call(method: str, path: str, token: str | None = None):
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(API + path, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def main() -> None:
    started = datetime.now(timezone.utc) - timedelta(seconds=5)
    db = SessionLocal()
    tag = uuid.uuid4().hex[:8]
    checks: list[tuple[str, bool]] = []
    user_ids: list[uuid.UUID] = []
    lead_ids: list[uuid.UUID] = []
    purchase_ids: list[uuid.UUID] = []
    payouts_before = db.query(PayoutRequest).count()

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    try:
        admin = db.query(User).filter(User.role.in_(STAFF), User.is_active.is_(True)).first()
        if not admin:
            raise SystemExit("Need an active admin user.")
        dsa = User(email=f"verify-case-a-{tag}@verify.rupeedial.in", full_name="Verify Case DSA", password_hash=hash_password(tag), role="dsa", dsa_id=f"RD-T-{tag[:4]}")
        other = User(email=f"verify-case-b-{tag}@verify.rupeedial.in", full_name="Verify Case Other", password_hash=hash_password(tag), role="dsa")
        db.add_all([dsa, other])
        db.flush()
        user_ids += [dsa.id, other.id]
        lead_done = Lead(applicant_name="Verify Disbursed Client", full_phone="9000000011", masked_phone="90XXXXXX11", city="Pune", price=99, loan_amount=600000, product_subtype="loan_lap", status="sold")
        lead_open = Lead(applicant_name="Verify Open Client", full_phone="9000000012", masked_phone="90XXXXXX12", city="Pune", price=99, loan_amount=300000, status="sold")
        db.add_all([lead_done, lead_open])
        db.flush()
        lead_ids += [lead_done.id, lead_open.id]
        done = LeadPurchase(lead_id=lead_done.id, buyer_user_id=dsa.id, price_paid=99, pipeline_stage="disbursed", converted=True, deal_value=500000, notes=[])
        open_ = LeadPurchase(lead_id=lead_open.id, buyer_user_id=dsa.id, price_paid=99, pipeline_stage="contacted", notes=[])
        db.add_all([done, open_])
        db.commit()
        purchase_ids += [done.id, open_.id]
        deal_done = lead_deal_no(done.id)
        deal_open = lead_deal_no(open_.id)

        admin_token = create_access_token(str(admin.id))
        dsa_token = create_access_token(str(dsa.id))
        other_token = create_access_token(str(other.id))

        status, _ = call("POST", "/api/cases/import-disbursed")
        check("import requires auth", status == 401)
        status, _ = call("POST", "/api/cases/import-disbursed", dsa_token)
        check("partner cannot import", status == 403)

        status, raw = call("POST", "/api/cases/import-disbursed", admin_token)
        body = json.loads(raw) if status == 200 else {}
        mine = next((row for row in body.get("items", []) if row.get("deal_no") == deal_done), None)
        check("admin import succeeds", status == 200)
        check("disbursed lead became a case file", mine is not None)
        check("open lead was not imported", all(row.get("deal_no") != deal_open for row in body.get("items", [])))
        if mine:
            check("case stage is disbursed", mine["stage"] == "disbursed" and mine["status_label"] == "Not Counted")
            check("client and partner copied", mine["client_name"] == "Verify Disbursed Client" and mine["partner_name"] == "Verify Case DSA" and mine["partner_code"] == dsa.dsa_id)
            check("loan type from product", mine["loan_type"] == "LAP")
            check("disbursed amount is the deal value", mine["sanctioned_amount"] == 500000 and mine["loan_amount"] == 600000)
            check("receivable 1.4% and payable 90% defaults", mine["receivable_amount"] == 7000 and mine["payable_amount"] == 6300)

        status, raw = call("POST", "/api/cases/import-disbursed", admin_token)
        again = json.loads(raw) if status == 200 else {}
        check("second import adds no duplicate", status == 200 and all(row.get("deal_no") != deal_done for row in again.get("items", [])))
        check("exactly one case file for the lead", db.query(LoanCase).filter(LoanCase.deal_no == deal_done).count() == 1)

        today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
        q = f"/api/cases?chip=all&date_from={today}&date_to={today}"
        status, raw = call("GET", q, dsa_token)
        dsa_rows = {row["deal_no"] for row in json.loads(raw).get("items", [])} if status == 200 else set()
        check("partner sees their imported case", deal_done in dsa_rows)
        status, raw = call("GET", q, other_token)
        other_rows = {row["deal_no"] for row in json.loads(raw).get("items", [])} if status == 200 else {deal_done}
        check("another partner does not see it", deal_done not in other_rows)
        status, raw = call("GET", f"/api/cases?chip=disbursed&date_from={today}&date_to={today}", admin_token)
        check("admin list shows it", status == 200 and deal_done in {row["deal_no"] for row in json.loads(raw).get("items", [])})
    finally:
        db.rollback()
        db.query(LoanCase).filter(LoanCase.deal_no.like("RD-LP-%"), LoanCase.created_at >= started).delete(synchronize_session=False)
        if purchase_ids:
            db.query(LeadPurchase).filter(LeadPurchase.id.in_(purchase_ids)).delete(synchronize_session=False)
        if lead_ids:
            db.query(Lead).filter(Lead.id.in_(lead_ids)).delete(synchronize_session=False)
        if user_ids:
            db.query(AuditEvent).filter(AuditEvent.actor_user_id.in_(user_ids)).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
        check("partner payout requests unchanged", db.query(PayoutRequest).count() == payouts_before)
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
