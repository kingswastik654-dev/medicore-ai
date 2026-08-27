from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field


class EdVisitCreate(BaseModel):
    patient_id: int
    arrival_mode: Literal["WALK_IN", "AMBULANCE"] = "WALK_IN"
    chief_complaint: Optional[str] = Field(default=None, max_length=500)


class TriageIn(BaseModel):
    esi_level: int = Field(ge=1, le=5)


class MlcIn(BaseModel):
    mlc_flag: bool


class DispositionIn(BaseModel):
    disposition: Literal["DISCHARGED", "ADMITTED", "LAMA", "EXPIRED", "REFERRED"]


class EdVisitOut(BaseModel):
    id: int
    patient_id: int
    patient_name: str = ""
    mrn: str = ""
    blood_group: str = ""
    allergies: str = ""
    arrival_mode: str
    esi_level: Optional[int]
    chief_complaint: Optional[str]
    status: str
    mlc_flag: bool
    created_at: datetime
    triaged_at: Optional[datetime]
    doctor_at: Optional[datetime]
    diagnostics_at: Optional[datetime]
    disposed_at: Optional[datetime]
    disposition: Optional[str]
    wait_minutes: int = 0

    @classmethod
    def build(cls, v, now: datetime) -> "EdVisitOut":
        patient = v.patient
        created = v.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        return cls(
            id=v.id,
            patient_id=v.patient_id,
            patient_name=patient.full_name if patient else "",
            mrn=patient.mrn if patient else "",
            blood_group=(patient.blood_group or "") if patient else "",
            allergies=(patient.allergies or "") if patient else "",
            arrival_mode=v.arrival_mode,
            esi_level=v.esi_level,
            chief_complaint=v.chief_complaint,
            status=v.status,
            mlc_flag=v.mlc_flag,
            created_at=v.created_at,
            triaged_at=v.triaged_at,
            doctor_at=v.doctor_at,
            diagnostics_at=v.diagnostics_at,
            disposed_at=v.disposed_at,
            disposition=v.disposition,
            wait_minutes=max(0, int((now - created).total_seconds() // 60)),
        )
