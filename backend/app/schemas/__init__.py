from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    email: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: str
    phone: str | None = None
    dsa_id: str | None = None
    is_active: bool = True
    kyc_verified: bool = False

    model_config = {"from_attributes": True}


class UserUpdateIn(BaseModel):
    full_name: str | None = None
    phone: str | None = None


class LeadOut(BaseModel):
    id: UUID
    applicant_name: str
    full_phone: str
    masked_phone: str
    email: str | None = None
    city: str
    state: str | None = None
    loan_amount: float
    monthly_income: float | None = None
    employment_type: str | None = None
    company_name: str | None = None
    loan_type: str
    product_category: str
    product_subtype: str | None = None
    product_type_id: str | None = None
    status: str
    score: str
    price: float
    source: str | None = None
    utm_source: str | None = None
    is_marketplace: bool
    sale_available: bool
    phone_verified: bool
    product_details: dict[str, Any] = Field(default_factory=dict)
    quality_score: int | None = None
    lead_grade: str = "L0"
    listing_type: str = "shared"
    website_lead_id: str | None = None
    raw_payload: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadCreate(BaseModel):
    applicant_name: str
    full_phone: str
    city: str = ""
    email: str | None = None
    loan_amount: float = 0
    monthly_income: float | None = None
    employment_type: str | None = None
    company_name: str | None = None
    product_category: str = "loan"
    product_subtype: str | None = None
    loan_type: str = "personal"
    source: str | None = "manual"
    score: str = "cold"
    price: float = 0
    is_marketplace: bool = True
    sale_available: bool = True
    product_details: dict[str, Any] = Field(default_factory=dict)


class LeadListOut(BaseModel):
    items: list[LeadOut]
    total: int


class PublicLeadIn(BaseModel):
    """Accepts the PHP website payload shape as-is (extra fields allowed)."""

    model_config = {"extra": "allow"}

    applicant_name: str | None = None
    full_phone: str | None = None
    masked_phone: str | None = None
    email: str | None = None
    city: str | None = None
    state: str | None = None
    loan_amount: float | int | None = None
    monthly_income: float | int | None = None
    employment_type: str | None = None
    company_name: str | None = None
    loan_type: str | None = None
    product_category: str | None = None
    product_subtype: str | None = None
    product_type_id: str | None = None
    status: str | None = None
    score: str | None = None
    price: float | int | None = None
    source: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    is_marketplace: bool | None = None
    sale_available: bool | None = None
    workspace_id: str | None = None
    phone_verified: bool | None = None
    product_details: dict[str, Any] | None = None
    documents: Any = None
    banks: Any = None
    primary_bank: Any = None
    interest_rate: Any = None
    emi: Any = None


class PublicLeadOut(BaseModel):
    success: bool = True
    id: UUID
    message: str = "Lead saved to CRM"
    referred: bool = False


class PublicPartnerIn(BaseModel):
    model_config = {"extra": "allow"}

    website_lead_id: str | None = None
    lead_id: str | None = None  # PHP alias
    ref_code: str | None = None
    dsa_type: str | None = None
    full_name: str | None = None
    phone: str | None = None
    mobile: str | None = None  # PHP alias
    email: str | None = None
    city: str | None = None
    state: str | None = None
    documents: dict[str, Any] | list[Any] | None = None
    status: str | None = None


class PublicPartnerOut(BaseModel):
    success: bool = True
    id: UUID
    website_lead_id: str
    message: str = "Partner application saved to CRM"


class PartnerOut(BaseModel):
    id: UUID
    website_lead_id: str
    ref_code: str | None = None
    dsa_type: str | None = None
    full_name: str
    phone: str
    email: str
    city: str
    state: str | None = None
    status: str
    generated_dsa_id: str | None = None
    rejection_reason: str | None = None
    internal_notes: str | None = None
    documents: dict[str, Any] = Field(default_factory=dict)
    user_id: UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PartnerListOut(BaseModel):
    items: list[PartnerOut]
    total: int


class PartnerApproveIn(BaseModel):
    notes: str | None = None


class PartnerRejectIn(BaseModel):
    reason: str = Field(min_length=5)


class PartnerApproveOut(BaseModel):
    success: bool = True
    dsa_id: str
    application_id: UUID
    user_id: UUID
    email: str
    temporary_password: str
    message: str = "Partner approved — DSA can login to CRM"
