"""LOS pipeline, lender, task, and sanction checks. Deletes only rows this script creates."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models import (
    AuditEvent,
    CustomerLenderCase,
    CustomerLosPipeline,
    CustomerPipelineHistory,
    CustomerProfile,
    CustomerSanctionDisbursal,
    CustomerTask,
    LeadPurchase,
    User,
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
    checks: list[tuple[str, bool]] = []

    def check(name: str, ok: bool) -> None:
        checks.append((name, bool(ok)))
        print(("PASS" if ok else "FAIL"), name)

    try:
        profile = db.query(CustomerProfile).order_by(CustomerProfile.created_at.asc()).first()
        if not profile:
            raise SystemExit("No customer profile exists.")
        purchase_id = profile.lead_purchase_id
        purchase = db.query(LeadPurchase).filter(LeadPurchase.id == purchase_id).first()
        board_stage = purchase.pipeline_stage if purchase else None
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

        status, _ = call("GET", f"{base}/los-pipeline")
        check("pipeline requires auth", status == 401)
        status, _ = call("GET", f"{base}/los-pipeline", other_token)
        check("other customer cannot open pipeline", status == 404)

        status, raw = call("GET", f"{base}/los-pipeline", owner_token)
        pipe = json.loads(raw) if status == 200 else {}
        check("pipeline starts at lead purchased", status == 200 and pipe.get("current_stage") == "lead_purchased")
        check("pipeline owner is the buyer", pipe.get("dsa_id") == str(profile.dsa_id))
        pipeline_id = pipe.get("id")
        status, raw = call("GET", f"{base}/pipeline-history", owner_token)
        first_history = json.loads(raw) if status == 200 else {"rows": []}
        check("initialization is recorded once", len(first_history["rows"]) == 1 and first_history["rows"][0]["to_stage"] == "lead_purchased")
        status, _ = call("GET", f"{base}/los-pipeline", owner_token)
        status, raw = call("GET", f"{base}/pipeline-history", owner_token)
        again = json.loads(raw) if status == 200 else {"rows": []}
        check("opening again does not add history", len(again["rows"]) == 1)

        status, _ = call("POST", f"/api/customer-los-pipelines/{pipeline_id}/stage", owner_token, {"to_stage": "magic"})
        check("unknown stage rejected", status == 400)
        status, raw = call("POST", f"/api/customer-los-pipelines/{pipeline_id}/stage", owner_token, {"to_stage": "calling_started"})
        moved = json.loads(raw) if status == 200 else {}
        check("stage change saved", status == 200 and moved.get("current_stage") == "calling_started")
        status, _ = call("POST", f"/api/customer-los-pipelines/{pipeline_id}/stage", other_token, {"to_stage": "sanctioned"})
        check("other customer cannot change stage", status == 404)
        status, raw = call("GET", f"{base}/pipeline-history", owner_token)
        history = json.loads(raw) if status == 200 else {"rows": []}
        stages = [row["to_stage"] for row in history["rows"]]
        check("history keeps both stages", stages[0] == "calling_started" and "lead_purchased" in stages)
        check("sanction is not implied by opening the pipeline", "sanctioned" not in stages)

        status, _ = call(
            "PATCH",
            f"/api/customer-los-pipelines/{pipeline_id}",
            owner_token,
            {"case_owner_id": str(other.id), "priority": "urgent"},
        )
        check("foreign case owner rejected", status == 400)
        status, raw = call(
            "PATCH",
            f"/api/customer-los-pipelines/{pipeline_id}",
            owner_token,
            {"case_owner_id": str(owner.id), "banker_name": "Branch RM", "priority": "high"},
        )
        assigned = json.loads(raw) if status == 200 else {}
        check("self assignment saved", status == 200 and assigned.get("case_owner_id") == str(owner.id))

        status, raw = call(
            "POST",
            f"{base}/lender-cases",
            owner_token,
            {
                "dsa_id": str(other.id),
                "lender_name": "Test Lender",
                "login_status": "logged_in",
                "sanctioned_amount": 500000,
                "roi": 8.5,
                "password": "do-not-store",
            },
        )
        lender = json.loads(raw) if status == 200 else {}
        check("lender case created", status == 200 and lender.get("lender_name") == "Test Lender")
        check("lender amount is numeric", lender.get("sanctioned_amount") == 500000)
        check("lender owner is the buyer", lender.get("dsa_id") == str(profile.dsa_id) and "password" not in raw.decode().lower())
        lender_id = lender.get("id")
        status, _ = call("PATCH", f"/api/customer-lender-cases/{lender_id}", owner_token, {"login_status": "preapproved"})
        check("invalid lender status rejected", status == 400)
        status, raw = call("PATCH", f"/api/customer-lender-cases/{lender_id}", owner_token, {"login_status": "under_review"})
        check("lender status updated", status == 200 and json.loads(raw).get("login_status") == "under_review")
        status, _ = call("POST", f"/api/customer-lender-cases/{lender_id}/best-offer", other_token)
        check("other customer cannot mark best offer", status == 404)
        status, raw = call("POST", f"/api/customer-lender-cases/{lender_id}/best-offer", owner_token)
        check("best offer saved", status == 200 and json.loads(raw).get("is_best_offer") is True)
        status, raw = call("GET", f"{base}/lender-cases", owner_token)
        reloaded = json.loads(raw) if status == 200 else {"rows": []}
        check("lender persists", any(row["id"] == lender_id and row["is_best_offer"] for row in reloaded["rows"]))

        status, raw = call(
            "POST",
            f"{base}/tasks",
            owner_token,
            {"title": "Collect PAN", "task_type": "collect_docs", "assigned_user_id": str(other.id), "dsa_id": str(other.id)},
        )
        task = json.loads(raw) if status == 200 else {}
        check("task created", status == 200 and task.get("title") == "Collect PAN")
        check("task assignee is the caller", task.get("assigned_user_id") == str(owner.id))
        task_id = task.get("id")
        status, _ = call("PATCH", f"/api/customer-tasks/{task_id}", owner_token, {"status": "done"})
        check("invalid task status rejected", status == 400)
        status, raw = call("PATCH", f"/api/customer-tasks/{task_id}", owner_token, {"status": "completed"})
        finished = json.loads(raw) if status == 200 else {}
        check("completed task has a timestamp", status == 200 and finished.get("status") == "completed" and bool(finished.get("completed_at")))
        status, raw = call("GET", f"{base}/tasks", owner_token)
        tasks = json.loads(raw) if status == 200 else {"rows": []}
        check("task persists", any(row["id"] == task_id and row["status"] == "completed" for row in tasks["rows"]))

        status, raw = call(
            "PUT",
            f"{base}/sanction",
            owner_token,
            {"sanction_amount": 480000, "bank_account_credited": "998877665544", "utr_number": "UTR123", "password": "secret"},
        )
        sanction = json.loads(raw) if status == 200 else {}
        check("sanction record saved explicitly", status == 200 and sanction.get("sanction_amount") == 480000)
        check("sanction response omits password", "password" not in raw.decode().lower() and "secret" not in raw.decode().lower())
        status, raw = call("GET", f"{base}/los-pipeline", owner_token)
        still = json.loads(raw) if status == 200 else {}
        check("saving sanction does not change the stage", still.get("current_stage") == "calling_started")
        db.refresh(purchase)
        check("lead board stage unchanged", purchase.pipeline_stage == board_stage)

        status, raw = call("GET", f"{base}/timeline", owner_token)
        timeline = raw.decode()
        check("timeline shows task and sanction without the account", "Collect PAN" in timeline and "998877665544" not in timeline and "UTR123" not in timeline)
        status, _ = call("GET", "/api/los/summary")
        check("summary requires auth", status == 401)
        status, raw = call("GET", "/api/los/summary", owner_token)
        summary = json.loads(raw) if status == 200 else {}
        check("summary counts the open case", status == 200 and summary.get("activeCases", 0) >= 1)

        status, _ = call("DELETE", f"/api/customer-lender-cases/{lender_id}", other_token)
        check("other customer cannot delete lender", status == 404)
        status, _ = call("DELETE", f"/api/customer-lender-cases/{lender_id}", owner_token)
        check("lender deleted", status == 200)
        status, _ = call("DELETE", f"/api/customer-tasks/{task_id}", owner_token)
        check("task deleted", status == 200)
    finally:
        if purchase_id is not None:
            db.query(CustomerPipelineHistory).filter(
                CustomerPipelineHistory.lead_purchase_id == purchase_id,
                CustomerPipelineHistory.created_at >= started,
            ).delete(synchronize_session=False)
            db.query(CustomerLosPipeline).filter(
                CustomerLosPipeline.lead_purchase_id == purchase_id,
                CustomerLosPipeline.created_at >= started,
            ).delete(synchronize_session=False)
            db.query(CustomerLenderCase).filter(
                CustomerLenderCase.lead_purchase_id == purchase_id,
                CustomerLenderCase.created_at >= started,
            ).delete(synchronize_session=False)
            db.query(CustomerTask).filter(
                CustomerTask.lead_purchase_id == purchase_id,
                CustomerTask.created_at >= started,
            ).delete(synchronize_session=False)
            db.query(CustomerSanctionDisbursal).filter(
                CustomerSanctionDisbursal.lead_purchase_id == purchase_id,
                CustomerSanctionDisbursal.created_at >= started,
            ).delete(synchronize_session=False)
            db.query(AuditEvent).filter(
                AuditEvent.entity_id == str(purchase_id),
                AuditEvent.created_at >= started,
                AuditEvent.entity_type.in_(["los_pipeline", "lender_case", "sanction"]),
            ).delete(synchronize_session=False)
            db.commit()
        db.close()

    failed = [name for name, ok in checks if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
