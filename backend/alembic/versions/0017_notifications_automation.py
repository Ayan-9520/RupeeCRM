"""In-app notifications and built-in automation run logs."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0017_notifications_automation"
down_revision: Union[str, None] = "0016_case_finance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.String(500), nullable=True),
        sa.Column("link", sa.String(200), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_user_notifications_user", "user_notifications", ["user_id"])

    op.create_table(
        "customer_automation_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rule_key", sa.String(60), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("message", sa.String(300), nullable=False),
        sa.Column("task_id", UUID(as_uuid=True), nullable=True),
        sa.Column("retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actor_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_automation_logs_purchase", "customer_automation_logs", ["lead_purchase_id"])
    op.create_index("ix_customer_automation_logs_dsa", "customer_automation_logs", ["dsa_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_automation_logs_dsa", table_name="customer_automation_logs")
    op.drop_index("ix_customer_automation_logs_purchase", table_name="customer_automation_logs")
    op.drop_table("customer_automation_logs")
    op.drop_index("ix_user_notifications_user", table_name="user_notifications")
    op.drop_table("user_notifications")
