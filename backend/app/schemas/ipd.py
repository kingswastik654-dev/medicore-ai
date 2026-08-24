from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class WardCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=20, pattern=r"^[A-Z0-9_-]+$")
    floor: Optional[str] = Field(default=None, max_length=30)


class BedCreate(BaseModel):
    ward_id: int
    bed_no: str = Field(min_length=1, max_length=15)
    bed_type: Literal["GENERAL", "PRIVATE", "ICU", "DAYCARE"] = "GENERAL"


class BedOut(BaseModel):
    id: int
    ward_id: int
    ward_name: str = ""
    bed_no: str
    bed_type: str
    status: str
    patient_name: Optional[str] = None
    admission_id: Optional[int] = None

    @classmethod
    def build(cls, bed, active_admission=None) -> "BedOut":
        return cls(
            id=bed.id,
            ward_id=bed.ward_id,
            ward_name=bed.ward.name if bed.ward else "",
            bed_no=bed.bed_no,
            bed_type=bed.bed_type,
            status=bed.status,
            patient_name=(
                active_admission.patient.full_name
                if active_admission and active_admission.patient
                else None
            ),
            admission_id=active_admission.id if active_admission else None,
        )


class AdmitRequest(BaseModel):
    patient_id: int
    bed_id: Optional[int] = None
    ward_code: Optional[str] = None
    attending_profile_id: Optional[int] = None
    expected_days: Optional[int] = Field(default=None, ge=1, le=365)


class TransferRequest(BaseModel):
    target_bed_id: int


class DischargeRequest(BaseModel):
    discharge_note: Optional[str] = Field(default=None, max_length=2000)


class OccupancyRow(BaseModel):
    ward: str
    total: int
    occupied: int
    available: int
    cleaning: int
    maintenance: int
    occupancy_pct: float


class OccupancyResponse(BaseModel):
    as_of: datetime
    overall_pct: float
    wards: list[OccupancyRow]
