"""Click-to-call. Without provider keys the desk uses the phone's own dialer."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.purchases import caller_may_see
from app.core.config import settings
from app.db.session import get_db
from app.models import LeadPurchase, User

router = APIRouter(prefix="/api/telephony", tags=["telephony"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}


class ClickIn(BaseModel):
    purchase_id: UUID


@router.get("/status")
def telephony_status(_user: User = Depends(get_current_user)) -> dict:
    return {"configured": settings.telephony_ready, "mode": "provider" if settings.telephony_ready else "handset"}


@router.post("/click")
def click_to_call(
    body: ClickIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if not settings.telephony_ready:
        raise HTTPException(status_code=409, detail="telephony_not_configured")

    purchase = db.query(LeadPurchase).filter(LeadPurchase.id == body.purchase_id).first()
    if not purchase or not purchase.lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if user.role not in ADMIN_ROLES and not caller_may_see(db, user, purchase):
        raise HTTPException(status_code=403, detail="This lead is not on your list")
    agent = (user.phone or "").strip()
    if len(agent) < 10:
        raise HTTPException(status_code=400, detail="Add your mobile number on your profile. The call rings you first.")

    payload = {
        "from": agent,
        "to": purchase.lead.full_phone,
        "caller_id": settings.telephony_virtual_number.strip(),
        "reference": str(purchase.id),
    }
    request = Request(
        settings.telephony_click_url.strip(),
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.telephony_api_key.strip()}",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=12) as response:
            code = getattr(response, "status", 200)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail="The calling account refused this call") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail="The calling account could not be reached") from exc
    if code >= 300:
        raise HTTPException(status_code=502, detail="The calling account refused this call")
    return {"placed": True}
