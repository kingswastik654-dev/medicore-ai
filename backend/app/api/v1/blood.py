from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import BloodDonor, BloodUnit, CrossMatchRequest, Patient, User
from app.schemas.blood import (
    BloodDonorCreate,
    BloodDonorOut,
    BloodUnitCollect,
    BloodUnitOut,
    CrossMatchCreate,
    CrossMatchOut,
    InventoryRow,
    TestResultIn,
)
from app.services.audit import from_request

router = APIRouter(prefix="/blood", tags=["blood-bank"])

COMPONENT_SHELF_DAYS = {
    "WHOLE_BLOOD": 35,
    "PRBC": 35,
    "FFP": 365,
    "PLATELETS": 5,
}


@router.get("/donors", response_model=list[BloodDonorOut])
def list_donors(
    blood_group: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(BloodDonor).order_by(BloodDonor.id.desc()).limit(200)
    if blood_group:
        stmt = stmt.where(BloodDonor.blood_group == blood_group)
    return [BloodDonorOut.model_validate(d) for d in db.scalars(stmt)]


@router.post("/donors", response_model=BloodDonorOut, status_code=status.HTTP_201_CREATED)
def register_donor(
    payload: BloodDonorCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("RECEPTIONIST", "NURSE", "LAB_TECH", "FACILITY_ADMIN")),
):
    donor = BloodDonor(**payload.model_dump())
    db.add(donor)
    from_request(db, request, user, "CREATE", "blood_donor", resource_id=donor.id, detail=f"{payload.blood_group}")
    db.commit()
    db.refresh(donor)
    return BloodDonorOut.model_validate(donor)


@router.get("/units", response_model=list[BloodUnitOut])
def list_units(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    blood_group: Optional[str] = None,
    component: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(BloodUnit).order_by(BloodUnit.expires_on).limit(300)
    if status_filter:
        stmt = stmt.where(BloodUnit.status == status_filter)
    if blood_group:
        stmt = stmt.where(BloodUnit.blood_group == blood_group)
    if component:
        stmt = stmt.where(BloodUnit.component == component)
    return [BloodUnitOut.model_validate(u) for u in db.scalars(stmt)]


@router.post("/units", response_model=BloodUnitOut, status_code=status.HTTP_201_CREATED)
def collect_unit(
    payload: BloodUnitCollect,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("LAB_TECH")),
):
    exists = db.scalar(select(BloodUnit).where(BloodUnit.unit_no == payload.unit_no))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Unit number already registered")

    group = payload.blood_group
    donor = None
    if payload.donor_id is not None:
        donor = db.get(BloodDonor, payload.donor_id)
        if not donor:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Donor not found")
        if donor.is_deferred:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Donor {donor.full_name} is permanently deferred")
        if donor.last_donation_on and (date.today() - donor.last_donation_on).days < 90:
            eligible_on = donor.last_donation_on + timedelta(days=90)
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Donor {donor.full_name} donated on {donor.last_donation_on.isoformat()}; eligible again {eligible_on.isoformat()}",
            )
        group = donor.blood_group
    if not group:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "blood_group is required when no donor is linked")

    today = date.today()
    expires = payload.expires_on or today + timedelta(days=COMPONENT_SHELF_DAYS[payload.component])

    unit = BloodUnit(
        unit_no=payload.unit_no,
        donor_id=donor.id if donor else None,
        blood_group=group,
        component=payload.component,
        volume_ml=payload.volume_ml,
        collected_on=today,
        expires_on=expires,
    )
    db.add(unit)
    if donor:
        donor.last_donation_on = today
    from_request(db, request, user, "CREATE", "blood_unit", resource_id=payload.unit_no, detail=f"{group}:{payload.component}")
    db.commit()
    db.refresh(unit)
    return BloodUnitOut.model_validate(unit)


@router.get("/inventory", response_model=list[InventoryRow])
def inventory(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(
            BloodUnit.blood_group,
            BloodUnit.component,
            func.count(BloodUnit.id),
            func.min(BloodUnit.expires_on),
        )
        .where(BloodUnit.status == "AVAILABLE")
        .group_by(BloodUnit.blood_group, BloodUnit.component)
        .order_by(BloodUnit.blood_group, BloodUnit.component)
    ).all()
    return [
        InventoryRow(blood_group=g, component=c, units=n, earliest_expiry=e)
        for g, c, n, e in rows
    ]


@router.post("/inventory/sweep")
def sweep_expired_units(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("LAB_TECH", "FACILITY_ADMIN")),
):
    stale = db.scalars(
        select(BloodUnit).where(
            BloodUnit.status.in_(["AVAILABLE", "RESERVED"]),
            BloodUnit.expires_on < date.today(),
        )
    ).all()
    for unit in stale:
        unit.status = "EXPIRED"
    from_request(db, request, user, "UPDATE", "blood_unit", detail=f"sweep expired={len(stale)}")
    db.commit()
    return {"expired": len(stale)}


def _get_request(db: Session, request_id: int) -> CrossMatchRequest:
    req = db.get(CrossMatchRequest, request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cross-match request not found")
    return req


@router.post("/requests", status_code=status.HTTP_201_CREATED)
def create_crossmatch(
    payload: CrossMatchCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR", "NURSE")),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    unit = db.get(BloodUnit, payload.unit_id)
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Blood unit not found")
    if unit.status != "AVAILABLE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unit is {unit.status}, not AVAILABLE")

    req = CrossMatchRequest(
        patient_id=patient.id,
        unit_id=unit.id,
        requested_by_id=user.id,
        notes=payload.notes,
    )
    unit.status = "RESERVED"
    db.add(req)
    from_request(db, request, user, "CREATE", "crossmatch", resource_id=req.id, patient_id=patient.id, detail=unit.unit_no)
    db.commit()
    db.refresh(req)
    return CrossMatchOut.build(req).model_dump(mode="json")


@router.get("/requests")
def list_crossmatches(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(CrossMatchRequest).order_by(CrossMatchRequest.id.desc()).limit(200)
    if status_filter:
        stmt = stmt.where(CrossMatchRequest.status == status_filter)
    return [CrossMatchOut.build(r).model_dump(mode="json") for r in db.scalars(stmt)]


@router.post("/requests/{request_id}/test")
def record_compatibility(
    request_id: int,
    payload: TestResultIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("LAB_TECH")),
):
    req = _get_request(db, request_id)
    if req.status != "REQUESTED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Test requires REQUESTED, got {req.status}")
    req.tested_by_id = user.id
    req.tested_at = datetime.now(timezone.utc)
    if payload.compatible:
        req.status = "COMPATIBLE"
    else:
        req.status = "INCOMPATIBLE"
        if req.unit and req.unit.status == "RESERVED":
            req.unit.status = "AVAILABLE"
    from_request(db, request, user, "RESULT", "crossmatch", resource_id=req.id, patient_id=req.patient_id, detail=f"compatible={payload.compatible}")
    db.commit()
    return CrossMatchOut.build(req).model_dump(mode="json")


@router.post("/requests/{request_id}/issue")
def issue_unit(
    request_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("LAB_TECH")),
):
    req = _get_request(db, request_id)
    if req.status != "COMPATIBLE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Issue requires COMPATIBLE cross-match, got {req.status}")
    if not req.unit or req.unit.status != "RESERVED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reserved unit no longer available")

    req.unit.status = "ISSUED"
    req.status = "ISSUED"
    req.issued_by_id = user.id
    req.issued_at = datetime.now(timezone.utc)
    from_request(db, request, user, "ISSUE", "crossmatch", resource_id=req.id, patient_id=req.patient_id, detail=req.unit.unit_no)
    db.commit()
    return CrossMatchOut.build(req).model_dump(mode="json")
