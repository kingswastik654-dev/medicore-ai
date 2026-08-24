from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models import Lead, User
from app.services.audit import from_request

router = APIRouter(prefix="/leads", tags=["leads"])

leads_admin = require_roles("SUPER_ADMIN", "FACILITY_ADMIN")


class LeadCreate(BaseModel):
    hospital_name: str = Field(min_length=2, max_length=200)
    contact_name: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=5, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$")
    phone: str | None = Field(default=None, max_length=25)
    beds: str | None = Field(default=None, max_length=30)
    message: str | None = Field(default=None, max_length=2000)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, request: Request, db: Session = Depends(get_db)):
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    return {"id": lead.id, "status": lead.status}


@router.get("")
def list_leads(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    request: Request = None,
    db: Session = Depends(get_db),
    user: User = Depends(leads_admin),
):
    stmt = select(Lead).order_by(Lead.id.desc()).limit(limit)
    if status_filter:
        stmt = stmt.where(Lead.status == status_filter)
    rows = db.scalars(stmt).all()
    total = db.scalar(select(func.count()).select_from(Lead)) or 0
    from_request(db, request, user, "LIST", "lead")
    db.commit()
    return {
        "total": int(total),
        "items": [
            {
                "id": r.id,
                "hospital_name": r.hospital_name,
                "contact_name": r.contact_name,
                "email": r.email,
                "phone": r.phone,
                "beds": r.beds,
                "message": r.message,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.patch("/{lead_id}")
def update_status(
    lead_id: int,
    new_status: str = Query(pattern="^(NEW|CONTACTED|QUALIFIED|CLOSED)$"),
    request: Request = None,
    db: Session = Depends(get_db),
    user: User = Depends(leads_admin),
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    lead.status = new_status
    from_request(db, request, user, "UPDATE", "lead", resource_id=lead.id, detail=new_status)
    db.commit()
    return {"id": lead.id, "status": lead.status}
