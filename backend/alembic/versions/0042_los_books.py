"""Lenders, a second bank application, schemes, ledger notes, import rollback, and decimal money."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0042_los_books"
down_revision: Union[str, None] = "0041_case_bonus"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MONEY = ("loan_amount", "sanctioned_amount", "loyalty_amount", "invoice_amount", "collected_amount", "bonus_amount")


def upgrade() -> None:
    op.add_column("loan_cases", sa.Column("lender_status", sa.String(40), nullable=False, server_default=""))
    op.add_column("loan_cases", sa.Column("paper_history", JSONB, nullable=False, server_default="[]"))
    for name in MONEY:
        op.alter_column("loan_cases", name, type_=sa.Numeric(14, 2), postgresql_using=f"{name}::numeric(14,2)")
    for name in ("amount", "gst_amount", "tds_amount", "net_payable", "paid_amount"):
        op.alter_column("payout_requests", name, type_=sa.Numeric(14, 2), postgresql_using=f"{name}::numeric(14,2)")
    op.create_table(
        "lenders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("code", sa.String(40), nullable=False, unique=True),
        sa.Column("lender_type", sa.String(20), nullable=False, server_default="bank"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("gst_treatment", sa.String(20), nullable=False, server_default="exclusive"),
    )
    op.create_table(
        "lender_branches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lender_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("city", sa.String(80), nullable=False, server_default=""),
    )
    op.create_table(
        "case_applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("loan_case_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("lender_id", UUID(as_uuid=True), nullable=True),
        sa.Column("branch_name", sa.String(160), nullable=False, server_default=""),
        sa.Column("application_no", sa.String(80), nullable=False, server_default=""),
        sa.Column("lan", sa.String(80), nullable=False, server_default=""),
        sa.Column("lender_status", sa.String(40), nullable=False, server_default=""),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
    )
    op.create_table(
        "lender_schemes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lender_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("bonus_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("partner_percent", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "ledger_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("loan_case_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("note", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "import_batches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("filename", sa.String(180), nullable=False, server_default=""),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="applied"),
        sa.Column("snapshot", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("import_batches")
    op.drop_table("ledger_notes")
    op.drop_table("lender_schemes")
    op.drop_table("case_applications")
    op.drop_table("lender_branches")
    op.drop_table("lenders")
    op.drop_column("loan_cases", "paper_history")
    op.drop_column("loan_cases", "lender_status")
