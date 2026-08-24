def _get_test(admin, code):
    tests = admin.get("/api/lab/tests").json()
    return next(t for t in tests if t["code"] == code)


def _order(doctor, patient_id, test_def_id, priority="URGENT"):
    res = doctor.post(
        "/api/lab/orders",
        json={"patient_id": patient_id, "test_def_id": test_def_id, "priority": priority},
    )
    assert res.status_code == 201, res.text
    return res.json()


def _patient(receptionist, first, last):
    return receptionist.post(
        "/api/patients?force=true", json={"first_name": first, "last_name": last, "phone": f"+91-9120{last}"[:13]}
    ).json()


def test_lab_order_full_lifecycle_with_critical_flag(admin, doctor, nurse, labtech, receptionist):
    hb = _get_test(admin, "LABH-HB")
    patient = _patient(receptionist, "Lab", "Flow")

    order = _order(doctor, patient["id"], hb["id"], priority="STAT")
    assert order["status"] == "ORDERED"
    assert order["test_code"] == "LABH-HB"

    result_too_early = labtech.post(f"/api/lab/orders/{order['id']}/result", json={"value_numeric": 9.0})
    assert result_too_early.status_code == 400

    collected = nurse.post(f"/api/lab/orders/{order['id']}/collect")
    assert collected.status_code == 200

    low_hb = labtech.post(f"/api/lab/orders/{order['id']}/result", json={"value_numeric": 6.2})
    assert low_hb.status_code == 200, low_hb.text
    body = low_hb.json()
    assert body["critical_alert"] is True
    assert body["result"]["is_abnormal"] is True and body["result"]["is_critical"] is True

    verified = doctor.post(f"/api/lab/orders/{order['id']}/verify")
    assert verified.status_code == 200
    assert verified.json()["status"] == "VERIFIED"


def test_abnormal_not_critical_and_normal_paths(labtech, doctor, receptionist, admin):
    glu = _get_test(admin, "LABH-GLUF")

    p1 = _patient(receptionist, "Glucose", "High")
    o1 = _order(doctor, p1["id"], glu["id"])
    labtech.post(f"/api/lab/orders/{o1['id']}/collect")
    r1 = labtech.post(f"/api/lab/orders/{o1['id']}/result", json={"value_numeric": 180})
    assert r1.json()["critical_alert"] is False
    assert r1.json()["result"]["is_abnormal"] is True

    p2 = _patient(receptionist, "Glucose", "Ok")
    o2 = _order(doctor, p2["id"], glu["id"])
    labtech.post(f"/api/lab/orders/{o2['id']}/collect")
    r2 = labtech.post(f"/api/lab/orders/{o2['id']}/result", json={"value_numeric": 92})
    assert r2.json()["result"]["is_abnormal"] is False


def test_worklist_orders_stat_first(labtech, doctor, receptionist, admin):
    hb = _get_test(admin, "LABH-HB")
    pa = _patient(receptionist, "Stat", "Aa")
    pb = _patient(receptionist, "Routine", "Bb")

    routine = _order(doctor, pb["id"], hb["id"], priority="ROUTINE")
    stat = _order(doctor, pa["id"], hb["id"], priority="STAT")

    worklist = labtech.get("/api/lab/orders", params={"status": "ORDERED"}).json()
    ids = [o["id"] for o in worklist]
    assert ids.index(stat["id"]) < ids.index(routine["id"])


def test_only_lab_tech_enters_results(doctor, admin, labtech, receptionist):
    tsh = _get_test(admin, "LABH-TSH")
    patient = _patient(receptionist, "Perm", "Check")
    order = _order(doctor, patient["id"], tsh["id"])

    denied_collect = doctor.post(f"/api/lab/orders/{order['id']}/collect")
    assert denied_collect.status_code == 403

    collected = labtech.post(f"/api/lab/orders/{order['id']}/collect")
    assert collected.status_code == 200

    denied_result = doctor.post(f"/api/lab/orders/{order['id']}/result", json={"value_numeric": 2.5})
    assert denied_result.status_code == 403

    allowed = labtech.post(f"/api/lab/orders/{order['id']}/result", json={"value_numeric": 2.5})
    assert allowed.status_code == 200
    assert allowed.json()["critical_alert"] is False
