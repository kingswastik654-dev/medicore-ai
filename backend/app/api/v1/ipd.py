from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    ADMISSION_STATUSES,
    Admission,
    Bed,
    Encounter,
    Patient,
    User,
    Ward,
)
from app.schemas.ipd import (
    AdmitRequest,
    BedCreate,
    BedOut,
    DischargeRequest,
    OccupancyRow,
    OccupancyResponse,
    TransferRequest,
    WardCreate,
)
from app.services.audit import from_request

router = APIRouter(prefix="/ipd", tags=["ipd"])

admission_desk = require_roles("RECEPTIONIST", "DOCTOR")
clinical_ipd = require_roles("DOCTOR")
housekeeping = require_roles("RECEPTIONIST", "NURSE", "FACILITY_ADMIN")


def _active_admission(db: Session, bed_id: int) -> Optional[Admission]:
    return db.scalar(
        select(Admission).where(
            Admission.bed_id == bed_id, Admission.status == "ADMITTED"
        )
    )


@router.get("/wards")
def list_wards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    wards = db.scalars(select(Ward).where(Ward.is_active == True).order_by(Ward.name)).all()  # noqa: E712
    counts = dict(
        db.execute(
            select(Bed.ward_id, Bed.status, func.count()).group_by(Bed.ward_id, Bed.status)
        ).all()
    )
    return [
        {
            "id": w.id,
            "name": w.name,
            "code": w.code,
            "floor": w.floor,
            "beds_total": sum(v for (wid, _), v in counts.items() if wid == w.id),
            "beds_available": counts.get((w.id, "AVAILABLE"), 0),
        }
        for w in wards
    ]


@router.post("/wards", status_code=status.HTTP_201_CREATED)
def create_ward(
    payload: WardCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("FACILITY_ADMIN")),
):
    if db.scalar(select(Ward).where(Ward.code == payload.code)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ward code already exists")
    ward = Ward(**payload.model_dump())
    db.add(ward)
    from_request(db, request, user, "CREATE", "ward", resource_id=payload.code)
    db.commit()
    return {"id": ward.id}


@router.get("/beds", response_model=list[BedOut])
def list_beds(
    ward_id: Optional[int] = None,
    bed_status: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Bed).join(Ward).where(Ward.is_active == True).order_by(Ward.name, Bed.bed_no)  # noqa: E712
    if ward_id:
        stmt = stmt.where(Bed.ward_id == ward_id)
    if bed_status:
        stmt = stmt.where(Bed.status == bed_status)
    beds = db.scalars(stmt).all()

    admissions = {
        a.bed_id: a
        for a in db.scalars(select(Admission).where(Admission.status == "ADMITTED"))
    }
    return [BedOut.build(b, admissions.get(b.id)).model_dump(mode="json") for b in beds]


@router.post("/beds", response_model=BedOut, status_code=status.HTTP_201_CREATED)
def create_bed(
    payload: BedCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("FACILITY_ADMIN")),
):
    ward = db.get(Ward, payload.ward_id)
    if not ward:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ward not found")
    dup = db.scalar(
        select(Bed).where(Bed.ward_id == payload.ward_id, Bed.bed_no == payload.bed_no)
    )
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, "Bed number already exists in this ward")
    bed = Bed(ward_id=payload.ward_id, bed_no=payload.bed_no, bed_type=payload.bed_type)
    db.add(bed)
    from_request(db, request, user, "CREATE", "bed", resource_id=f"{ward.code}-{payload.bed_no}")
    db.commit()
    db.refresh(bed)
    return BedOut.build(bed).model_dump(mode="json")


def _pick_bed(db: Session, bed_id: Optional[int], ward_code: Optional[str]) -> Bed:
    if bed_id:
        bed = db.get(Bed, bed_id)
        if not bed:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bed not found")
    elif ward_code:
        ward = db.scalar(select(Ward).where(Ward.code == ward_code))
        if not ward:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ward not found")
        bed = db.scalar(
            select(Bed).where(
                Bed.ward_id == ward.id,
                Bed.status == "AVAILABLE",
                Bed.bed_type != "ICU",
            )
        ) or db.scalar(select(Bed).where(Bed.ward_id == ward.id, Bed.status == "AVAILABLE"))
        if not bed:
            raise HTTPException(status.HTTP_409_CONFLICT, f"No available bed in ward {ward.code}")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide bed_id or ward_code")
    if bed.status != "AVAILABLE":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Bed {bed.bed_no} is {bed.status}")
    return bed


@router.post("/admissions", status_code=status.HTTP_201_CREATED)
def admit_patient(
    payload: AdmitRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(admission_desk),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    active = db.scalar(
        select(Admission).where(
            Admission.patient_id == patient.id, Admission.status == "ADMITTED"
        )
    )
    if active:
        raise HTTPException(status.HTTP_409_CONFLICT, "Patient already has an active admission")

    bed = _pick_bed(db, payload.bed_id, payload.ward_code)

    encounter = Encounter(
        patient_id=patient.id,
        doctor_profile_id=payload.attending_profile_id,
        enc_type="IPD",
        chief_complaint="Inpatient admission",
        created_by_id=user.id,
    )
    db.add(encounter)
    db.flush()

    admission = Admission(
        patient_id=patient.id,
        encounter_id=encounter.id,
        bed_id=bed.id,
        attending_profile_id=payload.attending_profile_id,
        admitted_by_id=user.id,
        expected_days=payload.expected_days,
    )
    bed.status = "OCCUPIED"
    db.add(admission)
    db.flush()

    from_request(
        db, request, user, "ADMIT", "admission",
        resource_id=admission.id, patient_id=patient.id,
        detail=f"bed={bed.ward.code}-{bed.bed_no}",
    )
    db.commit()
    db.refresh(admission)
    return {
        "id": admission.id,
        "bed_id": bed.id,
        "encounter_id": admission.encounter_id,
        "bed": f"{bed.ward.code}-{bed.bed_no}",
        "status": admission.status,
    }


@router.post("/admissions/{admission_id}/transfer")
def transfer_patient(
    admission_id: int,
    payload: TransferRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(clinical_ipd),
):
    admission = db.get(Admission, admission_id)
    if not admission or admission.status != "ADMITTED":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Active admission not found")
    old_bed = db.get(Bed, admission.bed_id)
    target = db.get(Bed, payload.target_bed_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Target bed not found")
    if target.id == admission.bed_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Patient is already in that bed")
    if target.status != "AVAILABLE":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Target bed is {target.status}")

    old_bed.status = "CLEANING"
    target.status = "OCCUPIED"
    admission.bed_id = target.id

    from_request(
        db, request, user, "TRANSFER", "admission",
        resource_id=admission.id, patient_id=admission.patient_id,
        detail=f"{old_bed.bed_no}->{target.bed_no}",
    )
    db.commit()
    return {"id": admission.id, "bed_id": target.id, "old_bed_status": "CLEANING"}


@router.post("/admissions/{admission_id}/discharge")
def discharge_patient(
    admission_id: int,
    payload: DischargeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(clinical_ipd),
):
    admission = db.get(Admission, admission_id)
    if not admission or admission.status != "ADMITTED":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Active admission not found")

    bed = db.get(Bed, admission.bed_id)
    bed.status = "CLEANING"
    admission.status = "DISCHARGED"
    admission.discharged_at = datetime.now(timezone.utc)
    admission.discharge_note = payload.discharge_note

    enc = db.get(Encounter, admission.encounter_id) if admission.encounter_id else None
    if enc and enc.status == "OPEN":
        enc.status = "CLOSED"
        enc.closed_at = admission.discharged_at

    from_request(
        db, request, user, "DISCHARGE", "admission",
        resource_id=admission.id, patient_id=admission.patient_id,
        detail=f"bed={bed.bed_no} -> CLEANING",
    )
    db.commit()
    return {"id": admission.id, "status": admission.status, "bed_status": "CLEANING"}


@router.post("/beds/{bed_id}/ready")
def mark_bed_ready(
    bed_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(housekeeping),
):
    bed = db.get(Bed, bed_id)
    if not bed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bed not found")
    if bed.status not in ("CLEANING", "MAINTENANCE"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot ready a {bed.status} bed")
    bed.status = "AVAILABLE"
    from_request(db, request, user, "BED_READY", "bed", resource_id=bed.id, detail=f"ward={bed.ward_id}")
    db.commit()
    return {"id": bed.id, "status": bed.status}


@router.post("/beds/{bed_id}/maintenance")
def toggle_maintenance(
    bed_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("FACILITY_ADMIN")),
):
    bed = db.get(Bed, bed_id)
    if not bed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bed not found")
    if bed.status == "OCCUPIED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot maintain an occupied bed")
    if bed.status == "MAINTENANCE":
        bed.status = "AVAILABLE"
    else:
        bed.status = "MAINTENANCE"
    from_request(db, request, user, "UPDATE", "bed", resource_id=bed.id, detail=f"maintenance={bed.status}")
    db.commit()
    return {"id": bed.id, "status": bed.status}


@router.get("/occupancy", response_model=OccupancyResponse)
def occupancy(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.execute(
        select(Ward.name, Bed.status, func.count())
        .join(Bed, Bed.ward_id == Ward.id)
        .where(Ward.is_active == True)  # noqa: E712
        .group_by(Ward.name, Bed.status)
    ).all()

    wards: dict[str, dict] = {}
    for ward_name, bed_status, count in rows:
        w = wards.setdefault(
            ward_name,
            {"total": 0, "occupied": 0, "available": 0, "cleaning": 0, "maintenance": 0},
        )
        key = {"AVAILABLE": "available", "OCCUPIED": "occupied", "CLEANING": "cleaning", "MAINTENANCE": "maintenance"}.get(bed_status)
        if key:
            w[key] = count
        w["total"] += count

    ward_rows = []
    for name, c in sorted(wards.items()):
        pct = round(c["occupied"] / c["total"] * 100, 1) if c["total"] else 0.0
        ward_rows.append(OccupancyRow(ward=name, **c, occupancy_pct=pct))

    total = sum(r.total for r in ward_rows)
    occupied = sum(r.occupied for r in ward_rows)
    overall = round(occupied / total * 100, 1) if total else 0.0

    return OccupancyResponse(as_of=datetime.now(timezone.utc), overall_pct=overall, wards=ward_rows)
