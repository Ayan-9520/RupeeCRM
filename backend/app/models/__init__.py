import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False, default="admin")
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    dsa_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Phase 2 — subscription
    plan_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    plan_cycle: Mapped[str | None] = mapped_column(String(20), nullable=True)
    plan_status: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    plan_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    plan_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    wallet_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    monthly_target_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    joining_credit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    seat_owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    payout_bank: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    kyc_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    finance_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    rm1_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    rm2_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    sales_grade: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    reports_to_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    applicant_name: Mapped[str] = mapped_column(String(200), nullable=False)
    full_phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    masked_phone: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    loan_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    monthly_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    loan_type: Mapped[str] = mapped_column(String(40), nullable=False, default="personal")
    product_category: Mapped[str] = mapped_column(String(40), nullable=False, default="loan")
    product_subtype: Mapped[str | None] = mapped_column(String(80), nullable=True)
    product_type_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="available", index=True)
    score: Mapped[str] = mapped_column(String(20), nullable=False, default="cold")
    price: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    source: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    utm_source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(120), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_marketplace: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sale_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fraud_risk: Mapped[str] = mapped_column(String(40), nullable=False, default="low")
    workspace_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    quality_factors: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    website_lead_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def lead_grade(self) -> str:
        from app.services.lead_grades import grade_code

        return grade_code(self)

    @property
    def listing_type(self) -> str:
        from app.services.lead_grades import listing_type

        return listing_type(self)


DEFAULT_PIPELINE_STAGES = [
    "new",
    "contacted",
    "docs_collected",
    "bank_submitted",
    "sanctioned",
    "disbursed",
    "rejected",
]


class LeadPurchase(Base):
    __tablename__ = "lead_purchases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    buyer_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    price_paid: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    pipeline_stage: Mapped[str] = mapped_column(String(60), nullable=False, default="new", index=True)
    notes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    next_followup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deal_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


PARTNER_STATUSES = ("pending", "under_review", "approved", "rejected")


class PartnerApplication(Base):
    """Website partner apply → CRM review → DSA login."""

    __tablename__ = "partner_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    website_lead_id: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    ref_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    dsa_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending", index=True)
    generated_dsa_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    documents: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

class PartnerProfile(Base):
    """Public firm profile — Growth+ published; Pro can be directory_featured."""

    __tablename__ = "partner_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    firm_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    tagline: Mapped[str | None] = mapped_column(String(240), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    products: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    theme: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    directory_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class VisitingCard(Base):
    """Digital visiting card per seat user."""

    __tablename__ = "visiting_cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(30), nullable=True)
    website: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    products: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    theme: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    qr_target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

class ProfileVisit(Base):
    """One counted open of a public partner profile. Refreshes in the same session do not add another row."""

    __tablename__ = "profile_visits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    partner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    session_key: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class PayoutRequest(Base):
    """Partner bank payout request — manual admin settle (no RazorpayX yet)."""

    __tablename__ = "payout_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending", index=True)
    bank_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    utr: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stage: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    queried_stage: Mapped[str | None] = mapped_column(String(30), nullable=True)
    gst_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    tds_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_payable: Mapped[float | None] = mapped_column(Float, nullable=True)
    payment_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_bank: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InvoiceApproval(Base):
    __tablename__ = "invoice_approvals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(30), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    """Append-only trust audit trail (Phase 7)."""

    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class CommissionSettings(Base):
    """Admin payout percent on disbursed cases. Default 1 until changed."""

    __tablename__ = "commission_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rate_percent: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    gst_percent: Mapped[float] = mapped_column(Float, nullable=False, default=18)
    tds_percent: Mapped[float] = mapped_column(Float, nullable=False, default=2)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PayoutGrid(Base):
    """Approved lender rate for a product from a date. Does not rewrite old cases."""

    __tablename__ = "payout_grids"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    product: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    receivable_percent: Mapped[float] = mapped_column(Float, nullable=False)
    payable_percent: Mapped[float] = mapped_column(Float, nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PayoutAdjustment(Base):
    """Case-only change. The grid stays as approved."""

    __tablename__ = "payout_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    deal_no: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(30), nullable=False, default="subvention")
    subvention_points: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    other_points: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    payable_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    before_receivable: Mapped[float | None] = mapped_column(Float, nullable=True)
    before_payable: Mapped[float | None] = mapped_column(Float, nullable=True)
    after_receivable: Mapped[float | None] = mapped_column(Float, nullable=True)
    after_payable: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NetworkSettings(Base):
    """Admin-editable network levels and revenue share. Not hardcoded in payouts."""

    __tablename__ = "network_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    levels: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LoanCase(Base):
    """Closure file. Bank commission in, connector payout out, company net left."""

    __tablename__ = "loan_cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_no: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(40), nullable=False, default="draft", index=True)
    flag: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    loan_type: Mapped[str] = mapped_column(String(40), nullable=False, default="LAP")
    lead_source: Mapped[str] = mapped_column(String(40), nullable=False, default="Connector")
    partner_code: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    partner_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    partner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    client_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    client_phone: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    project_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    expected_sanction_on: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    client_access: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    loan_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    sanctioned_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    receivable_percent: Mapped[float] = mapped_column(Float, nullable=False, default=1.4)
    payable_percent: Mapped[float] = mapped_column(Float, nullable=False, default=90)
    loyalty_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    loyalty_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    bank_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    bank_rm: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    bank_rm_phone: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    submitted_by: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    pod_pending: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pod_remarks: Mapped[str] = mapped_column(Text, nullable=False, default="")
    counted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    invoice_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    collected_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    payout_status: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    payout_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    lead_purchase_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, unique=True)
    case_no: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerProfile(Base):
    """One customer file per purchased lead. Owner is the purchase buyer, not the caller."""

    __tablename__ = "customer_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    workspace_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(15), nullable=True)
    alternate_mobile: Mapped[str | None] = mapped_column(String(15), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dob: Mapped[str | None] = mapped_column(String(20), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(40), nullable=True)
    marital_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    father_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mother_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    aadhaar: Mapped[str | None] = mapped_column(String(12), nullable=True)
    education: Mapped[str | None] = mapped_column(String(80), nullable=True)
    residence_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    current_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    permanent_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(6), nullable=True)
    family_members: Mapped[int | None] = mapped_column(Integer, nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    business_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    industry_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    monthly_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_salary: Mapped[float | None] = mapped_column(Float, nullable=True)
    annual_turnover: Mapped[float | None] = mapped_column(Float, nullable=True)
    work_experience: Mapped[str | None] = mapped_column(String(80), nullable=True)
    business_vintage: Mapped[str | None] = mapped_column(String(80), nullable=True)
    salary_mode: Mapped[str | None] = mapped_column(String(40), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    itr_filed: Mapped[str | None] = mapped_column(String(20), nullable=True)
    office_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_completion: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerBankAccount(Base):
    __tablename__ = "customer_bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    bank_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    account_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    account_vintage: Mapped[str | None] = mapped_column(String(80), nullable=True)
    average_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_salary_account: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    emi_bounce_history: Mapped[str | None] = mapped_column(String(200), nullable=True)
    statement_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CustomerObligation(Base):
    __tablename__ = "customer_obligations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    loan_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emi: Mapped[float | None] = mapped_column(Float, nullable=True)
    outstanding_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    sanction_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    remaining_tenure: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    overdue_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CustomerCoApplicant(Base):
    __tablename__ = "customer_co_applicants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    relation: Mapped[str | None] = mapped_column(String(80), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(15), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    aadhaar: Mapped[str | None] = mapped_column(String(12), nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    income: Mapped[float | None] = mapped_column(Float, nullable=True)
    obligations_summary: Mapped[str | None] = mapped_column(String(400), nullable=True)
    cibil_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CustomerLoanRequirement(Base):
    __tablename__ = "customer_loan_requirements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    product_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    loan_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    tenure_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    purpose: Mapped[str | None] = mapped_column(String(200), nullable=True)
    property_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    has_existing_loan: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    balance_transfer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    top_up_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    insurance_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    roi_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    extra_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CustomerDocument(Base):
    """One catalog slot per purchase. File bytes live on disk, not in this row."""

    __tablename__ = "customer_documents"
    __table_args__ = (UniqueConstraint("lead_purchase_id", "doc_slug", name="uq_customer_documents_purchase_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    doc_slug: Mapped[str] = mapped_column(String(80), nullable=False)
    doc_label: Mapped[str] = mapped_column(String(120), nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(240), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending")
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerDocumentEvent(Base):
    """History of uploads, status changes, and file removals."""

    __tablename__ = "customer_document_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CustomerFollowup(Base):
    """Follow-up history. The purchase's next_followup_at remains the single scheduled time."""

    __tablename__ = "customer_followups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    note_type: Mapped[str] = mapped_column(String(40), nullable=False, default="other")
    followup_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    followup_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    discussion_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(200), nullable=True)
    next_action: Mapped[str | None] = mapped_column(String(200), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerBankLogin(Base):
    """Lender login tracking. This is not a bank credential store."""

    __tablename__ = "customer_bank_logins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    bank_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    product: Mapped[str | None] = mapped_column(String(120), nullable=True)
    login_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    login_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    tenure_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    banker_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    banker_mobile: Mapped[str | None] = mapped_column(String(10), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(120), nullable=True)
    login_status: Mapped[str] = mapped_column(String(40), nullable=False, default="draft")
    sanction_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    approved_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_fees: Mapped[float | None] = mapped_column(Float, nullable=True)
    disbursal_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    expected_disbursal_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerLosPipeline(Base):
    """One LOS stage record per purchase. Distinct from the lead-board pipeline."""

    __tablename__ = "customer_los_pipelines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    current_stage: Mapped[str] = mapped_column(String(40), nullable=False, default="lead_purchased")
    case_owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    assigned_rm_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    assigned_dsa_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    banker_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    banker_mobile: Mapped[str | None] = mapped_column(String(10), nullable=True)
    banker_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    sla_target_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_stage_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_stage_changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerPipelineHistory(Base):
    __tablename__ = "customer_pipeline_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    from_stage: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_stage: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CustomerLenderCase(Base):
    """A lender the case was sent to. Separate from bank-login tracking rows."""

    __tablename__ = "customer_lender_cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lender_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(120), nullable=True)
    banker_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    banker_mobile: Mapped[str | None] = mapped_column(String(10), nullable=True)
    banker_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    login_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    login_status: Mapped[str] = mapped_column(String(40), nullable=False, default="draft")
    sanctioned_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi: Mapped[float | None] = mapped_column(Float, nullable=True)
    tenure: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processing_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    insurance_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    disbursed_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_expected: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_received: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_best_offer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerTask(Base):
    __tablename__ = "customer_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[str] = mapped_column(String(40), nullable=False, default="general")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    comments: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerSanctionDisbursal(Base):
    """Explicit sanction figures. Saving this row does not approve the loan by itself."""

    __tablename__ = "customer_sanction_disbursals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    lender_case_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    sanction_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_roi: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_tenure: Mapped[int | None] = mapped_column(Integer, nullable=True)
    emi: Mapped[float | None] = mapped_column(Float, nullable=True)
    processing_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    insurance_deduction: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_disbursal: Mapped[float | None] = mapped_column(Float, nullable=True)
    disbursal_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    utr_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    bank_account_credited: Mapped[str | None] = mapped_column(String(40), nullable=True)
    payout_expected: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_received: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerDisbursal(Base):
    """A recorded disbursal. Net, EMI, and payout pending are calculated, not typed as rules."""

    __tablename__ = "customer_disbursals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lender_case_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    disbursal_status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending")
    sanctioned_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    disbursed_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_disbursal: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi: Mapped[float | None] = mapped_column(Float, nullable=True)
    tenure: Mapped[int | None] = mapped_column(Integer, nullable=True)
    emi: Mapped[float | None] = mapped_column(Float, nullable=True)
    processing_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    insurance_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    deductions: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_expected: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_received: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_pending: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    disbursal_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    utr_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    credited_bank_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    credited_account_number: Mapped[str | None] = mapped_column(String(18), nullable=True)
    credited_ifsc: Mapped[str | None] = mapped_column(String(11), nullable=True)
    first_emi_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    disbursal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerCasePayout(Base):
    """Case commission/incentive ledger. Separate from partner payout requests."""

    __tablename__ = "customer_case_payouts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    lender_case_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payout_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    payout_type: Mapped[str] = mapped_column(String(20), nullable=False, default="commission")
    payout_status: Mapped[str] = mapped_column(String(20), nullable=False, default="expected")
    expected_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    received_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    payout_reference: Mapped[str | None] = mapped_column(String(80), nullable=True)
    payout_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CommunityPost(Base):
    """One public community note. No customer phone numbers."""

    __tablename__ = "community_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_name: Mapped[str] = mapped_column(String(80), nullable=False)
    author_role: Mapped[str] = mapped_column(String(40), nullable=False, default="partner")
    topic: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class CommunityPostLike(Base):
    """One like from a logged-in user. A person can like a post only once."""

    __tablename__ = "community_post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_community_post_like"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserNotification(Base):
    """In-app notice for one user. Not a substitute for email or SMS."""

    __tablename__ = "user_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(String(500), nullable=True)
    link: Mapped[str | None] = mapped_column(String(200), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CustomerAutomationLog(Base):
    """A run of one of the built-in case rules. Rules themselves stay in application code."""

    __tablename__ = "customer_automation_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_purchase_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    dsa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    rule_key: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(String(300), nullable=False)
    task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Certificate(Base):
    """Academy certificate issued once per user and course on a passing quiz score."""

    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    course_slug: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    course_title: Mapped[str] = mapped_column(String(160), nullable=False)
    badge: Mapped[str] = mapped_column(String(80), nullable=False)
    score_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    certificate_no: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NetworkLink(Base):
    __tablename__ = "network_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    child_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    invite_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    invite_phone: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    invite_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    invite_code: Mapped[str] = mapped_column(String(40), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="invited", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AutomationRulePref(Base):
    """Whether one user has a built-in case rule turned on. Missing row means on."""

    __tablename__ = "automation_rule_prefs"
    __table_args__ = (UniqueConstraint("user_id", "rule_key", name="uq_automation_rule_pref"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    rule_key: Mapped[str] = mapped_column(String(60), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
