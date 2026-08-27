from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

MODALITY = Literal["XRAY", "CT", "MRI", "US", "MAMMO"]


class RadProcedureCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=200)
    modality: MODALITY
    body_part: Optional[str] = Field(default=None, max_length=60)
    tat_minutes: int = Field(default=60, ge=5, le=1440)
    price: float = Field(default=0, ge=0)


class RadProcedureOut(RadProcedureCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class RadOrderCreate(BaseModel):
    patient_id: int
    procedure_def_id: int
    encounter_id: Optional[int] = None
    priority: Literal["ROUTINE", "URGENT", "STAT"] = "ROUTINE"
    clinical_notes: Optional[str] = Field(default=None, max_length=500)


class ScheduleIn(BaseModel):
    scheduled_at: datetime


class PrelimIn(BaseModel):
    report: str = Field(min_length=5, max_length=4000)


class FinalizeIn(BaseModel):
    report: Optional[str] = Field(default=None, max_length=4000)


class AIFlagIn(BaseModel):
    finding: str = Field(min_length=3, max_length=300)
    priority: bool = False


class RadOrderOut(BaseModel):
    id: int
    patient_id: int
    encounter_id: Optional[int]
    priority: str
    status: str
    clinical_notes: Optional[str]
    ordered_at: datetime
    scheduled_at: Optional[datetime]
    acquired_at: Optional[datetime]
    preliminary_at: Optional[datetime]
    finalized_at: Optional[datetime]
    prelim_report: Optional[str]
    final_report: Optional[str]
    ai_flag: Optional[str]
    ai_priority: bool
    modality: str = ""
    procedure_code: str = ""
    procedure_name: str = ""
    reported_by: str = ""

    @classmethod
    def build(cls, order) -> "RadOrderOut":
        reporter = order.reported_by
        return cls(
            id=order.id,
            patient_id=order.patient_id,
            encounter_id=order.encounter_id,
            priority=order.priority,
            status=order.status,
            clinical_notes=order.clinical_notes,
            ordered_at=order.ordered_at,
            scheduled_at=order.scheduled_at,
            acquired_at=order.acquired_at,
            preliminary_at=order.preliminary_at,
            finalized_at=order.finalized_at,
            prelim_report=order.prelim_report,
            final_report=order.final_report,
            ai_flag=order.ai_flag,
            ai_priority=order.ai_priority or False,
            modality=order.procedure_def.modality if order.procedure_def else "",
            procedure_code=order.procedure_def.code if order.procedure_def else "",
            procedure_name=order.procedure_def.name if order.procedure_def else "",
            reported_by=reporter.full_name if reporter else "",
        )
