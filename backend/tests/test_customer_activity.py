"""Follow-up, bank-login, and timeline checks against the local API.

Deletes only the rows and files this script creates.
"""

from __future__ import annotations

import json
import uuid
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models import (
    CustomerBankLogin,
    CustomerDocument,
    CustomerDocumentEvent,
    CustomerFollowup,
    CustomerProfile,
    User,
)
from app.services.document_files import delete_key

API = "http://127.0.0.1:8000"
PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
STAFF = {"admin", "ceo", "super_admin"}
SECRET_MARKERS = ("password", "otp", "pin", "token", "account_number", "storage_key", "storage_private")


def call(method: str, path: str, token: str | None = None, payload: dict | None = None, file: tuple | None = None):
    headers: dict[str, str] = {}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    if file is not None:
        filename, raw, mime = file
        boundary = uuid.uuid4().hex
        data = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode() + raw + f"\r\n--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
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

        status, _ = call("GET", f"{base}/followups")
        check("follow-ups require auth", status == 401)
        status, _ = call("GET", f"{base}/followups", other_token)
        check("other customer cannot list follow-ups", status == 404)

        status, raw = call(
            "POST",
            f"{base}/followups",
            owner_token,
            {
                "dsa_id": str(other.id),
                "note_type": "call",
                "followup_date": "2026-10-22",
                "followup_time": "15:30",
                "priority": "high",
                "discussion_notes": "Called the applicant",
                "outcome": "Connected",
                "next_action": "Send documents",
                "password": "should-not-be-stored",
            },
        )
        created = json.loads(raw) if status == 200 else {}
        check("follow-up created", status == 200 and created.get("discussion_notes") == "Called the applicant")
        check("owner comes from the purchase", created.get("dsa_id") == str(profile.dsa_id))
        check("follow-up response has no secret", all(marker not in raw.decode().lower() for marker in ("password", "should-not")))
        followup_id = created.get("id")

        status, _ = call("POST", f"{base}/followups", owner_token, {"priority": "urgent", "discussion_notes": "no"})
        check("invalid priority rejected", status == 400)

        status, raw = call("GET", f"{base}/followups", owner_token)
        listed = json.loads(raw) if status == 200 else {"rows": []}
        check("follow-up listed after reload", any(row["id"] == followup_id for row in listed["rows"]))

        status, raw = call("PATCH", f"/api/customer-followups/{followup_id}", owner_token, {"outcome": "Callback", "completed": True})
        patched = json.loads(raw) if status == 200 else {}
        check("follow-up updated", status == 200 and patched.get("outcome") == "Callback" and patched.get("completed") is True)
        status, _ = call("PATCH", f"/api/customer-followups/{followup_id}", other_token, {"outcome": "Stolen"})
        check("other customer cannot update follow-up", status == 404)

        status, _ = call("GET", f"{base}/bank-logins")
        check("bank logins require auth", status == 401)
        status, raw = call(
            "POST",
            f"{base}/bank-logins",
            owner_token,
            {
                "dsa_id": str(other.id),
                "bank_name": "Test Bank",
                "product": "Home loan",
                "login_amount": 250000,
                "roi_percent": 9.5,
                "banker_mobile": "9876543210",
                "login_status": "logged_in",
                "password": "bank-secret",
                "otp": "123456",
                "token": "abc",
            },
        )
        bank = json.loads(raw) if status == 200 else {}
        body = raw.decode().lower()
        check("bank login created", status == 200 and bank.get("bank_name") == "Test Bank")
        check("amount stored as a number", bank.get("login_amount") == 250000)
        check("bank response drops credentials", all(marker not in body for marker in SECRET_MARKERS))
        check("bank owner is the purchase buyer", bank.get("dsa_id") == str(profile.dsa_id))
        bank_id = bank.get("id")

        status, _ = call("PATCH", f"/api/customer-bank-logins/{bank_id}", owner_token, {"banker_mobile": "123"})
        check("short banker mobile rejected", status == 400)
        status, raw = call("PATCH", f"/api/customer-bank-logins/{bank_id}", owner_token, {"login_status": "approved", "login_amount": 260000})
        updated = json.loads(raw) if status == 200 else {}
        check("bank login updated", status == 200 and updated.get("login_status") == "approved" and updated.get("login_amount") == 260000)
        status, _ = call("GET", f"/api/customer-bank-logins/{bank_id}", other_token)
        status, raw = call("GET", f"{base}/bank-logins", owner_token)
        again = json.loads(raw) if status == 200 else {"rows": []}
        check("bank login persists", any(row["id"] == bank_id and row["login_status"] == "approved" for row in again["rows"]))
        status, _ = call("DELETE", f"/api/customer-bank-logins/{bank_id}", other_token)
        check("other customer cannot delete bank login", status == 404)

        status, raw = call("POST", f"{base}/documents/pan_card/file", owner_token, file=("pan.pdf", PDF, "application/pdf"))
        check("document event source uploaded", status == 200)
        status, raw = call("GET", f"{base}/timeline", owner_token)
        timeline = json.loads(raw) if status == 200 else {"entries": []}
        text = raw.decode().lower()
        types = {entry["activity_type"] for entry in timeline.get("entries", [])}
        check("timeline requires nothing secret", all(marker not in text for marker in ("storage_key", "storage_private", "bank-secret", "password")))
        check("timeline includes follow-up and document", "call" in types and "document" in types)
        check("timeline includes bank login without mobile", "login" in types and "9876543210" not in text)
        times = [entry["created_at"] for entry in timeline.get("entries", [])]
        check("timeline is newest first", times == sorted(times, reverse=True))
        status, _ = call("GET", f"{base}/timeline")
        check("timeline requires auth", status == 401)
        status, _ = call("GET", f"{base}/timeline", other_token)
        check("other customer cannot read timeline", status == 404)

        status, _ = call("DELETE", f"/api/customer-followups/{followup_id}", owner_token)
        check("follow-up deleted", status == 200)
        status, raw = call("GET", f"{base}/followups", owner_token)
        left = json.loads(raw) if status == 200 else {"rows": []}
        check("deleted follow-up stays gone", all(row["id"] != followup_id for row in left["rows"]))
        status, _ = call("DELETE", f"/api/customer-bank-logins/{bank_id}", owner_token)
        check("bank login deleted", status == 200)
    finally:
        if purchase_id is not None:
            docs = (
                db.query(CustomerDocument)
                .filter(CustomerDocument.lead_purchase_id == purchase_id, CustomerDocument.created_at >= started)
                .all()
            )
            for doc in docs:
                delete_key(doc.storage_key)
            doc_ids = [doc.id for doc in docs]
            if doc_ids:
                db.query(CustomerDocumentEvent).filter(CustomerDocumentEvent.document_id.in_(doc_ids)).delete(synchronize_session=False)
                db.query(CustomerDocument).filter(CustomerDocument.id.in_(doc_ids)).delete(synchronize_session=False)
            db.query(CustomerFollowup).filter(
                CustomerFollowup.lead_purchase_id == purchase_id, CustomerFollowup.created_at >= started
            ).delete(synchronize_session=False)
            db.query(CustomerBankLogin).filter(
                CustomerBankLogin.lead_purchase_id == purchase_id, CustomerBankLogin.created_at >= started
            ).delete(synchronize_session=False)
            db.commit()
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
