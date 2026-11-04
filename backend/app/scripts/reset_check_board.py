"""Clear partners and old records, then leave one fresh marketplace lead per product.

Company logins (ceo, super_admin, admin) stay so the CRM can still be opened.
Pricing rules stay. Run once on the server after deploy.
"""

from __future__ import annotations

from app.db.session import SessionLocal
from app.models import (
    AuditEvent,
    Certificate,
    CustomerAutomationLog,
    CustomerBankAccount,
    CustomerBankLogin,
    CustomerCasePayout,
    CustomerCoApplicant,
    CustomerDisbursal,
    CustomerDocument,
    CustomerDocumentEvent,
    CustomerFollowup,
    CustomerLenderCase,
    CustomerLoanRequirement,
    CustomerLosPipeline,
    CustomerObligation,
    CustomerPipelineHistory,
    CustomerProfile,
    CustomerSanctionDisbursal,
    CustomerTask,
    InvoiceApproval,
    Lead,
    LeadPurchase,
    LoanCase,
    NetworkLink,
    PartnerApplication,
    PartnerProfile,
    PayoutAdjustment,
    PayoutRequest,
    ProfileVisit,
    User,
    UserNotification,
    VisitingCard,
)
from app.plans import default_lead_price

KEEP_ROLES = ("ceo", "super_admin", "admin")

LEADS = [
    ("personal-loan", "Aarav Sharma", "Personal Loan", "loan", "loan_personal", 500000, "salaried", "New Delhi", "Delhi"),
    ("home-loan", "Meera Iyer", "Home Loan", "loan", "home_loan", 2500000, "salaried", "Mumbai", "Maharashtra"),
    ("lap-loan", "Kabir Singh", "Loan Against Property", "loan", "loan_lap", 1800000, "salaried", "Jaipur", "Rajasthan"),
    ("auto-loan", "Ananya Rao", "Auto Loan", "loan", "loan_auto_new", 700000, "salaried", "Hyderabad", "Telangana"),
    ("msme-loan", "Vikram Patel", "MSME Loan", "loan", "loan_msme", 1000000, "business-owner", "Ahmedabad", "Gujarat"),
    ("mudra-loan", "Sana Khan", "Mudra Loan", "loan", "loan_mudra", 300000, "trading", "Lucknow", "Uttar Pradesh"),
    ("education-loan", "Rohan Das", "Education Loan", "loan", "education_loan", 800000, "salaried", "Kolkata", "West Bengal"),
    ("machinery-loan", "Neha Gupta", "Machinery Loan", "loan", "machinery_loan", 1500000, "business-owner", "Pune", "Maharashtra"),
    ("business-loan", "Arjun Nair", "Business Loan", "loan", "business-loan", 2000000, "business-owner", "Kochi", "Kerala"),
    ("bnpl", "Ishaan Verma", "BNPL Pay Later", "loan", "bnpl-pay-later", 20000, "salaried", "Chandigarh", "Chandigarh"),
    ("credit-card", "Pooja Reddy", "Credit Card", "credit_card", "credit_card", 0, "salaried", "Bengaluru", "Karnataka"),
    ("insurance", "Rahul Mehta", "Health Insurance", "insurance", "insurance", 0, "salaried", "Indore", "Madhya Pradesh"),
]


def _mask(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    return f"{digits[:2]}XXXXXX{digits[-2:]}"


def _clear(db, model) -> int:
    return db.query(model).delete(synchronize_session=False)


def main() -> None:
    db = SessionLocal()
    try:
        cleared = {
            "purchases": _clear(db, LeadPurchase),
            "profiles": _clear(db, CustomerProfile),
            "bank_accounts": _clear(db, CustomerBankAccount),
            "obligations": _clear(db, CustomerObligation),
            "co_applicants": _clear(db, CustomerCoApplicant),
            "loan_requirements": _clear(db, CustomerLoanRequirement),
            "document_events": _clear(db, CustomerDocumentEvent),
            "documents": _clear(db, CustomerDocument),
            "followups": _clear(db, CustomerFollowup),
            "bank_logins": _clear(db, CustomerBankLogin),
            "pipelines": _clear(db, CustomerLosPipeline),
            "pipeline_history": _clear(db, CustomerPipelineHistory),
            "lender_cases": _clear(db, CustomerLenderCase),
            "tasks": _clear(db, CustomerTask),
            "sanctions": _clear(db, CustomerSanctionDisbursal),
            "disbursals": _clear(db, CustomerDisbursal),
            "case_payouts": _clear(db, CustomerCasePayout),
            "automation": _clear(db, CustomerAutomationLog),
            "loan_cases": _clear(db, LoanCase),
            "payouts": _clear(db, PayoutRequest),
            "invoice_approvals": _clear(db, InvoiceApproval),
            "payout_adjustments": _clear(db, PayoutAdjustment),
            "partner_profiles": _clear(db, PartnerProfile),
            "partner_applications": _clear(db, PartnerApplication),
            "visiting_cards": _clear(db, VisitingCard),
            "profile_visits": _clear(db, ProfileVisit),
            "notifications": _clear(db, UserNotification),
            "certificates": _clear(db, Certificate),
            "network_links": _clear(db, NetworkLink),
            "audit": _clear(db, AuditEvent),
            "leads": _clear(db, Lead),
        }

        keep = db.query(User).filter(User.role.in_(KEEP_ROLES)).all()
        keep_ids = {user.id for user in keep}
        for user in keep:
            if user.seat_owner_id not in keep_ids:
                user.seat_owner_id = None
            if user.rm1_user_id not in keep_ids:
                user.rm1_user_id = None
            if user.rm2_user_id not in keep_ids:
                user.rm2_user_id = None
            if user.reports_to_user_id not in keep_ids:
                user.reports_to_user_id = None
        db.flush()
        removed_users = (
            db.query(User)
            .filter(~User.role.in_(KEEP_ROLES))
            .delete(synchronize_session=False)
        )

        for index, (key, name, _label, category, subtype, amount, employment, city, state) in enumerate(LEADS, start=1):
            phone = f"9000000{index:03d}"
            db.add(
                Lead(
                    applicant_name=name,
                    full_phone=phone,
                    masked_phone=_mask(phone),
                    city=city,
                    state=state,
                    loan_amount=amount,
                    employment_type=employment,
                    loan_type=subtype[:40],
                    product_category=category,
                    product_subtype=subtype,
                    status="available",
                    score="warm",
                    price=default_lead_price(category),
                    source="website",
                    utm_source="rupeedial",
                    utm_medium="check-board",
                    is_marketplace=True,
                    sale_available=True,
                    phone_verified=False,
                    website_lead_id=f"CHECK-{key}",
                    product_details={"check": True, "form": key},
                    quality_factors={},
                )
            )
        db.commit()
        print(
            "kept_logins="
            + str(len(keep_ids))
            + " removed_users="
            + str(removed_users)
            + " removed_leads="
            + str(cleared["leads"])
            + " new_leads="
            + str(len(LEADS))
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
