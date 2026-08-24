from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models import AuditLog, User

router = APIRouter(prefix="/audits", tags=["audits"])

audit_access = require_roles("AUDITOR", "FACILITY_ADMIN")


@router.get("")
def list_audits(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    action: str | None = None,
    resource_type: str | None = None,
    patient_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(audit_access),
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    count_stmt = select(func.count()).select_from(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
        count_stmt = count_stmt.where(AuditLog.resource_type == resource_type)
    if patient_id:
        stmt = stmt.where(AuditLog.patient_id == patient_id)
        count_stmt = count_stmt.where(AuditLog.patient_id == patient_id)

    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "items": [
            {
                "id": r.id,
                "actor_username": r.actor_username,
                "action": r.action,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "patient_id": r.patient_id,
                "ip": r.ip,
                "detail": r.detail,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": int(total),
        "page": page,
        "page_size": page_size,
    }
