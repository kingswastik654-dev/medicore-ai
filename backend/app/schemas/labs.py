from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class LabTestCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=200)
    unit: Optional[str] = Field(default=None, max_length=20)
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None
    tat_hours: int = Field(default=24, ge=1, le=720)
    price: float = Field(default=0, ge=0)


class LabTestOut(LabTestCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class LabOrderCreate(BaseModel):
    patient_id: int
    test_def_id: int
    encounter_id: Optional[int] = None
    priority: Literal["ROUTINE", "URGENT", "STAT"] = "ROUTINE"


class LabResultIn(BaseModel):
    value_numeric: Optional[float] = None
    value_text: Optional[str] = Field(default=None, max_length=250)


class LabResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    value_numeric: Optional[float]
    value_text: Optional[str]
    is_abnormal: bool
    is_critical: bool
    verified_at: Optional[datetime]


class LabOrderOut(BaseModel):
    id: int
    patient_id: int
    encounter_id: Optional[int]
    priority: str
    status: str
    ordered_at: datetime
    collected_at: Optional[datetime]
    test_code: str = ""
    test_name: str = ""
    unit: Optional[str] = None
    result: Optional[LabResultOut] = None

    @classmethod
    def build(cls, order) -> "LabOrderOut":
        res = getattr(order, "result", None)
        return cls(
            id=order.id,
            patient_id=order.patient_id,
            encounter_id=order.encounter_id,
            priority=order.priority,
            status=order.status,
            ordered_at=order.ordered_at,
            collected_at=order.collected_at,
            test_code=order.test_def.code if order.test_def else "",
            test_name=order.test_def.name if order.test_def else "",
            unit=order.test_def.unit if order.test_def else None,
            result=LabResultOut.model_validate(res).model_dump() if res else None,
        )
