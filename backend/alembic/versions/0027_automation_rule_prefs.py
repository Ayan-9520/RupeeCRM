"""Per-user on/off for the built-in case automation rules."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0027_automation_rule_prefs"
down_revision: Union[str, None] = "0026_community_likes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "automation_rule_prefs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rule_key", sa.String(60), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "rule_key", name="uq_automation_rule_pref"),
    )
    op.create_index("ix_automation_rule_prefs_user_id", "automation_rule_prefs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_automation_rule_prefs_user_id", table_name="automation_rule_prefs")
    op.drop_table("automation_rule_prefs")
