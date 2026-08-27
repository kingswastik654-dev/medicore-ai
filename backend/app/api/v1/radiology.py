from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Patient, RadOrder, RadProcedureDef, User
from app.schemas.radiology import (
    AIFlagIn,
    FinalizeIn,
    PrelimIn,
    RadOrderCreate,
    RadOrderOut,
    RadProcedureCreate,
    RadProcedureOut,
    ScheduleIn,
)
from app.services.audit import from_request

router = APIRouter(prefix="/rad", tags=["radiology"])

rad_staff = require_roles("RAD_TECH")
radiologist_access = require_roles("RADIOLOGIST")
clinical_order_access = require_roles("DOCTOR", "NURSE")


@router.get("/procedures", response_model=list[RadProcedureOut])
def list_procedures(
    modality: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(RadProcedureDef).where(RadProcedureDef.is_active == True).order_by(RadProcedureDef.name)  # noqa: E712
    if modality:
        stmt = stmt.where(RadProcedureDef.modality == modality)
    return [RadProcedureOut.model_validate(p) for p in db.scalars(stmt)]


@router.post("/procedures", response_model=RadProcedureOut, status_code=status.HTTP_201_CREATED)
def create_procedure(
    payload: RadProcedureCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("FACILITY_ADMIN")),
):
    exists = db.scalar(select(RadProcedureDef).where(RadProcedureDef.code == payload.code))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Procedure code already exists")
    proc = RadProcedureDef(**payload.model_dump())
    db.add(proc)
    from_request(db, request, user, "CREATE", "rad_procedure", resource_id=payload.code)
    db.commit()
    db.refresh(proc)
    return RadProcedureOut.model_validate(proc)


def _get_order(db: Session, order_id: int) -> RadOrder:
    order = db.get(RadOrder, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Radiology order not found")
    return order


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def create_order(
    payload: RadOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(clinical_order_access),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    proc = db.get(RadProcedureDef, payload.procedure_def_id)
    if not proc or not proc.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Radiology procedure not found")

    order = RadOrder(
        procedure_def_id=proc.id,
        patient_id=patient.id,
        encounter_id=payload.encounter_id,
        ordered_by_id=user.id,
        priority=payload.priority,
        clinical_notes=payload.clinical_notes,
    )
    db.add(order)
    from_request(
        db, request, user, "CREATE", "rad_order",
        resource_id=order.id, patient_id=patient.id, detail=f"{proc.modality}:{proc.code}",
    )
    db.commit()
    db.refresh(order)
    return RadOrderOut.build(order).model_dump(mode="json")


@router.get("/orders")
def list_orders(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    modality: Optional[str] = None,
    patient_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(RadOrder).order_by(RadOrder.id.desc()).limit(200)
    if status_filter:
        stmt = stmt.where(RadOrder.status == status_filter)
    if patient_id:
        stmt = stmt.where(RadOrder.patient_id == patient_id)
    if modality:
        stmt = stmt.join(RadProcedureDef).where(RadProcedureDef.modality == modality)

    def sort_key(o: RadOrder):
        priority_rank = {"STAT": 0, "URGENT": 1, "ROUTINE": 2}
        return (priority_rank.get(o.priority, 3), -o.id)

    orders = sorted(db.scalars(stmt), key=sort_key)
    return [RadOrderOut.build(o).model_dump(mode="json") for o in orders]


@router.post("/orders/{order_id}/schedule")
def schedule_order(
    order_id: int,
    payload: ScheduleIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(rad_staff),
):
    order = _get_order(db, order_id)
    if order.status != "ORDERED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot schedule from status {order.status}")
    order.scheduled_at = payload.scheduled_at
    order.status = "SCHEDULED"
    from_request(db, request, user, "UPDATE", "rad_order", resource_id=order.id, detail="scheduled", patient_id=order.patient_id)
    db.commit()
    return RadOrderOut.build(order).model_dump(mode="json")


@router.post("/orders/{order_id}/acquire")
def acquire_images(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(rad_staff),
):
    order = _get_order(db, order_id)
    if order.status != "SCHEDULED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Acquire requires SCHEDULED, got {order.status}")
    order.status = "ACQUIRED"
    order.acquired_at = datetime.now(timezone.utc)
    from_request(db, request, user, "UPDATE", "rad_order", resource_id=order.id, detail="images acquired", patient_id=order.patient_id)
    db.commit()
    return RadOrderOut.build(order).model_dump(mode="json")


@router.post("/orders/{order_id}/prelim")
def submit_prelim_report(
    order_id: int,
    payload: Optional[FinalizeIn] = None,
    request: Request = None,
    db: Session = Depends(get_db),
    user: User = Depends(radiologist_access),
):
    order = _get_order(db, order_id)
    if order.status != "ACQUIRED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Prelim report requires ACQUIRED, got {order.status}")
    order.prelim_report = payload.report
    order.reported_by_id = user.id
    order.preliminary_at = datetime.now(timezone.utc)
    order.status = "PRELIMINARY"
    from_request(db, request, user, "REPORT", "rad_order", resource_id=order.id, detail="preliminary", patient_id=order.patient_id)
    db.commit()
    return RadOrderOut.build(order).model_dump(mode="json")


@router.post("/orders/{order_id}/finalize")
def finalize_report(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(radiologist_access),
    payload: Optional[FinalizeIn] = None,
):
    order = _get_order(db, order_id)
    if order.status != "PRELIMINARY":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Final sign-off requires PRELIMINARY, got {order.status}")
    override = payload.report.strip() if payload and payload.report and payload.report.strip() else None
    order.final_report = override or order.prelim_report
    order.reported_by_id = user.id
    order.finalized_at = datetime.now(timezone.utc)
    order.status = "FINAL"
    from_request(db, request, user, "SIGN", "rad_order", resource_id=order.id, detail="final report", patient_id=order.patient_id)
    db.commit()
    return RadOrderOut.build(order).model_dump(mode="json")


@router.post("/orders/{order_id}/ai-flag")
def ai_triage_flag(
    order_id: int,
    payload: AIFlagIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("RAD_TECH", "FACILITY_ADMIN", "SUPER_ADMIN")),
):
    order = _get_order(db, order_id)
    if order.status in ("FINAL", "CANCELLED"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"AI flags are closed for status {order.status}")
    order.ai_flag = payload.finding
    if payload.priority:
        order.ai_priority = True
    from_request(
        db, request, user, "AI_FLAG", "rad_order",
        resource_id=order.id, patient_id=order.patient_id,
        detail=f"priority={payload.priority} finding={payload.finding}",
    )
    db.commit()
    result = RadOrderOut.build(order).model_dump(mode="json")
    result["note"] = (
        "AI-generated triage marker; advisory only. Report finalization always requires a radiologist."
    )
    return result
