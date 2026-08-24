from datetime import datetime, timezone
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog


def record(
    db: Session,
    *,
    actor_user_id: Optional[int] = None,
    actor_username: Optional[str] = None,
    action: str,
    resource_type: str,
    resource_id=None,
    patient_id: Optional[int] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    detail: Optional[str] = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        actor_username=actor_username,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        patient_id=patient_id,
        ip=ip,
        user_agent=user_agent,
        detail=detail,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    return entry


def from_request(
    db: Session,
    request: Optional[Request],
    user,
    action: str,
    resource_type: str,
    resource_id=None,
    patient_id: Optional[int] = None,
    detail: Optional[str] = None,
) -> AuditLog:
    client = getattr(request, "client", None)
    return record(
        db,
        actor_user_id=getattr(user, "id", None),
        actor_username=getattr(user, "username", None),
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        patient_id=patient_id,
        ip=client.host if client else None,
        user_agent=request.headers.get("user-agent") if request is not None else None,
        detail=detail,
    )
