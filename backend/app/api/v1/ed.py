from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import EdVisit, Patient, User
from app.schemas.ed import DispositionIn, EdVisitCreate, EdVisitOut, MlcIn, TriageIn
from app.services.audit import from_request

router = APIRouter(prefix="/ed", tags=["emergency"])

STAGE_FLOW = ["TRIAGED", "WITH_DOCTOR", "DIAGNOSTICS"]


def _get_visit(db: Session, visit_id: int) -> EdVisit:
    visit = db.get(EdVisit, visit_id)
    if not visit:
        raise HTTPException(404, "ED visit not found")
    return visit


@router.post("/visits", status_code=201)
def register_visit(
    payload: EdVisitCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("RECEPTIONIST", "NURSE", "DOCTOR")),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    visit = EdVisit(
        patient_id=patient.id,
        arrival_mode=payload.arrival_mode,
        chief_complaint=payload.chief_complaint,
        registered_by_id=user.id,
    )
    db.add(visit)
    from_request(db, request, user, "CREATE", "ed_visit", resource_id=visit.id, patient_id=patient.id, detail=f"casualty:{payload.arrival_mode}")
    db.commit()
    db.refresh(visit)
    return EdVisitOut.build(visit, datetime.now(timezone.utc)).model_dump(mode="json")


@router.get("/visits")
def list_visits(
    include_disposed: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(EdVisit).order_by(EdVisit.id.desc()).limit(200)
    if not include_disposed:
        stmt = stmt.where(EdVisit.status != "DISPOSED")
    now = datetime.now(timezone.utc)

    def sort_key(v: EdVisit):
        esi_rank = v.esi_level if v.esi_level is not None else 9
        active = 0 if v.status != "DISPOSED" else 1
        return (active, esi_rank, -v.id)

    visits = sorted(db.scalars(stmt), key=sort_key)
    return [EdVisitOut.build(v, now).model_dump(mode="json") for v in visits]


@router.get("/board")
def tracking_board(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    visits = db.scalars(select(EdVisit).order_by(EdVisit.created_at)).all()
    columns: dict[str, list] = {stage: [] for stage in ["REGISTERED", "TRIAGED", "WITH_DOCTOR", "DIAGNOSTICS", "DISPOSED"]}
    longest_wait = 0
    critical_open = 0
    mlc_open = 0

    for v in visits:
        item = EdVisitOut.build(v, now).model_dump(mode="json")
        columns.setdefault(v.status, []).append(item)
        if v.status != "DISPOSED":
            longest_wait = max(longest_wait, item["wait_minutes"])
            critical_open += 1 if (v.esi_level is not None and v.esi_level <= 2) else 0
            mlc_open += 1 if v.mlc_flag else 0

    return {
        "columns": columns,
        "stats": {
            "active": sum(len(c) for s, c in columns.items() if s != "DISPOSED"),
            "critical_open": critical_open,
            "mlc_open": mlc_open,
            "longest_wait_minutes": longest_wait,
            "disposed_today": len(columns["DISPOSED"]),
        },
    }


@router.post("/visits/{visit_id}/triage")
def triage_visit(
    visit_id: int,
    payload: TriageIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("NURSE", "DOCTOR")),
):
    visit = _get_visit(db, visit_id)
    if visit.status != "REGISTERED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Triage requires REGISTERED, got {visit.status}")
    visit.esi_level = payload.esi_level
    visit.triaged_by_id = user.id
    visit.triaged_at = datetime.now(timezone.utc)
    visit.status = "TRIAGED"
    from_request(db, request, user, "UPDATE", "ed_visit", resource_id=visit.id, patient_id=visit.patient_id, detail=f"ESI={payload.esi_level}")
    db.flush()

    if payload.esi_level <= 2:
        from app.services.notify import queue as notify_queue

        patient = db.get(Patient, visit.patient_id)
        notify_queue(
            db,
            event="ED_CRITICAL",
            body=(
                f"ED ALERT: ESI-{payload.esi_level} arrival "
                f"({patient.full_name if patient else 'patient'}) — {visit.chief_complaint or 'undifferentiated'}. Immediate physician required."
            ),
            recipient_name="ED charge nurse",
            related_type="ed_visit",
            related_id=visit.id,
        )
    db.commit()
    return EdVisitOut.build(visit, datetime.now(timezone.utc)).model_dump(mode="json")


@router.post("/visits/{visit_id}/advance")
def advance_stage(
    visit_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("NURSE", "DOCTOR")),
):
    visit = _get_visit(db, visit_id)
    try:
        idx = STAGE_FLOW.index(visit.status)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot advance from status {visit.status}")

    next_stage = STAGE_FLOW[idx + 1] if idx + 1 < len(STAGE_FLOW) else None
    if next_stage is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Visit is at DIAGNOSTICS; record a disposition instead")

    visit.status = next_stage
    setattr(visit, "doctor_at" if next_stage == "WITH_DOCTOR" else "diagnostics_at", datetime.now(timezone.utc))
    from_request(db, request, user, "UPDATE", "ed_visit", resource_id=visit.id, patient_id=visit.patient_id, detail=next_stage)
    db.commit()
    return EdVisitOut.build(visit, datetime.now(timezone.utc)).model_dump(mode="json")


@router.post("/visits/{visit_id}/mlc")
def set_mlc_flag(
    visit_id: int,
    payload: MlcIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR", "FACILITY_ADMIN", "SUPER_ADMIN")),
):
    visit = _get_visit(db, visit_id)
    visit.mlc_flag = payload.mlc_flag
    from_request(db, request, user, "UPDATE", "ed_visit", resource_id=visit.id, patient_id=visit.patient_id, detail=f"mlc={payload.mlc_flag}")
    db.commit()
    return EdVisitOut.build(visit, datetime.now(timezone.utc)).model_dump(mode="json")


@router.post("/visits/{visit_id}/disposition")
def record_disposition(
    visit_id: int,
    payload: DispositionIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR")),
):
    visit = _get_visit(db, visit_id)
    if visit.status == "REGISTERED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Triage must be recorded before disposition")
    if visit.status == "DISPOSED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Visit already disposed")

    visit.status = "DISPOSED"
    visit.disposition = payload.disposition
    visit.disposed_at = datetime.now(timezone.utc)
    from_request(db, request, user, "DISPOSITION", "ed_visit", resource_id=visit.id, patient_id=visit.patient_id, detail=payload.disposition)
    db.commit()
    return EdVisitOut.build(visit, datetime.now(timezone.utc)).model_dump(mode="json")
