def test_preauth_draft_builds_payer_packet(admin, receptionist):
    patient = receptionist.post(
        "/api/patients?force=true",
        json={
            "first_name": "Preauth", "last_name": "Case",
            "phone": "+91-9160000001", "abha_id": "ABHA-77123",
        },
    ).json()

    enc = admin.post(
        "/api/encounters",
        json={"patient_id": patient["id"], "enc_type": "IPD", "chief_complaint": "surgery"},
    ).json()
    admin.post(
        f"/api/encounters/{enc['id']}/diagnoses",
        json={"code": "K80.2", "description": "Calculus of gallbladder", "is_primary": True},
    )

    inv = admin.post(
        "/api/invoices",
        json={
            "patient_id": patient["id"],
            "lines": [
                {"description": "Laparoscopic cholecystectomy", "quantity": 1, "unit_price": 65000},
                {"description": "ICU day 1", "quantity": 1, "unit_price": 12000},
            ],
        },
    ).json()
    issued = admin.post(f"/api/invoices/{inv['id']}/issue").json()

    res = admin.post("/api/ai/ops/preauth/draft", params={"invoice_id": issued["id"]})
    assert res.status_code == 200, res.text
    packet = res.json()
    assert packet["request_type"] == "CASHLESS_PREAUTH"
    assert packet["patient"]["mrn"] == patient["mrn"]
    assert packet["patient"]["abha_or_national_id"] == "ABHA-77123"
    codes = [d["code"] for d in packet["diagnoses"]]
    assert "K80.2" in codes
    assert len(packet["lines"]) == 2
    assert packet["amount_requested"] == 77000.0
    assert "Rs 77,000" in packet["medical_necessity"] or "77,000" in packet["medical_necessity"]
    assert packet["provider"] in ("heuristic", "openai")


def test_lead_capture_public_and_admin_listing(client, admin):
    lead = client.post(
        "/api/leads",
        json={
            "hospital_name": "Sunrise Multispeciality",
            "contact_name": "Dr. Meera Nair",
            "email": "meera@sunrisehealth.in",
            "phone": "+91-9170000001",
            "beds": "120 beds",
            "message": "Need OPD + billing automation for 3 branches.",
        },
    )
    assert lead.status_code == 201

    listed = admin.get("/api/leads").json()
    assert listed["total"] >= 1
    match = next(l for l in listed["items"] if l["hospital_name"] == "Sunrise Multispeciality")
    assert match["status"] == "NEW"

    advanced = admin.patch(f"/api/leads/{match['id']}?new_status=QUALIFIED")
    assert advanced.status_code == 200 and advanced.json()["status"] == "QUALIFIED"


def test_lead_validation_rejects_bad_email(client):
    res = client.post(
        "/api/leads",
        json={"hospital_name": "Bad", "contact_name": "No Email", "email": "not-an-email"},
    )
    assert res.status_code == 422


def test_leads_listing_is_admin_only(receptionist):
    res = receptionist.get("/api/leads")
    assert res.status_code == 403
