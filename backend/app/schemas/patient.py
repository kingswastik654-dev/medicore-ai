from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Gender = Literal["MALE", "FEMALE", "OTHER"]


class DuplicateMatch(BaseModel):
    patient_id: int
    mrn: str
    name: str
    dob: Optional[date] = None
    phone: Optional[str] = None
    score: int


class DuplicateCheckResponse(BaseModel):
    potential_duplicates: list[DuplicateMatch]


class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = None
    blood_group: Optional[str] = Field(default=None, max_length=5)
    allergies: Optional[str] = None
    national_id: Optional[str] = Field(default=None, max_length=40)
    abha_id: Optional[str] = Field(default=None, max_length=40)


class PatientUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = None
    blood_group: Optional[str] = Field(default=None, max_length=5)
    allergies: Optional[str] = None
    national_id: Optional[str] = Field(default=None, max_length=40)
    abha_id: Optional[str] = Field(default=None, max_length=40)


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mrn: str
    first_name: str
    last_name: str
    full_name: str
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    national_id: Optional[str] = None
    abha_id: Optional[str] = None
    status: str
    created_at: datetime


class MergeRequest(BaseModel):
    survivor_id: int


class Page(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
