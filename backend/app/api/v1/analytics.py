from datetime import date, datetime, time

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai import engine
from app.ai.gateway import active_provider, log_interaction
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Appointment, Invoice, Payment, Patient, User

router = APIRouter(prefix="/analytics", tags=["analytics"])


def compute_summary(db: Session) -> dict:
    today = date.today()
    today_start = datetime.combine(today, time.min)

    total_patients = db.scalar(
        select(func.count()).select_from(Patient).where(Patient.status == "ACTIVE")
    ) or 0

    appts_today = db.scalar(
        select(func.count()).select_from(Appointment).where(Appointment.scheduled_date == today)
    ) or 0
    completed_today = db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(Appointment.scheduled_date == today, Appointment.status.in_(["COMPLETED"]))
    ) or 0

    revenue_today = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.received_at >= today_start)
    ) or 0
    revenue_total = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0))) or 0

    outstanding = db.scalar(
        select(func.coalesce(func.sum(Invoice.grand_total - Invoice.amount_paid), 0)).where(
            Invoice.status.in_(["ISSUED", "PARTIALLY_PAID"])
        )
    ) or 0

    return {
        "date": today.isoformat(),
        "total_patients": int(total_patients),
        "appointments_today": int(appts_today),
        "completed_today": int(completed_today),
        "revenue_today": float(revenue_today),
        "revenue_total": float(revenue_total),
        "outstanding": float(outstanding),
    }


@router.get("/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return compute_summary(db)


@router.post("/ask")
def analytics_ask(
    question: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    provider, model = active_provider()
    metrics = compute_summary(db)
    answer_text, data = engine.answer_analytics_question(question, metrics)

    if answer_text is None:
        result = {
            "question": question,
            "answer": (
                "I can answer questions about: revenue today, outstanding dues, "
                "total patients, appointments today, and completed consultations."
            ),
            "supported": False,
            "data": {"summary": metrics},
            "provider": provider,
        }
    else:
        result = {
            "question": question,
            "answer": answer_text,
            "supported": True,
            "data": data,
            "provider": provider,
        }

    log_interaction(db, user, feature="ANALYTICS_ASK", input_summary=question[:500], output_summary=result["answer"][:1000])
    db.commit()
    return result
