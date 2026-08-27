from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class OtRoomCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=120)
    floor: Optional[str] = Field(default=None, max_length=20)


class OtRoomOut(OtRoomCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str


class OtBookingCreate(BaseModel):
    room_id: int
    patient_id: int
    surgeon_profile_id: int
    procedure_name: str = Field(min_length=3, max_length=200)
    procedure_code: Optional[str] = Field(default=None, max_length=30)
    anesthesia_type: Optional[Literal["GA", "RA", "LOCAL", "SEDATION"]] = None
    start_at: datetime
    end_at: datetime


class ChecklistIn(BaseModel):
    phase: Literal["SIGN_IN", "TIME_OUT", "SIGN_OUT"]


class OtCompleteIn(BaseModel):
    implants_note: Optional[str] = Field(default=None, max_length=1000)


class OtCancelIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class OtBookingOut(BaseModel):
    id: int
    room_id: int
    room_code: str = ""
    room_name: str = ""
    patient_id: int
    patient_name: str = ""
    mrn: str = ""
    surgeon_profile_id: int
    surgeon_name: str = ""
    procedure_name: str
    procedure_code: Optional[str]
    anesthesia_type: Optional[str]
    start_at: datetime
    end_at: datetime
    status: str
    cleared: bool = False
    cleared_by: str = ""
    sign_in_done: bool
    time_out_done: bool
    sign_out_done: bool
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    implants_note: Optional[str]
    cancel_reason: Optional[str]

    @classmethod
    def build(cls, b) -> "OtBookingOut":
        return cls(
            id=b.id,
            room_id=b.room_id,
            room_code=b.room.code if b.room else "",
            room_name=b.room.name if b.room else "",
            patient_id=b.patient_id,
            patient_name=b.patient.full_name if b.patient else "",
            mrn=b.patient.mrn if b.patient else "",
            surgeon_profile_id=b.surgeon_profile_id,
            surgeon_name=b.surgeon_profile.doctor_name if b.surgeon_profile else "",
            procedure_name=b.procedure_name,
            procedure_code=b.procedure_code,
            anesthesia_type=b.anesthesia_type,
            start_at=b.start_at,
            end_at=b.end_at,
            status=b.status,
            cleared=b.cleared_at is not None,
            cleared_by=b.cleared_by.full_name if b.cleared_by else "",
            sign_in_done=b.sign_in_done,
            time_out_done=b.time_out_done,
            sign_out_done=b.sign_out_done,
            started_at=b.started_at,
            completed_at=b.completed_at,
            implants_note=b.implants_note,
            cancel_reason=b.cancel_reason,
        )
