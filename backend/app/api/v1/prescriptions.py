import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    DispenseLine,
    DispenseRecord,
    Drug,
    DrugBatch,
    Patient,
    Prescription,
    PrescriptionItem,
    User,
)
from app.schemas.pharmacy import (
    BatchCreate,
    DrugCreate,
    DrugOut,
    PrescriptionCreate,
    PrescriptionOut,
)
from app.services.audit import from_request
from app.services.safety import check_prescription

router = APIRouter(tags=["pharmacy"])

pharmacy_access = require_roles("PHARMACIST", "CASHIER")
drug_admin_access = require_roles("FACILITY_ADMIN")


def _prescription_out(p: Prescription) -> dict:
    warnings = json.loads(p.warnings_json) if p.warnings_json else []
    return {
        "id": p.id,
        "patient_id": p.patient_id,
        "encounter_id": p.encounter_id,
        "status": p.status,
        "warnings": warnings,
        "items": [
            {
                "id": i.id,
                "drug_id": i.drug_id,
                "drug_name": i.drug.name if i.drug else "",
                "dosage": i.dosage,
                "frequency": i.frequency,
                "duration_days": i.duration_days,
                "quantity": float(i.quantity),
            }
            for i in p.items
        ],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/drugs")
def list_drugs(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Drug).where(Drug.is_active == True).order_by(Drug.name).limit(100)  # noqa: E712
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(Drug.name.ilike(like))
    drugs = db.scalars(stmt).all()
    today = __import__("datetime").date.today()
    return [
        {
            "id": d.id,
            "code": d.code,
            "name": d.name,
            "form": d.form,
            "strength": d.strength,
            "in_stock": sum(float(b.quantity) for b in d.batches if b.expiry_date >= today and float(b.quantity) > 0),
        }
        for d in drugs
    ]


@router.post("/drugs", status_code=status.HTTP_201_CREATED)
def create_drug(
    payload: DrugCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(drug_admin_access),
):
    exists = db.scalar(select(Drug).where(Drug.code == payload.code))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Drug code already exists")
    drug = Drug(**payload.model_dump())
    db.add(drug)
    from_request(db, request, user, "CREATE", "drug", resource_id=payload.code)
    db.commit()
    db.refresh(drug)
    return DrugOut.model_validate(drug)


@router.post("/drugs/{drug_id}/batches", status_code=status.HTTP_201_CREATED)
def add_batch(
    drug_id: int,
    payload: BatchCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("PHARMACIST")),
):
    drug = db.get(Drug, drug_id)
    if not drug:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Drug not found")
    batch = DrugBatch(drug_id=drug_id, **payload.model_dump())
    db.add(batch)
    from_request(db, request, user, "CREATE", "drug_batch", resource_id=batch.batch_no, detail=f"qty={payload.quantity}")
    db.commit()
    db.refresh(batch)
    return {"id": batch.id}


@router.post("/prescriptions", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_prescription(
    payload: PrescriptionCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("DOCTOR")),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    rx = Prescription(patient_id=patient.id, encounter_id=payload.encounter_id, prescriber_id=user.id)
    for item in payload.items:
        drug = db.get(Drug, item.drug_id)
        if not drug or not drug.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown or inactive drug id {item.drug_id}")
        rx.items.append(PrescriptionItem(**item.model_dump()))

    db.add(rx)
    db.flush()
    warnings = check_prescription(db, patient, rx.items)
    rx.warnings_json = json.dumps(warnings)

    from_request(
        db, request, user, "CREATE", "prescription",
        resource_id=rx.id, patient_id=patient.id,
        detail=f"items={len(payload.items)} warnings={len(warnings)}",
    )
    db.commit()
    db.refresh(rx)
    return _prescription_out(rx)


@router.get("/prescriptions")
def list_prescriptions(
    patient_id: Optional[int] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Prescription).order_by(Prescription.id.desc()).limit(100)
    if patient_id:
        stmt = stmt.where(Prescription.patient_id == patient_id)
    if status_filter:
        stmt = stmt.where(Prescription.status == status_filter)
    return [_prescription_out(p) for p in db.scalars(stmt)]


class DispenseRequest(BaseModel):
    acknowledge_warnings: bool = False


@router.post("/prescriptions/{prescription_id}/dispense")
def dispense_prescription(
    prescription_id: int,
    payload: DispenseRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(pharmacy_access),
):
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    if rx.status != "ACTIVE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Prescription is {rx.status}")

    warnings = json.loads(rx.warnings_json) if rx.warnings_json else []
    blocking = [w for w in warnings if w.get("severity") in ("MAJOR", "MODERATE")]
    if blocking and not payload.acknowledge_warnings:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            {"message": "Warnings must be acknowledged before dispensing", "warnings": warnings},
        )

    from datetime import date

    allocations = []
    for item in rx.items:
        remaining = float(item.quantity)
        batches = (
            db.query(DrugBatch)
            .filter(DrugBatch.drug_id == item.drug_id, DrugBatch.quantity > 0)
            .order_by(DrugBatch.expiry_date.asc())
            .all()
        )
        for batch in batches:
            if remaining <= 0:
                break
            take = min(remaining, float(batch.quantity))
            batch.quantity = float(batch.quantity) - take
            remaining -= take
            allocations.append((item.id, batch.id, take))
        if remaining > 0:
            db.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Insufficient stock for {item.drug.name}: short by {remaining:g}",
            )

    record = DispenseRecord(
        prescription_id=rx.id,
        pharmacist_id=user.id,
        warnings_acknowledged=payload.acknowledge_warnings,
    )
    db.add(record)
    db.flush()
    for item_id, batch_id, qty in allocations:
        db.add(DispenseLine(dispense_id=record.id, prescription_item_id=item_id, drug_batch_id=batch_id, quantity=qty))
    rx.status = "DISPENSED"

    from_request(
        db, request, user, "DISPENSE", "prescription",
        resource_id=rx.id, patient_id=rx.patient_id,
        detail=f"lines={len(allocations)} ack={payload.acknowledge_warnings}",
    )
    db.commit()
    return {"dispense_id": record.id, "status": rx.status, "lines": len(allocations)}
