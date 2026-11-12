"""Set realistic prices on the current Leadboard. Does not delete leads or change wallets."""

from __future__ import annotations

from app.db.session import SessionLocal
from app.models import Lead
from app.scripts.replace_board_leads import BOARD_PRICES


def main() -> None:
    db = SessionLocal()
    try:
        rows = db.query(Lead).filter(Lead.website_lead_id.like("BOARD-%"), Lead.sale_available.is_(True)).all()
        changed = 0
        for lead in rows:
            key = (lead.website_lead_id or "").removeprefix("BOARD-")
            price = BOARD_PRICES.get(key)
            if price is None or float(lead.price or 0) == float(price):
                continue
            lead.price = price
            changed += 1
        db.commit()
        print(f"repriced={changed} still_for_sale={len(rows)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
