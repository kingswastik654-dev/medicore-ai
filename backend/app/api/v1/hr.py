from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import ShiftAssignment, User
from app.schemas.hr import ShiftAssignIn, ShiftOut
from app.services.audit import from_request

router = APIRouter(prefix="/hr", tags=["hr"])


def _parse_day(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dates must be YYYY-MM-DD")


@router.get("/shifts")
def list_shifts(
    date: Optional[str] = Query(default=None),
    user_id: Optional[int] = None,
    date_from: Optional[str] = Query(default=None, alias="from"),
    date_to: Optional[str] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(ShiftAssignment).order_by(ShiftAssignment.work_date, ShiftAssignment.id).limit(400)
    try:
        if date:
            stmt = stmt.where(ShiftAssignment.work_date == _parse_day(date))
        if date_from:
            stmt = stmt.where(ShiftAssignment.work_date >= _parse_day(date_from))
        if date_to:
            stmt = stmt.where(ShiftAssignment.work_date <= _parse_day(date_to))
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dates must be YYYY-MM-DD")
    if user_id:
        stmt = stmt.where(ShiftAssignment.user_id == user_id)
    return [ShiftOut.build(s).model_dump(mode="json") for s in db.scalars(stmt)]


@router.post("/shifts", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
def assign_shift(
    payload: ShiftAssignIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("FACILITY_ADMIN", "SUPER_ADMIN")),
):
    staff = db.get(User, payload.user_id)
    if not staff or not staff.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found or inactive")
    clash = db.scalar(
        select(ShiftAssignment).where(
            ShiftAssignment.user_id == payload.user_id,
            ShiftAssignment.work_date == payload.work_date,
        )
    )
    if clash:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{staff.full_name} already has {clash.shift} on {payload.work_date.isoformat()}; remove it first",
        )
    assignment = ShiftAssignment(**payload.model_dump(), created_by_id=user.id)
    db.add(assignment)
    from_request(db, request, user, "CREATE", "shift", resource_id=assignment.id, detail=f"user={staff.username}:{payload.shift}:{payload.work_date.isoformat()}")
    db.commit()
    db.refresh(assignment)
    return ShiftOut.build(assignment)


@router.delete("/shifts/{shift_id}")
def remove_shift(
    shift_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("FACILITY_ADMIN", "SUPER_ADMIN")),
):
    assignment = db.get(ShiftAssignment, shift_id)
    if not assignment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shift assignment not found")
    detail = f"user_id={assignment.user_id}:{assignment.shift}:{assignment.work_date.isoformat()}"
    db.delete(assignment)
    from_request(db, request, user, "DELETE", "shift", resource_id=shift_id, detail=detail)
    db.commit()
    return {"id": shift_id, "removed": True}


@router.get("/coverage")
def coverage(
    date: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    work_date = _parse_day(date)

    rows = db.execute(
        select(ShiftAssignment.shift, func.count(ShiftAssignment.id))
        .where(ShiftAssignment.work_date == work_date)
        .group_by(ShiftAssignment.shift)
    ).all()

    assignments = db.scalars(select(ShiftAssignment).where(ShiftAssignment.work_date == work_date)).all()
    by_shift: dict[str, list] = {s: [] for s in ["MORNING", "EVENING", "NIGHT", "OFF"]}
    for a in assignments:
        by_shift.setdefault(a.shift, []).append({
            "user_id": a.user_id,
            "staff_name": a.user.full_name if a.user else "",
            "role": a.user.role if a.user else "",
            "note": a.note,
        })

    return {
        "date": work_date.isoformat(),
        "counts": {shift: n for shift, n in rows},
        "on_duty": sum(n for shift, n in rows if shift != "OFF"),
        "assignments": by_shift,
    }
