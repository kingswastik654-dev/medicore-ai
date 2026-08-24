from sqlalchemy import text as sqltext

from app.db.session import engine


def test_knowledge_search_finds_sepsis_protocol_with_citation(doctor):
    res = doctor.get("/api/ai/knowledge/search", params={"q": "fever qsofa lactate sepsis screening"})
    assert res.status_code == 200
    hits = res.json()["hits"]
    assert len(hits) >= 1
    assert any("Sepsis" in h["title"] for h in hits)
    top = hits[0]
    assert 0 < top["score"] <= 100
    assert len(top["excerpt"]) > 20


def test_knowledge_search_empty_query_handled(doctor):
    res = doctor.get("/api/ai/knowledge/search", params={"q": "zzzqqq"})
    assert res.status_code == 200
    assert res.json()["hits"] == []


def test_coding_suggest_returns_ranked_icd_codes(doctor):
    res = doctor.post(
        "/api/ai/coding/suggest",
        json={"text": "Patient reports crushing chest pain radiating to arm, known hypertension and diabetes."},
    )
    assert res.status_code == 200
    suggestions = res.json()
    codes = [s["code"] for s in suggestions]
    assert "I20.0" in codes or "R07.9" in codes
    assert "I10" in codes and "E11.9" in codes

    confidences = [s["confidence"] for s in suggestions]
    assert confidences == sorted(confidences, reverse=True)
    for s in suggestions:
        assert s["evidence"], "each suggestion must cite evidence keywords"


def test_analytics_ask_revenue_and_outstanding(admin):
    patient = admin.post(
        "/api/patients?force=true",
        json={"first_name": "Nl", "last_name": "Qa", "phone": "+91-9130000001"},
    ).json()

    inv = admin.post(
        "/api/invoices",
        json={
            "patient_id": patient["id"],
            "lines": [{"description": "Consult", "quantity": 1, "unit_price": 800}],
        },
    ).json()
    admin.post(f"/api/invoices/{inv['id']}/issue")

    revenue = admin.post("/api/analytics/ask?question=what%20was%20our%20revenue%20collected%20today")
    assert revenue.status_code == 200
    rev_body = revenue.json()
    assert rev_body["supported"] is True
    assert "revenue" in rev_body["answer"].lower() or "Revenue" in rev_body["answer"]

    outstanding = admin.post("/api/analytics/ask?question=how%20much%20outstanding%20dues")
    body = outstanding.json()
    assert body["supported"] is True
    assert str(int(inv["grand_total"])) in body["answer"].replace(",", "")

    summary_data = body["data"]
    assert "outstanding" in summary_data


def test_analytics_unsupported_question_flagged(doctor):
    res = doctor.post("/api/analytics/ask?question=who%20won%20the%20cricket%20match")
    assert res.status_code == 200
    body = res.json()
    assert body["supported"] is False
    assert "revenue" in body["answer"].lower()


def test_ai_feedback_loop_updates_interaction(admin, doctor):
    draft_res = doctor.post(
        "/api/ai/coding/suggest",
        json={"text": "persistent cough with fever since five days"},
    )
    assert draft_res.status_code == 200

    audits = admin.get("/api/audits", params={"action": "AI_CALL"})
    assert audits.json()["items"], "AI calls should be audited"

    with engine.connect() as conn:
        row = conn.exec_driver_sql(
            "SELECT id FROM ai_interactions WHERE feature='CODING_SUGGEST' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    assert row is not None
    interaction_id = row[0]

    fb_ok = doctor.post(f"/api/ai/feedback/{interaction_id}", json={"accepted": False})
    assert fb_ok.status_code == 200
    assert fb_ok.json()["accepted"] is False
