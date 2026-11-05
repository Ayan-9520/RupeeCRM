"""Topic and likes on community posts."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0026_community_likes"
down_revision: Union[str, None] = "0025_community_author_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("community_posts", "author_name", type_=sa.String(80), existing_type=sa.String(40), existing_nullable=False)
    op.add_column("community_posts", sa.Column("topic", sa.String(40), nullable=False, server_default=""))
    op.add_column("community_posts", sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"))
    op.create_table(
        "community_post_likes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("post_id", UUID(as_uuid=True), sa.ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("post_id", "user_id", name="uq_community_post_like"),
    )
    op.create_index("ix_community_post_likes_post_id", "community_post_likes", ["post_id"])
    op.create_index("ix_community_post_likes_user_id", "community_post_likes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_community_post_likes_user_id", table_name="community_post_likes")
    op.drop_index("ix_community_post_likes_post_id", table_name="community_post_likes")
    op.drop_table("community_post_likes")
    op.drop_column("community_posts", "like_count")
    op.drop_column("community_posts", "topic")
    op.alter_column("community_posts", "author_name", type_=sa.String(40), existing_type=sa.String(80), existing_nullable=False)
