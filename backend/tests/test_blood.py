from datetime import date, timedelta

def _donor(receptionist, name, group="O+"):
    res = receptionist.post("/api/blood/donors", json={"full_name": name, "blood_group": group, "phone": "+91-9810099999"})
    assert res.status_code == 201, res.text
    return res.json()

def test_donor_and_unit_inventory_and_sweep(admin, labtech, receptionist):
    donors = receptionist.get("/api/blood/donors").json()
    assert len(donors) >= 3

    donor = _donor(receptionist, "Sweep Donor", "A+")
    unit_no = f"BB-TEST-{donor['id']}-001"
    u1 = labtech.post("/api/blood/units", json={"unit_no": unit_no, "donor_id": donor["id"], "component": "WHOLE_BLOOD"})
    assert u1.status_code == 201

    too_soon = labtech.post("/api/blood/units", json={"unit_no": unit_no + "-2", "donor_id": donor["id"]})
    assert too_soon.status_code == 400
    assert "eligible again" in too_soon.json()["detail"]

    inv = labtech.get("/api/blood/inventory").json()
    assert any(r["blood_group"] == "A+" for r in inv)

    expiring = labtech.post("/api/blood/units", json={"unit_no": f"EXP-{donor['id']}", "blood_group": "O+", "component": "WHOLE_BLOOD", "expires_on": (date.today() - timedelta(days=1)).isoformat()})
    assert expiring.status_code == 201
    assert expiring.json()["status"] == "AVAILABLE"
    sweep = labtech.post("/api/blood/inventory/sweep")
    assert sweep.status_code == 200
    assert sweep.json()["expired"] >= 1
    units = labtech.get("/api/blood/units", params={"status": "EXPIRED"}).json()
    assert any(u["unit_no"] == f"EXP-{donor['id']}" for u in units)

def test_crossmatch_compatible_issue_flow(doctor, labtech, receptionist):
    patient = receptionist.post("/api/patients?force=true", json={"first_name": "Blood", "last_name": "Flow", "phone": "+91-9810100001"}).json()
    donor = _donor(receptionist, "Issue Donor", "B+")
    unit = labtech.post("/api/blood/units", json={"unit_no": f"BB-ISSUE-{donor['id']}", "donor_id": donor["id"], "component": "PRBC"}).json()
    assert unit["status"] == "AVAILABLE"

    req = doctor.post("/api/blood/requests", json={"patient_id": patient["id"], "unit_id": unit["id"]})
    assert req.status_code == 201, req.text
    rid = req.json()["id"]
    assert req.json()["status"] == "REQUESTED"

    reserved = labtech.get("/api/blood/units", params={"status": "RESERVED"}).json()
    assert any(u["id"] == unit["id"] for u in reserved)

    tested = labtech.post(f"/api/blood/requests/{rid}/test", json={"compatible": True})
    assert tested.status_code == 200
    assert tested.json()["status"] == "COMPATIBLE"

    issued = labtech.post(f"/api/blood/requests/{rid}/issue")
    assert issued.status_code == 200
    assert issued.json()["status"] == "ISSUED"
    assert issued.json()["issued_at"] is not None

    unit_after = next(u for u in labtech.get("/api/blood/units", params={"status": "ISSUED"}).json() if u["id"] == unit["id"])
    assert unit_after["status"] == "ISSUED"

def test_crossmatch_incompatible_prevents_issue(doctor, labtech, receptionist):
    patient = receptionist.post("/api/patients?force=true", json={"first_name": "Blood", "last_name": "Incompat", "phone": "+91-9810100002"}).json()
    donor = _donor(receptionist, "Incompat Donor", "AB+")
    unit = labtech.post("/api/blood/units", json={"unit_no": f"BB-INCOMP-{donor['id']}", "donor_id": donor["id"]}).json()
    req = doctor.post("/api/blood/requests", json={"patient_id": patient["id"], "unit_id": unit["id"]}).json()
    rid = req["id"]
    bad = labtech.post(f"/api/blood/requests/{rid}/test", json={"compatible": False})
    assert bad.status_code == 200
    assert bad.json()["status"] == "INCOMPATIBLE"

    back = labtech.get("/api/blood/units", params={"status": "AVAILABLE"}).json()
    assert any(u["id"] == unit["id"] for u in back)

    issue_after_incompat = labtech.post(f"/api/blood/requests/{rid}/issue")
    assert issue_after_incompat.status_code == 400

def test_blood_rbac_and_duplicate_unit(doctor, receptionist, labtech):
    donor = _donor(receptionist, "Rbac Donor", "O-")
    unit_no = f"BB-DUP-{donor['id']}"
    assert labtech.post("/api/blood/units", json={"unit_no": unit_no, "donor_id": donor["id"]}).status_code == 201
    dup = labtech.post("/api/blood/units", json={"unit_no": unit_no, "donor_id": donor["id"]})
    assert dup.status_code == 409

    denied_collect = doctor.post("/api/blood/units", json={"unit_no": unit_no + "-X", "blood_group": "O+"})
    assert denied_collect.status_code == 403

    denied_donor = doctor.post("/api/blood/donors", json={"full_name": "Nope", "blood_group": "A+"})
    assert denied_donor.status_code == 403
