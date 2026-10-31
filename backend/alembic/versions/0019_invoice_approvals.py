"""Partner invoice approval chain: RM1 -> RM2 -> Manager -> Business Head -> Accounts, with GST/TDS and payment details."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0019_invoice_approvals"
down_revision: Union[str, None] = "0018_case_numbers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("finance_level", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("rm1_user_id", PG_UUID(as_uuid=True), nullable=True))
    op.add_column("users", sa.Column("rm2_user_id", PG_UUID(as_uuid=True), nullable=True))

    op.add_column("commission_settings", sa.Column("gst_percent", sa.Float(), nullable=False, server_default="18"))
    op.add_column("commission_settings", sa.Column("tds_percent", sa.Float(), nullable=False, server_default="2"))

    op.add_column("payout_requests", sa.Column("stage", sa.String(30), nullable=True))
    op.add_column("payout_requests", sa.Column("queried_stage", sa.String(30), nullable=True))
    op.add_column("payout_requests", sa.Column("gst_amount", sa.Float(), nullable=True))
    op.add_column("payout_requests", sa.Column("tds_amount", sa.Float(), nullable=True))
    op.add_column("payout_requests", sa.Column("net_payable", sa.Float(), nullable=True))
    op.add_column("payout_requests", sa.Column("payment_mode", sa.String(20), nullable=True))
    op.add_column("payout_requests", sa.Column("payment_bank", sa.String(120), nullable=True))
    op.add_column("payout_requests", sa.Column("payment_date", sa.Date(), nullable=True))
    op.add_column("payout_requests", sa.Column("paid_amount", sa.Float(), nullable=True))
    op.create_index("ix_payout_requests_stage", "payout_requests", ["stage"])

    op.create_table(
        "invoice_approvals",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
        sa.Column("request_id", PG_UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("stage", sa.String(30), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("actor_user_id", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("actor_name", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.execute(
        """
        UPDATE payout_requests SET stage = CASE status
            WHEN 'pending' THEN 'rm1'
            WHEN 'approved' THEN 'accounts'
            WHEN 'processing' THEN 'accounts'
            WHEN 'query' THEN 'query'
            WHEN 'paid' THEN 'paid'
            WHEN 'rejected' THEN 'rejected'
        END,
        queried_stage = CASE WHEN status = 'query' THEN 'rm1' END,
        net_payable = amount
        WHERE bank_snapshot ? 'invoice_number'
        """
    )


def downgrade() -> None:
    op.drop_table("invoice_approvals")
    op.drop_index("ix_payout_requests_stage", table_name="payout_requests")
    for col in (
        "paid_amount",
        "payment_date",
        "payment_bank",
        "payment_mode",
        "net_payable",
        "tds_amount",
        "gst_amount",
        "queried_stage",
        "stage",
    ):
        op.drop_column("payout_requests", col)
    op.drop_column("commission_settings", "tds_percent")
    op.drop_column("commission_settings", "gst_percent")
    op.drop_column("users", "rm2_user_id")
    op.drop_column("users", "rm1_user_id")
    op.drop_column("users", "finance_level")
