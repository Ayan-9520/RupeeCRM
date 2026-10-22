"""Every Case Files chip: each status lands in the right list, not in the wrong one, and counts match.

Creates temporary case files through the API and deletes only those.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models import LoanCase, User

API = "http://127.0.0.1:8000"
STAFF = ["admin", "ceo", "super_admin"]

STATES: dict[str, tuple[dict, set[str], set[str]]] = {
    "draft": ({"stage": "draft"}, {"draft"}, {"disbursed", "not_counted"}),
    "submitted": ({"stage": "submitted"}, {"submitted"}, {"draft"}),
    "logged_in": ({"stage": "logged_in"}, {"logged_in"}, {"sanctioned"}),
    "sanctioned": ({"stage": "sanctioned"}, {"sanctioned"}, {"disbursed"}),
    "disbursed": ({"stage": "disbursed"}, {"disbursed", "not_counted"}, {"counted", "disbursed_hold"}),
    "hold": ({"stage": "disbursed", "flag": "hold"}, {"disbursed_hold", "not_counted"}, {"disbursed"}),
    "confirmed": ({"stage": "disbursed_confirmed"}, {"disbursed_confirmed", "counted"}, {"not_counted", "disbursed"}),
    "partial": (
        {"stage": "disbursed_confirmed", "loan_amount": 1000000, "sanctioned_amount": 1000000, "invoice_amount": 14000, "collected_amount": 7000},
        {"partially_collected", "disbursed_confirmed", "counted"},
        {"collected"},
    ),
    "banker": ({"stage": "sanctioned", "flag": "banker_pending"}, {"banker_pending"}, {"sanctioned"}),
    "counted": ({"stage": "disbursed", "counted": True}, {"counted", "disbursed"}, {"not_counted", "counted_pod_pending"}),
    "pod": ({"stage": "disbursed", "counted": True, "pod_pending": True}, {"counted_pod_pending", "disbursed"}, {"counted", "not_counted"}),
    "movement": ({"stage": "logged_in", "flag": "movement"}, {"movement"}, {"logged_in"}),
    "cancelled": ({"stage": "disbursed", "flag": "cancelled"}, {"cancelled"}, {"disbursed", "not_counted", "counted"}),
    "collected": ({"stage": "collected"}, {"collected", "counted"}, {"disbursed_confirmed", "not_counted"}),
    "uncancel": ({"stage": "disbursed", "flag": ""}, {"disbursed", "not_counted"}, {"cancelled"}),
}
CHIPS = (
    "all", "draft", "submitted", "logged_in", "sanctioned", "disbursed", "disbursed_hold", "disbursed_confirmed",
    "partially_collected", "banker_pending", "not_counted", "counted", "counted_pod_pending", "movement", "cancelled", "collected",
)


def call(method: str, path: str, token: str, payload: dict | None = None):
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as exc:
        return exc.code, {}


def main() -> None:
    db = SessionLocal()
    checks: list[tuple[str, bool]] = []
    created: dict[str, str] = {}

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    try:
        admin = db.query(User).filter(User.role.in_(STAFF), User.is_active.is_(True)).first()
        if not admin:
            raise SystemExit("Need an active admin user.")
        token = create_access_token(str(admin.id))

        for key, (patch, _, _) in STATES.items():
            status, row = call("POST", "/api/cases", token, {"client_name": f"Chip test {key}", "loan_amount": 500000})
            if status != 200:
                check(f"create {key}", False)
                continue
            if key == "uncancel":
                call("PUT", f"/api/cases/{row['id']}", token, {"stage": "disbursed", "flag": "cancelled"})
            status, saved = call("PUT", f"/api/cases/{row['id']}", token, patch)
            check(f"save {key} → {saved.get('status_label', status)}", status == 200)
            created[key] = saved.get("deal_no", row["deal_no"])

        today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
        lists: dict[str, set[str]] = {}
        counts: dict[str, int] = {}
        for chip in CHIPS:
            status, body = call("GET", f"/api/cases?chip={chip}&date_from={today}&date_to={today}", token)
            lists[chip] = {row["deal_no"] for row in body.get("items", [])}
            if chip == "all":
                counts = body.get("counts") or {}
            check(f"chip {chip} loads", status == 200)

        for key, (_, must, must_not) in STATES.items():
            deal = created.get(key)
            if not deal:
                continue
            missing = [chip for chip in must if deal not in lists.get(chip, set())]
            wrong = [chip for chip in must_not if deal in lists.get(chip, set())]
            check(f"{key}: in {sorted(must)}" + (f" (missing {missing})" if missing else ""), not missing)
            check(f"{key}: not in {sorted(must_not)}" + (f" (wrongly in {wrong})" if wrong else ""), not wrong)
            check(f"{key}: in All", deal in lists["all"])

        mismatched = [chip for chip in CHIPS if counts.get(chip) != len(lists[chip])]
        check("chip counts equal the listed rows" + (f" (off: {mismatched})" if mismatched else ""), not mismatched)
    finally:
        if created:
            db.query(LoanCase).filter(LoanCase.deal_no.in_(list(created.values()))).delete(synchronize_session=False)
            db.commit()
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
