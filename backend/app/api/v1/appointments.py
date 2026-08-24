from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    ACTIVE_APPOINTMENT_STATUSES,
    APPOINTMENT_STATUSES,
    Appointment,
    DoctorProfile,
    DoctorSchedule,
    Patient,
    User,
)
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    DoctorOut,
    RescheduleRequest,
    SlotInfo,
    SlotsResponse,
    StatusUpdateRequest,
)
from app.services.audit import from_request

router = APIRouter(tags=["appointments"])

booking_access = require_roles("RECEPTIONIST", "NURSE", "DOCTOR")


@router.get("/doctors", response_model=list[DoctorOut])
def list_doctors(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profiles = db.scalars(
        select(DoctorProfile).where(DoctorProfile.is_active == True)  # noqa: E712
    ).all()
    return [DoctorOut.model_validate(p) for p in profiles]


def _generate_slots(db: Session, doctor_profile_id: int, day: date) -> list[SlotInfo]:
    schedules = db.scalars(
        select(DoctorSchedule).where(
            DoctorSchedule.doctor_profile_id == doctor_profile_id,
            DoctorSchedule.weekday == day.weekday(),
            DoctorSchedule.is_active == True,  # noqa: E712
        )
    ).all()
    if not schedules:
        return []

    booked = set(
        db.scalars(
            select(Appointment.slot_start).where(
                Appointment.doctor_profile_id == doctor_profile_id,
                Appointment.scheduled_date == day,
                Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
            )
        )
    )

    slots: dict[str, SlotInfo] = {}
    for s in schedules:
        cursor = datetime.combine(day, s.start_time)
        end = datetime.combine(day, s.end_time)
        while cursor + timedelta(minutes=s.slot_minutes) <= end:
            start_t = cursor.time()
            end_t = (cursor + timedelta(minutes=s.slot_minutes)).time()
            key = start_t.isoformat()
            info = SlotInfo(start=key, end=end_t.isoformat(), available=start_t not in booked)
            if key in slots:
                slots[key].available = slots[key].available and info.available
            else:
                slots[key] = info
            cursor += timedelta(minutes=s.slot_minutes)

    return [slots[k] for k in sorted(slots.keys())]


@router.get("/doctors/{doctor_profile_id}/slots", response_model=SlotsResponse)
def get_slots(
    doctor_profile_id: int,
    day: date = Query(alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = db.get(DoctorProfile, doctor_profile_id)
    if not profile or not profile.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    return SlotsResponse(date=day, doctor_profile_id=doctor_profile_id, slots=_generate_slots(db, doctor_profile_id, day))


def _validate_slot(db: Session, doctor_profile_id: int, day: date, slot_start: time) -> time:
    slots = {s.start: s for s in _generate_slots(db, doctor_profile_id, day)}
    info = slots.get(slot_start.isoformat())
    if info is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Slot is outside the doctor's schedule")
    return (
        datetime.strptime(info.end, "%H:%M:%S").time()
        if len(info.end.split(":")) == 3
        else datetime.strptime(info.end, "%H:%M").time()
    )


def _book(db: Session, payload: AppointmentCreate, user: User) -> Appointment:
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    profile = db.get(DoctorProfile, payload.doctor_profile_id)
    if not profile or not profile.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    if payload.scheduled_date < date.today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot book in the past")

    slot_end = _validate_slot(db, payload.doctor_profile_id, payload.scheduled_date, payload.slot_start)

    token = (
        db.scalar(
            select(func.max(Appointment.token_number)).where(
                Appointment.doctor_profile_id == payload.doctor_profile_id,
                Appointment.scheduled_date == payload.scheduled_date,
            )
        )
        or 0
    ) + 1

    appointment = Appointment(
        patient_id=payload.patient_id,
        doctor_profile_id=payload.doctor_profile_id,
        scheduled_date=payload.scheduled_date,
        slot_start=payload.slot_start,
        slot_end=slot_end,
        token_number=token,
        chief_complaint=payload.chief_complaint,
        created_by_id=user.id,
        facility_id=user.facility_id,
    )
    db.add(appointment)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Slot already booked")
    return appointment


@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def book_appointment(
    payload: AppointmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(booking_access),
):
    appointment = _book(db, payload, user)
    from_request(
        db, request, user, "CREATE", "appointment",
        resource_id=appointment.id, patient_id=appointment.patient_id,
        detail=f"doc={payload.doctor_profile_id} date={payload.scheduled_date} slot={payload.slot_start}",
    )
    db.commit()
    db.refresh(appointment)
    return AppointmentOut.build(appointment)


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(
    day: Optional[date] = Query(default=None, alias="date"),
    doctor_profile_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    appt_status: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Appointment).order_by(Appointment.scheduled_date, Appointment.slot_start)
    if day:
        stmt = stmt.where(Appointment.scheduled_date == day)
    if doctor_profile_id:
        stmt = stmt.where(Appointment.doctor_profile_id == doctor_profile_id)
    if patient_id:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if appt_status:
        if appt_status not in APPOINTMENT_STATUSES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid status filter")
        stmt = stmt.where(Appointment.status == appt_status)
    rows = db.scalars(stmt.limit(500)).all()
    return [AppointmentOut.build(a) for a in rows]


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
def update_status(
    appointment_id: int,
    payload: StatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(booking_access),
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    allowed = {
        "BOOKED": {"CHECKED_IN", "CANCELLED", "NO_SHOW"},
        "CHECKED_IN": {"IN_PROGRESS", "NO_SHOW"},
        "IN_PROGRESS": {"COMPLETED"},
        "COMPLETED": set(),
        "CANCELLED": set(),
        "NO_SHOW": set(),
    }
    if payload.status not in allowed[appointment.status]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Cannot move from {appointment.status} to {payload.status}",
        )
    previous = appointment.status
    appointment.status = payload.status
    from_request(
        db, request, user, "UPDATE", "appointment",
        resource_id=appointment.id, patient_id=appointment.patient_id,
        detail=f"{previous}->{payload.status}",
    )
    db.commit()
    db.refresh(appointment)
    return AppointmentOut.build(appointment)


@router.post("/appointments/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: int,
    payload: RescheduleRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(booking_access),
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    if appointment.status not in ("BOOKED",):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only BOOKED appointments can be rescheduled")

    old = f"{appointment.scheduled_date}@{appointment.slot_start}"
    appointment.status = "CANCELLED"
    new_payload = AppointmentCreate(
        patient_id=appointment.patient_id,
        doctor_profile_id=appointment.doctor_profile_id,
        scheduled_date=payload.scheduled_date,
        slot_start=payload.slot_start,
        chief_complaint=appointment.chief_complaint,
    )
    try:
        moved = _book(db, new_payload, user)
    except HTTPException:
        appointment.status = "BOOKED"
        raise
    from_request(
        db, request, user, "RESCHEDULE", "appointment",
        resource_id=moved.id, patient_id=moved.patient_id,
        detail=f"was {old}",
    )
    db.commit()
    db.refresh(moved)
    return AppointmentOut.build(moved)
