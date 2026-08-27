from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import DoctorProfile, OtBooking, OtRoom, Patient, User
from app.schemas.ot import (
    ChecklistIn,
    OtBookingCreate,
    OtBookingOut,
    OtCancelIn,
    OtCompleteIn,
    OtRoomCreate,
    OtRoomOut,
)
from app.services.audit import from_request

router = APIRouter(prefix="/ot", tags=["ot"])

CHECKLIST_ORDER = ["SIGN_IN", "TIME_OUT", "SIGN_OUT"]


@router.get("/rooms", response_model=list[OtRoomOut])
def list_rooms(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return [OtRoomOut.model_validate(r) for r in db.scalars(select(OtRoom).order_by(OtRoom.code))]


@router.post("/rooms", response_model=OtRoomOut, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: OtRoomCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("FACILITY_ADMIN")),
):
    exists = db.scalar(select(OtRoom).where(OtRoom.code == payload.code))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "OT room code already exists")
    room = OtRoom(**payload.model_dump())
    db.add(room)
    from_request(db, request, user, "CREATE", "ot_room", resource_id=payload.code)
    db.commit()
    db.refresh(room)
    return OtRoomOut.model_validate(room)


@router.get("/bookings")
def list_bookings(
    date: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(OtBooking).order_by(OtBooking.start_at).limit(300)
    if status_filter:
        stmt = stmt.where(OtBooking.status == status_filter)
    if date:
        try:
            day_start = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, microsecond=0)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "date must be YYYY-MM-DD")
        day_end = day_start.replace(hour=23, minute=59, second=59)
        stmt = stmt.where(OtBooking.start_at >= day_start, OtBooking.start_at <= day_end)
    return [OtBookingOut.build(b).model_dump(mode="json") for b in db.scalars(stmt)]


def _get_booking(db: Session, booking_id: int) -> OtBooking:
    booking = db.get(OtBooking, booking_id)
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "OT booking not found")
    return booking


def _assert_no_conflict(
    db: Session, *, room_id: int, surgeon_profile_id: int, start_at: datetime, end_at: datetime
) -> None:
    overlap = select(OtBooking).where(
        OtBooking.status != "CANCELLED",
        OtBooking.start_at < end_at,
        OtBooking.end_at > start_at,
        or_(OtBooking.room_id == room_id, OtBooking.surgeon_profile_id == surgeon_profile_id),
    )
    clash = db.scalar(overlap)
    if clash:
        scope = "room" if clash.room_id == room_id else "surgeon"
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Slot conflicts with existing case #{clash.id} ({scope} double-booking)",
        )


@router.post("/bookings", status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: OtBookingCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR")),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    room = db.get(OtRoom, payload.room_id)
    if not room:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "OT room not found")
    if room.status == "MAINTENANCE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"OT {room.code} is under maintenance")
    surgeon = db.get(DoctorProfile, payload.surgeon_profile_id)
    if not surgeon or not surgeon.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Surgeon profile not found")
    if payload.end_at <= payload.start_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "end_at must be after start_at")

    _assert_no_conflict(
        db,
        room_id=room.id,
        surgeon_profile_id=surgeon.id,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )

    booking = OtBooking(**payload.model_dump())
    db.add(booking)
    from_request(
        db, request, user, "CREATE", "ot_booking",
        resource_id=booking.id, patient_id=patient.id, detail=f"{room.code}:{payload.procedure_name}",
    )
    db.commit()
    db.refresh(booking)
    return OtBookingOut.build(booking).model_dump(mode="json")


@router.post("/bookings/{booking_id}/clearance")
def grant_clearance(
    booking_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR")),
):
    booking = _get_booking(db, booking_id)
    if booking.status != "PLANNED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Clearance requires PLANNED, got {booking.status}")
    booking.cleared_by_id = user.id
    booking.cleared_at = datetime.now(timezone.utc)
    from_request(db, request, user, "UPDATE", "ot_booking", resource_id=booking.id, detail="anesthesia clearance", patient_id=booking.patient_id)
    db.commit()
    return OtBookingOut.build(booking).model_dump(mode="json")


@router.post("/bookings/{booking_id}/checklist")
def mark_checklist(
    booking_id: int,
    payload: ChecklistIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("NURSE", "DOCTOR")),
):
    booking = _get_booking(db, booking_id)
    if booking.status not in ("PLANNED", "IN_PROGRESS"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Checklist closed for status {booking.status}")
    idx = CHECKLIST_ORDER.index(payload.phase)
    prior = [p.lower() for p in CHECKLIST_ORDER[:idx]]
    for phase in prior:
        if not getattr(booking, f"{phase}_done"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{phase.upper()} must be completed before {payload.phase}")

    setattr(booking, f"{payload.phase.lower()}_done", True)
    from_request(db, request, user, "UPDATE", "ot_booking", resource_id=booking.id, detail=f"WHO SSC {payload.phase}", patient_id=booking.patient_id)
    db.commit()
    return OtBookingOut.build(booking).model_dump(mode="json")


@router.post("/bookings/{booking_id}/start")
def start_case(
    booking_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("NURSE", "DOCTOR")),
):
    booking = _get_booking(db, booking_id)
    if booking.status != "PLANNED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Start requires PLANNED, got {booking.status}")
    if not booking.cleared_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Anesthesia clearance required before start")
    if not (booking.sign_in_done and booking.time_out_done):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "WHO SSC Sign-In and Time-Out must be completed before knife-to-skin")
    if booking.room.status == "MAINTENANCE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"OT {booking.room.code} is under maintenance")

    booking.status = "IN_PROGRESS"
    booking.started_at = datetime.now(timezone.utc)
    booking.room.status = "IN_USE"
    from_request(db, request, user, "UPDATE", "ot_booking", resource_id=booking.id, detail="case started", patient_id=booking.patient_id)
    db.commit()
    return OtBookingOut.build(booking).model_dump(mode="json")


@router.post("/bookings/{booking_id}/complete")
def complete_case(
    booking_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR")),
    payload: Optional[OtCompleteIn] = None,
):
    booking = _get_booking(db, booking_id)
    if booking.status != "IN_PROGRESS":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Complete requires IN_PROGRESS, got {booking.status}")
    if not booking.sign_out_done:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "WHO SSC Sign-Out must be completed before closing the case")
    if payload and payload.implants_note:
        booking.implants_note = payload.implants_note
    booking.status = "COMPLETED"
    booking.completed_at = datetime.now(timezone.utc)
    booking.room.status = "AVAILABLE"
    from_request(db, request, user, "COMPLETE", "ot_booking", resource_id=booking.id, patient_id=booking.patient_id)
    db.commit()
    return OtBookingOut.build(booking).model_dump(mode="json")


@router.post("/bookings/{booking_id}/cancel")
def cancel_case(
    booking_id: int,
    payload: OtCancelIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR", "FACILITY_ADMIN")),
):
    booking = _get_booking(db, booking_id)
    if booking.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot cancel from status {booking.status}")
    booking.status = "CANCELLED"
    booking.cancel_reason = payload.reason
    if booking.room.status == "IN_USE":
        booking.room.status = "AVAILABLE"
    from_request(db, request, user, "CANCEL", "ot_booking", resource_id=booking.id, detail=payload.reason[:100], patient_id=booking.patient_id)
    db.commit()
    return OtBookingOut.build(booking).model_dump(mode="json")
