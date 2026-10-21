"""Customer document slots, file metadata, and document history."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0013_customer_documents"
down_revision: Union[str, None] = "0012_customer_workspace"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("doc_slug", sa.String(80), nullable=False),
        sa.Column("doc_label", sa.String(120), nullable=False),
        sa.Column("file_name", sa.String(200), nullable=True),
        sa.Column("storage_key", sa.String(240), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(80), nullable=True),
        sa.Column("status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("verification_notes", sa.Text(), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("uploaded_by", UUID(as_uuid=True), nullable=True),
        sa.Column("verified_by", UUID(as_uuid=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("lead_purchase_id", "doc_slug", name="uq_customer_documents_purchase_slug"),
    )
    op.create_index("ix_customer_documents_profile", "customer_documents", ["customer_profile_id"])
    op.create_index("ix_customer_documents_purchase", "customer_documents", ["lead_purchase_id"])
    op.create_index("ix_customer_documents_dsa", "customer_documents", ["dsa_id"])

    op.create_table(
        "customer_document_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("status", sa.String(40), nullable=True),
        sa.Column("file_name", sa.String(200), nullable=True),
        sa.Column("actor_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_document_events_document", "customer_document_events", ["document_id"])
    op.create_index("ix_customer_document_events_purchase", "customer_document_events", ["lead_purchase_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_document_events_purchase", table_name="customer_document_events")
    op.drop_index("ix_customer_document_events_document", table_name="customer_document_events")
    op.drop_table("customer_document_events")
    op.drop_index("ix_customer_documents_dsa", table_name="customer_documents")
    op.drop_index("ix_customer_documents_purchase", table_name="customer_documents")
    op.drop_index("ix_customer_documents_profile", table_name="customer_documents")
    op.drop_table("customer_documents")
