"""Partner assistant. Answers from this user's cases. Does not match lenders."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Lead, LeadPurchase, User
from app.services.customers import recommended_for

CLOSED = {"disbursed", "rejected"}


def _rows(db: Session, user: User) -> list[tuple[LeadPurchase, Lead | None]]:
    query = db.query(LeadPurchase)
    if user.role != "admin":
        query = query.filter(LeadPurchase.buyer_user_id == user.id)
    purchases = query.order_by(LeadPurchase.updated_at.desc()).limit(200).all()
    out = []
    for purchase in purchases:
        lead = db.query(Lead).filter(Lead.id == purchase.lead_id).first()
        out.append((purchase, lead))
    return out


def _name(lead: Lead | None, purchase: LeadPurchase) -> str:
    if lead and lead.applicant_name:
        return lead.applicant_name
    return "Case"


def _line(purchase: LeadPurchase, lead: Lead | None) -> str:
    product = lead.product_subtype if lead and lead.product_subtype else "Loan"
    city = lead.city if lead else ""
    return f"{_name(lead, purchase)} · {product} · {city} · {purchase.pipeline_stage}"


def answer_question(db: Session, user: User, question: str) -> str:
    text = (question or "").strip().lower()
    rows = _rows(db, user)
    now = datetime.now(timezone.utc)

    if any(word in text for word in ("follow-up", "follow up", "callback", "today")):
        due = []
        for purchase, lead in rows:
            when = purchase.next_followup_at
            if when is None or purchase.pipeline_stage in CLOSED:
                continue
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            if when.date() <= now.date():
                due.append(f"- {_line(purchase, lead)} · {when.strftime('%d %b %H:%M')}")
        if not due:
            return "No follow-up is due today on your cases."
        return "Follow-ups due:\n" + "\n".join(due[:12])

    if any(word in text for word in ("48", "haven't moved", "not moved", "stuck", "stale")):
        cutoff = now - timedelta(hours=48)
        stale = []
        for purchase, lead in rows:
            if purchase.pipeline_stage in CLOSED:
                continue
            updated = purchase.updated_at
            if updated is None:
                continue
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            if updated < cutoff:
                stale.append(f"- {_line(purchase, lead)}")
        if not stale:
            return "No open case has been sitting for 48 hours."
        return "Cases with no update for 48 hours:\n" + "\n".join(stale[:12])

    if "document" in text:
        pending = [
            f"- {_line(purchase, lead)}"
            for purchase, lead in rows
            if purchase.pipeline_stage in {"new", "contacted"}
        ]
        if not pending:
            return "No case is waiting on the first document pack. Open a case in My Leads to see what was already collected."
        return "These cases are still before document collection:\n" + "\n".join(pending[:12])

    if "whatsapp" in text or "draft" in text:
        open_rows = [(purchase, lead) for purchase, lead in rows if purchase.pipeline_stage not in CLOSED]
        if not open_rows:
            return "There is no open case to draft a message for."
        purchase, lead = open_rows[0]
        name = _name(lead, purchase)
        product = lead.product_subtype if lead and lead.product_subtype else "your loan"
        return (
            f"WhatsApp draft for {name}:\n"
            f"Namaste {name}, RupeeDial se. Aapki {product} requirement par follow-up hai. "
            "Aapke liye convenient time batayein. Approval ka promise nahi hai; lender final decision karega."
        )

    if "cross" in text:
        lines = []
        for purchase, lead in rows:
            if purchase.pipeline_stage not in {"disbursed", "sanctioned", "approved", "contacted"}:
                continue
            product = lead.product_subtype if lead else ""
            ideas = ", ".join(recommended_for(product)[:3])
            lines.append(f"- {_name(lead, purchase)} ({product or 'loan'}) → {ideas}")
        if not lines:
            return "No case is far enough along for a cross-sell note yet."
        return "Possible next products. These are suggestions, not sanctioned offers:\n" + "\n".join(lines[:8])

    if any(word in text for word in ("lender", "lap", "policy", "eligib")):
        return (
            "Lender matching and bank policy are not decided here. OneFlo does that later.\n"
            "For a LAP or any loan, confirm city, income, existing EMI, property type and consent, "
            "then send the case to lender match. Do not promise a bank or a rate."
        )

    return (
        "I can answer from your cases only. Try one of these:\n"
        "- Show my leads requiring follow-up today\n"
        "- What documents are pending?\n"
        "- Which cases haven't moved for 48 hours?\n"
        "- Draft WhatsApp follow-up for this customer\n"
        "- Which customers have potential cross-sell?\n"
        "- Which lender may fit this LAP profile?"
    )
