"""Follow-up history and bank-login tracking. No credential columns."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0014_followups_bank_logins"
down_revision: Union[str, None] = "0013_customer_documents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_followups",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("note_type", sa.String(40), nullable=False, server_default="other"),
        sa.Column("followup_date", sa.String(10), nullable=True),
        sa.Column("followup_time", sa.String(5), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("assigned_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("discussion_notes", sa.Text(), nullable=True),
        sa.Column("outcome", sa.String(200), nullable=True),
        sa.Column("next_action", sa.String(200), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_followups_purchase", "customer_followups", ["lead_purchase_id"])
    op.create_index("ix_customer_followups_profile", "customer_followups", ["customer_profile_id"])
    op.create_index("ix_customer_followups_dsa", "customer_followups", ["dsa_id"])

    op.create_table(
        "customer_bank_logins",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("bank_name", sa.String(120), nullable=True),
        sa.Column("product", sa.String(120), nullable=True),
        sa.Column("login_date", sa.String(10), nullable=True),
        sa.Column("login_amount", sa.Float(), nullable=True),
        sa.Column("roi_percent", sa.Float(), nullable=True),
        sa.Column("tenure_months", sa.Integer(), nullable=True),
        sa.Column("banker_name", sa.String(120), nullable=True),
        sa.Column("banker_mobile", sa.String(10), nullable=True),
        sa.Column("branch", sa.String(120), nullable=True),
        sa.Column("login_status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("sanction_amount", sa.Float(), nullable=True),
        sa.Column("approved_amount", sa.Float(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("processing_fees", sa.Float(), nullable=True),
        sa.Column("disbursal_status", sa.String(80), nullable=True),
        sa.Column("expected_disbursal_date", sa.String(10), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_bank_logins_purchase", "customer_bank_logins", ["lead_purchase_id"])
    op.create_index("ix_customer_bank_logins_profile", "customer_bank_logins", ["customer_profile_id"])
    op.create_index("ix_customer_bank_logins_dsa", "customer_bank_logins", ["dsa_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_bank_logins_dsa", table_name="customer_bank_logins")
    op.drop_index("ix_customer_bank_logins_profile", table_name="customer_bank_logins")
    op.drop_index("ix_customer_bank_logins_purchase", table_name="customer_bank_logins")
    op.drop_table("customer_bank_logins")
    op.drop_index("ix_customer_followups_dsa", table_name="customer_followups")
    op.drop_index("ix_customer_followups_profile", table_name="customer_followups")
    op.drop_index("ix_customer_followups_purchase", table_name="customer_followups")
    op.drop_table("customer_followups")
