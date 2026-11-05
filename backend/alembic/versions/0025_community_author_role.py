"""Store the logged-in role on each community post."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025_community_author_role"
down_revision: Union[str, None] = "0024_community_posts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "community_posts",
        sa.Column("author_role", sa.String(40), nullable=False, server_default="partner"),
    )


def downgrade() -> None:
    op.drop_column("community_posts", "author_role")
