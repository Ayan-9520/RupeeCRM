"""Lender contact fields, products, banker contacts, and nullable case links."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0043_lender_master"
down_revision: Union[str, None] = "0042_los_books"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lenders", sa.Column("website", sa.String(200), nullable=False, server_default=""))
    op.add_column("lenders", sa.Column("phone", sa.String(30), nullable=False, server_default=""))
    op.add_column("lenders", sa.Column("notes", sa.Text(), nullable=False, server_default=""))
    op.add_column("lenders", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("lender_branches", sa.Column("code", sa.String(40), nullable=False, server_default=""))
    op.add_column("lender_branches", sa.Column("address", sa.String(240), nullable=False, server_default=""))
    op.add_column("lender_branches", sa.Column("state", sa.String(80), nullable=False, server_default=""))
    op.add_column("lender_branches", sa.Column("pincode", sa.String(10), nullable=False, server_default=""))
    op.add_column("lender_branches", sa.Column("phone", sa.String(30), nullable=False, server_default=""))
    op.add_column("lender_branches", sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_table(
        "lender_products",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lender_id", UUID(as_uuid=True), sa.ForeignKey("lenders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("category", sa.String(80), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "lender_contacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lender_id", UUID(as_uuid=True), sa.ForeignKey("lenders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), sa.ForeignKey("lender_branches.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("designation", sa.String(80), nullable=False, server_default=""),
        sa.Column("phone", sa.String(30), nullable=False, server_default=""),
        sa.Column("email", sa.String(160), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("loan_cases", sa.Column("lender_id", UUID(as_uuid=True), nullable=True))
    op.add_column("loan_cases", sa.Column("product_id", UUID(as_uuid=True), nullable=True))
    op.add_column("loan_cases", sa.Column("branch_id", UUID(as_uuid=True), nullable=True))
    op.add_column("loan_cases", sa.Column("contact_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_loan_cases_lender_id", "loan_cases", ["lender_id"])
    op.create_foreign_key("fk_loan_cases_lender", "loan_cases", "lenders", ["lender_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_loan_cases_product", "loan_cases", "lender_products", ["product_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_loan_cases_branch", "loan_cases", "lender_branches", ["branch_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_loan_cases_contact", "loan_cases", "lender_contacts", ["contact_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_loan_cases_contact", "loan_cases", type_="foreignkey")
    op.drop_constraint("fk_loan_cases_branch", "loan_cases", type_="foreignkey")
    op.drop_constraint("fk_loan_cases_product", "loan_cases", type_="foreignkey")
    op.drop_constraint("fk_loan_cases_lender", "loan_cases", type_="foreignkey")
    op.drop_index("ix_loan_cases_lender_id", table_name="loan_cases")
    op.drop_column("loan_cases", "contact_id")
    op.drop_column("loan_cases", "branch_id")
    op.drop_column("loan_cases", "product_id")
    op.drop_column("loan_cases", "lender_id")
    op.drop_table("lender_contacts")
    op.drop_table("lender_products")
    op.drop_column("lender_branches", "active")
    op.drop_column("lender_branches", "phone")
    op.drop_column("lender_branches", "pincode")
    op.drop_column("lender_branches", "state")
    op.drop_column("lender_branches", "address")
    op.drop_column("lender_branches", "code")
    op.drop_column("lenders", "updated_at")
    op.drop_column("lenders", "notes")
    op.drop_column("lenders", "phone")
    op.drop_column("lenders", "website")
