from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services.assistant import answer_question

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)


@router.post("/ask")
def ask(body: AskIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return {
        "answer": answer_question(db, user, body.question),
        "note": "Uses your CRM cases. It does not approve a lender.",
    }
