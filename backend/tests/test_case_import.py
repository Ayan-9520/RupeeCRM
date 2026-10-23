"""Disbursed My Leads purchases → Case Files import. Deletes only rows this script creates."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token, hash_password
from app.db.session import SessionLocal
from app.models import AuditEvent, Lead, LeadPurchase, LoanCase, PayoutRequest, User
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
    started = datetime.now(timezone.utc) - timedelta(seconds=5)
    db = SessionLocal()
    tag = uuid.uuid4().hex[:8]
    checks: list[tuple[str, bool]] = []
    user_ids: list[uuid.UUID] = []
    lead_ids: list[uuid.UUID] = []
    purchase_ids: list[uuid.UUID] = []
    draft_ids: list[str] = []
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

        def deal_of(purchase_id) -> str:
            db.expire_all()
            row = db.query(LoanCase).filter(LoanCase.lead_purchase_id == purchase_id).first()
            return row.deal_no if row else "<none>"

        def files_for(purchase_id) -> int:
            db.expire_all()
            return db.query(LoanCase).filter(LoanCase.lead_purchase_id == purchase_id).count()

        ymd = datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime("%Y%m%d")
        number_rx = re.compile(rf"^RD-MCF-{ymd}-(\d{{4,}})$")

        admin_token = create_access_token(str(admin.id))
        dsa_token = create_access_token(str(dsa.id))
        other_token = create_access_token(str(other.id))

        status, _ = call("POST", "/api/cases/import-disbursed")
        check("import requires auth", status == 401)
        status, _ = call("POST", "/api/cases/import-disbursed", dsa_token)
        check("partner cannot import", status == 403)

        status, raw = call("POST", "/api/cases/import-disbursed", admin_token)
        body = json.loads(raw) if status == 200 else {}
        deal_done = deal_of(done.id)
        mine = next((row for row in body.get("items", []) if row.get("deal_no") == deal_done), None)
        check("admin import succeeds", status == 200)
        check("disbursed lead became a case file", mine is not None)
        first = number_rx.match(deal_done)
        check(f"case number reads RD-MCF-<today>-NNNN ({deal_done})", first is not None and mine is not None and mine.get("case_no") == int(first.group(1)))
        check("open lead was not imported", files_for(open_.id) == 0)
        if mine:
            check("case stage is disbursed", mine["stage"] == "disbursed" and mine["status_label"] == "Not Counted")
            check("client and partner copied", mine["client_name"] == "Verify Disbursed Client" and mine["partner_name"] == "Verify Case DSA" and mine["partner_code"] == dsa.dsa_id)
            check("loan type from product", mine["loan_type"] == "LAP")
            check("disbursed amount is the deal value", mine["sanctioned_amount"] == 500000 and mine["loan_amount"] == 600000)
            check("receivable 1.4% and payable 90% defaults", mine["receivable_amount"] == 7000 and mine["payable_amount"] == 6300)

        status, raw = call("POST", "/api/cases/import-disbursed", admin_token)
        again = json.loads(raw) if status == 200 else {}
        check("second import adds no duplicate", status == 200 and all(row.get("deal_no") != deal_done for row in again.get("items", [])))
        check("exactly one case file for the lead", files_for(done.id) == 1 and deal_of(done.id) == deal_done)

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

        check("open lead still has no case file", files_for(open_.id) == 0)
        status, _ = call("PATCH", f"/api/my-leads/{open_.id}", dsa_token, {"pipeline_stage": "disbursed"})
        db.expire_all()
        auto = db.query(LoanCase).filter(LoanCase.lead_purchase_id == open_.id).first()
        check("moving a lead to Disbursed creates its case file at once", status == 200 and auto is not None)
        later = number_rx.match(auto.deal_no) if auto else None
        check("next file gets the next case number", later is not None and first is not None and int(later.group(1)) > int(first.group(1)))
        check("auto file is marked as automatic", auto is not None and auto.submitted_by == "Auto · My Leads" and auto.stage == "disbursed")
        check("auto file uses the lead amount when no deal value", auto is not None and auto.sanctioned_amount == 300000)
        status, _ = call("PATCH", f"/api/my-leads/{open_.id}", dsa_token, {"deal_value": 280000})
        db.expire_all()
        check("saving the lead again adds no duplicate", status == 200 and files_for(open_.id) == 1)

        lead_db = Lead(applicant_name="Verify Direct Client", full_phone="9000000013", masked_phone="90XXXXXX13", city="Pune", price=99, loan_amount=200000, status="sold")
        db.add(lead_db)
        db.flush()
        lead_ids.append(lead_db.id)
        direct = LeadPurchase(lead_id=lead_db.id, buyer_user_id=dsa.id, price_paid=99, pipeline_stage="disbursed", converted=True, notes=[])
        db.add(direct)
        db.commit()
        purchase_ids.append(direct.id)
        status, raw = call("GET", q, dsa_token)
        listed = {row["deal_no"] for row in json.loads(raw).get("items", [])} if status == 200 else set()
        check("opening Case Files picks up a disbursed lead with no file", deal_of(direct.id) in listed)

        def flag_of(deal: str) -> str | None:
            db.expire_all()
            row = db.query(LoanCase).filter(LoanCase.deal_no == deal).first()
            return row.flag if row else None

        def in_chip(chip: str, deal: str) -> bool:
            status, raw = call("GET", f"/api/cases?chip={chip}&date_from={today}&date_to={today}", admin_token)
            return status == 200 and deal in {row["deal_no"] for row in json.loads(raw).get("items", [])}

        status, _ = call("PATCH", f"/api/my-leads/{done.id}", dsa_token, {"pipeline_stage": "rejected"})
        check("rejecting the lead cancels its case file", status == 200 and flag_of(deal_done) == "cancelled")
        check("rejected file shows under Cancelled", in_chip("cancelled", deal_done))
        check("rejected file leaves Disbursed and Not Counted", not in_chip("disbursed", deal_done) and not in_chip("not_counted", deal_done))
        status, _ = call("PATCH", f"/api/my-leads/{done.id}", dsa_token, {"pipeline_stage": "disbursed"})
        check("moving the lead back to Disbursed lifts the cancel", status == 200 and flag_of(deal_done) == "")
        check("reopened file is back under Disbursed", in_chip("disbursed", deal_done) and not in_chip("cancelled", deal_done))
        check("reopening adds no duplicate and keeps the number", files_for(done.id) == 1 and deal_of(done.id) == deal_done)

        def bank_of(deal: str) -> str | None:
            db.expire_all()
            row = db.query(LoanCase).filter(LoanCase.deal_no == deal).first()
            return row.bank_name if row else None

        status, _ = call("PATCH", f"/api/my-leads/{done.id}", dsa_token, {"notes_text": "Assigned to HDFC Bank"})
        check("assigning a lender fills the empty Bank on the case file", status == 200 and bank_of(deal_done) == "HDFC Bank")
        file_row = db.query(LoanCase).filter(LoanCase.deal_no == deal_done).first()
        call("PUT", f"/api/cases/{file_row.id}", admin_token, {"bank_name": "ICICI Bank"})
        call("PATCH", f"/api/my-leads/{done.id}", dsa_token, {"notes_text": "Assigned to Axis Bank"})
        check("a bank the admin typed is never overwritten", bank_of(deal_done) == "ICICI Bank")

        file_id = db.query(LoanCase).filter(LoanCase.deal_no == deal_done).first().id
        status, _ = call("PUT", f"/api/cases/{file_id}", admin_token, {"flag": "cancelled"})
        in_chip("all", deal_done)
        check("admin cancel on a disbursed lead is kept after reload", status == 200 and flag_of(deal_done) == "cancelled")

        db.query(LeadPurchase).filter(LeadPurchase.id == direct.id).update({LeadPurchase.pipeline_stage: "rejected", LeadPurchase.converted: True})
        db.commit()
        direct_deal = deal_of(direct.id)
        check("opening Case Files cancels a lead rejected elsewhere", in_chip("cancelled", direct_deal) and flag_of(direct_deal) == "cancelled")

        lead_rej = Lead(applicant_name="Verify Rejected Client", full_phone="9000000014", masked_phone="90XXXXXX14", city="Pune", price=99, loan_amount=100000, status="sold")
        db.add(lead_rej)
        db.flush()
        lead_ids.append(lead_rej.id)
        rej = LeadPurchase(lead_id=lead_rej.id, buyer_user_id=dsa.id, price_paid=99, pipeline_stage="rejected", converted=True, notes=[])
        db.add(rej)
        db.commit()
        purchase_ids.append(rej.id)
        in_chip("all", deal_done)
        check("a rejected lead never gets a new case file", files_for(rej.id) == 0)

        status, draft = call("POST", "/api/cases", admin_token, {"client_name": "Verify Draft"})
        draft_body = json.loads(draft) if status == 200 else {}
        draft_ids.append(draft_body.get("id"))
        check("New draft also gets an RD-MCF-<today>-NNNN number", status == 200 and number_rx.match(draft_body.get("deal_no", "")) is not None)
    finally:
        db.rollback()
        db.query(LoanCase).filter(LoanCase.lead_purchase_id.isnot(None), LoanCase.created_at >= started).delete(synchronize_session=False)
        live_drafts = [d for d in draft_ids if d]
        if live_drafts:
            db.query(LoanCase).filter(LoanCase.id.in_(live_drafts)).delete(synchronize_session=False)
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
