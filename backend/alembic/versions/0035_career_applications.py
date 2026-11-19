"""Career applications from the website, for the admin HR inbox."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0035_career_applications"
down_revision: Union[str, None] = "0034_caller_assign"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "career_applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("website_lead_id", sa.String(80), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False, server_default=""),
        sa.Column("email", sa.String(255), nullable=False, server_default=""),
        sa.Column("position", sa.String(160), nullable=False, server_default=""),
        sa.Column("experience", sa.String(80), nullable=False, server_default=""),
        sa.Column("city", sa.String(120), nullable=False, server_default=""),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("current_role", sa.String(160), nullable=False, server_default=""),
        sa.Column("notice_period", sa.String(40), nullable=False, server_default=""),
        sa.Column("expected_salary", sa.String(80), nullable=False, server_default=""),
        sa.Column("source", sa.String(80), nullable=False, server_default=""),
        sa.Column("resume_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(40), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_career_applications_website_lead_id", "career_applications", ["website_lead_id"], unique=True)
    op.create_index("ix_career_applications_status", "career_applications", ["status"])
    op.create_index("ix_career_applications_created_at", "career_applications", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_career_applications_created_at", table_name="career_applications")
    op.drop_index("ix_career_applications_status", table_name="career_applications")
    op.drop_index("ix_career_applications_website_lead_id", table_name="career_applications")
    op.drop_table("career_applications")
