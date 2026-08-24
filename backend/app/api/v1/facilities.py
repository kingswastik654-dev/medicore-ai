from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Bed, Facility, Invoice, User, Ward


def _facility_brief(db: Session, f: Facility) -> dict:
    staff_count = db.scalar(select(func.count()).select_from(User).where(User.facility_id == f.id)) or 0
    wards = db.scalars(select(Ward).where(Ward.facility_id == f.id)).all()
    ward_ids = [w.id for w in wards]
    beds_total = 0
    beds_available = 0
    if ward_ids:
        beds_total = db.scalar(
            select(func.count()).select_from(Bed).where(Bed.ward_id.in_(ward_ids))
        ) or 0
        beds_available = db.scalar(
            select(func.count()).select_from(Bed).where(Bed.ward_id.in_(ward_ids), Bed.status == "AVAILABLE")
        ) or 0
    revenue = db.scalar(
        select(func.coalesce(func.sum(Invoice.amount_paid), 0)).where(Invoice.facility_id == f.id)
    ) or 0
    return {
        "id": f.id,
        "name": f.name,
        "code": f.code,
        "staff_count": int(staff_count),
        "beds_total": int(beds_total),
        "beds_available": int(beds_available),
        "revenue_collected": float(revenue),
    }


router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.get("")
def list_facilities(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    facilities = db.scalars(select(Facility).order_by(Facility.id)).all()
    return [_facility_brief(db, f) for f in facilities]


@router.get("/{facility_id}")
def facility_overview(
    facility_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    facility = db.get(Facility, facility_id)
    if not facility:
        from fastapi import HTTPException, status

        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facility not found")
    brief = _facility_brief(db, facility)

    wards = []
    for w in db.scalars(select(Ward).where(Ward.facility_id == facility_id)):
        total = db.scalar(select(func.count()).select_from(Bed).where(Bed.ward_id == w.id)) or 0
        avail = db.scalar(
            select(func.count()).select_from(Bed).where(Bed.ward_id == w.id, Bed.status == "AVAILABLE")
        ) or 0
        wards.append({"id": w.id, "name": w.name, "beds_total": int(total), "beds_available": int(avail)})

    return {**brief, "wards": wards}
