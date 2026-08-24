import difflib
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Patient


def _normalize(value: Optional[str]) -> str:
    return "".join(ch.lower() for ch in (value or "") if ch.isalnum())


def _full_name(first_name: str, last_name: str) -> str:
    return _normalize(f"{first_name}{last_name}")


def score_match(
    existing: Patient,
    first_name: str,
    last_name: str,
    dob,
    phone: str,
    national_id: Optional[str],
    abha_id: Optional[str],
) -> int:
    if national_id and existing.national_id and national_id == existing.national_id:
        return 100
    if abha_id and existing.abha_id and abha_id == existing.abha_id:
        return 100

    score = 0
    if phone and existing.phone and phone == existing.phone:
        score += 50
    dob_match = bool(dob and existing.dob and dob == existing.dob)
    if dob_match:
        score += 30

    ratio = difflib.SequenceMatcher(
        None, _full_name(existing.first_name, existing.last_name), _full_name(first_name, last_name)
    ).ratio()
    if ratio >= 0.92:
        score += 25
    elif ratio >= 0.82:
        score += 10
    elif ratio < 0.6:
        score = min(score, 5)

    if dob_match and ratio >= 0.82:
        score += 15
    return score


def find_duplicates(
    db: Session,
    *,
    first_name: str,
    last_name: str,
    dob=None,
    phone: str = "",
    national_id: Optional[str] = None,
    abha_id: Optional[str] = None,
    threshold: int = 60,
    limit: int = 5,
) -> list[dict]:
    base = select(Patient).where(Patient.status == "ACTIVE")
    candidates: dict[int, Patient] = {}

    if phone:
        for p in db.scalars(base.where(Patient.phone == phone)):
            candidates[p.id] = p
    if last_name:
        for p in db.scalars(base.where(Patient.last_name.ilike(f"{last_name[:12].lower()}%"))):
            candidates[p.id] = p
    if dob:
        for p in db.scalars(base.where(Patient.dob == dob)):
            candidates[p.id] = p
    if len(candidates) < 25:
        for p in db.scalars(select(Patient).where(Patient.status == "ACTIVE").limit(200)):
            candidates[p.id] = p

    results = []
    for c in candidates.values():
        s = score_match(c, first_name, last_name, dob, phone, national_id, abha_id)
        if s >= threshold:
            results.append((s, c))

    results.sort(key=lambda x: (-x[0], x[1].id))
    return [
        {
            "patient_id": c.id,
            "mrn": c.mrn,
            "name": f"{c.first_name} {c.last_name}".strip(),
            "dob": c.dob.isoformat() if c.dob else None,
            "phone": c.phone,
            "score": s,
        }
        for s, c in results[:limit]
    ]
