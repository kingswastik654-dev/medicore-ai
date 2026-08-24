from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import LabOrder, LabResult, LabTestDef, Patient, User
from app.schemas.labs import LabOrderCreate, LabOrderOut, LabResultIn, LabTestCreate, LabTestOut
from app.services.audit import from_request

router = APIRouter(prefix="/lab", tags=["labs"])

lab_staff = require_roles("LAB_TECH")
clinical_order_access = require_roles("DOCTOR", "NURSE")


@router.get("/tests", response_model=list[LabTestOut])
def list_tests(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return [
        LabTestOut.model_validate(t)
        for t in db.scalars(select(LabTestDef).where(LabTestDef.is_active == True).order_by(LabTestDef.name))  # noqa: E712
    ]


@router.post("/tests", response_model=LabTestOut, status_code=status.HTTP_201_CREATED)
def create_test(
    payload: LabTestCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("FACILITY_ADMIN")),
):
    exists = db.scalar(select(LabTestDef).where(LabTestDef.code == payload.code))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Test code already exists")
    test = LabTestDef(**payload.model_dump())
    db.add(test)
    from_request(db, request, user, "CREATE", "lab_test", resource_id=payload.code)
    db.commit()
    db.refresh(test)
    return LabTestOut.model_validate(test)


def _get_order(db: Session, order_id: int) -> LabOrder:
    order = db.get(LabOrder, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lab order not found")
    return order


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def create_order(
    payload: LabOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(clinical_order_access),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    test = db.get(LabTestDef, payload.test_def_id)
    if not test or not test.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lab test not found")

    order = LabOrder(
        test_def_id=test.id,
        patient_id=patient.id,
        encounter_id=payload.encounter_id,
        ordered_by_id=user.id,
        priority=payload.priority,
    )
    db.add(order)
    from_request(db, request, user, "CREATE", "lab_order", resource_id=order.id, patient_id=patient.id, detail=test.code)
    db.commit()
    db.refresh(order)
    return LabOrderOut.build(order).model_dump(mode="json")


@router.get("/orders")
def list_orders(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    patient_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(LabOrder).order_by(LabOrder.id.desc()).limit(200)
    if status_filter:
        stmt = stmt.where(LabOrder.status == status_filter)
    if patient_id:
        stmt = stmt.where(LabOrder.patient_id == patient_id)

    def sort_key(o: LabOrder):
        priority_rank = {"STAT": 0, "URGENT": 1, "ROUTINE": 2}
        return (priority_rank.get(o.priority, 3), -o.id)

    orders = sorted(db.scalars(stmt), key=sort_key)
    return [LabOrderOut.build(o).model_dump(mode="json") for o in orders]


@router.post("/orders/{order_id}/collect")
def collect_sample(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("LAB_TECH", "NURSE")),
):
    order = _get_order(db, order_id)
    if order.status != "ORDERED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot collect from status {order.status}")
    order.status = "SAMPLE_COLLECTED"
    order.collected_at = datetime.now(timezone.utc)
    from_request(db, request, user, "UPDATE", "lab_order", resource_id=order.id, detail="collected", patient_id=order.patient_id)
    db.commit()
    return {"id": order.id, "status": order.status}


@router.post("/orders/{order_id}/result")
def enter_result(
    order_id: int,
    payload: LabResultIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(lab_staff),
):
    order = _get_order(db, order_id)
    if order.status not in ("SAMPLE_COLLECTED",):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Result entry requires SAMPLE_COLLECTED, got {order.status}")

    is_abnormal = False
    is_critical = False
    if payload.value_numeric is not None:
        v = payload.value_numeric
        low, high = order.test_def.ref_low, order.test_def.ref_high
        if (low is not None and v < float(low)) or (high is not None and v > float(high)):
            is_abnormal = True
        clow, chigh = order.test_def.critical_low, order.test_def.critical_high
        if (clow is not None and v <= float(clow)) or (chigh is not None and v >= float(chigh)):
            is_critical = True
            is_abnormal = True

    existing = db.scalar(select(LabResult).where(LabResult.order_id == order.id))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Result already entered; use verify workflow")

    result = LabResult(
        order_id=order.id,
        value_numeric=payload.value_numeric,
        value_text=payload.value_text,
        is_abnormal=is_abnormal,
        is_critical=is_critical,
        entered_by_id=user.id,
    )
    order.status = "RESULTED"
    order.resulted_at = datetime.now(timezone.utc)
    db.add(result)
    db.flush()

    if is_critical:
        from app.services.notify import lab_critical

        patient = db.get(Patient, order.patient_id)
        lab_critical(
            db,
            patient_name=patient.full_name if patient else f"patient#{order.patient_id}",
            test_name=order.test_def.name,
            value_note=str(payload.value_numeric or payload.value_text),
        )

    from_request(
        db, request, user, "RESULT", "lab_order",
        resource_id=order.id, patient_id=order.patient_id,
        detail=f"critical={is_critical} abnormal={is_abnormal}",
    )
    db.commit()
    db.refresh(result)
    return {
        **LabOrderOut.build(order).model_dump(mode="json"),
        "critical_alert": is_critical,
    }


@router.post("/orders/{order_id}/verify")
def verify_result(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("LAB_TECH", "DOCTOR")),
):
    order = _get_order(db, order_id)
    if order.status != "RESULTED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Verify requires RESULTED, got {order.status}")
    result = db.scalar(select(LabResult).where(LabResult.order_id == order.id))
    if not result:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No result to verify")
    result.verified_by_id = user.id
    result.verified_at = datetime.now(timezone.utc)
    order.status = "VERIFIED"
    order.verified_at = result.verified_at
    from_request(db, request, user, "VERIFY", "lab_order", resource_id=order.id, patient_id=order.patient_id)
    db.commit()
    return LabOrderOut.build(order).model_dump(mode="json")
