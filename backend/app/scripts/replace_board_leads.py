"""Replace unsold marketplace leads with one filled lead per RupeeDial product.

Bought leads and case files stay. Partners and payouts stay.
"""

from __future__ import annotations

from app.db.session import SessionLocal
from app.models import Lead, LeadPurchase
from app.plans import default_lead_price

# key, name, category, subtype, loan_type, amount, income, employment, company, city, state, property, purpose
LEADS = [
    ("personal-loan", "Rohit Mehra", "loan", "loan_personal", "personal", 450000, 62000, "salaried", "Infosys", "Pune", "Maharashtra", "No collateral", "Medical"),
    ("home-loan", "Neha Kapoor", "loan", "home_loan", "home", 6500000, 145000, "salaried", "TCS", "Noida", "Uttar Pradesh", "Residential", "Ready flat"),
    ("lap-loan", "Suresh Iyer", "loan", "loan_lap", "lap", 2800000, 180000, "self-employed", "Iyer Traders", "Chennai", "Tamil Nadu", "Residential", "Business use"),
    ("auto-loan", "Pooja Nair", "loan", "loan_auto_new", "auto", 850000, 54000, "salaried", "Wipro", "Kochi", "Kerala", "New car", "Hyundai Creta"),
    ("education-loan", "Aditya Rao", "loan", "education_loan", "education", 1800000, 90000, "salaried", "Parent salaried", "Hyderabad", "Telangana", "No collateral", "MS abroad"),
    ("msme-loan", "Imran Qureshi", "loan", "loan_msme", "msme", 1500000, 210000, "business-owner", "Qureshi Garments", "Surat", "Gujarat", "Shop", "Stock"),
    ("mudra-loan", "Kavita Patil", "loan", "loan_mudra", "mudra", 800000, 70000, "business-owner", "Patil Foods", "Nashik", "Maharashtra", "Shop", "Kishore"),
    ("machinery-loan", "Harpreet Singh", "loan", "machinery_loan", "machinery", 3200000, 250000, "business-owner", "Singh Engineering", "Ludhiana", "Punjab", "Plant", "CNC machine"),
    ("business-loan", "Anjali Deshmukh", "loan", "business-loan", "business", 2000000, 160000, "business-owner", "Deshmukh Distributors", "Nagpur", "Maharashtra", "No collateral", "Working capital"),
    ("startup-business-loan", "Vikram Shah", "loan", "business-loan", "startup", 2500000, 0, "business-owner", "Shah Labs Pvt Ltd", "Ahmedabad", "Gujarat", "No collateral", "Seed capital"),
    ("working-capital-loan", "Meera Joshi", "loan", "loan_msme", "working-capital", 1200000, 190000, "business-owner", "Joshi Prints", "Jaipur", "Rajasthan", "Stock", "Receivables"),
    ("cgtmse-loan", "Arjun Reddy", "loan", "loan_msme", "cgtmse", 1800000, 140000, "business-owner", "Reddy Packaging", "Vijayawada", "Andhra Pradesh", "No collateral", "CGTMSE"),
    ("pmegp-loan", "Fatima Sheikh", "loan", "loan_msme", "pmegp", 1500000, 45000, "business-owner", "Sheikh Tailors", "Bhopal", "Madhya Pradesh", "Shop", "PMEGP"),
    ("standup-india", "Divya Kumari", "loan", "loan_msme", "standup", 2200000, 80000, "business-owner", "Kumari Handloom", "Ranchi", "Jharkhand", "Unit", "Stand-Up India"),
    ("subsidy-linked-msme", "Nitin Agarwal", "loan", "loan_msme", "subsidy", 3500000, 220000, "business-owner", "Agarwal Components", "Indore", "Madhya Pradesh", "Factory", "Subsidy project"),
    ("export-finance", "Rahul Banerjee", "loan", "business-loan", "export", 5000000, 400000, "business-owner", "Banerjee Exports", "Kolkata", "West Bengal", "Stock", "Export order"),
    ("import-finance", "Sanjay Kulkarni", "loan", "business-loan", "import", 4000000, 320000, "business-owner", "Kulkarni Imports", "Mumbai", "Maharashtra", "Stock", "Import LC"),
    ("lc-bg", "Priya Menon", "loan", "business-loan", "lc-bg", 2500000, 280000, "business-owner", "Menon Contracts", "Bengaluru", "Karnataka", "Contract", "Bank guarantee"),
    ("invoice-financing", "Amit Verma", "loan", "business-loan", "invoice", 900000, 150000, "business-owner", "Verma Supplies", "Lucknow", "Uttar Pradesh", "Invoices", "30 day bills"),
    ("cash-credit", "Rakesh Gupta", "loan", "business-loan", "cash-credit", 3000000, 260000, "business-owner", "Gupta Traders", "Delhi", "Delhi", "Stock", "CC limit"),
    ("overdraft", "Shalini Bose", "loan", "business-loan", "overdraft", 1000000, 120000, "salaried", "HDFC Bank staff", "Kolkata", "West Bengal", "No collateral", "OD limit"),
    ("credit-cards", "Kunal Saxena", "credit_card", "credit_card", "credit_card", 200000, 75000, "salaried", "Amazon", "Gurugram", "Haryana", "No collateral", "Card limit"),
    ("insurance", "Lakshmi Narayan", "insurance", "insurance", "insurance", 1000000, 48000, "salaried", "Self", "Coimbatore", "Tamil Nadu", "Family floater", "Health cover"),
]


def _mask(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    return f"{digits[:2]}XXXXXX{digits[-2:]}"


def main() -> None:
    db = SessionLocal()
    try:
        protected = {row[0] for row in db.query(LeadPurchase.lead_id).distinct()}
        query = db.query(Lead).filter(Lead.is_marketplace.is_(True))
        if protected:
            query = query.filter(~Lead.id.in_(protected))
        removed = query.delete(synchronize_session=False)
        added = 0
        for index, row in enumerate(LEADS, start=1):
            key, name, category, subtype, loan_type, amount, income, employment, company, city, state, property, purpose = row
            phone = f"98120{index:05d}"
            db.add(
                Lead(
                    applicant_name=name,
                    full_phone=phone,
                    masked_phone=_mask(phone),
                    email=f"{name.split()[0].lower()}.{key.split('-')[0]}@mail.test",
                    city=city,
                    state=state,
                    loan_amount=amount,
                    monthly_income=income or None,
                    employment_type=employment,
                    company_name=company,
                    loan_type=loan_type[:40],
                    product_category=category,
                    product_subtype=subtype,
                    status="available",
                    score="hot" if index % 3 == 0 else "warm",
                    price=default_lead_price(category),
                    source="website",
                    utm_source="rupeedial",
                    utm_medium="product-page",
                    utm_campaign=key,
                    is_marketplace=True,
                    sale_available=True,
                    phone_verified=True,
                    fraud_risk="low",
                    website_lead_id=f"BOARD-{key}",
                    product_details={
                        "product": key,
                        "purpose": purpose,
                        "property_type": property,
                        "cibil_band": "750+" if index % 2 == 0 else "700-749",
                        "existing_emi": 0 if index % 4 else 8500,
                        "tenure_months": 60 if amount < 2000000 else 180,
                    },
                    quality_factors={"phone": True, "income": bool(income), "city": True},
                    quality_score=78 if income else 64,
                )
            )
            added += 1
        db.commit()
        print(f"removed_unsold={removed} added={added} kept_bought_or_cased={len(protected)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
