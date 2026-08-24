from datetime import date, timedelta


def _patient(doctor, first, last, phone):
    return doctor.post(
        "/api/patients?force=true", json={"first_name": first, "last_name": last, "phone": phone}
    ).json()


def test_opd_forecast_returns_horizon_with_confidence(admin):
    res = admin.get("/api/ai/ops/forecast/opd", params={"days": 5})
    assert res.status_code == 200
    body = res.json()
    assert len(body["predictions"]) == 5
    for p in body["predictions"]:
        assert p["weekday"]
        if p["predicted_visits"] is not None:
            assert p["predicted_visits"] >= 0
            assert p["range_low"] <= p["predicted_visits"] <= p["range_high"]
            assert p["confidence"] in ("low", "medium")


def test_bed_readiness_flags_open_encounter_and_orders(doctor):
    patient = _patient(doctor, "Ready", "Agent", "+91-9140000010")
    adm = doctor.post(
        "/api/ipd/admissions",
        json={"patient_id": patient["id"], "ward_code": "GEN-A"},
    ).json()

    tests = doctor.get("/api/lab/tests").json()
    hb = next(t for t in tests if t["code"] == "LABH-HB")
    doctor.post(
        "/api/lab/orders",
        json={"patient_id": patient["id"], "test_def_id": hb["id"], "priority": "STAT"},
    )

    suggestions = doctor.get("/api/ai/ops/bed-suggestions").json()["suggestions"]
    mine = next(s for s in suggestions if s["admission_id"] == adm["id"])
    assert mine["ready"] is False or any("urgent" in b.lower() for b in mine["blockers"])
    assert 5 <= mine["score"] <= 100

    labtech_login = doctor.post(
        "/api/auth/login", json={"username": "lab.vikram", "password": "Lab@12345"}
    )
    tok = labtech_login.json()["access_token"]
    orders = doctor.get("/api/lab/orders").json()
    stat_order = next(o for o in orders if o["patient_id"] == patient["id"])
    doctor.headers.update({"Authorization": f"Bearer {tok}"})
    doctor.post(f"/api/lab/orders/{stat_order['id']}/collect")
    doctor.post(f"/api/lab/orders/{stat_order['id']}/result", json={"value_numeric": 13.0})
    doctor.post(f"/api/lab/orders/{stat_order['id']}/verify")
    doctor.headers.update({"Authorization": f"Bearer {(doctor.post('/api/auth/login', json={'username': 'dr.house', 'password': 'Doctor@123'})).json()['access_token']}"})

    after = doctor.get("/api/ai/ops/bed-suggestions").json()["suggestions"]
    mine2 = next(s for s in after if s["admission_id"] == adm["id"])
    resolved = not any("urgent" in b.lower() for b in mine2["blockers"])
    assert resolved and mine2["score"] >= mine["score"]


def test_denial_risk_scores_high_for_risky_invoice(admin, receptionist):
    risky_patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "NoPhone", "last_name": "Risk"},
    ).json()
    inv = admin.post(
        "/api/invoices",
        json={
            "patient_id": risky_patient["id"],
            "lines": [{"description": "Major procedure", "quantity": 1, "unit_price": 60000}],
            "invoice_discount": 15000,
        },
    ).json()
    issued = admin.post(f"/api/invoices/{inv['id']}/issue")
    invoice_id = issued.json()["id"]

    scored = admin.post("/api/ai/ops/denials/score", params={"invoice_id": invoice_id})
    assert scored.status_code == 200
    body = scored.json()
    assert body["tier"] == "HIGH"
    factor_names = {f["factor"] for f in body["factors"]}
    assert {"high_value_claim", "heavy_discount", "missing_contact"} <= factor_names
    assert "hold" in body["recommendation"].lower() or "resolve" in body["recommendation"].lower()

    clean_patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Clean", "last_name": "Claim", "phone": "+91-9140000020", "national_id": "ID-99881"},
    ).json()
    inv2 = admin.post(
        "/api/invoices",
        json={
            "patient_id": clean_patient["id"],
            "lines": [{"description": "Consultation", "quantity": 1, "unit_price": 800}],
        },
    ).json()
    issued2 = admin.post(f"/api/invoices/{inv2['id']}/issue").json()
    clean_scored = admin.post("/api/ai/ops/denials/score", params={"invoice_id": issued2["id"]}).json()
    assert clean_scored["tier"] == "LOW"
    assert clean_scored["score"] < 20


def test_ar_priorities_rank_outstanding_by_age_and_value(admin):
    patient = admin.post(
        "/api/patients?force=true",
        json={"first_name": "Ar", "last_name": "Rank", "phone": "+91-9140000021"},
    ).json()

    small = admin.post(
        "/api/invoices",
        json={"patient_id": patient["id"], "lines": [{"description": "Small", "quantity": 1, "unit_price": 900}]},
    ).json()
    admin.post(f"/api/invoices/{small['id']}/issue")

    priorities = admin.get("/api/ai/ops/rcm/ar-priorities").json()["priorities"]
    assert len(priorities) >= 1
    ours = [p for p in priorities if p["invoice_no"] and p.get("outstanding")]
    scores = [p["priority_score"] for p in priorities]
    assert scores == sorted(scores, reverse=True)
    buckets = {p["age_bucket"] for p in priorities}
    assert buckets <= {"0-7", "8-30", "31-60", "60+"}


def test_forecast_endpoint_audited_as_ai(admin):
    admin.get("/api/ai/ops/forecast/opd")
    audits = admin.get("/api/audits").json()["items"]
    ai_calls = [a for a in audits if a["action"] == "AI_CALL"]
    assert len(ai_calls) >= 2

    from app.db.session import engine as eng

    with eng.connect() as conn:
        row = conn.exec_driver_sql(
            "SELECT COUNT(*) FROM ai_interactions WHERE feature IN ('OPD_FORECAST','DENIAL_SCORE','AR_PRIORITY','BED_READINESS')"
        ).fetchone()
    assert row[0] >= 2
