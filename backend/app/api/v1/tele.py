import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models import TeleSession, User
from app.services.audit import from_request

router = APIRouter(prefix="/tele", tags=["telehealth"])

host_access = require_roles("DOCTOR", "NURSE", "RECEPTIONIST")


class TeleSessionStart(BaseModel):
    encounter_id: int = Field(gt=0)


class TeleSessionOut(BaseModel):
    id: int
    encounter_id: int
    room_code: str
    join_url: str
    provider: str
    status: str
    started_at: datetime | None
    ended_at: datetime | None

    class Config:
        from_attributes = True


def _out(s: TeleSession, reused: bool = False) -> dict:
    return {
        "id": s.id,
        "encounter_id": s.encounter_id,
        "room_code": s.room_code,
        "join_url": s.join_url,
        "provider": s.provider,
        "status": s.status,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        "reused": reused,
    }


@router.post("/sessions")
def start_session(
    payload: TeleSessionStart,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(host_access),
):
    existing = db.scalar(
        select(TeleSession).where(
            TeleSession.encounter_id == payload.encounter_id,
            TeleSession.status != "ENDED",
        )
    )
    if existing:
        from_request(db, request, user, "TELE_JOIN", "tele_session", resource_id=existing.id)
        db.commit()
        return _out(existing, reused=True)

    code = f"MC-{secrets.token_hex(3).upper()}"
    session = TeleSession(
        encounter_id=payload.encounter_id,
        room_code=code,
        join_url=f"https://meet.jit.si/medcore-{code}",
        scheduled_by_id=user.id,
    )
    db.add(session)
    from_request(db, request, user, "CREATE", "tele_session", resource_id=code)
    db.commit()
    db.refresh(session)
    return _out(session)


@router.get("/sessions")
def list_sessions(
    encounter_id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR", "NURSE", "RECEPTIONIST")),
):
    sessions = db.scalars(
        select(TeleSession).where(TeleSession.encounter_id == encounter_id).order_by(TeleSession.id.desc())
    ).all()
    return [_out(s) for s in sessions]


@router.post("/sessions/{session_id}/start")
def mark_live(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(host_access),
):
    session = db.get(TeleSession, session_id)
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session.status == "ENDED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session already ended")
    if session.status != "LIVE":
        session.status = "LIVE"
        session.started_at = datetime.now(timezone.utc)
    from_request(db, request, user, "UPDATE", "tele_session", resource_id=session.id, detail="live")
    db.commit()
    return _out(session)


@router.post("/sessions/{session_id}/end")
def end_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(host_access),
):
    session = db.get(TeleSession, session_id)
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session.status == "ENDED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session already ended")
    session.status = "ENDED"
    session.ended_at = datetime.now(timezone.utc)
    from_request(db, request, user, "UPDATE", "tele_session", resource_id=session.id, detail="ended")
    db.commit()
    return _out(session)
