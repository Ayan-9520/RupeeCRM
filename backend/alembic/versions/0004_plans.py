"""Phase 2: partner plans, wallet, team seats"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_plans"
down_revision: Union[str, None] = "0003_partners"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("plan_id", sa.String(length=40), nullable=True))
    op.add_column("users", sa.Column("plan_cycle", sa.String(length=20), nullable=True))
    op.add_column(
        "users",
        sa.Column("plan_status", sa.String(length=20), nullable=False, server_default="none"),
    )
    op.add_column("users", sa.Column("plan_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("plan_ends_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("wallet_balance", sa.Float(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("seat_owner_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_users_plan_id", "users", ["plan_id"])
    op.create_index("ix_users_seat_owner_id", "users", ["seat_owner_id"])
    op.create_foreign_key(
        "fk_users_seat_owner",
        "users",
        "users",
        ["seat_owner_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_seat_owner", "users", type_="foreignkey")
    op.drop_index("ix_users_seat_owner_id", table_name="users")
    op.drop_index("ix_users_plan_id", table_name="users")
    op.drop_column("users", "seat_owner_id")
    op.drop_column("users", "wallet_balance")
    op.drop_column("users", "plan_ends_at")
    op.drop_column("users", "plan_started_at")
    op.drop_column("users", "plan_status")
    op.drop_column("users", "plan_cycle")
    op.drop_column("users", "plan_id")
