"""Read-only checks for GET /api/billing/me, the source of the lead-board plan and wallet banner."""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models import LeadPurchase, PayoutRequest, User

API = "http://127.0.0.1:8000"
STAFF = ["admin", "ceo", "super_admin"]
ENTITLEMENT_KEYS = {
    "plan_id",
    "plan_name",
    "plan_cycle",
    "plan_status",
    "plan_started_at",
    "plan_ends_at",
    "wallet_balance",
    "seat_limit",
    "modules",
    "has_active_plan",
}


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
    db = SessionLocal()
    checks: list[tuple[str, bool]] = []
    purchases_before = db.query(LeadPurchase).count()
    payouts_before = db.query(PayoutRequest).count()

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    try:
        users = (
            db.query(User)
            .filter(User.role.notin_(STAFF), User.is_active.is_(True))
            .order_by(User.created_at.asc())
            .limit(2)
            .all()
        )
        if len(users) < 2:
            raise SystemExit("Need two active non-staff users.")
        me, other = users
        owner = db.query(User).filter(User.id == (me.seat_owner_id or me.id)).first() or me
        token = create_access_token(str(me.id))

        status, _ = call("GET", "/api/billing/me")
        check("billing requires auth", status == 401)
        status, _ = call("GET", "/api/billing/me", "not-a-token")
        check("invalid token rejected", status == 401)

        status, raw = call("GET", "/api/billing/me", token)
        body = json.loads(raw) if status == 200 else {}
        ent = body.get("entitlements") or {}
        check("signed-in user gets billing", status == 200)
        check("entitlements expose the plan and wallet fields", ENTITLEMENT_KEYS <= set(ent))
        check("wallet balance matches the account owner", abs(float(ent.get("wallet_balance", -1)) - float(owner.wallet_balance or 0)) < 0.01)
        plans = body.get("available_plans") or []
        check("plans include monthly lead credits", bool(plans) and all("lead_credits_monthly" in p for p in plans))
        check(
            "no lead-count quota fields are returned",
            not ({"leads_per_day", "used", "limit", "leads_used"} & set(ent)),
        )

        status, raw = call("GET", f"/api/billing/me?user_id={other.id}", token)
        again = (json.loads(raw).get("entitlements") or {}) if status == 200 else {}
        check("client user_id is ignored", status == 200 and again.get("wallet_balance") == ent.get("wallet_balance"))
    finally:
        check("purchases unchanged", db.query(LeadPurchase).count() == purchases_before)
        check("partner payout requests unchanged", db.query(PayoutRequest).count() == payouts_before)
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
