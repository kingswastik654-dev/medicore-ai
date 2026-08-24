from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Invoice, InvoiceLine, Payment, Patient, ServiceItem, User
from app.schemas.billing import (
    InvoiceCreate,
    InvoiceDetail,
    InvoiceOut,
    PaymentCreate,
    PaymentOut,
    ServiceItemCreate,
    ServiceItemOut,
)
from app.services.audit import from_request

router = APIRouter(tags=["billing"])

billing_access = require_roles("RECEPTIONIST", "CASHIER")
payment_access = require_roles("CASHIER", "RECEPTIONIST")
service_admin = require_roles("FACILITY_ADMIN")

CENT = Decimal("0.01")


def _money(value) -> float:
    return float(Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP))


@router.get("/services", response_model=list[ServiceItemOut])
def list_services(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(ServiceItem).where(ServiceItem.is_active == True).order_by(ServiceItem.category, ServiceItem.name)  # noqa: E712
    if category:
        stmt = stmt.where(ServiceItem.category == category)
    return [ServiceItemOut.model_validate(s) for s in db.scalars(stmt)]


@router.post("/services", response_model=ServiceItemOut, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(service_admin),
):
    exists = db.scalar(select(ServiceItem).where(ServiceItem.code == payload.code))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Service code already exists")
    item = ServiceItem(**payload.model_dump())
    db.add(item)
    from_request(db, request, user, "CREATE", "service_item", resource_id=payload.code)
    db.commit()
    db.refresh(item)
    return ServiceItemOut.model_validate(item)


def _next_invoice_no(db: Session, day: date) -> str:
    prefix = f"INV-{day.strftime('%Y%m%d')}"
    count = (
        db.scalar(
            select(func.count()).select_from(Invoice).where(Invoice.invoice_no.ilike(f"{prefix}%"))
        )
        or 0
    ) + 1
    return f"{prefix}-{count:04d}"


@router.post("/invoices", response_model=InvoiceDetail, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: InvoiceCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(billing_access),
):
    patient = db.get(Patient, payload.patient_id)
    if not patient or patient.status != "ACTIVE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    invoice = Invoice(patient_id=payload.patient_id, notes=payload.notes, created_by_id=user.id, facility_id=user.facility_id)
    subtotal = Decimal("0")
    line_discounts = Decimal("0")
    for line in payload.lines:
        qty = Decimal(str(line.quantity))
        price = Decimal(str(line.unit_price))
        disc = min(Decimal(str(line.discount)), qty * price)
        line_total = qty * price - disc
        subtotal += qty * price
        line_discounts += disc
        invoice.lines.append(
            InvoiceLine(
                service_item_id=line.service_item_id,
                description=line.description,
                quantity=float(qty),
                unit_price=_money(price),
                discount=_money(disc),
                line_total=_money(line_total),
            )
        )

    invoice_discount = min(Decimal(str(payload.invoice_discount)), subtotal - line_discounts)
    discount_total_dec = line_discounts + invoice_discount
    grand_total_dec = max(Decimal("0"), subtotal - discount_total_dec)
    invoice.subtotal = _money(subtotal)
    invoice.discount_total = _money(discount_total_dec)
    invoice.grand_total = _money(grand_total_dec)

    db.add(invoice)
    db.flush()
    from_request(
        db, request, user, "CREATE", "invoice",
        resource_id=invoice.id, patient_id=invoice.patient_id,
        detail=f"total={invoice.grand_total} lines={len(payload.lines)}",
    )
    db.commit()
    db.refresh(invoice)
    return InvoiceDetail.model_validate(invoice)


@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(
    patient_id: Optional[int] = None,
    inv_status: Optional[str] = Query(default=None, alias="status"),
    day: Optional[date] = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Invoice).order_by(Invoice.id.desc()).limit(200)
    if patient_id:
        stmt = stmt.where(Invoice.patient_id == patient_id)
    if inv_status:
        stmt = stmt.where(Invoice.status == inv_status)
    if day:
        stmt = stmt.where(func.date(Invoice.created_at) == day)
    rows = db.scalars(stmt).all()
    return [InvoiceOut.model_validate(i) for i in rows]


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return InvoiceDetail.model_validate(invoice)


@router.post("/invoices/{invoice_id}/issue", response_model=InvoiceDetail)
def issue_invoice(
    invoice_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(billing_access),
):
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if invoice.status != "DRAFT":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only DRAFT invoices can be issued")
    if not invoice.lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot issue an invoice with no lines")

    invoice.invoice_no = _next_invoice_no(db, date.today())
    invoice.issued_at = datetime.now(timezone.utc)
    invoice.status = "ISSUED"
    from_request(db, request, user, "ISSUE", "invoice", resource_id=invoice.invoice_no, patient_id=invoice.patient_id)

    patient = db.get(Patient, invoice.patient_id)
    if patient:
        from app.services.notify import invoice_issued

        invoice_issued(
            db,
            patient_name=patient.full_name,
            phone=patient.phone,
            invoice_no=invoice.invoice_no,
            total=float(invoice.grand_total),
        )
    db.commit()
    db.refresh(invoice)
    return InvoiceDetail.model_validate(invoice)


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceDetail)
def cancel_invoice(
    invoice_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(billing_access),
):
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if invoice.amount_paid > 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invoices with payments cannot be cancelled")
    invoice.status = "CANCELLED"
    from_request(db, request, user, "CANCEL", "invoice", resource_id=invoice.id, patient_id=invoice.patient_id)
    db.commit()
    db.refresh(invoice)
    return InvoiceDetail.model_validate(invoice)


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def add_payment(
    invoice_id: int,
    payload: PaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(payment_access),
):
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if invoice.status in ("DRAFT", "CANCELLED"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot pay a {invoice.status} invoice")
    balance = _money(invoice.grand_total) - _money(invoice.amount_paid)
    if _money(payload.amount) > balance:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Amount exceeds outstanding balance of {balance}")

    payment = Payment(
        invoice_id=invoice.id,
        amount=_money(payload.amount),
        method=payload.method,
        reference=payload.reference,
        received_by_id=user.id,
    )
    invoice.amount_paid = _money(Decimal(str(invoice.amount_paid)) + Decimal(str(payment.amount)))
    if invoice.amount_paid >= invoice.grand_total:
        invoice.status = "PAID"
    else:
        invoice.status = "PARTIALLY_PAID"

    db.add(payment)
    db.flush()
    from_request(
        db, request, user, "PAYMENT", "invoice",
        resource_id=invoice.invoice_no or invoice.id,
        patient_id=invoice.patient_id,
        detail=f"{payment.method}={payment.amount}",
    )
    db.commit()
    db.refresh(payment)
    return PaymentOut.model_validate(payment)
