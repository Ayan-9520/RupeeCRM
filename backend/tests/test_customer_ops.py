"""Notification and automation-log checks. Deletes only rows this script creates."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models import (
    CustomerAutomationLog,
    CustomerProfile,
    CustomerTask,
    PayoutRequest,
    User,
    UserNotification,
)

API = "http://127.0.0.1:8000"
STAFF = {"admin", "ceo", "super_admin"}


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
    owner_id = None
    checks: list[tuple[str, bool]] = []
    profiles_before = db.query(CustomerProfile).count()
    payouts_before = db.query(PayoutRequest).count()

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
        owner_id = owner.id
        owner_token = create_access_token(str(owner.id))
        other_token = create_access_token(str(other.id))

        status, _ = call("GET", "/api/notifications")
        check("notifications require auth", status == 401)

        status, _ = call(
            "POST",
            "/api/notifications",
            owner_token,
            {"type": "docs_pending", "title": "Docs pending reminder", "link": "https://evil.example/phish", "user_id": str(other.id)},
        )
        check("external notification link rejected", status == 400)

        status, raw = call(
            "POST",
            "/api/notifications",
            owner_token,
            {
                "type": "docs_pending",
                "title": "Docs pending reminder",
                "body": "3 documents are still pending",
                "link": f"/dashboard/customer/{purchase_id}",
                "user_id": str(other.id),
            },
        )
        created = json.loads(raw) if status == 200 else {}
        note_id = created.get("id")
        check("owner notification saved", status == 200 and bool(note_id))

        status, raw = call("GET", "/api/notifications", other_token)
        other_rows = json.loads(raw).get("rows", []) if status == 200 else [{"id": note_id}]
        check("another user cannot see the notification", status == 200 and note_id not in {row.get("id") for row in other_rows})

        status, _ = call("POST", f"/api/notifications/{note_id}/read", other_token)
        check("another user cannot mark it read", status == 404)

        status, raw = call("GET", "/api/notifications", owner_token)
        owner_rows = json.loads(raw).get("rows", []) if status == 200 else []
        check("notification survives a later request", status == 200 and note_id in {row.get("id") for row in owner_rows})

        status, raw = call("POST", f"/api/notifications/{note_id}/read", owner_token)
        marked = json.loads(raw) if status == 200 else {}
        check("owner can mark the notification read", status == 200 and bool(marked.get("read_at")))

        status, _ = call("POST", "/api/notifications/read-all", owner_token)
        check("mark all read succeeds", status == 200)

        status, _ = call("POST", f"/api/my-leads/{purchase_id}/automation-logs", other_token, {"rule_key": "docs_pending_reminder", "status": "success", "message": "no"})
        check("another user cannot write this case log", status == 404)

        status, _ = call(
            "POST",
            f"/api/my-leads/{purchase_id}/automation-logs",
            owner_token,
            {"rule_key": "invented_rule", "status": "success", "message": "no", "dsa_id": str(other.id)},
        )
        check("unknown automation rule rejected", status == 400)

        status, raw = call(
            "POST",
            f"/api/my-leads/{purchase_id}/automation-logs",
            owner_token,
            {"rule_key": "docs_pending_reminder", "status": "failed", "message": "Could not add task", "dsa_id": str(other.id)},
        )
        log_id = json.loads(raw).get("id") if status == 200 else None
        check("owner automation log saved", status == 200 and bool(log_id))

        status, raw = call("GET", "/api/automation-logs", other_token)
        other_logs = json.loads(raw).get("rows", []) if status == 200 else [{"id": log_id}]
        check("another user cannot read the automation log", status == 200 and log_id not in {row.get("id") for row in other_logs})

        status, raw = call("GET", "/api/automation-logs", owner_token)
        owner_logs = json.loads(raw).get("rows", []) if status == 200 else []
        check("automation log survives a later request", status == 200 and log_id in {row.get("id") for row in owner_logs})

        status, raw = call(
            "POST",
            f"/api/my-leads/{purchase_id}/tasks",
            owner_token,
            {"title": "Reminder: pending documents", "task_type": "automation", "dsa_id": str(other.id)},
        )
        task = json.loads(raw) if status == 200 else {}
        task_id = task.get("id")
        check("automation task type is accepted", status == 200 and task.get("task_type") == "automation")
        if task_id:
            status, _ = call("DELETE", f"/api/customer-tasks/{task_id}", owner_token)
            check("automation task deleted", status == 200)

        status, raw = call("GET", "/api/public/plans")
        plans = json.loads(raw) if status == 200 else {}
        prices = plans.get("category_prices") or {}
        check("public plans expose the lead prices", status == 200 and prices.get("loan") == 149 and prices.get("credit_card") == 79)
    finally:
        if owner_id is not None:
            db.query(UserNotification).filter(
                UserNotification.user_id == owner_id,
                UserNotification.created_at >= started,
            ).delete(synchronize_session=False)
        if purchase_id is not None:
            db.query(CustomerAutomationLog).filter(
                CustomerAutomationLog.lead_purchase_id == purchase_id,
                CustomerAutomationLog.created_at >= started,
            ).delete(synchronize_session=False)
            db.query(CustomerTask).filter(
                CustomerTask.lead_purchase_id == purchase_id,
                CustomerTask.created_at >= started,
                CustomerTask.task_type == "automation",
                CustomerTask.title == "Reminder: pending documents",
            ).delete(synchronize_session=False)
        db.commit()
        profiles_after = db.query(CustomerProfile).count()
        payouts_after = db.query(PayoutRequest).count()
        check("customer profiles unchanged", profiles_after == profiles_before)
        check("partner payout requests unchanged", payouts_after == payouts_before)
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
