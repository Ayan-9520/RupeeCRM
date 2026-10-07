from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Certificate, User
from app.services.quiz_bank import PASS_PERCENT, QUIZZES, get_quiz, grade, public_questions

router = APIRouter(prefix="/api/learn", tags=["learn"])


class CertificateOut(BaseModel):
    id: str
    course_slug: str
    course_title: str
    badge: str
    score_percent: int
    points: int
    certificate_no: str
    issued_at: str | None
    full_name: str


class SubmitIn(BaseModel):
    answers: list[int] = Field(min_length=1, max_length=50)


def _cert_out(c: Certificate, user: User) -> CertificateOut:
    return CertificateOut(
        id=str(c.id),
        course_slug=c.course_slug,
        course_title=c.course_title,
        badge=c.badge,
        score_percent=c.score_percent,
        points=c.points,
        certificate_no=c.certificate_no,
        issued_at=c.issued_at.isoformat() if c.issued_at else None,
        full_name=user.full_name,
    )


def _existing(db: Session, user: User, slug: str) -> Certificate | None:
    return db.query(Certificate).filter(Certificate.user_id == user.id, Certificate.course_slug == slug).first()


@router.get("/quizzes/{slug}")
def get_quiz_questions(slug: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    quiz = get_quiz(slug)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    cert = _existing(db, user, slug)
    return {
        "slug": slug,
        "title": quiz["title"],
        "badge": quiz["badge"],
        "points": quiz["points"],
        "pass_percent": PASS_PERCENT,
        "questions": public_questions(slug),
        "certificate": _cert_out(cert, user).model_dump() if cert else None,
    }


@router.post("/quizzes/{slug}/submit")
def submit_quiz(
    slug: str,
    body: SubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    quiz = get_quiz(slug)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if len(body.answers) != len(quiz["questions"]):
        raise HTTPException(status_code=400, detail="Answer every question before submitting")

    result = grade(slug, body.answers)
    cert = _existing(db, user, slug)
    points_awarded = 0
    if result["passed"] and not cert:
        cert = Certificate(
            user_id=user.id,
            course_slug=slug,
            course_title=quiz["title"],
            badge=quiz["badge"],
            score_percent=result["score_percent"],
            points=quiz["points"],
            certificate_no=f"RD-CERT-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3).upper()}",
        )
        db.add(cert)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            cert = _existing(db, user, slug)
        else:
            db.refresh(cert)
            points_awarded = quiz["points"]
    elif result["passed"] and cert and result["score_percent"] > cert.score_percent:
        cert.score_percent = result["score_percent"]
        db.commit()
        db.refresh(cert)

    return {
        **result,
        "pass_percent": PASS_PERCENT,
        "points_awarded": points_awarded,
        "certificate": _cert_out(cert, user).model_dump() if cert else None,
    }


@router.get("/certificates")
def my_certificates(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    rows = (
        db.query(Certificate)
        .filter(Certificate.user_id == user.id)
        .order_by(Certificate.issued_at.desc())
        .all()
    )
    earned = {c.course_slug for c in rows}
    return {
        "items": [_cert_out(c, user).model_dump() for c in rows],
        "total_points": sum(c.points for c in rows),
        "available": [
            {"slug": s, "title": q["title"], "badge": q["badge"], "points": q["points"]}
            for s, q in QUIZZES.items()
            if s not in earned
        ],
    }
