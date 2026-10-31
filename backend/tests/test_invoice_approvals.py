"""Invoice approval chain: RM1 -> RM2 -> Manager -> Business Head -> Accounts.

Creates temporary users and one temporary invoice, then deletes only those rows.
"""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

from app.core.security import create_access_token, hash_password
from app.db.session import SessionLocal
from app.models import AuditEvent, InvoiceApproval, PayoutRequest, User, UserNotification
from app.services.invoice_flow import tax_breakup, tax_settings

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
            return res.status, res.read(), res.headers.get("content-type", "")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), ""


def main() -> None:
    db = SessionLocal()
    checks: list[tuple[str, bool]] = []
    tag = uuid.uuid4().hex[:8]
    temp_ids: list[uuid.UUID] = []
    invoice_id = uuid.uuid4()
    before = {str(r.id): (r.status, r.stage) for r in db.query(PayoutRequest).all()}

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    def make(role: str, name: str, **extra) -> User:
        u = User(
            id=uuid.uuid4(),
            email=f"inv-{name}-{tag}@verify.rupeedial.in",
            full_name=f"Inv {name} {tag}",
            password_hash=hash_password(uuid.uuid4().hex),
            role=role,
            is_active=True,
            **extra,
        )
        db.add(u)
        temp_ids.append(u.id)
        return u

    try:
        admin = db.query(User).filter(User.role.in_(STAFF), User.is_active.is_(True)).first()
        if not admin:
            raise SystemExit("Need an admin user")
        bank = {
            "account_holder": "Inv Partner",
            "account_number": "123456789012",
            "ifsc": "HDFC0000001",
            "bank_name": "HDFC",
            "pan": "ABCDE1234F",
            "gstin": "07ABCDE1234F1Z5",
        }
        partner = make("dsa", "partner", kyc_verified=True, payout_bank=bank)
        rm1 = make("coordinator", "rm1")
        rm2 = make("coordinator", "rm2")
        manager = make("coordinator", "manager")
        bh = make("coordinator", "bh")
        accounts = make("coordinator", "accounts")
        db.commit()
        tok = {u: create_access_token(str(u.id)) for u in (partner, rm1, rm2, manager, bh, accounts)}
        admin_tok = create_access_token(str(admin.id))

        status, _, _ = call("GET", "/api/invoice-approvals")
        check("queue requires auth", status == 401)
        status, _, _ = call("GET", "/api/invoice-approvals", tok[partner])
        check("partner cannot open the approval queue", status == 403)
        status, _, _ = call("GET", "/api/invoice-approvals/setup", tok[rm1])
        check("non-admin cannot open finance setup", status == 403)

        for user, level in ((rm1, "rm"), (rm2, "rm"), (manager, "manager"), (bh, "business_head"), (accounts, "accounts")):
            status, _, _ = call("PUT", f"/api/invoice-approvals/setup/{user.id}", admin_tok, {"finance_level": level})
            if status != 200:
                break
        check("admin sets finance levels", status == 200)
        status, _, _ = call("PUT", f"/api/invoice-approvals/setup/{partner.id}", admin_tok, {"finance_level": "manager"})
        check("partner cannot be an approver", status == 400)
        status, _, _ = call("PUT", f"/api/invoice-approvals/setup/{partner.id}", admin_tok, {"rm1_user_id": str(manager.id)})
        check("RM must have the RM level", status == 400)
        status, _, _ = call(
            "PUT", f"/api/invoice-approvals/setup/{partner.id}", admin_tok, {"rm1_user_id": str(rm1.id), "rm2_user_id": str(rm1.id)}
        )
        check("RM 1 and RM 2 must differ", status == 400)
        status, _, _ = call(
            "PUT", f"/api/invoice-approvals/setup/{partner.id}", admin_tok, {"rm1_user_id": str(rm1.id), "rm2_user_id": str(rm2.id)}
        )
        check("admin assigns RM 1 and RM 2 to the partner", status == 200)

        status, raw, _ = call("GET", "/api/admin/commission", admin_tok)
        settings = json.loads(raw) if status == 200 else {}
        check("commission settings include GST and TDS", "gst_percent" in settings and "tds_percent" in settings)
        gst_pct, tds_pct = tax_settings(db)
        gst, tds, net = tax_breakup(db, 10000, "07ABCDE1234F1Z5")
        check(
            "GST applies with GSTIN, TDS on commission",
            gst == round(10000 * gst_pct / 100, 2) and tds == round(10000 * tds_pct / 100, 2) and net == round(10000 + gst - tds, 2),
        )
        g0, t0, n0 = tax_breakup(db, 10000, "")
        check("no GST without GSTIN", g0 == 0 and n0 == round(10000 - t0, 2))

        db.add(
            PayoutRequest(
                id=invoice_id,
                user_id=partner.id,
                amount=10000.0,
                status="pending",
                stage="rm1",
                gst_amount=gst,
                tds_amount=tds,
                net_payable=net,
                bank_snapshot={**bank, "invoice_number": f"RD-INV-TEST-{tag}", "case_ids": []},
                note=f"Invoice RD-INV-TEST-{tag}",
            )
        )
        db.commit()
        act = f"/api/invoice-approvals/{invoice_id}/action"

        status, raw, _ = call("GET", "/api/invoice-approvals?scope=mine", tok[rm1])
        mine = [r["id"] for r in json.loads(raw)] if status == 200 else []
        check("RM 1 sees the invoice in My queue", str(invoice_id) in mine)
        status, raw, _ = call("GET", "/api/invoice-approvals?scope=mine", tok[rm2])
        mine = [r["id"] for r in json.loads(raw)] if status == 200 else ["x"]
        check("RM 2 does not see it yet", str(invoice_id) not in mine)
        status, _, _ = call("POST", act, tok[rm2], {"action": "approve"})
        check("RM 2 cannot act at RM 1 step", status == 403)
        status, _, _ = call("POST", act, tok[manager], {"action": "approve"})
        check("Manager cannot skip RM steps", status == 403)
        status, _, _ = call("POST", f"/api/payouts/admin/requests/{invoice_id}", admin_tok, {"action": "approve"})
        check("legacy one-step admin approve is blocked", status == 409)

        status, raw, _ = call("POST", act, tok[rm1], {"action": "approve", "comment": "cases ok"})
        row = json.loads(raw) if status == 200 else {}
        check("RM 1 approves to RM 2", row.get("stage") == "rm2" and row.get("status") == "pending")
        notes = db.query(UserNotification).filter(UserNotification.user_id == rm2.id).count()
        check("RM 2 is notified", notes >= 1)

        status, _, _ = call("POST", act, tok[rm2], {"action": "query"})
        check("query needs a note", status == 400)
        status, raw, _ = call("POST", act, tok[rm2], {"action": "query", "comment": "Add GST certificate"})
        row = json.loads(raw) if status == 200 else {}
        check("RM 2 raises a query", row.get("stage") == "query" and row.get("status") == "query")
        db.expire_all()
        check(
            "partner is notified of the query",
            db.query(UserNotification).filter(UserNotification.user_id == partner.id).count() >= 1,
        )
        status, _, _ = call("GET", f"/api/payouts/invoices/{invoice_id}/history", create_access_token(str(uuid.uuid4())))
        check("unknown user cannot read history", status in (401, 404))
        status, raw, _ = call("GET", f"/api/payouts/invoices/{invoice_id}/history", tok[partner])
        hist = json.loads(raw) if status == 200 else []
        check("partner reads the history", status == 200 and [h["action"] for h in hist] == ["approved", "query"])

        status, raw, _ = call("POST", f"/api/payouts/invoices/{invoice_id}/resubmit", tok[partner], {"comment": "Uploaded"})
        row = json.loads(raw) if status == 200 else {}
        check("partner resubmits and it resumes at RM 2", row.get("stage") == "rm2")

        for who, expected in ((rm2, "manager"), (manager, "business_head"), (bh, "accounts")):
            status, raw, _ = call("POST", act, tok[who], {"action": "approve"})
            row = json.loads(raw) if status == 200 else {}
            if row.get("stage") != expected:
                break
        check("RM 2, Manager, Business Head approve in order", row.get("stage") == "accounts" and row.get("status") == "approved")

        status, _, _ = call("POST", act, tok[accounts], {"action": "approve"})
        check("Accounts cannot plain-approve", status == 400)
        status, raw, _ = call("POST", act, tok[accounts], {"action": "processing"})
        check("Accounts starts processing", status == 200 and json.loads(raw).get("status") == "processing")
        pay = f"/api/invoice-approvals/{invoice_id}/pay"
        base = {"payment_bank": "ICICI current a/c", "transaction_id": "NEFT12345678", "payment_date": date.today().isoformat()}
        status, _, _ = call("POST", pay, tok[accounts], {**base, "payment_mode": "CASH"})
        check("bad payment mode rejected", status == 400)
        status, _, _ = call(
            "POST", pay, tok[accounts], {**base, "payment_mode": "NEFT", "payment_date": (date.today() + timedelta(days=3)).isoformat()}
        )
        check("future payment date rejected", status == 400)
        status, _, _ = call("POST", pay, tok[manager], {**base, "payment_mode": "NEFT"})
        check("Manager cannot record payment", status == 403)
        status, raw, _ = call("POST", pay, tok[accounts], {**base, "payment_mode": "neft"})
        row = json.loads(raw) if status == 200 else {}
        check(
            "Accounts records payment",
            row.get("stage") == "paid" and row.get("utr") == "NEFT12345678" and row.get("payment_mode") == "NEFT" and row.get("paid_amount") == net,
        )
        check("full history recorded", len(row.get("history") or []) == 8)

        status, raw, ctype = call("GET", "/api/invoice-approvals/export.xlsx?stage=all", admin_tok)
        found = False
        if status == 200:
            from openpyxl import load_workbook

            ws = load_workbook(io.BytesIO(raw)).active
            found = any(r[0] == f"RD-INV-TEST-{tag}" for r in ws.iter_rows(min_row=2, values_only=True))
        check("Excel export has the invoice", status == 200 and "spreadsheetml" in ctype and found)
        status, _, _ = call("GET", "/api/invoice-approvals/export.xlsx", tok[partner])
        check("partner cannot export", status == 403)
    finally:
        db.rollback()
        db.query(InvoiceApproval).filter(InvoiceApproval.request_id == invoice_id).delete(synchronize_session=False)
        db.query(PayoutRequest).filter(PayoutRequest.id == invoice_id).delete(synchronize_session=False)
        if temp_ids:
            db.query(UserNotification).filter(UserNotification.user_id.in_(temp_ids)).delete(synchronize_session=False)
            ids = [str(i) for i in temp_ids] + [str(invoice_id)]
            db.query(AuditEvent).filter(AuditEvent.entity_id.in_(ids)).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(temp_ids)).delete(synchronize_session=False)
        db.commit()
        after = {str(r.id): (r.status, r.stage) for r in db.query(PayoutRequest).all()}
        check("existing invoices unchanged", after == before)
        check("temp users removed", db.query(User).filter(User.email.like(f"inv-%-{tag}@verify.rupeedial.in")).count() == 0)
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
