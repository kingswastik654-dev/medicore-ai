from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models import DoctorProfile, ROLES, User
from app.schemas.auth import RoleName, UserCreate, UserOut, UserUpdate
from app.services.audit import from_request

router = APIRouter(prefix="/users", tags=["users"])

admin_only = require_roles("FACILITY_ADMIN")


class DoctorCreate(BaseModel):
    specialty: str = "General Medicine"
    registration_no: Optional[str] = None
    consultation_fee: float = 0


@router.get("", response_model=list[UserOut])
def list_users(
    q: Optional[str] = None,
    role: Optional[RoleName] = None,
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    stmt = select(User).order_by(User.id)
    if role:
        stmt = stmt.where(User.role == role)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(User.username.ilike(like), User.full_name.ilike(like)))
    return [UserOut.model_validate(u) for u in db.scalars(stmt)]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    if payload.role not in ROLES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown role")
    exists = db.scalar(select(User).where(User.username == payload.username))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")

    new_user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        facility_id=payload.facility_id,
    )
    db.add(new_user)
    db.flush()
    if payload.role == "DOCTOR":
        profile = DoctorProfile(
            user_id=new_user.id,
            specialty=payload.specialty or "General Medicine",
            registration_no=payload.registration_no,
            consultation_fee=payload.consultation_fee,
        )
        db.add(profile)
    from_request(
        db, request, user, "CREATE", "user", resource_id=new_user.username,
        detail=f"role={new_user.role}",
    )
    db.commit()
    db.refresh(new_user)
    return UserOut.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    changed = []
    if payload.full_name is not None:
        target.full_name = payload.full_name
        changed.append("full_name")
    if payload.email is not None:
        target.email = payload.email
        changed.append("email")
    if payload.is_active is not None:
        target.is_active = payload.is_active
        changed.append("is_active")
    if payload.password is not None:
        target.hashed_password = hash_password(payload.password)
        changed.append("password_reset")

    from_request(db, request, user, "UPDATE", "user", resource_id=target.username, detail=",".join(changed))
    db.commit()
    db.refresh(target)
    return UserOut.model_validate(target)


@router.post("/{user_id}/doctor-profile", response_model=dict)
def upsert_doctor_profile(
    user_id: int,
    payload: DoctorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.role != "DOCTOR":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User is not a doctor")
    profile = db.scalar(select(DoctorProfile).where(DoctorProfile.user_id == user_id))
    if profile:
        profile.specialty = payload.specialty
        profile.registration_no = payload.registration_no
        profile.consultation_fee = payload.consultation_fee
    else:
        profile = DoctorProfile(
            user_id=user_id,
            specialty=payload.specialty,
            registration_no=payload.registration_no,
            consultation_fee=payload.consultation_fee,
        )
        db.add(profile)
    db.commit()
    return {"detail": "ok"}
