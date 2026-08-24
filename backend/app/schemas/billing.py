from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

PaymentMethod = Literal["CASH", "CARD", "UPI", "INSURANCE", "CHEQUE"]
ServiceCategory = Literal["CONSULTATION", "LAB", "RADIOLOGY", "PROCEDURE", "PHARMACY", "ROOM"]
InvoiceStatus = Literal["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"]


class ServiceItemCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=200)
    category: ServiceCategory
    price: float = Field(ge=0)
    tax_percent: float = Field(default=0, ge=0, le=50)


class ServiceItemOut(ServiceItemCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class InvoiceLineIn(BaseModel):
    service_item_id: Optional[int] = None
    description: str = Field(min_length=1, max_length=250)
    quantity: float = Field(default=1, gt=0, le=10000)
    unit_price: float = Field(ge=0)
    discount: float = Field(default=0, ge=0)


class InvoiceCreate(BaseModel):
    patient_id: int
    lines: list[InvoiceLineIn] = Field(min_length=1)
    invoice_discount: float = Field(default=0, ge=0)
    notes: Optional[str] = None


class InvoiceLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    quantity: float
    unit_price: float
    discount: float
    line_total: float


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    method: PaymentMethod
    reference: Optional[str] = None
    received_at: datetime


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    method: PaymentMethod
    reference: Optional[str] = Field(default=None, max_length=80)


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_no: Optional[str] = None
    patient_id: int
    status: InvoiceStatus
    subtotal: float
    discount_total: float
    grand_total: float
    amount_paid: float
    currency: str
    notes: Optional[str] = None
    issued_at: Optional[datetime] = None
    created_at: datetime


class InvoiceDetail(InvoiceOut):
    lines: list[InvoiceLineOut]
    payments: list[PaymentOut]
