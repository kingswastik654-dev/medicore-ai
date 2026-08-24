from datetime import date, timedelta

TOMORROW = date.today() + timedelta(days=1)


def _patient(receptionist, first, last, phone):
    return receptionist.post(
        "/api/patients?force=true", json={"first_name": first, "last_name": last, "phone": phone}
    ).json()


def _beds(admin, ward_code=None, status=None):
    params = {}
    if ward_code:
        pass
    if status:
        params["status"] = status
    return admin.get("/api/ipd/beds", params=params or None).json()


def test_ward_and_bed_creation_admin_only(receptionist, admin):
    denied = receptionist.post("/api/ipd/wards", json={"name": "Nope Ward", "code": "NOPE"})
    assert denied.status_code == 403

    ok = admin.post("/api/ipd/wards", json={"name": "Test Ward X", "code": "TWX", "floor": "3"})
    assert ok.status_code == 201
    bed = admin.post("/api/ipd/beds", json={"ward_id": ok.json()["id"], "bed_no": "X-01", "bed_type": "PRIVATE"})
    assert bed.status_code == 201
    dup = admin.post("/api/ipd/beds", json={"ward_id": ok.json()["id"], "bed_no": "X-01"})
    assert dup.status_code == 409


def test_seed_beds_present_and_available(admin):
    beds = admin.get("/api/ipd/beds").json()
    assert len(beds) >= 12
    available = [b for b in beds if b["status"] == "AVAILABLE"]
    assert len(available) >= 10
    icu = [b for b in beds if b["bed_type"] == "ICU"]
    assert len(icu) >= 4


def test_admit_assigns_bed_and_creates_ipd_encounter(doctor):
    patient = _patient(doctor, "Adm", "Flow", "+91-9140000001")
    res = doctor.post(
        "/api/ipd/admissions",
        json={"patient_id": patient["id"], "ward_code": "GEN-A", "expected_days": 4},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "ADMITTED"
    assert body["bed"].startswith("GEN-A")

    enc = doctor.get(f"/api/encounters/{body['encounter_id']}").json()
    assert enc["enc_type"] == "IPD"

    beds = doctor.get("/api/ipd/beds").json()
    mine = next(b for b in beds if b["id"] and b.get("admission_id") == body["id"])
    assert mine["status"] == "OCCUPIED" and mine["patient_name"] == patient["full_name"]

    again = doctor.post(
        "/api/ipd/admissions",
        json={"patient_id": patient["id"], "ward_code": "GEN-A"},
    )
    assert again.status_code == 409


def test_transfer_moves_patient_and_marks_old_bed_cleaning(doctor, receptionist):
    patient = _patient(doctor, "Trf", "Flow", "+91-9140000002")
    adm = doctor.post(
        "/api/ipd/admissions",
        json={"patient_id": patient["id"], "ward_code": "GEN-A"},
    ).json()

    free = [b for b in doctor.get("/api/ipd/beds", params={"status": "AVAILABLE"}).json() if b["bed_type"] != "ICU"]
    target = free[0]

    moved = doctor.post(f"/api/ipd/admissions/{adm['id']}/transfer", json={"target_bed_id": target["id"]})
    assert moved.status_code == 200

    old_bed = next(b for b in doctor.get("/api/ipd/beds").json() if b["id"] == adm["bed_id"])
    assert old_bed["status"] == "CLEANING"

    ready = receptionist.post(f"/api/ipd/beds/{adm['bed_id']}/ready")
    assert ready.status_code == 200 and ready.json()["status"] == "AVAILABLE"


def test_discharge_then_housekeeping_cycle(doctor, receptionist):
    patient = _patient(doctor, "Dis", "Flow", "+91-9140000003")
    adm = doctor.post(
        "/api/ipd/admissions",
        json={"patient_id": patient["id"], "ward_code": "GEN-A"},
    ).json()

    discharged = doctor.post(
        f"/api/ipd/admissions/{adm['id']}/discharge",
        json={"discharge_note": "stable, home care"},
    )
    assert discharged.status_code == 200

    beds = {b["id"]: b for b in doctor.get("/api/ipd/beds").json()}
    assert beds[adm["bed_id"]]["status"] == "CLEANING"

    ready = receptionist.post(f"/api/ipd/beds/{adm['bed_id']}/ready")
    assert ready.status_code == 200 and ready.json()["status"] == "AVAILABLE"


def test_occupancy_endpoint_math(admin, doctor):
    occ = admin.get("/api/ipd/occupancy").json()
    total = sum(w["total"] for w in occ["wards"])
    occupied = sum(w["occupied"] for w in occ["wards"])
    assert occ["overall_pct"] == round(occupied / total * 100, 1)
