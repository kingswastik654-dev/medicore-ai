def _open_encounter(doctor, patient_id, complaint="fever and cough for 3 days"):
    res = doctor.post(
        "/api/encounters",
        json={"patient_id": patient_id, "enc_type": "OPD", "chief_complaint": complaint},
    )
    assert res.status_code == 201, res.text
    return res.json()


def _make_patient(receptionist, name, phone):
    return receptionist.post(
        "/api/patients?force=true", json={"first_name": name[0], "last_name": name[1], "phone": phone}
    ).json()


def test_receptionist_cannot_create_encounter(receptionist, admin):
    patient = admin.get("/api/patients", params={"q": "Ramesh"}).json()["items"][0]
    res = receptionist.post("/api/encounters", json={"patient_id": patient["id"]})
    assert res.status_code == 403


def test_encounter_lifecycle_with_vitals_and_notes(doctor, nurse):
    patient = doctor.post(
        "/api/patients?force=true",
        json={"first_name": "Encounter", "last_name": "Flow", "phone": "+91-9100000001"},
    ).json()
    enc = _open_encounter(doctor, patient["id"])
    eid = enc["id"]
    assert enc["status"] == "OPEN"
    assert enc["patient_name"] == "Encounter Flow"
    assert enc["doctor_profile_id"], "doctor profile should auto-link"

    vitals = nurse.post(
        f"/api/encounters/{eid}/vitals",
        json={"temperature_c": 38.6, "pulse": 104, "spo2": 96, "systolic": 128, "diastolic": 82},
    )
    assert vitals.status_code == 201

    note = doctor.post(
        f"/api/encounters/{eid}/notes",
        json={
            "note_type": "SOAP",
            "subjective": "- Fever 3 days, dry cough",
            "objective": "- Temp 38.6C, chest clear on auscultation",
            "assessment": "- Likely acute upper respiratory infection",
            "plan": "- Tab paracetamol, steam inhalation, review 5 days",
        },
    )
    assert note.status_code == 201
    assert note.json()["signed"] is True

    dx = doctor.post(
        f"/api/encounters/{eid}/diagnoses",
        json={"code": "J06.9", "description": "Acute upper respiratory infection", "is_primary": True},
    )
    assert dx.status_code == 201

    detail = doctor.get(f"/api/encounters/{eid}").json()
    assert len(detail["notes"]) == 1 and detail["notes"][0]["source"] == "MANUAL"
    assert detail["diagnoses"][0]["code"] == "J06.9"
    assert detail["vitals"][0]["temperature_c"] == 38.6

    closed = doctor.post(f"/api/encounters/{eid}/close")
    assert closed.status_code == 200 and closed.json()["status"] == "CLOSED"

    again = doctor.post(f"/api/encounters/{eid}/close")
    assert again.status_code == 400


def test_primary_diagnosis_switches_exclusively(doctor):
    patient = doctor.post(
        "/api/patients?force=true",
        json={"first_name": "Primary", "last_name": "Dx", "phone": "+91-9100000002"},
    ).json()
    enc = _open_encounter(doctor, patient["id"])
    doctor.post(
        f"/api/encounters/{enc['id']}/diagnoses",
        json={"code": "R50.9", "description": "Fever", "is_primary": True},
    )
    doctor.post(
        f"/api/encounters/{enc['id']}/diagnoses",
        json={"code": "J02.9", "description": "Pharyngitis", "is_primary": True},
    )
    detail = doctor.get(f"/api/encounters/{enc['id']}").json()
    primaries = [d for d in detail["diagnoses"] if d["is_primary"]]
    assert len(primaries) == 1 and primaries[0]["code"] == "J02.9"


def test_scribe_draft_endpoint_structures_transcript(doctor):
    transcript = """Patient: I have had fever and headache since two days.
Doctor: Temperature recorded 101 F, pulse 96.
Patient: Also mild cough at night.
Doctor: Chest examination clear. Likely viral syndrome.
Doctor: Prescribe tab paracetamol for five days, advise fluids and rest, follow up after three days."""
    res = doctor.post("/api/ai/scribe/draft", json={"transcript": transcript})
    assert res.status_code == 200
    body = res.json()
    assert "fever" in body["subjective"].lower()
    assert "paracetamol" in body["plan"].lower()
    assert "clear" in body["objective"].lower()
    assert body["provider"] in ("heuristic", "openai")
    assert "Review" in body["disclaimer"]

    accepted = doctor.post(
        "/api/ai/scribe/draft",
        json={"transcript": "short"} if False else {"transcript": transcript},
    )
    assert accepted.status_code == 200


def test_ai_accepted_note_is_audited_as_ai_source(doctor):
    patient = doctor.post(
        "/api/patients?force=true",
        json={"first_name": "Ai", "last_name": "Note", "phone": "+91-9100000003"},
    ).json()
    enc = _open_encounter(doctor, patient["id"], complaint="cough")
    note = doctor.post(
        f"/api/encounters/{enc['id']}/notes",
        json={"source": "AI_SCRIBE", "subjective": "- cough 1 week", "assessment": "- bronchitis likely", "plan": "- review"},
    )
    assert note.status_code == 201
    assert note.json()["source"] == "AI_SCRIBE"
