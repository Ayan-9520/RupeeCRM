"""Loan closure files: receivable, connector payable, and net revenue."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0011_loan_cases"
down_revision: Union[str, None] = "0010_certificates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "loan_cases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("deal_no", sa.String(40), nullable=False, unique=True),
        sa.Column("stage", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("flag", sa.String(40), nullable=False, server_default=""),
        sa.Column("loan_type", sa.String(40), nullable=False, server_default="LAP"),
        sa.Column("lead_source", sa.String(40), nullable=False, server_default="Connector"),
        sa.Column("partner_code", sa.String(40), nullable=False, server_default=""),
        sa.Column("partner_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("partner_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("client_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("client_phone", sa.String(30), nullable=False, server_default=""),
        sa.Column("project_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("expected_sanction_on", sa.String(20), nullable=False, server_default=""),
        sa.Column("client_access", sa.String(80), nullable=False, server_default=""),
        sa.Column("loan_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sanctioned_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("receivable_percent", sa.Float(), nullable=False, server_default="1.4"),
        sa.Column("payable_percent", sa.Float(), nullable=False, server_default="90"),
        sa.Column("loyalty_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("loyalty_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("bank_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("bank_rm", sa.String(120), nullable=False, server_default=""),
        sa.Column("bank_rm_phone", sa.String(30), nullable=False, server_default=""),
        sa.Column("submitted_by", sa.String(120), nullable=False, server_default=""),
        sa.Column("pod_pending", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pod_remarks", sa.Text(), nullable=False, server_default=""),
        sa.Column("counted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("invoice_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("collected_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("payout_status", sa.String(20), nullable=False, server_default="none"),
        sa.Column("payout_note", sa.Text(), nullable=False, server_default=""),
        sa.Column("owner_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_loan_cases_stage", "loan_cases", ["stage"])
    op.create_index("ix_loan_cases_partner_user_id", "loan_cases", ["partner_user_id"])
    op.create_index("ix_loan_cases_owner_user_id", "loan_cases", ["owner_user_id"])


def downgrade() -> None:
    op.drop_index("ix_loan_cases_owner_user_id", table_name="loan_cases")
    op.drop_index("ix_loan_cases_partner_user_id", table_name="loan_cases")
    op.drop_index("ix_loan_cases_stage", table_name="loan_cases")
    op.drop_table("loan_cases")
