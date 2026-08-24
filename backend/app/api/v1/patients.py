from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Appointment, Invoice, Patient, User
from app.schemas.patient import (
    DuplicateCheckResponse,
    MergeRequest,
    PatientCreate,
    PatientOut,
    PatientUpdate,
)
from app.services.audit import from_request
from app.services.mpi import find_duplicates

router = APIRouter(prefix="/patients", tags=["patients"])

staff_access = get_current_user
registration_access = require_roles("RECEPTIONIST", "NURSE", "DOCTOR")
merge_access = require_roles("RECEPTIONIST")


def _next_mrn(db: Session) -> str:
    seq = (db.scalar(select(func.max(Patient.id))) or 0) + 1
    return f"MRN-{seq:06d}"


@router.post("/check-duplicates", response_model=DuplicateCheckResponse)
def check_duplicates(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    user: User = Depends(staff_access),
):
    matches = find_duplicates(
        db,
        first_name=payload.first_name,
        last_name=payload.last_name,
        dob=payload.dob,
        phone=payload.phone or "",
        national_id=payload.national_id,
        abha_id=payload.abha_id,
    )
    return DuplicateCheckResponse(potential_duplicates=matches)


@router.post("", status_code=status.HTTP_201_CREATED)
def register_patient(
    payload: PatientCreate,
    request: Request,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(registration_access),
):
    matches = find_duplicates(
        db,
        first_name=payload.first_name,
        last_name=payload.last_name,
        dob=payload.dob,
        phone=payload.phone or "",
        national_id=payload.national_id,
        abha_id=payload.abha_id,
    )
    if matches and not force:
        return {"created": False, "potential_duplicates": matches}

    patient = Patient(
        mrn=_next_mrn(db),
        **payload.model_dump(),
        created_by_id=user.id,
    )
    db.add(patient)
    db.flush()
    from_request(db, request, user, "CREATE", "patient", resource_id=patient.mrn, patient_id=patient.id)
    db.commit()
    db.refresh(patient)

    out = PatientOut.model_validate(patient).model_dump(mode="json")
    out["created"] = True
    out["potential_duplicates"] = matches
    return out


@router.get("")
def list_patients(
    q: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    request: Request = None,
    db: Session = Depends(get_db),
    user: User = Depends(staff_access),
):
    stmt = select(Patient).where(Patient.status == "ACTIVE").order_by(Patient.id.desc())
    count_stmt = select(func.count()).select_from(Patient).where(Patient.status == "ACTIVE")
    if q:
        like = f"%{q.lower()}%"
        conditions = or_(
            Patient.mrn.ilike(like),
            Patient.first_name.ilike(like),
            Patient.last_name.ilike(like),
            Patient.phone.ilike(like),
            Patient.national_id.ilike(like),
            Patient.abha_id.ilike(like),
        )
        stmt = stmt.where(conditions)
        count_stmt = count_stmt.where(conditions)

    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    from_request(db, request, user, "LIST", "patient", detail=f"q={q!r} page={page}")
    db.commit()
    return {
        "items": [PatientOut.model_validate(r).model_dump(mode="json") for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(staff_access),
):
    patient = db.get(Patient, patient_id)
    if not patient or patient.status == "MERGED":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    from_request(db, request, user, "READ", "patient", resource_id=patient.mrn, patient_id=patient.id)
    db.commit()
    return PatientOut.model_validate(patient)


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    payload: PatientUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(registration_access),
):
    patient = db.get(Patient, patient_id)
    if not patient or patient.status == "MERGED":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(patient, field, value)

    from_request(
        db, request, user, "UPDATE", "patient",
        resource_id=patient.mrn, patient_id=patient.id,
        detail=",".join(updates.keys()),
    )
    db.commit()
    db.refresh(patient)
    return PatientOut.model_validate(patient)


@router.post("/{patient_id}/merge", response_model=PatientOut)
def merge_patient(
    patient_id: int,
    payload: MergeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(merge_access),
):
    duplicate = db.get(Patient, patient_id)
    survivor = db.get(Patient, payload.survivor_id)
    if not duplicate or not survivor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient record not found")
    if duplicate.id == survivor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot merge a record into itself")
    if duplicate.status != "ACTIVE" or survivor.status != "ACTIVE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Both records must be active to merge")

    db.query(Appointment).filter(Appointment.patient_id == duplicate.id).update(
        {Appointment.patient_id: survivor.id}
    )
    db.query(Invoice).filter(Invoice.patient_id == duplicate.id).update(
        {Invoice.patient_id: survivor.id}
    )
    duplicate.status = "MERGED"
    duplicate.merged_into_id = survivor.id

    from_request(
        db, request, user, "MERGE", "patient",
        resource_id=duplicate.mrn, patient_id=survivor.id,
        detail=f"merged {duplicate.mrn} into {survivor.mrn}",
    )
    db.commit()
    db.refresh(survivor)
    return PatientOut.model_validate(survivor)
