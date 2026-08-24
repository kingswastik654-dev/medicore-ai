import sys
from datetime import date, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    DoctorProfile,
    DoctorSchedule,
    Drug,
    DrugBatch,
    DrugInteraction,
    Facility,
    KnowledgeDoc,
    LabTestDef,
    Patient,
    ServiceItem,
    User,
)

SCHEDULE_WEEKDAYS = [0, 1, 2, 3, 4]
SERVICES = [
    ("CONS-GEN", "General Consultation", "CONSULTATION", 500),
    ("CONS-SPEC", "Specialist Consultation", "CONSULTATION", 900),
    ("LAB-CBC", "Complete Blood Count", "LAB", 350),
    ("LAB-LFT", "Liver Function Test", "LAB", 700),
    ("LAB-KFT", "Kidney Function Test", "LAB", 750),
    ("LAB-HBA1C", "HbA1c", "LAB", 550),
    ("RAD-CXR", "Chest X-Ray", "RADIOLOGY", 600),
    ("RAD-USABD", "Ultrasound Abdomen", "RADIOLOGY", 1200),
    ("PROC-DRESS", "Wound Dressing", "PROCEDURE", 400),
    ("PHM-CONS", "Pharmacy Item", "PHARMACY", 100),
    ("ROOM-GEN", "General Ward Bed Day", "ROOM", 2500),
    ("ROOM-ICU", "ICU Bed Day", "ROOM", 12000),
]


def get_or_create_user(db: Session, **kwargs) -> User:
    user = db.scalar(select(User).where(User.username == kwargs["username"]))
    if user:
        return user
    new_user = User(**kwargs)
    db.add(new_user)
    db.flush()
    return new_user


DRUGS = [
    ("DRUG-ASA", "Aspirin 75mg Tablet", "Acetylsalicylic acid", "Tablet", "75 mg"),
    ("DRUG-WARF", "Warfarin 5mg Tablet", "Warfarin sodium", "Tablet", "5 mg"),
    ("DRUG-AMOX", "Amoxicillin 500mg Capsule", "Amoxicillin", "Capsule", "500 mg"),
    ("DRUG-PARA", "Paracetamol 650mg Tablet", "Paracetamol", "Tablet", "650 mg"),
    ("DRUG-METF", "Metformin 500mg Tablet", "Metformin HCl", "Tablet", "500 mg"),
    ("DRUG-IBUP", "Ibuprofen 400mg Tablet", "Ibuprofen", "Tablet", "400 mg"),
]

DRUG_INTERACTIONS = [
    ("DRUG-ASA", "DRUG-WARF", "MAJOR", "Additive bleeding risk; concurrent use requires INR monitoring."),
    ("DRUG-ASA", "DRUG-IBUP", "MODERATE", "Ibuprofen may reduce aspirin's antiplatelet effect."),
    ("DRUG-WARF", "DRUG-PARA", "MINOR", "Regular paracetamol may potentiate warfarin effect at high doses."),
]

LAB_TESTS = [
    ("LABH-HB", "Hemoglobin", "g/dL", 12.0, 16.0, 7.0, 20.0, 6, 350),
    ("LABH-GLUF", "Blood Glucose Fasting", "mg/dL", 70.0, 110.0, 45.0, 300.0, 4, 150),
    ("LABH-TSH", "TSH", "uIU/mL", 0.4, 4.0, 0.05, 15.0, 12, 450),
]

KNOWLEDGE_DOCS = [
    (
        "Sepsis Screening Protocol",
        "Screen every febrile patient for sepsis using qSOFA: respiratory rate >=22/min, "
        "altered mentation (GCS<15), systolic BP <=100 mmHg. Two or more criteria indicate high risk. "
        "Draw blood cultures and serum lactate within one hour, start broad-spectrum antibiotics after "
        "cultures, and give 30 mL/kg crystalloid for hypotension. Reassess hourly and escalate to ICU "
        "if lactate >4 mmol/L or hypotension persists despite fluids.",
        "sepsis,qsofa,fever,infection,icu,lactate",
    ),
    (
        "Hypertension Management Guidelines",
        "Confirm elevated BP on at least two visits using proper technique before diagnosing "
        "hypertension. For stage 1 without cardiovascular disease, begin with lifestyle modification: "
        "DASH diet, sodium <2 g/day, 150 minutes weekly aerobic exercise, weight reduction. Start a "
        "single agent such as amlodipine or an ACE inhibitor if BP remains above 140/90 after three "
        "months or if diabetes is present. Monitor potassium and creatinine two weeks after starting "
        "ACE inhibitors.",
        "hypertension,bp,blood pressure,amlodipine,dash",
    ),
    (
        "Anticoagulation and Bleeding Risk",
        "Patients on warfarin require INR testing every four weeks when stable. Hold warfarin for "
        "major surgery per surgeon advice, bridging with LMWH only for mechanical valves or recent "
        "thromboembolism. Avoid concurrent NSAIDs and aspirin unless specifically indicated because "
        "combined therapy multiplies gastrointestinal bleeding risk. Educate patients about dark "
        "stools, unusual bruising, and gum bleeding as warning signs requiring immediate review.",
        "warfarin,inr,bleeding,anticoagulation,aspirin,surgery",
    ),
    (
        "Diabetes Follow-up Schedule",
        "Review HbA1c every three months; target below 7 percent for most adults on metformin-based "
        "therapy. Annual screening includes retinal exam, urine microalbumin, foot examination with "
        "monofilament, and lipid profile. Reinforce diet adherence, 30 minutes daily activity, and "
        "hypoglycemia awareness. Escalate to endocrinology when HbA1c exceeds 9 percent despite dual "
        "oral therapy or when ketosis-prone features appear.",
        "diabetes,hba1c,metformin,retinal,foot,glucose",
    ),
]


def _seed_pharmacy(db: Session) -> None:
    drugs = {}
    for code, name, generic, form, strength in DRUGS:
        drug = db.scalar(select(Drug).where(Drug.code == code))
        if not drug:
            drug = Drug(code=code, name=name, generic_name=generic, form=form, strength=strength)
            db.add(drug)
            db.flush()
        drugs[code] = drug

    if not db.scalar(select(DrugBatch).limit(1)):
        today = date.today()
        batches = [
            ("DRUG-ASA", "ASA-B101", today + timedelta(days=200), 500),
            ("DRUG-WARF", "WARF-B201", today + timedelta(days=120), 300),
            ("DRUG-WARF", "WARF-B202", today + timedelta(days=60), 250),
            ("DRUG-AMOX", "AMOX-B301", today + timedelta(days=90), 800),
            ("DRUG-PARA", "PARA-B401", today + timedelta(days=400), 1000),
            ("DRUG-METF", "METF-B501", today + timedelta(days=300), 900),
            ("DRUG-IBUP", "IBUP-B601", today + timedelta(days=150), 600),
        ]
        for code, batch_no, expiry, qty in batches:
            db.add(DrugBatch(drug_id=drugs[code].id, batch_no=batch_no, expiry_date=expiry, quantity=qty))

    for code_a, code_b, severity, desc in DRUG_INTERACTIONS:
        exists = db.scalar(
            select(DrugInteraction).where(
                DrugInteraction.drug_a_id == drugs[code_a].id,
                DrugInteraction.drug_b_id == drugs[code_b].id,
            )
        )
        if not exists:
            db.add(
                DrugInteraction(
                    drug_a_id=drugs[code_a].id,
                    drug_b_id=drugs[code_b].id,
                    severity=severity,
                    description=desc,
                )
            )


def _seed_labs(db: Session) -> None:
    for code, name, unit, low, high, clow, chigh, tat, price in LAB_TESTS:
        if not db.scalar(select(LabTestDef).where(LabTestDef.code == code)):
            db.add(
                LabTestDef(
                    code=code, name=name, unit=unit,
                    ref_low=low, ref_high=high,
                    critical_low=clow, critical_high=chigh,
                    tat_hours=tat, price=price,
                )
            )


def _seed_knowledge(db: Session) -> None:
    for title, body, tags in KNOWLEDGE_DOCS:
        if not db.scalar(select(KnowledgeDoc).where(KnowledgeDoc.title == title)):
            db.add(KnowledgeDoc(title=title, body=body, tags=tags))


def _seed_ipd(db: Session) -> None:
    from app.models import Bed, Ward

    ward_defs = [("General Ward A", "GEN-A", "1"), ("Intensive Care Unit", "ICU", "2")]
    wards = {}
    for name, code, floor in ward_defs:
        ward = db.scalar(select(Ward).where(Ward.code == code))
        if not ward:
            ward = Ward(name=name, code=code, floor=floor)
            db.add(ward)
            db.flush()
        wards[code] = ward

    bed_defs = [
        ("GEN-A", [f"A{i:02d}" for i in range(1, 9)], "GENERAL"),
        ("ICU", ["ICU-1", "ICU-2", "ICU-3", "ICU-4"], "ICU"),
    ]
    for code, numbers, btype in bed_defs:
        for no in numbers:
            if not db.scalar(select(Bed).where(Bed.ward_id == wards[code].id, Bed.bed_no == no)):
                db.add(Bed(ward_id=wards[code].id, bed_no=no, bed_type=btype))


def run_seed(db: Session) -> None:
    facility = db.scalar(select(Facility).where(Facility.code == "MAIN"))
    if not facility:
        facility = Facility(name="MediCore Main Hospital", code="MAIN")
        db.add(facility)
        db.flush()

    admin = get_or_create_user(
        db,
        username="admin",
        full_name="System Administrator",
        email="admin@medcore.local",
        hashed_password=hash_password("Admin@123"),
        role="SUPER_ADMIN",
        facility_id=facility.id,
    )
    doctor = get_or_create_user(
        db,
        username="dr.house",
        full_name="Dr. Gregory House",
        email="house@medcore.local",
        hashed_password=hash_password("Doctor@123"),
        role="DOCTOR",
        facility_id=facility.id,
    )
    get_or_create_user(
        db, username="nurse.priya", full_name="Priya Sharma",
        hashed_password=hash_password("Nurse@123"), role="NURSE", facility_id=facility.id,
    )
    get_or_create_user(
        db, username="reception.rekha", full_name="Rekha Verma",
        hashed_password=hash_password("Reception@123"), role="RECEPTIONIST", facility_id=facility.id,
    )
    get_or_create_user(
        db, username="cashier.amit", full_name="Amit Patel",
        hashed_password=hash_password("Cashier@123"), role="CASHIER", facility_id=facility.id,
    )
    get_or_create_user(
        db, username="auditor.meena", full_name="Meena Iyer",
        hashed_password=hash_password("Auditor@123"), role="AUDITOR", facility_id=facility.id,
    )
    get_or_create_user(
        db, username="pharm.suresh", full_name="Suresh Nair",
        hashed_password=hash_password("Pharma@123"), role="PHARMACIST", facility_id=facility.id,
    )
    get_or_create_user(
        db, username="lab.vikram", full_name="Vikram Joshi",
        hashed_password=hash_password("Lab@12345"), role="LAB_TECH", facility_id=facility.id,
    )

    profile = db.scalar(select(DoctorProfile).where(DoctorProfile.user_id == doctor.id))
    if not profile:
        profile = DoctorProfile(
            user_id=doctor.id,
            specialty="Internal Medicine",
            registration_no="REG-2001-4423",
            consultation_fee=800,
        )
        db.add(profile)
        db.flush()
        for weekday in SCHEDULE_WEEKDAYS:
            db.add(
                DoctorSchedule(
                    doctor_profile_id=profile.id,
                    weekday=weekday,
                    start_time=time(9, 0),
                    end_time=time(13, 0),
                    slot_minutes=15,
                )
            )
        for weekday in SCHEDULE_WEEKDAYS:
            db.add(
                DoctorSchedule(
                    doctor_profile_id=profile.id,
                    weekday=weekday,
                    start_time=time(17, 0),
                    end_time=time(19, 0),
                    slot_minutes=15,
                )
            )

    for code, name, category, price in SERVICES:
        if not db.scalar(select(ServiceItem).where(ServiceItem.code == code)):
            db.add(ServiceItem(code=code, name=name, category=category, price=price))

    _seed_pharmacy(db)
    _seed_labs(db)
    _seed_knowledge(db)
    _seed_ipd(db)

    if not db.scalar(select(Patient).limit(1)):
        db.add(
            Patient(
                mrn="MRN-000001",
                first_name="Ramesh",
                last_name="Kumar",
                dob=date(1980, 5, 12),
                gender="MALE",
                phone="+91-9876543210",
                blood_group="O+",
                created_by_id=admin.id,
            )
        )
        db.add(
            Patient(
                mrn="MRN-000002",
                first_name="Sunita",
                last_name="Devi",
                dob=date(1992, 11, 30),
                gender="FEMALE",
                phone="+91-9123456780",
                blood_group="A+",
                allergies="Penicillin",
                created_by_id=admin.id,
            )
        )

    db.commit()


if __name__ == "__main__":
    from app.db.session import SessionLocal

    run_seed(SessionLocal())
    print("Seed complete.")
    sys.exit(0)
