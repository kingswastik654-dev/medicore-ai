from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

AppointmentStatus = Literal["BOOKED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]


class DoctorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    doctor_name: str
    specialty: str
    consultation_fee: float
    is_active: bool


class SlotInfo(BaseModel):
    start: str
    end: str
    available: bool


class SlotsResponse(BaseModel):
    date: date
    doctor_profile_id: int
    slots: list[SlotInfo]


class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_profile_id: int
    scheduled_date: date
    slot_start: time
    chief_complaint: Optional[str] = Field(default=None, max_length=500)


class RescheduleRequest(BaseModel):
    scheduled_date: date
    slot_start: time


class StatusUpdateRequest(BaseModel):
    status: AppointmentStatus


class PatientBrief(BaseModel):
    id: int
    mrn: str
    full_name: str
    phone: Optional[str] = None

    @classmethod
    def from_patient(cls, p) -> "PatientBrief":
        return cls(id=p.id, mrn=p.mrn, full_name=p.full_name, phone=p.phone)


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    doctor_profile_id: int
    scheduled_date: date
    slot_start: time
    slot_end: time
    token_number: int
    status: AppointmentStatus
    source: str
    chief_complaint: Optional[str] = None
    created_at: datetime
    patient: PatientBrief
    doctor_name: str = ""

    @classmethod
    def build(cls, appt) -> "AppointmentOut":
        base = PatientBrief.from_patient(appt.patient)
        return cls(
            id=appt.id,
            patient_id=appt.patient_id,
            doctor_profile_id=appt.doctor_profile_id,
            scheduled_date=appt.scheduled_date,
            slot_start=appt.slot_start,
            slot_end=appt.slot_end,
            token_number=appt.token_number,
            status=appt.status,
            source=appt.source,
            chief_complaint=appt.chief_complaint,
            created_at=appt.created_at,
            patient=base,
            doctor_name=appt.doctor_profile.doctor_name if appt.doctor_profile else "",
        )
