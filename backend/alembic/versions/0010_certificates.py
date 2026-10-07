"""Academy certificates (one per user per course)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0010_certificates"
down_revision: Union[str, None] = "0009_commission"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "certificates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("course_slug", sa.String(80), nullable=False),
        sa.Column("course_title", sa.String(160), nullable=False),
        sa.Column("badge", sa.String(80), nullable=False),
        sa.Column("score_percent", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("certificate_no", sa.String(40), nullable=False, unique=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "course_slug", name="uq_certificates_user_course"),
    )
    op.create_index("ix_certificates_user_id", "certificates", ["user_id"])
    op.create_index("ix_certificates_course_slug", "certificates", ["course_slug"])


def downgrade() -> None:
    op.drop_index("ix_certificates_course_slug", table_name="certificates")
    op.drop_index("ix_certificates_user_id", table_name="certificates")
    op.drop_table("certificates")
