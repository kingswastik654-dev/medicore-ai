from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Notification, User
from app.services.audit import from_request
from app.services.notify import dispatch_pending

router = APIRouter(prefix="/notifications", tags=["notifications"])

dispatch_access = require_roles("FACILITY_ADMIN", "RECEPTIONIST", "NURSE")


@router.get("")
def list_notifications(
    status_filter: str | None = Query(default=None, alias="status"),
    event: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Notification).order_by(Notification.id.desc()).limit(limit)
    if status_filter:
        stmt = stmt.where(Notification.status == status_filter)
    if event:
        stmt = stmt.where(Notification.event == event)
    rows = db.scalars(stmt).all()
    return [
        {
            "id": n.id,
            "channel": n.channel,
            "event": n.event,
            "status": n.status,
            "recipient_name": n.recipient_name,
            "recipient_phone": n.recipient_phone,
            "body": n.body,
            "error": n.error,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "sent_at": n.sent_at.isoformat() if n.sent_at else None,
        }
        for n in rows
    ]


@router.post("/dispatch")
def run_dispatch(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(dispatch_access),
):
    processed = dispatch_pending(db)
    from_request(db, request, user, "DISPATCH", "notification", detail=f"processed={processed}")
    db.commit()
    return {"processed": processed}


@router.post("/{notification_id}/resend")
def resend(
    notification_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(dispatch_access),
):
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if notification.status == "QUEUED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already queued for delivery")
    notification.status = "QUEUED"
    notification.error = None
    db.flush()
    processed = dispatch_pending(db)
    from_request(db, request, user, "RESEND", "notification", resource_id=notification.id)
    db.commit()
    db.refresh(notification)
    return {"id": notification.id, "status": notification.status}
