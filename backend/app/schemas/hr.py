from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ShiftAssignIn(BaseModel):
    user_id: int
    work_date: date
    shift: Literal["MORNING", "EVENING", "NIGHT", "OFF"]
    note: Optional[str] = Field(default=None, max_length=200)


class ShiftOut(BaseModel):
    id: int
    user_id: int
    staff_name: str = ""
    role: str = ""
    work_date: date
    shift: str
    note: Optional[str]

    @classmethod
    def build(cls, s) -> "ShiftOut":
        return cls(
            id=s.id,
            user_id=s.user_id,
            staff_name=s.user.full_name if s.user else "",
            role=s.user.role if s.user else "",
            work_date=s.work_date,
            shift=s.shift,
            note=s.note,
        )
