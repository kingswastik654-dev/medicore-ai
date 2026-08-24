def _make_patient(receptionist, name, phone):
    return receptionist.post(
        "/api/patients?force=true", json={"first_name": name[0], "last_name": name[1], "phone": phone}
    ).json()


def _create_invoice(cashier, patient_id):
    res = cashier.post(
        "/api/invoices",
        json={
            "patient_id": patient_id,
            "lines": [
                {"service_item_id": None, "description": "General Consultation", "quantity": 1, "unit_price": 500},
                {"service_item_id": None, "description": "CBC", "quantity": 1, "unit_price": 350, "discount": 50},
            ],
            "invoice_discount": 100,
            "notes": "OPD visit",
        },
    )
    assert res.status_code == 201, res.text
    inv = res.json()
    assert inv["subtotal"] == 850.0
    assert inv["discount_total"] == 150.0
    assert inv["grand_total"] == 700.0
    return inv


def test_services_listed(admin):
    services = admin.get("/api/services")
    assert services.status_code == 200
    codes = [s["code"] for s in services.json()]
    assert "CONS-GEN" in codes


def test_create_service_requires_admin(cashier, admin):
    denied = cashier.post(
        "/api/services",
        json={"code": "X-1", "name": "Nope Service", "category": "PROCEDURE", "price": 10},
    )
    assert denied.status_code == 403

    ok = admin.post(
        "/api/services",
        json={"code": "TEST-ITEM-1", "name": "Test Item", "category": "PROCEDURE", "price": 111.5},
    )
    assert ok.status_code == 201


def test_full_billing_lifecycle(admin):
    patient = _make_patient(admin, ("Bhuvan", "M"), "+91-9000000020")
    cashier = admin

    invoice = _create_invoice(cashier, patient["id"])
    iid = invoice["id"]

    pay_early = cashier.post(f"/api/invoices/{iid}/payments", json={"amount": 100, "method": "CASH"})
    assert pay_early.status_code == 400

    issued = cashier.post(f"/api/invoices/{iid}/issue")
    assert issued.status_code == 200
    assert issued.json()["status"] == "ISSUED"
    assert issued.json()["invoice_no"].startswith("INV-")

    partial = cashier.post(f"/api/invoices/{iid}/payments", json={"amount": 200, "method": "UPI", "reference": "upi-1"})
    assert partial.status_code == 201, partial.text
    after_partial = cashier.get(f"/api/invoices/{iid}").json()
    assert after_partial["status"] == "PARTIALLY_PAID"

    overpay = cashier.post(f"/api/invoices/{iid}/payments", json={"amount": 9999, "method": "CARD"})
    assert overpay.status_code == 400

    settle = cashier.post(f"/api/invoices/{iid}/payments", json={"amount": 500, "method": "CASH"})
    assert settle.status_code == 201, settle.text
    final = cashier.get(f"/api/invoices/{iid}").json()
    assert final["status"] == "PAID"
    assert final["amount_paid"] == 700.0


def test_discount_cannot_exceed_total(admin):
    patient = _make_patient(admin, ("Zara", "K"), "+91-9000000021")
    res = admin.post(
        "/api/invoices",
        json={
            "patient_id": patient["id"],
            "lines": [{"description": "Item", "quantity": 1, "unit_price": 100}],
            "invoice_discount": 500,
        },
    )
    assert res.status_code == 201
    assert res.json()["grand_total"] == 0.0


def test_analytics_summary(admin):
    summary = admin.get("/api/analytics/summary")
    assert summary.status_code == 200
    body = summary.json()
    for key in ["total_patients", "appointments_today", "revenue_today", "outstanding"]:
        assert key in body
    assert body["revenue_today"] >= 700.0


def test_write_operations_are_audited(admin):
    audits = admin.get("/api/audits", params={"action": "PAYMENT"})
    assert audits.status_code == 200
    items = audits.json()["items"]
    assert len(items) >= 1
    entry = items[0]
    assert entry["actor_username"]
    assert entry["resource_type"] in {"invoice", "http"}
