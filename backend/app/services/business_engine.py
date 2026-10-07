"""Rule-based business loan assessment (no AI).

Indicative only — mirrors common Indian bank / NBFC credit norms:
- Working capital: Nayak committee (20% of turnover for MSE up to ₹5 Cr).
- Term loans: debt-service capacity from cash accrual at minimum DSCR 1.25.
- Schemes: CGTMSE, Mudra, PMEGP, Stand-Up India eligibility checks.
"""

from __future__ import annotations

from typing import Any

ENGINE_VERSION = "rules-v1"

CRORE = 10_000_000
LAKH = 100_000

FACILITIES: dict[str, dict[str, Any]] = {
    "cash_credit": {"label": "Cash Credit", "kind": "wc", "rate": (9.5, 12.0)},
    "overdraft": {"label": "Overdraft", "kind": "wc", "rate": (9.75, 12.5)},
    "dropline_od": {"label": "Drop-line OD", "kind": "dropline", "rate": (10.0, 13.0), "tenure": 60},
    "term_loan": {"label": "Term Loan", "kind": "term", "rate": (10.0, 13.0), "tenure": 60},
    "machinery_loan": {"label": "Machinery Loan", "kind": "term", "rate": (9.5, 12.5), "tenure": 84},
    "equipment_finance": {"label": "Equipment Finance", "kind": "term", "rate": (10.0, 14.0), "tenure": 60},
    "commercial_vehicle": {"label": "Commercial Vehicle Loan", "kind": "term", "rate": (9.0, 13.0), "tenure": 60},
    "project_finance": {"label": "Project Finance", "kind": "term", "rate": (10.0, 13.5), "tenure": 96},
    "invoice_discounting": {"label": "Invoice Discounting", "kind": "receivable", "rate": (10.0, 15.0)},
    "bill_discounting": {"label": "Bill Discounting", "kind": "receivable", "rate": (9.5, 13.0)},
    "purchase_finance": {"label": "Purchase / Vendor Finance", "kind": "receivable", "rate": (11.0, 16.0)},
    "bank_guarantee": {"label": "Bank Guarantee", "kind": "non_fund", "rate": (1.0, 2.5)},
    "letter_of_credit": {"label": "Letter of Credit", "kind": "non_fund", "rate": (1.0, 2.5)},
    "secured_business_loan": {"label": "Secured Business Loan (LAP)", "kind": "secured", "rate": (9.5, 13.5), "tenure": 120},
    "unsecured_business_loan": {"label": "Unsecured Business Loan", "kind": "unsecured", "rate": (15.0, 24.0), "tenure": 36},
}

SECTOR_MARGIN = {
    "manufacturing": 0.08,
    "trading": 0.03,
    "services": 0.12,
    "construction": 0.07,
    "agriculture": 0.06,
}

ASSUMED_CIBIL = 700
MIN_DSCR = 1.25

# min_vintage (years), min_turnover (₹), min_cibil, max ticket (₹), products, kind
LENDERS: list[dict[str, Any]] = [
    {"name": "SBI", "kind": "PSU Bank", "min_vintage": 2, "min_turnover": 10 * LAKH, "min_cibil": 680, "max": 50 * CRORE,
     "products": {"cash_credit", "overdraft", "dropline_od", "term_loan", "machinery_loan", "project_finance", "bill_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan", "commercial_vehicle", "equipment_finance"},
     "rate": (9.25, 11.5), "cgtmse": True},
    {"name": "Bank of Baroda", "kind": "PSU Bank", "min_vintage": 2, "min_turnover": 10 * LAKH, "min_cibil": 680, "max": 25 * CRORE,
     "products": {"cash_credit", "overdraft", "dropline_od", "term_loan", "machinery_loan", "project_finance", "bill_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan"},
     "rate": (9.4, 11.75), "cgtmse": True},
    {"name": "PNB", "kind": "PSU Bank", "min_vintage": 2, "min_turnover": 10 * LAKH, "min_cibil": 680, "max": 25 * CRORE,
     "products": {"cash_credit", "overdraft", "term_loan", "machinery_loan", "project_finance", "bill_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan"},
     "rate": (9.4, 11.75), "cgtmse": True},
    {"name": "Canara Bank", "kind": "PSU Bank", "min_vintage": 2, "min_turnover": 10 * LAKH, "min_cibil": 680, "max": 25 * CRORE,
     "products": {"cash_credit", "overdraft", "dropline_od", "term_loan", "machinery_loan", "project_finance", "bill_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan"},
     "rate": (9.3, 11.6), "cgtmse": True},
    {"name": "Union Bank of India", "kind": "PSU Bank", "min_vintage": 2, "min_turnover": 10 * LAKH, "min_cibil": 680, "max": 25 * CRORE,
     "products": {"cash_credit", "overdraft", "term_loan", "machinery_loan", "project_finance", "bill_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan"},
     "rate": (9.35, 11.7), "cgtmse": True},
    {"name": "Indian Bank", "kind": "PSU Bank", "min_vintage": 2, "min_turnover": 10 * LAKH, "min_cibil": 680, "max": 15 * CRORE,
     "products": {"cash_credit", "overdraft", "term_loan", "machinery_loan", "bill_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan"},
     "rate": (9.4, 11.8), "cgtmse": True},
    {"name": "Bank of India", "kind": "PSU Bank", "min_vintage": 2, "min_turnover": 10 * LAKH, "min_cibil": 680, "max": 15 * CRORE,
     "products": {"cash_credit", "overdraft", "term_loan", "machinery_loan", "bill_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan"},
     "rate": (9.4, 11.8), "cgtmse": True},
    {"name": "HDFC Bank", "kind": "Private Bank", "min_vintage": 3, "min_turnover": 40 * LAKH, "min_cibil": 720, "max": 50 * CRORE,
     "products": {"cash_credit", "overdraft", "dropline_od", "term_loan", "machinery_loan", "commercial_vehicle", "equipment_finance", "bill_discounting", "invoice_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan", "unsecured_business_loan"},
     "rate": (10.0, 13.5), "cgtmse": True},
    {"name": "ICICI Bank", "kind": "Private Bank", "min_vintage": 3, "min_turnover": 40 * LAKH, "min_cibil": 720, "max": 50 * CRORE,
     "products": {"cash_credit", "overdraft", "dropline_od", "term_loan", "machinery_loan", "commercial_vehicle", "equipment_finance", "bill_discounting", "invoice_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan", "unsecured_business_loan"},
     "rate": (10.0, 13.75), "cgtmse": True},
    {"name": "Axis Bank", "kind": "Private Bank", "min_vintage": 3, "min_turnover": 40 * LAKH, "min_cibil": 720, "max": 25 * CRORE,
     "products": {"cash_credit", "overdraft", "dropline_od", "term_loan", "machinery_loan", "commercial_vehicle", "bill_discounting", "invoice_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan", "unsecured_business_loan"},
     "rate": (10.25, 14.0), "cgtmse": True},
    {"name": "Kotak Mahindra Bank", "kind": "Private Bank", "min_vintage": 3, "min_turnover": 50 * LAKH, "min_cibil": 730, "max": 25 * CRORE,
     "products": {"cash_credit", "overdraft", "dropline_od", "term_loan", "machinery_loan", "bill_discounting", "bank_guarantee", "letter_of_credit", "secured_business_loan", "unsecured_business_loan"},
     "rate": (10.5, 14.5), "cgtmse": True},
    {"name": "SIDBI", "kind": "Development Bank", "min_vintage": 3, "min_turnover": 1 * CRORE, "min_cibil": 700, "max": 25 * CRORE,
     "products": {"term_loan", "machinery_loan", "equipment_finance", "project_finance", "cash_credit", "invoice_discounting"},
     "rate": (8.75, 11.0), "cgtmse": True},
    {"name": "Bajaj Finserv", "kind": "NBFC", "min_vintage": 3, "min_turnover": 20 * LAKH, "min_cibil": 685, "max": 80 * LAKH,
     "products": {"unsecured_business_loan", "secured_business_loan", "machinery_loan", "dropline_od"},
     "rate": (14.0, 22.0), "cgtmse": False},
    {"name": "Tata Capital", "kind": "NBFC", "min_vintage": 3, "min_turnover": 30 * LAKH, "min_cibil": 700, "max": 5 * CRORE,
     "products": {"unsecured_business_loan", "secured_business_loan", "machinery_loan", "equipment_finance", "invoice_discounting", "purchase_finance", "term_loan"},
     "rate": (12.0, 20.0), "cgtmse": True},
    {"name": "Aditya Birla Capital", "kind": "NBFC", "min_vintage": 2, "min_turnover": 30 * LAKH, "min_cibil": 700, "max": 5 * CRORE,
     "products": {"unsecured_business_loan", "secured_business_loan", "term_loan", "purchase_finance", "invoice_discounting"},
     "rate": (12.5, 21.0), "cgtmse": True},
    {"name": "IIFL Finance", "kind": "NBFC", "min_vintage": 2, "min_turnover": 15 * LAKH, "min_cibil": 675, "max": 3 * CRORE,
     "products": {"unsecured_business_loan", "secured_business_loan", "machinery_loan", "commercial_vehicle"},
     "rate": (14.0, 24.0), "cgtmse": False},
    {"name": "Lendingkart", "kind": "Fintech NBFC", "min_vintage": 1, "min_turnover": 10 * LAKH, "min_cibil": 650, "max": 2 * CRORE,
     "products": {"unsecured_business_loan", "purchase_finance"},
     "rate": (15.0, 27.0), "cgtmse": True},
]

COMMON_DOCS = [
    ("entity_pan", "PAN of business"),
    ("gst_certificate", "GST registration certificate"),
    ("gstr3b_12m", "GSTR-3B — last 12 months"),
    ("bank_statement_12m", "Bank statements — last 12 months (all current accounts)"),
    ("itr_financials", "ITR + audited financials (Balance Sheet, P&L) — last 2–3 years"),
    ("promoter_kyc", "Promoter / partner KYC (PAN, Aadhaar, photo)"),
    ("udyam_certificate", "Udyam registration certificate"),
    ("existing_loans", "Sanction letters & statements of existing loans"),
]

CONSTITUTION_DOCS = {
    "private_limited": [("moa_aoa", "MOA / AOA & Certificate of Incorporation"), ("board_resolution", "Board resolution for borrowing"), ("shareholding", "Latest shareholding pattern")],
    "public_limited": [("moa_aoa", "MOA / AOA & Certificate of Incorporation"), ("board_resolution", "Board resolution for borrowing"), ("shareholding", "Latest shareholding pattern")],
    "llp": [("llp_agreement", "LLP agreement & incorporation certificate")],
    "partnership": [("partnership_deed", "Registered partnership deed")],
    "proprietorship": [("shop_licence", "Shop & establishment / trade licence")],
}

FACILITY_DOCS = {
    "machinery_loan": [("quotation", "Machinery quotation / proforma invoice")],
    "equipment_finance": [("quotation", "Equipment quotation / proforma invoice")],
    "commercial_vehicle": [("vehicle_quotation", "Vehicle quotation & permit details")],
    "project_finance": [("dpr", "Detailed project report (DPR)")],
    "invoice_discounting": [("debtor_list", "Debtor ageing list & sample invoices")],
    "bill_discounting": [("debtor_list", "Debtor ageing list & sample bills")],
    "purchase_finance": [("supplier_list", "Supplier list & purchase invoices")],
    "bank_guarantee": [("bg_format", "BG format / tender document")],
    "letter_of_credit": [("lc_details", "Import/purchase order for LC")],
}


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _str(value: Any) -> str:
    return str(value or "").strip().lower()


def _pv(rate_pa: float, months: int, monthly_payment: float) -> float:
    if monthly_payment <= 0 or months <= 0:
        return 0.0
    r = rate_pa / 1200
    if r == 0:
        return monthly_payment * months
    return monthly_payment * (1 - (1 + r) ** -months) / r


def _emi(principal: float, rate_pa: float, months: int) -> float:
    if principal <= 0 or months <= 0:
        return 0.0
    r = rate_pa / 1200
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def inr(amount: float) -> str:
    n = int(round(amount))
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return f"₹{'-' if n < 0 else ''}{s}"


def _round_lakh(amount: float) -> int:
    if amount <= 0:
        return 0
    if amount < LAKH:
        return int(round(amount / 10_000) * 10_000)
    return int(amount // 50_000 * 50_000)


def enterprise_size(turnover: float, declared: str = "") -> str:
    declared = _str(declared)
    if declared in {"micro", "small", "medium"}:
        return declared
    if turnover <= 10 * CRORE:
        return "micro"
    if turnover <= 100 * CRORE:
        return "small"
    if turnover <= 500 * CRORE:
        return "medium"
    return "large"


def _merge_input(case: dict[str, Any]) -> dict[str, Any]:
    """Flatten quick / data / financials sections; later sections win."""
    merged: dict[str, Any] = {}
    for section in ("quick", "data", "financials"):
        block = case.get(section)
        if isinstance(block, dict):
            for k, v in block.items():
                if v not in (None, ""):
                    merged[k] = v
    for k, v in case.items():
        if k not in {"quick", "data", "financials", "documents", "assessment", "history"} and v not in (None, "") and k not in merged:
            merged[k] = v
    return merged


def _facility_amounts(inp: dict[str, Any], cash_accrual: float, existing_emi_annual: float, turnover: float, vintage: float) -> dict[str, dict[str, Any]]:
    capacity_annual = max(0.0, cash_accrual / MIN_DSCR - existing_emi_annual)
    capacity_monthly = capacity_annual / 12
    collateral_value = _num(inp.get("collateral_value"))
    debtors = _num(inp.get("debtors"))
    abb = _num(inp.get("avg_bank_balance"))

    wc_rule = turnover * (0.20 if turnover <= 5 * CRORE else 0.15)
    receivables = debtors if debtors > 0 else turnover * 60 / 365

    out: dict[str, dict[str, Any]] = {}
    for key, f in FACILITIES.items():
        lo, hi = f["rate"]
        mid = round((lo + hi) / 2, 2)
        tenure = int(f.get("tenure", 12))
        kind = f["kind"]
        amount = 0.0
        note = ""
        if kind == "wc":
            amount = wc_rule
            note = "20% of turnover (Nayak norms), renewed yearly" if turnover <= 5 * CRORE else "≈15% of turnover; bank will assess MPBF on CMA data"
        elif kind == "dropline":
            amount = min(wc_rule * 0.8, _pv(mid, tenure, capacity_monthly))
            note = "Limit reduces monthly over 5 years"
        elif kind == "term":
            amount = _pv(mid, tenure, capacity_monthly)
            note = f"Based on cash accrual at DSCR {MIN_DSCR}"
            if key in {"machinery_loan", "equipment_finance", "commercial_vehicle"}:
                note += "; usually 75–85% of asset cost"
        elif kind == "receivable":
            amount = receivables * 0.75
            note = "≈75% of receivables" if debtors > 0 else "≈75% of receivables (assumed 60 debtor days)"
        elif kind == "non_fund":
            amount = turnover * 0.10
            note = "Commission-based; 10–25% cash margin / FD usually needed"
        elif kind == "secured":
            dscr_amt = _pv(mid, tenure, capacity_monthly)
            if collateral_value > 0:
                amount = min(collateral_value * 0.6, dscr_amt)
                note = "Up to 60% of property value, limited by repayment capacity"
            elif _str(inp.get("collateral")) == "no":
                amount = 0
                note = "Needs property as collateral"
            else:
                amount = dscr_amt
                note = "Needs property as collateral — value not shared yet"
        elif kind == "unsecured":
            if vintage < 2:
                amount = 0
                note = "Most lenders need 2+ years of business vintage"
            else:
                caps = [turnover * 0.10, _pv(mid, tenure, capacity_monthly), 75 * LAKH]
                if abb > 0:
                    caps.append(abb * 15)
                amount = min(caps)
                note = "Collateral-free; capped at ~10% of turnover"
        amount = _round_lakh(amount)
        emi = 0 if kind in {"wc", "receivable", "non_fund"} else int(round(_emi(amount, mid, tenure)))
        out[key] = {
            "facility": key,
            "label": f["label"],
            "amount": amount,
            "rate_min": lo,
            "rate_max": hi,
            "rate_unit": "commission % p.a." if kind == "non_fund" else "% p.a.",
            "tenure_months": tenure if kind in {"term", "secured", "unsecured", "dropline"} else 12,
            "emi": emi,
            "note": note,
        }
    return out


def assess_business(case: dict[str, Any]) -> dict[str, Any]:
    inp = _merge_input(case)

    turnover = _num(inp.get("annual_turnover"))
    vintage = _num(inp.get("vintage_years"))
    sector = _str(inp.get("sector"))
    facility = _str(inp.get("facility")) or "term_loan"
    if facility not in FACILITIES:
        facility = "term_loan"
    requested = _num(inp.get("required_amount"))
    collateral = _str(inp.get("collateral"))
    gst = _str(inp.get("gst_regularity"))
    udyam = _str(inp.get("udyam_registered"))
    stage = _str(inp.get("company_stage"))
    promoter = _str(inp.get("promoter_category"))
    constitution = _str(inp.get("constitution")) or "proprietorship"
    top_customer = _num(inp.get("top_customer_share"))
    bounces = inp.get("cheque_bounces")
    cibil_raw = _num(inp.get("cibil_score"))
    cibil = cibil_raw if cibil_raw >= 300 else ASSUMED_CIBIL
    existing_emi_annual = _num(inp.get("existing_emi")) * 12
    preferred = {str(b).strip().lower() for b in (inp.get("preferred_banks") or []) if str(b).strip()}

    net_profit = _num(inp.get("net_profit"))
    profit_is_estimate = net_profit <= 0
    margin = SECTOR_MARGIN.get(sector, 0.06)
    profit = net_profit if net_profit > 0 else turnover * margin
    depreciation = _num(inp.get("depreciation"))
    if depreciation <= 0:
        depreciation = profit * (0.25 if sector == "manufacturing" else 0.10)
    cash_accrual = profit + depreciation

    size = enterprise_size(turnover, inp.get("enterprise_size", ""))
    options = _facility_amounts(inp, cash_accrual, existing_emi_annual, turnover, vintage)
    chosen = options[facility]
    eligible = chosen["amount"]

    proposed_amount = min(requested or eligible, eligible)
    if chosen["emi"]:
        proposed_annual = _emi(proposed_amount, (chosen["rate_min"] + chosen["rate_max"]) / 2, chosen["tenure_months"]) * 12
    else:
        proposed_annual = proposed_amount * chosen["rate_max"] / 100
    debt_service = existing_emi_annual + proposed_annual
    dscr = round(cash_accrual / debt_service, 2) if debt_service > 0 else None

    flags: list[dict[str, str]] = []
    score = 50

    if vintage < 1:
        score -= 15
        flags.append({"type": "bad", "text": "Business is less than 1 year old — banks prefer 2–3 years"})
    elif vintage < 2:
        score -= 5
        flags.append({"type": "warn", "text": "Under 2 years vintage — limited lender choice"})
    elif vintage >= 6:
        score += 10
        flags.append({"type": "good", "text": f"{int(vintage)}+ years in business"})
    else:
        score += 5

    if gst == "regular":
        score += 10
        flags.append({"type": "good", "text": "GST returns filed regularly"})
    elif gst == "delays":
        score -= 5
        flags.append({"type": "warn", "text": "Delays in GST filing — file pending returns before applying"})
    elif gst == "not_filed":
        score -= 15
        flags.append({"type": "bad", "text": "GST not filed / not registered — most banks need GST history"})

    if cibil_raw >= 300:
        if cibil >= 750:
            score += 15
            flags.append({"type": "good", "text": f"Strong CIBIL ({int(cibil)})"})
        elif cibil >= 700:
            score += 8
        elif cibil < 650:
            score -= 20
            flags.append({"type": "bad", "text": f"Low CIBIL ({int(cibil)}) — banks usually need 680+"})

    if bounces not in (None, ""):
        b = _num(bounces)
        if b == 0:
            score += 5
        elif b <= 2:
            score -= 5
            flags.append({"type": "warn", "text": f"{int(b)} cheque/EMI bounce(s) in last 6 months"})
        else:
            score -= 15
            flags.append({"type": "bad", "text": f"{int(b)} bounces in last 6 months — high risk for banks"})

    if collateral == "yes":
        score += 10
        flags.append({"type": "good", "text": "Collateral available"})
    elif collateral == "partial":
        score += 5

    if udyam == "yes":
        score += 5
    elif udyam in {"no", "pending"}:
        flags.append({"type": "warn", "text": "Get Udyam registration — needed for MSME benefits & CGTMSE"})

    if top_customer > 50:
        score -= 10
        flags.append({"type": "warn", "text": f"High customer concentration ({int(top_customer)}% from one buyer)"})
    elif top_customer > 30:
        score -= 5

    if dscr is not None:
        if dscr >= 1.5:
            score += 10
            flags.append({"type": "good", "text": f"Healthy repayment capacity (DSCR {dscr})"})
        elif dscr >= MIN_DSCR:
            score += 3
        elif dscr >= 1:
            score -= 10
            flags.append({"type": "warn", "text": f"Tight repayment capacity (DSCR {dscr}; banks want {MIN_DSCR}+)"})
        else:
            score -= 20
            flags.append({"type": "bad", "text": f"Cash flow does not cover EMIs (DSCR {dscr})"})

    if requested > 0 and eligible > 0 and requested > eligible * 1.2:
        score -= 5

    score = max(0, min(100, score))
    grade = "A" if score >= 75 else "B" if score >= 60 else "C" if score >= 45 else "D"
    chance = {"A": "High", "B": "Good", "C": "Fair", "D": "Low"}[grade]

    if eligible <= 0:
        verdict = "not_eligible"
        headline = f"{chosen['label']} is not available on current numbers"
    elif requested <= 0 or requested <= eligible:
        verdict = "within"
        headline = f"You may be eligible for {chosen['label']} up to {inr(eligible)}"
    else:
        verdict = "partial"
        headline = f"Requested amount is above the indicative limit of {inr(eligible)}"

    ranked = sorted(
        (o for k, o in options.items() if k != facility and o["amount"] > 0),
        key=lambda o: o["amount"],
        reverse=True,
    )
    option_list = [{**chosen, "recommended": True}] + [{**o, "recommended": False} for o in ranked[:5]]

    schemes = _schemes(size, requested or eligible, sector, stage, promoter, vintage, facility, udyam)
    lenders, unmatched = _match_lenders(facility, eligible, vintage, turnover, cibil, gst, score, preferred, size)

    documents = [{"key": k, "label": label} for k, label in COMMON_DOCS]
    documents += [{"key": k, "label": label} for k, label in CONSTITUTION_DOCS.get(constitution, [])]
    documents += [{"key": k, "label": label} for k, label in FACILITY_DOCS.get(facility, [])]
    if collateral in {"yes", "partial"}:
        documents.append({"key": "property_papers", "label": "Collateral property papers & latest valuation"})

    assumptions = []
    if profit_is_estimate:
        assumptions.append(f"Net profit assumed at {int(margin * 100)}% of turnover ({sector or 'general'} average) — share actual figures for a precise result")
    if cibil_raw < 300:
        assumptions.append(f"CIBIL assumed {ASSUMED_CIBIL} until a bureau check")
    assumptions.append("Indicative estimate based on typical bank norms. Final sanction depends on the lender's own appraisal.")

    return {
        "engine": ENGINE_VERSION,
        "summary": {
            "facility": facility,
            "facility_label": chosen["label"],
            "requested_amount": int(requested),
            "eligible_amount": int(eligible),
            "verdict": verdict,
            "headline": headline,
        },
        "risk": {"score": score, "grade": grade, "chance": chance, "flags": flags},
        "ratios": {
            "turnover": int(turnover),
            "estimated_profit": int(profit),
            "profit_is_estimate": profit_is_estimate,
            "cash_accrual": int(cash_accrual),
            "existing_emi_annual": int(existing_emi_annual),
            "dscr": dscr,
            "loan_to_turnover": round((requested or eligible) / turnover * 100, 1) if turnover > 0 else None,
            "enterprise_size": size,
            "cibil_used": int(cibil),
        },
        "options": option_list,
        "schemes": schemes,
        "lenders": lenders,
        "unmatched_lenders": unmatched,
        "documents": documents,
        "assumptions": assumptions,
    }


def _schemes(size: str, amount: float, sector: str, stage: str, promoter: str, vintage: float, facility: str, udyam: str) -> list[dict[str, Any]]:
    mse = size in {"micro", "small"}
    is_new = stage in {"new", "greenfield"} or vintage < 1
    out = []

    cg_ok = mse and 0 < amount <= 10 * CRORE
    out.append({
        "key": "cgtmse",
        "name": "CGTMSE (collateral-free guarantee)",
        "eligible": cg_ok,
        "detail": "Collateral-free cover up to ₹10 Cr for micro & small enterprises via member banks; guarantee fee applies."
        if cg_ok else ("Only for micro & small enterprises" if not mse else "Loan amount outside ₹10 Cr CGTMSE limit"),
    })

    mudra_ok = size == "micro" and 0 < amount <= 20 * LAKH and sector != "agriculture"
    tier = "Shishu (≤ ₹50k)" if amount <= 50_000 else "Kishore (≤ ₹5L)" if amount <= 5 * LAKH else "Tarun (≤ ₹10L)" if amount <= 10 * LAKH else "Tarun Plus (≤ ₹20L, for prior Tarun borrowers)"
    out.append({
        "key": "mudra",
        "name": "PM Mudra Yojana",
        "eligible": mudra_ok,
        "detail": f"{tier} — no collateral for non-farm micro units." if mudra_ok else "For non-farm micro units with loans up to ₹20 lakh",
    })

    pmegp_cap = 50 * LAKH if sector == "manufacturing" else 20 * LAKH
    pmegp_ok = is_new and 0 < amount <= pmegp_cap and facility in {"term_loan", "machinery_loan", "project_finance", "equipment_finance", "cash_credit"}
    out.append({
        "key": "pmegp",
        "name": "PMEGP (15–35% subsidy)",
        "eligible": pmegp_ok,
        "detail": f"New units: project cost up to ₹{int(pmegp_cap / LAKH)}L with margin-money subsidy." if pmegp_ok else "Only for new units (manufacturing ≤ ₹50L, services ≤ ₹20L)",
    })

    sui_ok = promoter in {"women", "sc", "st"} and is_new and 10 * LAKH <= amount <= 1 * CRORE
    out.append({
        "key": "stand_up_india",
        "name": "Stand-Up India",
        "eligible": sui_ok,
        "detail": "Greenfield loans ₹10L–₹1 Cr for women / SC / ST entrepreneurs." if sui_ok else "For women / SC / ST promoters starting a greenfield unit (₹10L–₹1 Cr)",
    })

    if udyam != "yes":
        for s in out:
            if s["eligible"] and s["key"] in {"cgtmse", "mudra"}:
                s["detail"] += " Udyam registration required."
    return out


def _match_lenders(
    facility: str,
    eligible: float,
    vintage: float,
    turnover: float,
    cibil: float,
    gst: str,
    score: int,
    preferred: set[str],
    size: str,
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    matched: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    for lender in LENDERS:
        name = lender["name"]
        reason = ""
        if facility not in lender["products"]:
            reason = f"Does not offer {FACILITIES[facility]['label']}"
        elif vintage < lender["min_vintage"]:
            reason = f"Needs {lender['min_vintage']}+ years vintage"
        elif turnover < lender["min_turnover"]:
            reason = f"Needs turnover ₹{lender['min_turnover'] / LAKH:.0f}L+"
        elif cibil < lender["min_cibil"]:
            reason = f"Needs CIBIL {lender['min_cibil']}+"
        elif gst == "not_filed" and lender["kind"] != "Fintech NBFC":
            reason = "Needs regular GST filing"
        elif eligible <= 0:
            reason = "No eligible amount on current numbers"
        if reason:
            unmatched.append({"name": name, "reason": reason})
            continue

        adj = score
        if lender["kind"] == "PSU Bank" and vintage < 3:
            adj -= 5
        if lender["kind"] in {"NBFC", "Fintech NBFC"}:
            adj += 8
        chance = "High" if adj >= 75 else "Good" if adj >= 60 else "Fair" if adj >= 45 else "Low"
        lo, hi = lender["rate"]
        f_lo, f_hi = FACILITIES[facility]["rate"]
        if FACILITIES[facility]["kind"] == "non_fund":
            lo, hi = f_lo, f_hi
        elif FACILITIES[facility]["kind"] == "unsecured":
            lo, hi = max(lo, f_lo - 2), max(hi, f_lo)
        matched.append({
            "name": name,
            "kind": lender["kind"],
            "amount": int(min(eligible, lender["max"])),
            "rate_min": lo,
            "rate_max": hi,
            "chance": chance,
            "preferred": name.lower() in preferred,
            "cgtmse": bool(lender["cgtmse"]) and size in {"micro", "small"},
        })

    order = {"High": 0, "Good": 1, "Fair": 2, "Low": 3}
    matched.sort(key=lambda m: (not m["preferred"], order[m["chance"]], m["rate_min"]))
    return matched, unmatched
