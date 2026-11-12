"""Payment rows for offline activation and a later Razorpay connection."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0030_billing_payments"
down_revision: Union[str, None] = "0029_login_target"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "billing_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("provider", sa.String(20), nullable=False, server_default="offline"),
        sa.Column("provider_order_id", sa.String(80), nullable=True),
        sa.Column("provider_payment_id", sa.String(80), nullable=True),
        sa.Column("plan_id", sa.String(40), nullable=True),
        sa.Column("cycle", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_billing_payments_user_id", "billing_payments", ["user_id"])
    op.create_index("ix_billing_payments_status", "billing_payments", ["status"])
    op.create_index("ix_billing_payments_provider_order_id", "billing_payments", ["provider_order_id"])
    op.create_index("ix_billing_payments_created_at", "billing_payments", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_billing_payments_created_at", table_name="billing_payments")
    op.drop_index("ix_billing_payments_provider_order_id", table_name="billing_payments")
    op.drop_index("ix_billing_payments_status", table_name="billing_payments")
    op.drop_index("ix_billing_payments_user_id", table_name="billing_payments")
    op.drop_table("billing_payments")
