"""Payout percent. Invoices read this row, they do not keep a hardcoded rate."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import CommissionSettings


def get_percent(db: Session) -> float:
    row = db.query(CommissionSettings).filter(CommissionSettings.id == 1).first()
    if not row:
        row = CommissionSettings(id=1, rate_percent=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return float(row.rate_percent or 0)


def rate_fraction(db: Session) -> float:
    return round(get_percent(db) / 100.0, 6)


def save_percent(db: Session, percent: float) -> float:
    if percent < 0 or percent > 100:
        raise ValueError("Commission percent must be between 0 and 100")
    row = db.query(CommissionSettings).filter(CommissionSettings.id == 1).first()
    if not row:
        row = CommissionSettings(id=1, rate_percent=percent)
        db.add(row)
    else:
        row.rate_percent = percent
    db.commit()
    db.refresh(row)
    return float(row.rate_percent)
