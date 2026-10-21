"""Customer document slots and private file access."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.customer_workspace import _require_purchase
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CustomerDocument, CustomerDocumentEvent, CustomerProfile, User
from app.services.document_files import delete_key, open_key, safe_filename, save_bytes, sniff_mime

router = APIRouter(prefix="/api", tags=["customer-documents"])

CATALOG: tuple[tuple[str, str, str], ...] = (
    ("pan_card", "PAN Card", "kyc"),
    ("aadhaar_front", "Aadhaar Front", "kyc"),
    ("aadhaar_back", "Aadhaar Back", "kyc"),
    ("passport", "Passport", "kyc"),
    ("voter_id", "Voter ID", "kyc"),
    ("driving_license", "Driving License", "kyc"),
    ("salary_slip", "Salary Slip", "income"),
    ("bank_statement", "Bank Statement", "income"),
    ("itr", "ITR", "income"),
    ("form_16", "Form 16", "income"),
    ("gst_return", "GST Return", "income"),
    ("pnl", "P&L", "income"),
    ("balance_sheet", "Balance Sheet", "income"),
    ("registry", "Registry", "property"),
    ("agreement", "Agreement", "property"),
    ("sale_deed", "Sale Deed", "property"),
    ("chain_documents", "Chain Documents", "property"),
    ("noc", "NOC", "property"),
    ("gst_certificate", "GST Certificate", "business"),
    ("shop_act", "Shop Act", "business"),
    ("udyam", "Udyam", "business"),
    ("partnership_deed", "Partnership Deed", "business"),
    ("moa_aoa", "MOA/AOA", "business"),
    ("cancelled_cheque", "Cancelled Cheque", "banking"),
    ("passbook", "Passbook", "banking"),
    ("account_statement", "Account Statement", "banking"),
)
CATALOG_BY_SLUG = {slug: (label, category) for slug, label, category in CATALOG}
STATUSES = {
    "pending",
    "requested",
    "received",
    "uploaded",
    "under_review",
    "verified",
    "rejected",
    "expired",
}


class DocumentPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: str | None = None
    verification_notes: str | None = None
    comments: str | None = None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _out(row: CustomerDocument) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "lead_id": str(row.lead_id),
        "dsa_id": str(row.dsa_id),
        "category": row.category,
        "doc_slug": row.doc_slug,
        "doc_label": row.doc_label,
        "file_name": row.file_name,
        "file_url": f"/api/customer-documents/{row.id}/file" if row.storage_key else None,
        "storage_path": None,
        "file_size": row.file_size,
        "mime_type": row.mime_type,
        "status": row.status,
        "verification_notes": row.verification_notes,
        "comments": row.comments,
        "uploaded_by": str(row.uploaded_by) if row.uploaded_by else None,
        "verified_by": str(row.verified_by) if row.verified_by else None,
        "verified_at": _iso(row.verified_at),
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _event(db: Session, row: CustomerDocument, user: User, action: str, note: str | None = None) -> None:
    db.add(
        CustomerDocumentEvent(
            document_id=row.id,
            lead_purchase_id=row.lead_purchase_id,
            action=action,
            status=row.status,
            file_name=row.file_name,
            actor_user_id=user.id,
            note=(note or "")[:1000] or None,
        )
    )


def _profile(db: Session, purchase_id: UUID) -> CustomerProfile:
    profile = db.query(CustomerProfile).filter(CustomerProfile.lead_purchase_id == purchase_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Open the customer workspace before uploading documents")
    return profile


def _ensure_slots(db: Session, profile: CustomerProfile, user: User) -> list[CustomerDocument]:
    existing = {
        row.doc_slug: row
        for row in db.query(CustomerDocument).filter(CustomerDocument.lead_purchase_id == profile.lead_purchase_id).all()
    }
    for slug, label, category in CATALOG:
        if slug in existing:
            continue
        row = CustomerDocument(
            customer_profile_id=profile.id,
            lead_purchase_id=profile.lead_purchase_id,
            lead_id=profile.lead_id,
            dsa_id=profile.dsa_id,
            category=category,
            doc_slug=slug,
            doc_label=label,
            status="pending",
        )
        db.add(row)
        db.flush()
        _event(db, row, user, "created")
        existing[slug] = row
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    rows = (
        db.query(CustomerDocument)
        .filter(CustomerDocument.lead_purchase_id == profile.lead_purchase_id)
        .order_by(CustomerDocument.category, CustomerDocument.doc_label)
        .all()
    )
    return rows


def _owned_doc(db: Session, user: User, document_id: UUID) -> CustomerDocument:
    row = db.query(CustomerDocument).filter(CustomerDocument.id == document_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    _require_purchase(db, user, row.lead_purchase_id)
    return row


@router.get("/my-leads/{purchase_id}/documents")
def list_documents(
    purchase_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase.id)
    rows = _ensure_slots(db, profile, user)
    events = (
        db.query(CustomerDocumentEvent)
        .filter(CustomerDocumentEvent.lead_purchase_id == purchase.id)
        .order_by(CustomerDocumentEvent.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "documents": [_out(row) for row in rows],
        "events": [
            {
                "id": str(event.id),
                "document_id": str(event.document_id),
                "action": event.action,
                "status": event.status,
                "file_name": event.file_name,
                "note": event.note,
                "created_at": _iso(event.created_at),
            }
            for event in events
        ],
    }


@router.post("/my-leads/{purchase_id}/documents/{slug}/file")
async def upload_document(
    purchase_id: UUID,
    slug: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if slug not in CATALOG_BY_SLUG:
        raise HTTPException(status_code=400, detail="Unknown document")
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase.id)
    _ensure_slots(db, profile, user)
    row = (
        db.query(CustomerDocument)
        .filter(CustomerDocument.lead_purchase_id == purchase.id, CustomerDocument.doc_slug == slug)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    payload = await file.read()
    mime = sniff_mime(payload, file.content_type or "")
    previous = row.storage_key
    key = save_bytes(str(purchase.id), str(row.id), payload, mime)
    row.file_name = safe_filename(file.filename or "document")
    row.storage_key = key
    row.file_size = len(payload)
    row.mime_type = mime
    row.status = "uploaded"
    row.uploaded_by = user.id
    row.verified_by = None
    row.verified_at = None
    _event(db, row, user, "uploaded")
    db.commit()
    db.refresh(row)
    if previous and previous != key:
        delete_key(previous)
    return _out(row)


@router.patch("/customer-documents/{document_id}")
def update_document(
    document_id: UUID,
    body: DocumentPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_doc(db, user, document_id)
    present = set(body.model_fields_set)
    if "status" in present:
        status = (body.status or "").strip()
        if status not in STATUSES:
            raise HTTPException(status_code=400, detail="Invalid document status")
        row.status = status
        if status == "verified":
            row.verified_by = user.id
            row.verified_at = datetime.now(timezone.utc)
        elif status != "verified":
            row.verified_by = None
            row.verified_at = None
    if "verification_notes" in present:
        notes = (body.verification_notes or "").strip()
        row.verification_notes = notes[:2000] or None
    if "comments" in present:
        comments = (body.comments or "").strip()
        row.comments = comments[:2000] or None
    _event(db, row, user, "updated", row.verification_notes)
    db.commit()
    db.refresh(row)
    return _out(row)


@router.get("/customer-documents/{document_id}/file")
def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FileResponse:
    row = _owned_doc(db, user, document_id)
    if not row.storage_key:
        raise HTTPException(status_code=404, detail="File not found")
    path = open_key(row.storage_key)
    return FileResponse(
        path,
        media_type=row.mime_type or "application/octet-stream",
        filename=row.file_name or "document",
        content_disposition_type="attachment",
    )


@router.delete("/customer-documents/{document_id}/file")
def remove_document_file(
    document_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_doc(db, user, document_id)
    delete_key(row.storage_key)
    row.file_name = None
    row.storage_key = None
    row.file_size = None
    row.mime_type = None
    row.status = "pending"
    row.uploaded_by = None
    row.verified_by = None
    row.verified_at = None
    _event(db, row, user, "removed")
    db.commit()
    db.refresh(row)
    return _out(row)
