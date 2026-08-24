from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai import engine
from app.ai.gateway import active_provider, log_interaction, search_knowledge
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import AIInteraction, Encounter, User
from app.schemas.ai import (
    CodingSuggestRequest,
    CodingSuggestion,
    FeedbackRequest,
    KnowledgeHit,
    KnowledgeSearchResponse,
)
from app.services.audit import from_request

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/knowledge/search", response_model=KnowledgeSearchResponse)
def knowledge_search(
    q: str = Query(min_length=2),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hits = search_knowledge(db, q)
    return KnowledgeSearchResponse(
        query=q,
        hits=[KnowledgeHit(**h) for h in hits[:5]],
    )


@router.post("/coding/suggest", response_model=list[CodingSuggestion])
def coding_suggest(
    payload: CodingSuggestRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    provider, _ = active_provider()
    suggestions = engine.suggest_codes(payload.text)
    log_interaction(
        db, user,
        feature="CODING_SUGGEST",
        input_summary=payload.text[:500],
        output_summary=str(suggestions)[:1500],
    )
    from_request(db, request, user, "AI_CALL", "ai", resource_id="coding_suggest", detail=f"provider={provider}")
    db.commit()
    return [CodingSuggestion(**s) for s in suggestions]


@router.post("/feedback/{interaction_id}")
def feedback(
    interaction_id: int,
    payload: FeedbackRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.get(AIInteraction, interaction_id)
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interaction not found")
    if entry.user_id is not None and entry.user_id != user.id and user.role not in ("SUPER_ADMIN",):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your interaction to review")
    entry.accepted = payload.accepted
    from_request(
        db, request, user, "AI_FEEDBACK", "ai",
        resource_id=interaction_id,
        detail=f"accepted={payload.accepted} feature={entry.feature}",
    )
    db.commit()
    return {"id": entry.id, "accepted": entry.accepted}


ops_router = APIRouter(prefix="/ops", tags=["ai-ops"])


def _utc_aware(dt):
    return dt.replace(tzinfo=timezone.utc) if dt else None


@ops_router.get("/forecast/opd")
def forecast_opd(
    days: int = Query(default=7, ge=1, le=14),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import date, timedelta

    from app.models import Appointment

    today = date.today()
    start = today - timedelta(days=42)
    counts = dict(
        db.execute(
            select(Appointment.scheduled_date, func.count())
            .where(Appointment.scheduled_date >= start, Appointment.status.notin_(["CANCELLED"]))
            .group_by(Appointment.scheduled_date)
        ).all()
    )
    provider, _ = active_provider()
    predictions = engine.forecast_opd(counts, today, days)
    log_interaction(db, user, feature="OPD_FORECAST", input_summary=f"window=42d horizon={days}d", output_summary=str(predictions)[:1500])
    db.commit()
    return {
        "generated_for": today.isoformat(),
        "horizon_days": days,
        "model": "weekday-seasonality + trend (heuristic v1)",
        "provider": provider,
        "predictions": predictions,
    }


@ops_router.get("/bed-suggestions")
def bed_suggestions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import date, datetime, timezone

    from app.models import Admission, Invoice, LabOrder

    admissions = db.scalars(select(Admission).where(Admission.status == "ADMITTED")).all()
    suggestions = []
    for adm in admissions:
        pending_urgent = (
            db.scalar(
                select(func.count())
                .select_from(LabOrder)
                .where(
                    LabOrder.patient_id == adm.patient_id,
                    LabOrder.status.in_(["ORDERED", "SAMPLE_COLLECTED", "RESULTED"]),
                    LabOrder.priority.in_(["STAT", "URGENT"]),
                )
            )
            or 0
        )
        open_encounter = False
        enc = db.get(Encounter, adm.encounter_id) if adm.encounter_id else None
        open_encounter = bool(enc and enc.status == "OPEN")

        outstanding_amount = db.scalar(
            select(func.coalesce(func.sum(Invoice.grand_total - Invoice.amount_paid), 0)).where(
                Invoice.patient_id == adm.patient_id,
                Invoice.status.in_(["ISSUED", "PARTIALLY_PAID"]),
            )
        ) or 0

        los_days = (datetime.now(timezone.utc) - _utc_aware(adm.admitted_at)).days
        overdue = bool(adm.expected_days and los_days > adm.expected_days)

        facts = {
            "pending_urgent_orders": int(pending_urgent),
            "open_encounter": open_encounter,
            "overdue_stay": overdue,
            "expected_days": adm.expected_days,
            "outstanding_amount": float(outstanding_amount),
        }
        result = engine.bed_readiness(facts)

        suggestions.append({
            "admission_id": adm.id,
            "patient_name": adm.patient.full_name if adm.patient else "",
            "mrn": adm.patient.mrn if adm.patient else "",
            "bed_no": adm.bed.bed_no if adm.bed else "",
            "los_days": los_days,
            **facts,
            **result,
        })

    suggestions.sort(key=lambda s: -s["score"])
    provider, _ = active_provider()
    log_interaction(db, user, feature="BED_READINESS", input_summary=f"admissions={len(admissions)}", output_summary=str(suggestions)[:2000])
    db.commit()
    return {"provider": provider, "count": len(suggestions), "suggestions": suggestions}


@ops_router.post("/denials/score")
def denials_score(
    invoice_id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models import Invoice, Patient

    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    patient = db.get(Patient, invoice.patient_id)

    subtotal = float(invoice.subtotal) or 0
    facts = {
        "grand_total": float(invoice.grand_total or 0),
        "discount_ratio": (float(invoice.discount_total) / subtotal) if subtotal else 0,
        "has_phone": bool(patient and patient.phone),
        "has_national_id": bool(patient and patient.national_id),
        "has_insurance_lines": True,
        "has_diagnosis_link": bool(invoice.patient_id),
    }

    result = engine.denial_risk(facts)
    provider, _ = active_provider()
    log_interaction(db, user, feature="DENIAL_SCORE", input_summary=f"invoice={invoice.id}", output_summary=str(result)[:1200])
    from_request(db, request=None, user=user, action="AI_CALL", resource_type="ai", resource_id="denial_score", detail=f"invoice={invoice.id} tier={result['tier']}")
    db.commit()

    return {
        "invoice_id": invoice.id,
        "invoice_no": invoice.invoice_no,
        **facts,
        **result,
        "provider": provider,
        "disclaimer": "Advisory score only. Billing decision remains with the revenue-cycle team.",
    }


@ops_router.get("/rcm/ar-priorities")
def ar_priorities(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models import Invoice, Patient

    rows = db.execute(
        select(Invoice, Patient)
        .join(Patient, Invoice.patient_id == Patient.id)
        .where(Invoice.status.in_(["ISSUED", "PARTIALLY_PAID"]))
    ).all()

    items = []
    for invoice, patient in rows:
        outstanding = max(0.0, float(invoice.grand_total) - float(invoice.amount_paid))
        if outstanding <= 0:
            continue
        age_days = (datetime.now(timezone.utc) - _utc_aware(invoice.issued_at or invoice.created_at)).days
        prio = engine.ar_priority(outstanding, age_days)
        items.append({
            "invoice_id": invoice.id,
            "invoice_no": invoice.invoice_no,
            "patient_name": patient.full_name,
            "outstanding": round(outstanding, 2),
            "age_days": age_days,
            **prio,
        })
    items.sort(key=lambda x: -x["priority_score"])
    items = items[:limit]

    provider, _ = active_provider()
    log_interaction(db, user, feature="AR_PRIORITY", input_summary=f"candidates={len(rows)}", output_summary=str(items)[:1500])
    db.commit()
    return {"provider": provider, "count": len(items), "priorities": items}

router.include_router(ops_router)
