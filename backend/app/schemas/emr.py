from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class EncounterCreate(BaseModel):
    patient_id: int
    doctor_profile_id: Optional[int] = None
    appointment_id: Optional[int] = None
    enc_type: Literal["OPD", "IPD", "EMERGENCY", "TELE"] = "OPD"
    chief_complaint: Optional[str] = Field(default=None, max_length=500)


class VitalsCreate(BaseModel):
    temperature_c: Optional[float] = Field(default=None, ge=25, le=45)
    pulse: Optional[int] = Field(default=None, ge=20, le=250)
    spo2: Optional[int] = Field(default=None, ge=50, le=100)
    systolic: Optional[int] = Field(default=None, ge=50, le=300)
    diastolic: Optional[int] = Field(default=None, ge=20, le=200)
    resp_rate: Optional[int] = Field(default=None, ge=4, le=80)


class NoteDraftSections(BaseModel):
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""


class ScribeDraftRequest(BaseModel):
    transcript: str = Field(min_length=10)


class NoteCreate(BaseModel):
    note_type: Literal["SOAP", "PROGRESS", "PROCEDURE", "NURSING"] = "SOAP"
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    source: Literal["MANUAL", "AI_SCRIBE"] = "MANUAL"


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    encounter_id: int
    note_type: str
    subjective: Optional[str]
    objective: Optional[str]
    assessment: Optional[str]
    plan: Optional[str]
    source: str
    signed: bool
    created_at: datetime


class DiagnosisCreate(BaseModel):
    code: str = Field(min_length=2, max_length=10)
    description: str = Field(min_length=2, max_length=250)
    is_primary: bool = False
    added_via: Literal["MANUAL", "AI_SUGGESTION"] = "MANUAL"
    confidence: Optional[float] = Field(default=None, ge=0, le=100)


class VitalsOut(VitalsCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    recorded_at: datetime


class EncounterBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    doctor_profile_id: Optional[int]
    enc_type: str
    status: str
    chief_complaint: Optional[str]
    started_at: datetime
    closed_at: Optional[datetime]


class EncounterDetail(EncounterBrief):
    patient_name: str = ""
    notes: list[NoteOut] = []
    diagnoses: list[dict] = []
    vitals: list[dict] = []
