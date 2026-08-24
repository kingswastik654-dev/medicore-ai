from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.engine import SCRIBE_DISCLAIMER
from app.ai.gateway import active_provider, draft_soap_with_provider, log_interaction
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    ClinicalNote,
    Diagnosis,
    Encounter,
    Patient,
    User,
    VitalsEntry,
)
from app.schemas.emr import (
    DiagnosisCreate,
    EncounterCreate,
    EncounterDetail,
    NoteCreate,
    NoteOut,
    ScribeDraftRequest,
    VitalsCreate,
)
from app.services.audit import from_request

router = APIRouter(tags=["emr"])

clinician_access = require_roles("DOCTOR")
care_team_access = require_roles("DOCTOR", "NURSE")


def _load_encounter(db: Session, encounter_id: int) -> Encounter:
    enc = db.get(Encounter, encounter_id)
    if not enc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Encounter not found")
    return enc


def _detail(db: Session, enc: Encounter) -> dict:
    notes = db.scalars(
        select(ClinicalNote).where(ClinicalNote.encounter_id == enc.id).order_by(ClinicalNote.id.desc())
    ).all()
    dx = db.scalars(select(Diagnosis).where(Diagnosis.encounter_id == enc.id)).all()
    vitals = db.scalars(
        select(VitalsEntry).where(VitalsEntry.encounter_id == enc.id).order_by(VitalsEntry.id.desc())
    ).all()
    base = EncounterDetail.model_validate(enc).model_dump(mode="json")
    base["patient_name"] = enc.patient.full_name if enc.patient else ""
    base["notes"] = [NoteOut.model_validate(n).model_dump(mode="json") for n in notes]
    base["diagnoses"] = [
        {
            "id": d.id,
            "code": d.code,
            "description": d.description,
            "is_primary": d.is_primary,
            "added_via": d.added_via,
            "confidence": float(d.confidence) if d.confidence is not None else None,
        }
        for d in dx
    ]
    base["vitals"] = [
        {
            "id": v.id,
            "temperature_c": float(v.temperature_c) if v.temperature_c is not None else None,
            "pulse": v.pulse,
            "spo2": v.spo2,
            "systolic": v.systolic,
            "diastolic": v.diastolic,
            "resp_rate": v.resp_rate,
            "recorded_at": v.recorded_at.isoformat() if v.recorded_at else None,
        }
        for v in vitals
    ]
    return base


@router.post("/encounters", status_code=status.HTTP_201_CREATED)
def create_encounter(
    payload: EncounterCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(clinician_access),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    doctor_profile_id = payload.doctor_profile_id
    if user.role == "DOCTOR" and user.doctor_profile and not doctor_profile_id:
        doctor_profile_id = user.doctor_profile.id

    enc = Encounter(
        patient_id=payload.patient_id,
        doctor_profile_id=doctor_profile_id,
        appointment_id=payload.appointment_id,
        enc_type=payload.enc_type,
        chief_complaint=payload.chief_complaint,
        created_by_id=user.id,
    )
    db.add(enc)
    db.flush()
    from_request(db, request, user, "CREATE", "encounter", resource_id=enc.id, patient_id=enc.patient_id)
    db.commit()
    db.refresh(enc)
    return _detail(db, enc)


@router.get("/encounters")
def list_encounters(
    patient_id: Optional[int] = None,
    enc_status: Optional[str] = Query(default=None, alias="status"),
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Encounter).order_by(Encounter.id.desc()).limit(max(1, min(limit, 200)))
    if patient_id:
        stmt = stmt.where(Encounter.patient_id == patient_id)
    if enc_status:
        stmt = stmt.where(Encounter.status == enc_status)
    return [_detail(db, e) for e in db.scalars(stmt)]


@router.get("/encounters/{encounter_id}")
def get_encounter(
    encounter_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _detail(db, _load_encounter(db, encounter_id))


@router.post("/encounters/{encounter_id}/vitals", status_code=status.HTTP_201_CREATED)
def add_vitals(
    encounter_id: int,
    payload: VitalsCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(care_team_access),
):
    enc = _load_encounter(db, encounter_id)
    entry = VitalsEntry(**payload.model_dump(), encounter_id=enc.id, recorded_by_id=user.id)
    db.add(entry)
    from_request(db, request, user, "CREATE", "vitals", resource_id=entry.id, patient_id=enc.patient_id)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "recorded_at": entry.recorded_at.isoformat()}


@router.post("/encounters/{encounter_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def add_note(
    encounter_id: int,
    payload: NoteCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(care_team_access),
):
    enc = _load_encounter(db, encounter_id)
    note = ClinicalNote(
        encounter_id=enc.id,
        author_id=user.id,
        note_type=payload.note_type,
        subjective=payload.subjective,
        objective=payload.objective,
        assessment=payload.assessment,
        plan=payload.plan,
        source=payload.source,
        signed=True,
    )
    db.add(note)
    from_request(
        db, request, user, "CREATE", "clinical_note",
        resource_id=note.id, patient_id=enc.patient_id,
        detail=f"type={note.note_type} source={note.source}",
    )
    db.commit()
    db.refresh(note)
    return NoteOut.model_validate(note)


@router.post("/encounters/{encounter_id}/diagnoses", status_code=status.HTTP_201_CREATED)
def add_diagnosis(
    encounter_id: int,
    payload: DiagnosisCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(clinician_access),
):
    enc = _load_encounter(db, encounter_id)
    dx = Diagnosis(
        encounter_id=enc.id,
        code=payload.code.upper(),
        description=payload.description,
        is_primary=payload.is_primary,
        added_via=payload.added_via,
        confidence=payload.confidence,
    )
    if payload.is_primary:
        for other in db.scalars(select(Diagnosis).where(Diagnosis.encounter_id == enc.id)):
            other.is_primary = False
    db.add(dx)
    from_request(
        db, request, user, "CREATE", "diagnosis",
        resource_id=dx.code, patient_id=enc.patient_id,
        detail=f"via={dx.added_via}",
    )
    db.commit()
    db.refresh(dx)
    return {"id": dx.id, "code": dx.code}


@router.post("/encounters/{encounter_id}/close")
def close_encounter(
    encounter_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(clinician_access),
):
    from datetime import datetime, timezone

    enc = _load_encounter(db, encounter_id)
    if enc.status == "CLOSED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Encounter already closed")
    enc.status = "CLOSED"
    enc.closed_at = datetime.now(timezone.utc)
    from_request(db, request, user, "CLOSE", "encounter", resource_id=enc.id, patient_id=enc.patient_id)
    db.commit()
    return {"id": enc.id, "status": enc.status}


@router.post("/ai/scribe/draft")
def scribe_draft(
    payload: ScribeDraftRequest,
    db: Session = Depends(get_db),
    user: User = Depends(care_team_access),
):
    provider, model = active_provider()
    sections = draft_soap_with_provider(payload.transcript)
    log_interaction(
        db, user,
        feature="SCRIBE_DRAFT",
        input_summary=payload.transcript[:500],
        output_summary=str({k: v for k, v in sections.items() if k in ("subjective", "objective", "assessment", "plan")})[:1500],
    )
    db.commit()
    return {**sections, "provider": provider, "model": model, "disclaimer": SCRIBE_DISCLAIMER}
