"""Partner assistant. Rule-based: answers from this user's cases and fixed CRM knowledge. No AI key needed."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Lead, LeadPurchase, User
from app.services.customers import recommended_for

CLOSED = {"disbursed", "rejected"}

STAGE_LABEL = {
    "new": "New",
    "contacted": "Contacted",
    "docs_collected": "Docs collected",
    "bank_submitted": "Sent to bank",
    "sanctioned": "Sanctioned",
    "disbursed": "Disbursed",
    "rejected": "Rejected",
}

DOCS_COMMON_SALARIED = ["PAN card", "Aadhaar card", "Last 3 months salary slips", "6 months bank statement (salary account)", "Form 16 / last 2 years ITR", "Passport-size photo"]
DOCS_COMMON_SELF = ["PAN card (individual + business)", "Aadhaar card", "Last 2–3 years ITR with computation", "12 months current account statement", "GST registration + last 12 months GST returns", "Business proof (Udyam / shop licence / partnership deed / MoA)"]

PRODUCT_DOCS: list[tuple[tuple[str, ...], str, list[str]]] = [
    (("lap", "against property", "mortgage"), "Loan Against Property", DOCS_COMMON_SELF + ["Property papers (sale deed, chain documents)", "Approved building plan", "Latest property tax receipt"]),
    (("home loan", "housing", "home"), "Home Loan", DOCS_COMMON_SALARIED + ["Property agreement / allotment letter", "Builder NOC or approved plan", "Own contribution proof"]),
    (("business", "msme", "cc", "od", "overdraft", "working capital", "term loan"), "Business Loan / CC / OD", DOCS_COMMON_SELF + ["Audited balance sheet + P&L (2–3 years)", "Existing loan sanction letters + repayment track", "Stock & debtors statement (for CC/OD)"]),
    (("car", "auto", "vehicle", "bike"), "Car / Vehicle Loan", DOCS_COMMON_SALARIED + ["Proforma invoice / quotation from dealer"]),
    (("gold",), "Gold Loan", ["PAN card", "Aadhaar card", "Gold ornaments for valuation", "Passport-size photo"]),
    (("credit card", "card"), "Credit Card", ["PAN card", "Aadhaar card", "Latest salary slip or ITR", "Bank statement (3 months)"]),
    (("education", "student"), "Education Loan", ["Student + co-applicant PAN & Aadhaar", "Admission letter + fee structure", "Mark sheets (10th, 12th, graduation)", "Co-applicant income proof (salary slips / ITR)", "6 months bank statement of co-applicant"]),
    (("personal", "pl"), "Personal Loan", DOCS_COMMON_SALARIED),
]

HOW_TO: list[tuple[tuple[str, ...], str]] = [
    (("buy", "kharid", "leadboard", "marketplace", "new lead", "recharge"),
     "Leads kharidne ke liye: Dashboard → Leadboard. Lead select karo → Buy. Wallet mein balance chahiye; recharge ke liye Leadboard pe 'Recharge' dabao (WhatsApp pe team activate karti hai). Kharida hua lead My Leads mein aa jata hai."),
    (("payout", "withdraw", "bank detail", "paisa nikal"),
     "Payout ke liye: Dashboard → Earnings. Pehle bank details save karo, phir 'Request payout' (minimum ₹1,000). Admin approve karke bank mein bhejta hai."),
    (("certificate", "quiz", "course", "training", "learn"),
     "Certificate ke liye: Dashboard → Learn mein course padho, phir quiz do. Pass hone par certificate Dashboard → Certificates mein PDF download ho jata hai."),
    (("plan", "subscription", "upgrade", "activate"),
     "Plan dekhne ke liye: Dashboard → Billing. Activation abhi team karti hai — 'Request activation' dabao, WhatsApp pe confirm ho jayega."),
    (("referral", "refer", "my link", "ref code", "ref link"),
     "Apna referral link Dashboard → Marketing → Referral mein hai (ya Settings). Aapke link se aaya customer lead seedha aapke My Leads mein free aata hai aur commission bhi milta hai."),
    (("password", "login"),
     "Password badalne ke liye: Settings → Change password. Bhool gaye ho to login page pe 'Forgot password' — email pe reset link aata hai."),
    (("visiting card", "business card", "qr"),
     "Visiting card + QR: Dashboard → Marketing → Card. Download karke WhatsApp ya print kar sakte ho."),
    (("poster", "post", "reel", "creative", "banner"),
     "Marketing posts/reels: Dashboard → Marketing. Ready posters pe aapka naam aur number lag ke download hote hain."),
    (("hrms", "attendance", "salary", "payroll", "leave", "employee", "staff"),
     "Team/HRMS: Dashboard → HRMS. Attendance, leaves, payroll aur payslips wahin hain (plan ke hisaab se)."),
    (("business case", "business check", "business eligibility"),
     "Website se aaye business cases: Dashboard → Business. Case ID se khol ke stage, documents aur notes update karo."),
]

GREETINGS = ("hi", "hello", "hey", "namaste", "hii", "help", "madad")


def _rows(db: Session, user: User) -> list[tuple[LeadPurchase, Lead | None]]:
    query = db.query(LeadPurchase)
    if user.role != "admin":
        query = query.filter(LeadPurchase.buyer_user_id == user.id)
    purchases = query.order_by(LeadPurchase.updated_at.desc()).limit(200).all()
    ids = [p.lead_id for p in purchases]
    leads = {lead.id: lead for lead in db.query(Lead).filter(Lead.id.in_(ids)).all()} if ids else {}
    return [(p, leads.get(p.lead_id)) for p in purchases]


def _name(lead: Lead | None, purchase: LeadPurchase) -> str:
    if lead and lead.applicant_name:
        return lead.applicant_name
    return "Case"


def _inr(value: float | None) -> str:
    n = float(value or 0)
    if n >= 1e7:
        return f"₹{n / 1e7:.2f} Cr".replace(".00 ", " ")
    if n >= 1e5:
        return f"₹{n / 1e5:.1f} L".replace(".0 ", " ")
    return f"₹{n:,.0f}"


def _rupees(value: float) -> str:
    s = str(int(round(value)))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = ",".join(re.findall(r"\d{1,2}", head[::-1]))[::-1]
        s = f"{head},{tail}"
    return f"₹{s}"


def _line(purchase: LeadPurchase, lead: Lead | None) -> str:
    product = lead.product_subtype if lead and lead.product_subtype else "Loan"
    city = lead.city if lead else ""
    stage = STAGE_LABEL.get(purchase.pipeline_stage, purchase.pipeline_stage)
    return f"{_name(lead, purchase)} · {product} · {city} · {stage}"


def _has(text: str, words: tuple[str, ...] | list[str]) -> bool:
    return any(w in text for w in words)


def _aware(when: datetime | None) -> datetime | None:
    if when is not None and when.tzinfo is None:
        return when.replace(tzinfo=timezone.utc)
    return when


def _match_customer(text: str, rows: list[tuple[LeadPurchase, Lead | None]]) -> tuple[LeadPurchase, Lead | None] | None:
    words = {w for w in re.findall(r"[a-z]{3,}", text)}
    if not words:
        return None
    for purchase, lead in rows:
        if not lead or not lead.applicant_name:
            continue
        parts = {p for p in re.findall(r"[a-z]{3,}", lead.applicant_name.lower())}
        if parts & words:
            return purchase, lead
    return None


def _parse_amount(text: str) -> float | None:
    best: float | None = None
    for m in re.finditer(r"(\d[\d,]*(?:\.\d+)?)\s*(cr|crore|lakhs?|lacs?|l|k|thousand)?\b", text):
        raw = float(m.group(1).replace(",", ""))
        unit = (m.group(2) or "").lower()
        if unit in ("cr", "crore"):
            raw *= 1e7
        elif unit.startswith("la") or unit == "l":
            raw *= 1e5
        elif unit in ("k", "thousand"):
            raw *= 1e3
        if raw >= 10000 and (best is None or raw > best):
            best = raw
    return best


def _emi_answer(text: str) -> str | None:
    amount = _parse_amount(text)
    rate_m = re.search(r"(\d+(?:\.\d+)?)\s*(%|percent|pct)", text)
    tenure_m = re.search(r"(\d+)\s*(years?|yrs?|saal|months?|mahine|m)\b", text)
    if not amount:
        return None
    rate = float(rate_m.group(1)) if rate_m else 11.0
    months = 60
    if tenure_m:
        n = int(tenure_m.group(1))
        months = max(1, n if tenure_m.group(2).startswith("m") else n * 12)
    r = rate / 1200
    emi = amount / months if r == 0 else amount * r * (1 + r) ** months / ((1 + r) ** months - 1)
    total = emi * months
    assumed = []
    if not rate_m:
        assumed.append("rate 11% maana")
    if not tenure_m:
        assumed.append("tenure 5 saal maana")
    note = f" ({', '.join(assumed)})" if assumed else ""
    return (
        f"EMI estimate{note}:\n"
        f"- Loan: {_inr(amount)} · Rate: {rate:g}% p.a. · Tenure: {months} months\n"
        f"- EMI: {_rupees(emi)} / month\n"
        f"- Total interest: {_rupees(total - amount)}\n"
        "Yeh sirf estimate hai; bank ka actual rate profile pe depend karta hai.\n"
        "Example: 'EMI 10 lakh 10.5% 5 years'"
    )


def _docs_answer(text: str) -> str | None:
    for keys, label, docs in PRODUCT_DOCS:
        if _has(text, keys):
            return f"{label} — documents checklist:\n" + "\n".join(f"- {d}" for d in docs) + "\nBank ke hisaab se 1–2 extra document maang sakte hain."
    return None


def answer_question(db: Session, user: User, question: str) -> str:
    text = " " + re.sub(r"\s+", " ", (question or "").strip().lower()) + " "
    rows = _rows(db, user)
    now = datetime.now(timezone.utc)
    open_rows = [(p, l) for p, l in rows if p.pipeline_stage not in CLOSED]

    if text.strip() in GREETINGS or _has(text, (" help ", "kya kar sakte", "what can you")):
        return _menu(user)

    if _has(text, ("emi", "installment", "kist")):
        ans = _emi_answer(text)
        if ans:
            return ans
        return "EMI nikalne ke liye amount, rate aur tenure likho. Example: 'EMI 10 lakh 10.5% 5 years'"

    if _has(text, ("follow-up", "follow up", "followup", "callback", "call back", "today", "aaj", "call karna")):
        due = []
        for purchase, lead in open_rows:
            when = _aware(purchase.next_followup_at)
            if when and when.date() <= now.date():
                due.append(f"- {_line(purchase, lead)} · {when.strftime('%d %b %H:%M')}")
        if not due:
            new = [p for p, _ in open_rows if p.pipeline_stage == "new"]
            extra = f" {len(new)} naye case abhi contact nahi hue — unhe call kar lo." if new else ""
            return "Aaj koi follow-up due nahi hai." + extra
        return "Aaj ke follow-ups:\n" + "\n".join(due[:12])

    if _has(text, ("48", "haven't moved", "not moved", "stuck", "stale", "atka", "atke", "ruka", "ruke", "pending kab")):
        cutoff = now - timedelta(hours=48)
        stale = [f"- {_line(p, l)}" for p, l in open_rows if (_aware(p.updated_at) or now) < cutoff]
        if not stale:
            return "Koi open case 48 ghante se ruka nahi hai."
        return "48 ghante se koi update nahi:\n" + "\n".join(stale[:12])

    if _has(text, ("document", "docs", "kagaz", "papers", "checklist")):
        ans = _docs_answer(text)
        if ans:
            return ans
        pending = [f"- {_line(p, l)}" for p, l in rows if p.pipeline_stage in {"new", "contacted"}]
        tip = "\nKisi product ki list chahiye to likho, jaise 'home loan documents' ya 'LAP documents'."
        if not pending:
            return "Koi case document collection se pehle atka nahi hai." + tip
        return "In cases mein documents abhi collect nahi hue:\n" + "\n".join(pending[:12]) + tip

    match = _match_customer(text, rows)

    if _has(text, ("whatsapp", "draft", "message", " msg")):
        target = match or (open_rows[0] if open_rows else None)
        if not target:
            return "Draft ke liye koi open case nahi hai."
        purchase, lead = target
        name = _name(lead, purchase)
        product = lead.product_subtype if lead and lead.product_subtype else "loan"
        stage = purchase.pipeline_stage
        if stage in {"new", "contacted"}:
            body = f"Aapki {product} requirement ke liye documents ki list bhej raha hoon. Aapke liye kaunsa time convenient hai baat karne ke liye?"
        elif stage == "docs_collected":
            body = f"Aapke {product} documents mil gaye hain, file bank ko bhejne ki tayari hai. Koi update ho to batayein."
        elif stage == "bank_submitted":
            body = f"Aapki {product} file bank mein process ho rahi hai. Bank se jaise hi update aayega, main aapko batata hoon."
        else:
            body = f"Aapki {product} requirement par follow-up hai."
        return (
            f"WhatsApp draft for {name}:\n"
            f"Namaste {name} ji, RupeeDial se {user.full_name}. {body}\n"
            "Final approval aur rate lender decide karega."
        )

    if _has(text, ("cross", "upsell", "aur product")):
        lines = []
        for purchase, lead in rows:
            if purchase.pipeline_stage not in {"disbursed", "sanctioned", "bank_submitted", "contacted"}:
                continue
            product = lead.product_subtype if lead else ""
            ideas = ", ".join(recommended_for(product)[:3])
            lines.append(f"- {_name(lead, purchase)} ({product or 'loan'}) → {ideas}")
        if not lines:
            return "Abhi koi case cross-sell ke stage tak nahi pahuncha."
        return "Next product suggestions (offer nahi, sirf idea):\n" + "\n".join(lines[:8])

    if _has(text, ("earning", "commission", "kamai", "income", "wallet", "balance", "kitna kamaya")):
        disbursed = [(p, l) for p, l in rows if p.pipeline_stage == "disbursed"]
        value = sum(float(p.deal_value or (l.loan_amount if l else 0) or 0) for p, l in disbursed)
        return (
            f"Wallet balance: {_inr(user.wallet_balance)}\n"
            f"Disbursed cases: {len(disbursed)} · Total disbursed value: {_inr(value)}\n"
            "Commission ka detail aur payout: Dashboard → Earnings."
        )

    if _has(text, ("summary", "pipeline", "kitne", "how many", "report", "overview", "status", "mere leads", "my leads")) and not match:
        if not rows:
            return "Abhi aapke paas koi case nahi hai. Leadboard se lead kharido ya apna referral link share karo."
        counts = Counter(p.pipeline_stage for p, _ in rows)
        lines = [f"- {STAGE_LABEL.get(s, s)}: {counts[s]}" for s in STAGE_LABEL if counts.get(s)]
        pipeline_value = sum(float(l.loan_amount or 0) for p, l in open_rows if l)
        due_today = sum(1 for p, _ in open_rows if (w := _aware(p.next_followup_at)) and w.date() <= now.date())
        return (
            f"Aapke {len(rows)} cases:\n" + "\n".join(lines) +
            f"\nOpen pipeline value: {_inr(pipeline_value)} · Aaj follow-up: {due_today}"
        )

    if match:
        purchase, lead = match
        when = _aware(purchase.next_followup_at)
        parts = [f"{_name(lead, purchase)}"]
        if lead:
            parts.append(f"- Product: {lead.product_subtype or lead.loan_type} · Amount: {_inr(lead.loan_amount)}")
            parts.append(f"- City: {lead.city or '—'} · Income: {_inr(lead.monthly_income) + '/month' if lead.monthly_income else '—'}")
        parts.append(f"- Stage: {STAGE_LABEL.get(purchase.pipeline_stage, purchase.pipeline_stage)}")
        parts.append(f"- Next follow-up: {when.strftime('%d %b %H:%M') if when else 'set nahi hai'}")
        if lead:
            ideas = ", ".join(recommended_for(lead.product_subtype)[:3])
            if ideas:
                parts.append(f"- Cross-sell idea: {ideas}")
        parts.append("Poori detail: Dashboard → My Leads.")
        return "\n".join(parts)

    if _has(text, ("lender", "bank", "policy", "eligib", "cibil", "score", "lap")):
        ans = [
            "Lender ka final decision bank karta hai — hum kisi bank ya rate ka promise nahi karte.",
            "File strong banane ke liye check karo:",
            "- CIBIL 700+ ho to zyada banks options; 650 se kam pe NBFC dekhna padta hai",
            "- Existing EMIs income ke 50–55% se zyada na ho (FOIR)",
            "- Salaried: 6 months current job continuity; self-employed: 2–3 saal ITR",
            "- LAP: property clear title + approved plan; value ka 50–70% tak loan",
            "- Business: GST returns regular, bank statement mein bounce na ho",
        ]
        return "\n".join(ans)

    for keys, reply in HOW_TO:
        if _has(text, keys):
            return reply

    docs = _docs_answer(text)
    if docs:
        return docs

    return _menu(user)


def _menu(user: User) -> str:
    first = (user.full_name or "").split(" ")[0] or "Partner"
    return (
        f"Namaste {first}! Main aapke CRM cases se jawab deta hoon. Aise poocho:\n"
        "- Summary / mere leads kitne hain\n"
        "- Aaj ke follow-ups\n"
        "- Kaunse case 48 ghante se atke hain\n"
        "- Home loan documents / LAP documents\n"
        "- EMI 10 lakh 10.5% 5 years\n"
        "- <customer ka naam> — us case ki detail\n"
        "- <customer ka naam> ke liye WhatsApp draft\n"
        "- Meri earning / wallet\n"
        "- Lead kaise kharide / payout kaise le / certificate kaise mile"
    )
