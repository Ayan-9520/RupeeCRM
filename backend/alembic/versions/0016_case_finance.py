"""Case disbursals and the case payout ledger. Not partner payout requests."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0016_case_finance"
down_revision: Union[str, None] = "0015_los_pipeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_disbursals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lender_case_id", UUID(as_uuid=True), nullable=True),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("disbursal_status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("sanctioned_amount", sa.Float(), nullable=True),
        sa.Column("disbursed_amount", sa.Float(), nullable=True),
        sa.Column("net_disbursal", sa.Float(), nullable=True),
        sa.Column("roi", sa.Float(), nullable=True),
        sa.Column("tenure", sa.Integer(), nullable=True),
        sa.Column("emi", sa.Float(), nullable=True),
        sa.Column("processing_fee", sa.Float(), nullable=True),
        sa.Column("insurance_amount", sa.Float(), nullable=True),
        sa.Column("deductions", sa.Float(), nullable=True),
        sa.Column("payout_expected", sa.Float(), nullable=True),
        sa.Column("payout_received", sa.Float(), nullable=True),
        sa.Column("payout_pending", sa.Float(), nullable=True),
        sa.Column("payout_status", sa.String(20), nullable=True),
        sa.Column("disbursal_date", sa.String(10), nullable=True),
        sa.Column("utr_number", sa.String(80), nullable=True),
        sa.Column("credited_bank_name", sa.String(120), nullable=True),
        sa.Column("credited_account_number", sa.String(18), nullable=True),
        sa.Column("credited_ifsc", sa.String(11), nullable=True),
        sa.Column("first_emi_date", sa.String(10), nullable=True),
        sa.Column("disbursal_notes", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_disbursals_purchase", "customer_disbursals", ["lead_purchase_id"])
    op.create_index("ix_customer_disbursals_profile", "customer_disbursals", ["customer_profile_id"])
    op.create_index("ix_customer_disbursals_dsa", "customer_disbursals", ["dsa_id"])

    op.create_table(
        "customer_case_payouts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lender_case_id", UUID(as_uuid=True), nullable=True),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("payout_amount", sa.Float(), nullable=True),
        sa.Column("payout_type", sa.String(20), nullable=False, server_default="commission"),
        sa.Column("payout_status", sa.String(20), nullable=False, server_default="expected"),
        sa.Column("expected_date", sa.String(10), nullable=True),
        sa.Column("received_date", sa.String(10), nullable=True),
        sa.Column("payout_reference", sa.String(80), nullable=True),
        sa.Column("payout_notes", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_case_payouts_purchase", "customer_case_payouts", ["lead_purchase_id"])
    op.create_index("ix_customer_case_payouts_profile", "customer_case_payouts", ["customer_profile_id"])
    op.create_index("ix_customer_case_payouts_dsa", "customer_case_payouts", ["dsa_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_case_payouts_dsa", table_name="customer_case_payouts")
    op.drop_index("ix_customer_case_payouts_profile", table_name="customer_case_payouts")
    op.drop_index("ix_customer_case_payouts_purchase", table_name="customer_case_payouts")
    op.drop_table("customer_case_payouts")
    op.drop_index("ix_customer_disbursals_dsa", table_name="customer_disbursals")
    op.drop_index("ix_customer_disbursals_profile", table_name="customer_disbursals")
    op.drop_index("ix_customer_disbursals_purchase", table_name="customer_disbursals")
    op.drop_table("customer_disbursals")
