"""Lender payout grids and case-only adjustments. Existing cases are not rewritten."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0020_payout_grids"
down_revision: Union[str, None] = "0019_invoice_approvals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payout_grids",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("channel_name", sa.String(160), nullable=False),
        sa.Column("product", sa.String(80), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("receivable_percent", sa.Float(), nullable=False),
        sa.Column("payable_percent", sa.Float(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_payout_grids_channel_name", "payout_grids", ["channel_name"])
    op.create_index("ix_payout_grids_product", "payout_grids", ["product"])
    op.create_index("ix_payout_grids_effective_from", "payout_grids", ["effective_from"])
    op.create_index("ix_payout_grids_status", "payout_grids", ["status"])

    op.create_table(
        "payout_adjustments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("loan_case_id", UUID(as_uuid=True), nullable=False),
        sa.Column("deal_no", sa.String(40), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False, server_default="subvention"),
        sa.Column("subvention_points", sa.Float(), nullable=False, server_default="0"),
        sa.Column("other_points", sa.Float(), nullable=False, server_default="0"),
        sa.Column("payable_percent", sa.Float(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("before_receivable", sa.Float(), nullable=True),
        sa.Column("before_payable", sa.Float(), nullable=True),
        sa.Column("after_receivable", sa.Float(), nullable=True),
        sa.Column("after_payable", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_payout_adjustments_loan_case_id", "payout_adjustments", ["loan_case_id"])
    op.create_index("ix_payout_adjustments_deal_no", "payout_adjustments", ["deal_no"])
    op.create_index("ix_payout_adjustments_status", "payout_adjustments", ["status"])


def downgrade() -> None:
    op.drop_table("payout_adjustments")
    op.drop_table("payout_grids")
