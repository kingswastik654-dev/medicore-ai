import httpx
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Notification, Plugin

WHATSAPP_SLUG = "whatsapp-channel"


def _utcnow():
    return datetime.now(timezone.utc)


def queue(
    db: Session,
    *,
    event: str,
    body: str,
    recipient_name: Optional[str] = None,
    recipient_phone: Optional[str] = None,
    subject: Optional[str] = None,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
) -> Notification:
    notification = Notification(
        channel="WHATSAPP",
        event=event,
        status="QUEUED",
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        subject=subject,
        body=body,
        plugin_slug=WHATSAPP_SLUG if event != "LAB_CRITICAL" else "lab-critical",
        related_type=related_type,
        related_id=related_id,
    )
    db.add(notification)
    return notification


def _channel_enabled(db: Session) -> bool:
    plugin = db.scalar(select(Plugin).where(Plugin.slug == WHATSAPP_SLUG))
    return bool(plugin and plugin.enabled)


def dispatch_pending(db: Session) -> int:
    settings = get_settings()
    enabled = _channel_enabled(db)
    db.flush()
    pending = db.query(Notification).filter(Notification.status == "QUEUED").all()

    for n in pending:
        if not enabled:
            n.status = "SKIPPED"
            n.error = "WhatsApp channel plugin is disabled"
            continue
        if not n.recipient_phone:
            n.status = "FAILED"
            n.error = "Recipient has no phone number on file"
            continue

        if settings.whatsapp_api_url and settings.whatsapp_token:
            try:
                resp = httpx.post(
                    settings.whatsapp_api_url,
                    json={"to": n.recipient_phone, "event": n.event, "body": n.body},
                    headers={"Authorization": f"Bearer {settings.whatsapp_token}"},
                    timeout=8,
                )
                resp.raise_for_status()
                n.status = "SENT"
                n.sent_at = _utcnow()
            except Exception as exc:
                n.status = "FAILED"
                n.error = str(exc)[:500]
        else:
            n.status = "SIMULATED"
            n.sent_at = _utcnow()

    db.commit()
    return len(pending)


def appointment_booked(db: Session, patient_name: str, phone: Optional[str], when: str, doctor: str) -> None:
    queue(
        db,
        event="APPT_BOOKED",
        body=f"Hi {patient_name}, your appointment with {doctor} is confirmed for {when}. Reply CANCEL to cancel.",
        recipient_name=patient_name,
        recipient_phone=phone,
        related_type="appointment",
    )
    dispatch_pending(db)


def lab_critical(db: Session, patient_name: str, test_name: str, value_note: str) -> None:
    queue(
        db,
        event="LAB_CRITICAL",
        body=f"CRITICAL result: {test_name} = {value_note} for {patient_name}. Immediate review required.",
        recipient_name="Ordering clinician / ED desk",
        related_type="lab_order",
    )
    dispatch_pending(db)


def invoice_issued(db: Session, patient_name: str, phone: Optional[str], invoice_no: str, total: float) -> None:
    queue(
        db,
        event="INVOICE_ISSUED",
        body=f"Hi {patient_name}, invoice {invoice_no} of Rs {total:,.2f} is ready. Pay online from your patient portal.",
        recipient_name=patient_name,
        recipient_phone=phone,
        related_type="invoice",
    )
    dispatch_pending(db)
