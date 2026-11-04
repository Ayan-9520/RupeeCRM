"""Count public profile visits. One row per slug and browser session."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0021_profile_visits"
down_revision: Union[str, None] = "0020_payout_grids"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "profile_visits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("partner_user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("session_key", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slug", "session_key", name="uq_profile_visit_session"),
    )
    op.create_index("ix_profile_visits_slug", "profile_visits", ["slug"])
    op.create_index("ix_profile_visits_partner_user_id", "profile_visits", ["partner_user_id"])


def downgrade() -> None:
    op.drop_index("ix_profile_visits_partner_user_id", table_name="profile_visits")
    op.drop_index("ix_profile_visits_slug", table_name="profile_visits")
    op.drop_table("profile_visits")
