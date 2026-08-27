from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

BLOOD_GROUP_PATTERN = r"^(A|B|AB|O)[+-]$"


class BloodDonorCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    blood_group: str = Field(pattern=BLOOD_GROUP_PATTERN)
    phone: Optional[str] = Field(default=None, max_length=25)
    notes: Optional[str] = Field(default=None, max_length=500)


class BloodDonorOut(BloodDonorCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_donation_on: Optional[date]
    is_deferred: bool


class BloodUnitCollect(BaseModel):
    unit_no: str = Field(min_length=3, max_length=30)
    donor_id: Optional[int] = None
    blood_group: Optional[str] = Field(default=None, pattern=BLOOD_GROUP_PATTERN)
    component: Literal["WHOLE_BLOOD", "PRBC", "FFP", "PLATELETS"] = "WHOLE_BLOOD"
    volume_ml: int = Field(default=350, ge=50, le=750)
    expires_on: Optional[date] = None


class BloodUnitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    unit_no: str
    donor_id: Optional[int]
    blood_group: str
    component: str
    volume_ml: int
    collected_on: date
    expires_on: date
    status: str


class CrossMatchCreate(BaseModel):
    patient_id: int
    unit_id: int
    notes: Optional[str] = Field(default=None, max_length=300)


class TestResultIn(BaseModel):
    compatible: bool


class CrossMatchOut(BaseModel):
    id: int
    patient_id: int
    patient_name: str = ""
    unit_id: int
    unit_no: str = ""
    blood_group: str = ""
    component: str = ""
    status: str
    notes: Optional[str]
    created_at: datetime
    issued_at: Optional[datetime]

    @classmethod
    def build(cls, r) -> "CrossMatchOut":
        return cls(
            id=r.id,
            patient_id=r.patient_id,
            patient_name=r.patient.full_name if r.patient else "",
            unit_id=r.unit_id,
            unit_no=r.unit.unit_no if r.unit else "",
            blood_group=r.unit.blood_group if r.unit else "",
            component=r.unit.component if r.unit else "",
            status=r.status,
            notes=r.notes,
            created_at=r.created_at,
            issued_at=r.issued_at,
        )


class InventoryRow(BaseModel):
    blood_group: str
    component: str
    units: int
    earliest_expiry: Optional[date] = None
