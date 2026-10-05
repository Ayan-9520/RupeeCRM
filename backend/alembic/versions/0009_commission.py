"""Admin-editable disbursed commission percent."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_commission"
down_revision: Union[str, None] = "0008_network"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "commission_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rate_percent", sa.Float(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.execute("INSERT INTO commission_settings (id, rate_percent) VALUES (1, 1)")


def downgrade() -> None:
    op.drop_table("commission_settings")
