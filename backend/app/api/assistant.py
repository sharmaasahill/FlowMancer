"""
Ask FlowMancer.

POST /api/assistant/chat   {"messages": [{"role": "user"|"assistant", "content": "..."}]}
  -> {"reply", "tools": [...], "approvals": [...], "model"}
"""
from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.core.llm import AIUnavailable
from app.models import Approval, User
from app.schemas import ApprovalResponse
from app.services import assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])

MAX_HISTORY = 20


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1)

    @field_validator("messages")
    @classmethod
    def ends_with_user(cls, v):
        if v[-1].role != "user":
            raise ValueError("The last message must be from the user")
        return v[-MAX_HISTORY:]


class ChatResponse(BaseModel):
    reply: str
    tools: List[Dict[str, Any]]
    approvals: List[ApprovalResponse]
    model: str


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db), user: User = Depends(current_user)):
    try:
        result = assistant.chat(db, user, [m.model_dump() for m in body.messages])
    except AIUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    drafted = db.query(Approval).filter(Approval.id.in_(result.approval_ids)).all() if result.approval_ids else []
    return ChatResponse(reply=result.text, tools=result.trace, approvals=drafted, model=result.model)
