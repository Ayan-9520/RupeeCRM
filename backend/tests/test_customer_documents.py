"""Authenticated customer-document checks against the local API.

Creates slots and files only for one existing purchase, then deletes those rows and files.
"""

from __future__ import annotations

import base64
import json
import uuid
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models import CustomerDocument, CustomerDocumentEvent, CustomerProfile, User
from app.services.document_files import delete_key

API = "http://127.0.0.1:8000"
PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
STAFF = {"admin", "ceo", "super_admin"}


def _token(user: User) -> str:
    return create_access_token(str(user.id))


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
            body = res.read()
            return res.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def main() -> None:
    started = datetime.now(timezone.utc) - timedelta(seconds=5)
    db: Session = SessionLocal()
    purchase_id = None
    checks: list[tuple[str, bool]] = []

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    try:
        profile = db.query(CustomerProfile).order_by(CustomerProfile.created_at.asc()).first()
        if not profile:
            raise SystemExit("No customer profile exists. Open a workspace before running this check.")
        purchase_id = profile.lead_purchase_id
        owner = db.query(User).filter(User.id == profile.dsa_id).first()
        other = (
            db.query(User)
            .filter(User.id != profile.dsa_id, User.role.notin_(list(STAFF)), User.is_active.is_(True))
            .first()
        )
        if not owner or not other:
            raise SystemExit("Need the purchase owner and a second non-staff user.")
        owner_token = _token(owner)
        other_token = _token(other)
        base = f"/api/my-leads/{purchase_id}/documents"

        status, _ = call("GET", base)
        check("missing auth is 401", status == 401)

        status, _ = call("GET", base, other_token)
        check("other customer is 404", status == 404)

        status, raw = call("GET", base, owner_token)
        listed = json.loads(raw) if status == 200 else {}
        check("owner can list", status == 200 and len(listed.get("documents", [])) >= 26)
        text = raw.decode("utf-8", "replace")
        check("response hides storage location", "storage_private" not in text and "storage_key" not in text)

        status, _ = call(
            "POST", f"{base}/pan_card/file", owner_token, file=("notes.txt", b"hello world, not a document", "text/plain")
        )
        check("text file rejected", status == 400)

        status, _ = call(
            "POST", f"{base}/pan_card/file", owner_token, file=("pan.pdf", b"not-a-real-pdf-file", "application/pdf")
        )
        check("fake pdf rejected", status == 400)

        huge = b"%PDF-1.4\n" + b"a" * (10 * 1024 * 1024)
        status, _ = call("POST", f"{base}/pan_card/file", owner_token, file=("big.pdf", huge, "application/pdf"))
        check("oversized file rejected", status == 400)

        status, raw = call(
            "POST", f"{base}/pan_card/file", owner_token, file=("../../pan card.pdf", PDF, "application/pdf")
        )
        doc = json.loads(raw) if status == 200 else {}
        check("valid pdf uploaded", status == 200)
        check("filename sanitized", ".." not in (doc.get("file_name") or ""))
        check("status uploaded", doc.get("status") == "uploaded")
        doc_id = doc.get("id")

        status, _ = call("GET", f"/api/customer-documents/{doc_id}/file")
        check("download requires auth", status == 401)
        status, _ = call("GET", f"/api/customer-documents/{doc_id}/file", other_token)
        check("other customer cannot download", status == 404)
        status, downloaded = call("GET", f"/api/customer-documents/{doc_id}/file", owner_token)
        check("owner download matches bytes", status == 200 and downloaded == PDF)

        status, raw = call(
            "POST", f"{base}/aadhaar_front/file", owner_token, file=("aadhaar.png", PNG, "image/png")
        )
        image = json.loads(raw) if status == 200 else {}
        check("valid png uploaded", status == 200 and image.get("mime_type") == "image/png")

        status, raw = call(
            "PATCH",
            f"/api/customer-documents/{doc_id}",
            owner_token,
            {"status": "verified", "verification_notes": "Checked"},
        )
        patched = json.loads(raw) if status == 200 else {}
        check("status updated", status == 200 and patched.get("status") == "verified")
        status, _ = call("PATCH", f"/api/customer-documents/{doc_id}", owner_token, {"status": "approved"})
        check("unknown status rejected", status == 400)

        status, raw = call("GET", base, owner_token)
        again = json.loads(raw) if status == 200 else {"documents": [], "events": []}
        pan = next(row for row in again["documents"] if row["doc_slug"] == "pan_card")
        check("file still listed after reload", pan["status"] == "verified" and bool(pan["file_name"]))
        check("history recorded", any(event["action"] == "uploaded" for event in again["events"]))

        status, raw = call("DELETE", f"/api/customer-documents/{doc_id}/file", owner_token)
        removed = json.loads(raw) if status == 200 else {}
        check("file removed", status == 200 and removed.get("status") == "pending" and not removed.get("file_url"))
        status, _ = call("GET", f"/api/customer-documents/{doc_id}/file", owner_token)
        check("removed file cannot be downloaded", status == 404)

        status, raw = call("GET", base, owner_token)
        kept = json.loads(raw)
        pan_after = next(row for row in kept["documents"] if row["doc_slug"] == "pan_card")
        check("slot remains after delete", pan_after["id"] == doc_id and pan_after["status"] == "pending")
    finally:
        if purchase_id is not None:
            rows = (
                db.query(CustomerDocument)
                .filter(CustomerDocument.lead_purchase_id == purchase_id, CustomerDocument.created_at >= started)
                .all()
            )
            for row in rows:
                delete_key(row.storage_key)
            ids = [row.id for row in rows]
            if ids:
                db.query(CustomerDocumentEvent).filter(CustomerDocumentEvent.document_id.in_(ids)).delete(
                    synchronize_session=False
                )
                db.query(CustomerDocument).filter(CustomerDocument.id.in_(ids)).delete(synchronize_session=False)
                db.commit()
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
