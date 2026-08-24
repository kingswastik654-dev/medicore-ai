from datetime import date, datetime, time, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _utcnow():
    return datetime.now(timezone.utc)


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="facility")


ROLES = [
    "SUPER_ADMIN",
    "FACILITY_ADMIN",
    "DOCTOR",
    "NURSE",
    "RECEPTIONIST",
    "CASHIER",
    "LAB_TECH",
    "PHARMACIST",
    "AUDITOR",
]

GENDERS = ["MALE", "FEMALE", "OTHER"]
PATIENT_STATUSES = ["ACTIVE", "MERGED"]
APPOINTMENT_STATUSES = ["BOOKED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]
ACTIVE_APPOINTMENT_STATUSES = ["BOOKED", "CHECKED_IN", "IN_PROGRESS"]
INVOICE_STATUSES = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"]
PAYMENT_METHODS = ["CASH", "CARD", "UPI", "INSURANCE", "CHEQUE"]
SERVICE_CATEGORIES = ["CONSULTATION", "LAB", "RADIOLOGY", "PROCEDURE", "PHARMACY", "ROOM"]

ENCOUNTER_TYPES = ["OPD", "IPD", "EMERGENCY", "TELE"]
ENCOUNTER_STATUSES = ["OPEN", "CLOSED"]
NOTE_TYPES = ["SOAP", "PROGRESS", "PROCEDURE", "NURSING"]
NOTE_SOURCES = ["MANUAL", "AI_SCRIBE"]
DIAGNOSIS_SOURCES = ["MANUAL", "AI_SUGGESTION"]
RX_STATUSES = ["ACTIVE", "DISPENSED", "CANCELLED"]
SEVERITY_LEVELS = ["MINOR", "MODERATE", "MAJOR"]
LAB_ORDER_STATUSES = ["ORDERED", "SAMPLE_COLLECTED", "RESULTED", "VERIFIED", "CANCELLED"]
LAB_PRIORITIES = ["ROUTINE", "URGENT", "STAT"]

BED_TYPES = ["GENERAL", "PRIVATE", "ICU", "DAYCARE"]
BED_STATUSES = ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"]
ADMISSION_STATUSES = ["ADMITTED", "DISCHARGED"]


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(30), index=True)
    facility_id: Mapped[Optional[int]] = mapped_column(ForeignKey("facilities.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    facility: Mapped[Optional["Facility"]] = relationship(back_populates="users")
    doctor_profile: Mapped[Optional["DoctorProfile"]] = relationship(
        back_populates="user", uselist=False, foreign_keys="DoctorProfile.user_id"
    )


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    specialty: Mapped[str] = mapped_column(String(120), default="General Medicine")
    registration_no: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    consultation_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="doctor_profile", foreign_keys=[user_id])
    schedules: Mapped[list["DoctorSchedule"]] = relationship(back_populates="doctor_profile")

    @property
    def doctor_name(self) -> str:
        return self.user.full_name if self.user else ""


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_profile_id: Mapped[int] = mapped_column(ForeignKey("doctor_profiles.id"), index=True)
    weekday: Mapped[int] = mapped_column(Integer, index=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    slot_minutes: Mapped[int] = mapped_column(Integer, default=15)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    doctor_profile: Mapped["DoctorProfile"] = relationship(back_populates="schedules")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    mrn: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    dob: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    gender: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blood_group: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    allergies: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    national_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    abha_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(10), default="ACTIVE", index=True)
    merged_into_id: Mapped[Optional[int]] = mapped_column(ForeignKey("patients.id"), nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    appointments: Mapped[list["Appointment"]] = relationship(back_populates="patient")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="patient")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index(
            "uq_appointment_active_slot",
            "doctor_profile_id",
            "scheduled_date",
            "slot_start",
            unique=True,
            sqlite_where=text("status IN ('BOOKED','CHECKED_IN','IN_PROGRESS')"),
            postgresql_where=text("status IN ('BOOKED','CHECKED_IN','IN_PROGRESS')"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_profile_id: Mapped[int] = mapped_column(ForeignKey("doctor_profiles.id"), index=True)
    facility_id: Mapped[Optional[int]] = mapped_column(ForeignKey("facilities.id"), nullable=True, index=True)
    scheduled_date: Mapped[date] = mapped_column(Date, index=True)
    slot_start: Mapped[time] = mapped_column(Time)
    slot_end: Mapped[time] = mapped_column(Time)
    token_number: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(15), default="BOOKED", index=True)
    source: Mapped[str] = mapped_column(String(15), default="DESK")
    chief_complaint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="appointments")
    doctor_profile: Mapped["DoctorProfile"] = relationship()


class ServiceItem(Base):
    __tablename__ = "service_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(20), index=True)
    price: Mapped[float] = mapped_column(Numeric(12, 2))
    tax_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_no: Mapped[Optional[str]] = mapped_column(String(40), unique=True, nullable=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    facility_id: Mapped[Optional[int]] = mapped_column(ForeignKey("facilities.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(15), default="DRAFT", index=True)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(5), default="INR")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issued_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    lines: Mapped[list["InvoiceLine"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice")
    patient: Mapped["Patient"] = relationship(back_populates="invoices")


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), index=True)
    service_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("service_items.id"), nullable=True)
    description: Mapped[str] = mapped_column(String(250))
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    method: Mapped[str] = mapped_column(String(15))
    reference: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    received_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_profile_id: Mapped[Optional[int]] = mapped_column(ForeignKey("doctor_profiles.id"), nullable=True)
    appointment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("appointments.id"), nullable=True)
    enc_type: Mapped[str] = mapped_column(String(15), default="OPD")
    status: Mapped[str] = mapped_column(String(10), default="OPEN", index=True)
    chief_complaint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    patient: Mapped["Patient"] = relationship()
    doctor_profile: Mapped[Optional["DoctorProfile"]] = relationship()


class VitalsEntry(Base):
    __tablename__ = "vitals_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"), index=True)
    recorded_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    temperature_c: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)
    pulse: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    spo2: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    systolic: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    diastolic: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resp_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"), index=True)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    note_type: Mapped[str] = mapped_column(String(20), default="SOAP")
    subjective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    objective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assessment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(15), default="MANUAL")
    signed: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"), index=True)
    code: Mapped[str] = mapped_column(String(10), index=True)
    description: Mapped[str] = mapped_column(String(250))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    added_via: Mapped[str] = mapped_column(String(15), default="MANUAL")
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Drug(Base):
    __tablename__ = "drugs"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    generic_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    form: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    strength: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    atc_class: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_narcotic: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    batches: Mapped[list["DrugBatch"]] = relationship()


class DrugBatch(Base):
    __tablename__ = "drug_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    drug_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"), index=True)
    batch_no: Mapped[str] = mapped_column(String(50))
    expiry_date: Mapped[date] = mapped_column(Date, index=True)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=0)


class DrugInteraction(Base):
    __tablename__ = "drug_interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    drug_a_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"), index=True)
    drug_b_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"), index=True)
    severity: Mapped[str] = mapped_column(String(10), default="MODERATE")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("encounters.id"), nullable=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    prescriber_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(15), default="ACTIVE", index=True)
    warnings_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    items: Mapped[list["PrescriptionItem"]] = relationship(cascade="all, delete-orphan")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    prescription_id: Mapped[int] = mapped_column(ForeignKey("prescriptions.id"), index=True)
    drug_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"))
    dosage: Mapped[str] = mapped_column(String(60))
    frequency: Mapped[str] = mapped_column(String(60))
    duration_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)

    drug: Mapped["Drug"] = relationship()


class DispenseRecord(Base):
    __tablename__ = "dispense_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    prescription_id: Mapped[int] = mapped_column(ForeignKey("prescriptions.id"), index=True)
    pharmacist_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    warnings_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    dispensed_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class DispenseLine(Base):
    __tablename__ = "dispense_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    dispense_id: Mapped[int] = mapped_column(ForeignKey("dispense_records.id"), index=True)
    prescription_item_id: Mapped[int] = mapped_column(ForeignKey("prescription_items.id"))
    drug_batch_id: Mapped[int] = mapped_column(ForeignKey("drug_batches.id"))
    quantity: Mapped[float] = mapped_column(Numeric(10, 2))


class LabTestDef(Base):
    __tablename__ = "lab_test_defs"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    ref_low: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    ref_high: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    critical_low: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    critical_high: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    tat_hours: Mapped[int] = mapped_column(Integer, default=24)
    price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class LabOrder(Base):
    __tablename__ = "lab_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    test_def_id: Mapped[int] = mapped_column(ForeignKey("lab_test_defs.id"))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    encounter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("encounters.id"), nullable=True)
    ordered_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default="ROUTINE")
    status: Mapped[str] = mapped_column(String(20), default="ORDERED", index=True)
    ordered_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    collected_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resulted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    test_def: Mapped["LabTestDef"] = relationship()
    result: Mapped[Optional["LabResult"]] = relationship(back_populates="order", uselist=False)


class LabResult(Base):
    __tablename__ = "lab_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("lab_orders.id"), unique=True)
    order: Mapped["LabOrder"] = relationship(back_populates="result")
    value_numeric: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    value_text: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    is_abnormal: Mapped[bool] = mapped_column(Boolean, default=False)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    entered_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    entered_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    verified_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), unique=True)
    body: Mapped[str] = mapped_column(Text)
    tags: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AIInteraction(Base):
    __tablename__ = "ai_interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(60), nullable=True, index=True)
    feature: Mapped[str] = mapped_column(String(40), index=True)
    provider: Mapped[str] = mapped_column(String(30), default="heuristic")
    model: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    input_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    accepted: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)


class Ward(Base):
    __tablename__ = "wards"

    id: Mapped[int] = mapped_column(primary_key=True)
    facility_id: Mapped[Optional[int]] = mapped_column(ForeignKey("facilities.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    floor: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    beds: Mapped[list["Bed"]] = relationship(back_populates="ward")


class Bed(Base):
    __tablename__ = "beds"
    __table_args__ = (UniqueConstraint("ward_id", "bed_no", name="uq_bed_ward_no"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    ward_id: Mapped[int] = mapped_column(ForeignKey("wards.id"), index=True)
    bed_no: Mapped[str] = mapped_column(String(15))
    bed_type: Mapped[str] = mapped_column(String(15), default="GENERAL", index=True)
    status: Mapped[str] = mapped_column(String(15), default="AVAILABLE", index=True)

    ward: Mapped["Ward"] = relationship()


class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    encounter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("encounters.id"), nullable=True)
    bed_id: Mapped[int] = mapped_column(ForeignKey("beds.id"), index=True)
    attending_profile_id: Mapped[Optional[int]] = mapped_column(ForeignKey("doctor_profiles.id"), nullable=True)
    admitted_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    expected_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="ADMITTED", index=True)
    admitted_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    discharged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    discharge_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    patient: Mapped["Patient"] = relationship()
    bed: Mapped["Bed"] = relationship()


class TeleSession(Base):
    __tablename__ = "tele_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    encounter_id: Mapped[int] = mapped_column(ForeignKey("encounters.id"), index=True)
    room_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    join_url: Mapped[str] = mapped_column(String(300))
    provider: Mapped[str] = mapped_column(String(30), default="jitsi")
    status: Mapped[str] = mapped_column(String(12), default="SCHEDULED", index=True)
    scheduled_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Plugin(Base):
    __tablename__ = "plugins"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(20), default="ANALYTICS")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(15), default="1.0.0")
    vendor: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    config_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    installed_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    actor_username: Mapped[Optional[str]] = mapped_column(String(60), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    resource_type: Mapped[str] = mapped_column(String(50), index=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    patient_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    ip: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
