from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DrugCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=200)
    generic_name: Optional[str] = None
    form: Optional[str] = None
    strength: Optional[str] = None
    atc_class: Optional[str] = None
    is_narcotic: bool = False


class BatchCreate(BaseModel):
    batch_no: str = Field(min_length=1, max_length=50)
    expiry_date: date
    quantity: float = Field(gt=0, le=1_000_000)


class DrugOut(DrugCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class BatchOut(BatchCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    drug_id: int


class PrescriptionItemIn(BaseModel):
    drug_id: int
    dosage: str = Field(min_length=1, max_length=60)
    frequency: str = Field(min_length=1, max_length=60)
    duration_days: Optional[int] = Field(default=None, ge=1, le=365)
    quantity: float = Field(default=1, gt=0, le=1000)


class PrescriptionCreate(BaseModel):
    patient_id: int
    encounter_id: Optional[int] = None
    items: list[PrescriptionItemIn] = Field(min_length=1)


class SafetyWarning(BaseModel):
    severity: str
    type: str
    detail: str


class PrescriptionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    drug_id: int
    drug_name: str = ""
    dosage: str
    frequency: str
    duration_days: Optional[int]
    quantity: float


class PrescriptionOut(BaseModel):
    id: int
    patient_id: int
    encounter_id: Optional[int]
    status: str
    warnings: list[SafetyWarning]
    items: list[PrescriptionItemOut]
    created_at: datetime
