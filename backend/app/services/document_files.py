"""Private customer-document files. Keys are relative; the absolute folder is never sent to clients."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import HTTPException

from app.core.config import settings

MAX_BYTES = 10 * 1024 * 1024
ALLOWED_MIME = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def storage_root() -> Path:
    configured = (settings.document_storage_dir or "").strip()
    if configured:
        root = Path(configured)
    else:
        root = Path(__file__).resolve().parents[1] / "storage_private" / "customer-documents"
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_filename(name: str) -> str:
    base = Path(name or "document").name.replace("\x00", "")
    cleaned = SAFE_NAME.sub("_", base).strip("._")
    return (cleaned or "document")[:180]


def sniff_mime(data: bytes, claimed: str) -> str:
    mime = (claimed or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Only PDF and images are allowed")
    if len(data) < 12 or len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File is empty or larger than 10MB")
    if mime == "application/pdf" and not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File is not a PDF")
    if mime in {"image/jpeg", "image/jpg"} and not data.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status_code=400, detail="File is not a JPEG")
    if mime == "image/png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=400, detail="File is not a PNG")
    if mime == "image/webp" and not (data.startswith(b"RIFF") and data[8:12] == b"WEBP"):
        raise HTTPException(status_code=400, detail="File is not a WebP image")
    return "image/jpeg" if mime == "image/jpg" else mime


def save_bytes(purchase_id: str, document_id: str, data: bytes, mime: str) -> str:
    ext = ALLOWED_MIME[mime]
    key = f"{purchase_id}/{document_id}/{uuid.uuid4().hex}{ext}"
    root = storage_root().resolve()
    path = root.joinpath(*key.split("/"))
    if root not in path.resolve().parents:
        raise HTTPException(status_code=400, detail="Invalid storage location")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def delete_key(key: str | None) -> None:
    if not key or ".." in key or key.startswith(("/", "\\")):
        return
    path = storage_root().joinpath(*key.split("/"))
    try:
        resolved = path.resolve()
    except OSError:
        return
    if storage_root().resolve() not in resolved.parents:
        return
    if resolved.is_file():
        resolved.unlink()


def open_key(key: str) -> Path:
    if not key or ".." in key or key.startswith(("/", "\\")):
        raise HTTPException(status_code=404, detail="File not found")
    path = storage_root().joinpath(*key.split("/")).resolve()
    if storage_root().resolve() not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return path
