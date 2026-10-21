"""Customer workspace: profile, banks, obligations, co-applicants, loan requirements."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0012_customer_workspace"
down_revision: Union[str, None] = "0011_loan_cases"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _child_keys() -> list[sa.Column]:
    return [
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "customer_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", sa.String(80), nullable=True),
        sa.Column("full_name", sa.String(200), nullable=True),
        sa.Column("mobile", sa.String(15), nullable=True),
        sa.Column("alternate_mobile", sa.String(15), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("dob", sa.String(20), nullable=True),
        sa.Column("gender", sa.String(40), nullable=True),
        sa.Column("marital_status", sa.String(40), nullable=True),
        sa.Column("father_name", sa.String(200), nullable=True),
        sa.Column("mother_name", sa.String(200), nullable=True),
        sa.Column("pan", sa.String(10), nullable=True),
        sa.Column("aadhaar", sa.String(12), nullable=True),
        sa.Column("education", sa.String(80), nullable=True),
        sa.Column("residence_type", sa.String(80), nullable=True),
        sa.Column("current_address", sa.Text(), nullable=True),
        sa.Column("permanent_address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(120), nullable=True),
        sa.Column("state", sa.String(120), nullable=True),
        sa.Column("pincode", sa.String(6), nullable=True),
        sa.Column("family_members", sa.Integer(), nullable=True),
        sa.Column("employment_type", sa.String(80), nullable=True),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("business_name", sa.String(200), nullable=True),
        sa.Column("designation", sa.String(120), nullable=True),
        sa.Column("industry_type", sa.String(120), nullable=True),
        sa.Column("monthly_income", sa.Float(), nullable=True),
        sa.Column("net_salary", sa.Float(), nullable=True),
        sa.Column("annual_turnover", sa.Float(), nullable=True),
        sa.Column("work_experience", sa.String(80), nullable=True),
        sa.Column("business_vintage", sa.String(80), nullable=True),
        sa.Column("salary_mode", sa.String(40), nullable=True),
        sa.Column("gst_number", sa.String(20), nullable=True),
        sa.Column("itr_filed", sa.String(20), nullable=True),
        sa.Column("office_address", sa.Text(), nullable=True),
        sa.Column("profile_completion", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("lead_purchase_id", name="uq_customer_profiles_purchase"),
    )
    op.create_index("ix_customer_profiles_lead_id", "customer_profiles", ["lead_id"])
    op.create_index("ix_customer_profiles_dsa_id", "customer_profiles", ["dsa_id"])

    op.create_table(
        "customer_bank_accounts",
        *_child_keys(),
        sa.Column("bank_name", sa.String(200), nullable=True),
        sa.Column("account_type", sa.String(80), nullable=True),
        sa.Column("account_vintage", sa.String(80), nullable=True),
        sa.Column("average_balance", sa.Float(), nullable=True),
        sa.Column("is_salary_account", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("emi_bounce_history", sa.String(200), nullable=True),
        sa.Column("statement_available", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "customer_obligations",
        *_child_keys(),
        sa.Column("loan_type", sa.String(80), nullable=True),
        sa.Column("bank_name", sa.String(200), nullable=True),
        sa.Column("emi", sa.Float(), nullable=True),
        sa.Column("outstanding_amount", sa.Float(), nullable=True),
        sa.Column("sanction_amount", sa.Float(), nullable=True),
        sa.Column("remaining_tenure", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.String(20), nullable=True),
        sa.Column("overdue_status", sa.String(80), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "customer_co_applicants",
        *_child_keys(),
        sa.Column("relation", sa.String(80), nullable=True),
        sa.Column("full_name", sa.String(200), nullable=True),
        sa.Column("mobile", sa.String(15), nullable=True),
        sa.Column("pan", sa.String(10), nullable=True),
        sa.Column("aadhaar", sa.String(12), nullable=True),
        sa.Column("employment_type", sa.String(80), nullable=True),
        sa.Column("income", sa.Float(), nullable=True),
        sa.Column("obligations_summary", sa.String(400), nullable=True),
        sa.Column("cibil_score", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "customer_loan_requirements",
        *_child_keys(),
        sa.Column("product_type", sa.String(80), nullable=True),
        sa.Column("loan_amount", sa.Float(), nullable=True),
        sa.Column("tenure_months", sa.Integer(), nullable=True),
        sa.Column("purpose", sa.String(200), nullable=True),
        sa.Column("property_value", sa.Float(), nullable=True),
        sa.Column("has_existing_loan", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("balance_transfer", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("top_up_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("insurance_type", sa.String(80), nullable=True),
        sa.Column("roi_percent", sa.Float(), nullable=True),
        sa.Column("extra_fields", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    for table in (
        "customer_bank_accounts",
        "customer_obligations",
        "customer_co_applicants",
        "customer_loan_requirements",
    ):
        op.create_index(f"ix_{table}_profile", table, ["customer_profile_id"])
        op.create_index(f"ix_{table}_purchase", table, ["lead_purchase_id"])


def downgrade() -> None:
    for table in (
        "customer_loan_requirements",
        "customer_co_applicants",
        "customer_obligations",
        "customer_bank_accounts",
    ):
        op.drop_index(f"ix_{table}_purchase", table_name=table)
        op.drop_index(f"ix_{table}_profile", table_name=table)
        op.drop_table(table)
    op.drop_index("ix_customer_profiles_dsa_id", table_name="customer_profiles")
    op.drop_index("ix_customer_profiles_lead_id", table_name="customer_profiles")
    op.drop_table("customer_profiles")
