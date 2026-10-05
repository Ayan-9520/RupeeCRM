"""Network links and admin-editable revenue share."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_network"
down_revision: Union[str, None] = "0007_trust"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "network_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("levels", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.execute(
        """
        INSERT INTO network_settings (id, levels)
        VALUES (
          1,
          '[{"level": 1, "label": "Direct connector", "share_percent": 10}, {"level": 2, "label": "Second line", "share_percent": 5}]'::jsonb
        )
        """
    )
    op.create_table(
        "network_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("parent_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("child_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invite_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("invite_phone", sa.String(30), nullable=False, server_default=""),
        sa.Column("invite_email", sa.String(255), nullable=False, server_default=""),
        sa.Column("invite_code", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="invited"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_network_links_parent_user_id", "network_links", ["parent_user_id"])
    op.create_index("ix_network_links_child_user_id", "network_links", ["child_user_id"])
    op.create_index("ix_network_links_invite_code", "network_links", ["invite_code"], unique=True)
    op.create_index("ix_network_links_status", "network_links", ["status"])
    op.create_index("ix_network_links_created_at", "network_links", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_network_links_created_at", table_name="network_links")
    op.drop_index("ix_network_links_status", table_name="network_links")
    op.drop_index("ix_network_links_invite_code", table_name="network_links")
    op.drop_index("ix_network_links_child_user_id", table_name="network_links")
    op.drop_index("ix_network_links_parent_user_id", table_name="network_links")
    op.drop_table("network_links")
    op.drop_table("network_settings")
