"""Hold a lender dump until a second admin approves it, and save column templates."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0045_dump_approval"
down_revision: Union[str, None] = "0044_commission_snapshot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("import_batches", sa.Column("preview", JSONB, nullable=False, server_default="[]"))
    op.add_column("import_batches", sa.Column("mapping", JSONB, nullable=False, server_default="{}"))
    op.add_column("import_batches", sa.Column("approved_by", UUID(as_uuid=True), nullable=True))
    op.add_column("import_batches", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "lender_import_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("lender_name", sa.String(160), nullable=False, server_default=""),
        sa.Column("mapping", JSONB, nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("lender_import_templates")
    op.drop_column("import_batches", "approved_at")
    op.drop_column("import_batches", "approved_by")
    op.drop_column("import_batches", "mapping")
    op.drop_column("import_batches", "preview")
