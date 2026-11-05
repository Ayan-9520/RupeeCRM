"""Community feed. Anyone can read. Only a logged-in admin, DSA, or affiliate can post."""

from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import bearer, get_current_user
from app.core.rate_limit import check_rate_limit
from app.core.security import decode_token
from app.db.session import get_db
from app.models import CommunityPost, CommunityPostLike, User

router = APIRouter(prefix="/api/public/community", tags=["community"])

POST_ROLES = {"ceo", "super_admin", "admin", "dsa", "affiliate"}
LIKE_ROLES = POST_ROLES | {"caller"}
ROLE_LABEL = {
    "ceo": "CEO",
    "super_admin": "Admin",
    "admin": "Admin",
    "dsa": "Partner",
    "affiliate": "Affiliate",
}
TOPICS = ("Home loan", "Personal loan", "Credit card", "Insurance", "City update", "Partner tip")
_PHONE = re.compile(r"(?:\+91[\s-]*)?[6-9]\d{9}")


class PostOut(BaseModel):
    id: UUID
    author_name: str
    author_role: str
    topic: str
    body: str
    like_count: int
    liked: bool
    created_at: datetime


class PostIn(BaseModel):
    body: str = Field(min_length=8, max_length=600)
    topic: str = ""


class LikeOut(BaseModel):
    liked: bool
    like_count: int


def _clean_body(value: str) -> str:
    body = value.strip()
    if _PHONE.search(body):
        raise HTTPException(status_code=400, detail="Do not put a phone number in the post.")
    if len(body) < 8:
        raise HTTPException(status_code=400, detail="Write a little more.")
    return body


def _clean_topic(value: str) -> str:
    topic = value.strip()
    if topic and topic not in TOPICS:
        raise HTTPException(status_code=400, detail="Pick a topic from the list.")
    return topic


def _viewer(creds: HTTPAuthorizationCredentials | None, db: Session) -> User | None:
    if not creds:
        return None
    payload = decode_token(creds.credentials)
    if not payload or "sub" not in payload or payload.get("purpose"):
        return None
    try:
        user_id = UUID(str(payload["sub"]))
    except (TypeError, ValueError):
        return None
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    return user


def _out(row: CommunityPost, liked: bool) -> PostOut:
    return PostOut(
        id=row.id,
        author_name=row.author_name,
        author_role=row.author_role,
        topic=row.topic or "",
        body=row.body,
        like_count=row.like_count or 0,
        liked=liked,
        created_at=row.created_at,
    )


@router.get("/posts", response_model=list[PostOut])
def list_posts(
    db: Session = Depends(get_db),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> list[PostOut]:
    rows = db.query(CommunityPost).order_by(CommunityPost.created_at.desc()).limit(50).all()
    user = _viewer(creds, db)
    liked_ids: set[UUID] = set()
    if user and rows:
        ids = [row.id for row in rows]
        liked_ids = {
            item.post_id
            for item in db.query(CommunityPostLike.post_id)
            .filter(CommunityPostLike.user_id == user.id, CommunityPostLike.post_id.in_(ids))
            .all()
        }
    return [_out(row, row.id in liked_ids) for row in rows]


@router.post("/posts", response_model=PostOut, status_code=201)
def create_post(
    body: PostIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PostOut:
    if user.role not in POST_ROLES:
        raise HTTPException(status_code=403, detail="Only an admin or a partner can post.")
    check_rate_limit(request, limit=8, window_sec=600, scope="community")
    row = CommunityPost(
        author_name=(user.full_name or "Partner")[:80],
        author_role=ROLE_LABEL.get(user.role, "Partner"),
        topic=_clean_topic(body.topic),
        body=_clean_body(body.body),
        like_count=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _out(row, False)


@router.post("/posts/{post_id}/like", response_model=LikeOut)
def toggle_like(
    post_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LikeOut:
    if user.role not in LIKE_ROLES:
        raise HTTPException(status_code=403, detail="Login as a partner to like a post.")
    check_rate_limit(request, limit=40, window_sec=600, scope="community-like")
    row = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found.")
    existing = (
        db.query(CommunityPostLike)
        .filter(CommunityPostLike.post_id == row.id, CommunityPostLike.user_id == user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        row.like_count = max(0, (row.like_count or 0) - 1)
        liked = False
    else:
        db.add(CommunityPostLike(post_id=row.id, user_id=user.id))
        row.like_count = (row.like_count or 0) + 1
        liked = True
    db.commit()
    return LikeOut(liked=liked, like_count=row.like_count)
