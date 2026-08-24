import re
from datetime import timedelta
from typing import Optional

SCRIBE_DISCLAIMER = (
    "AI-generated draft. Review and edit before accepting; the clinician remains responsible."
)

SUBJECTIVE_KW = {
    "pain", "fever", "cough", "since", "headache", "vomit", "nausea", "rash",
    "burning", "weak", "dizzy", "sleep", "appetite", "chest", "breath",
    "swelling", "itching", "bleeding", "diarrhea", "constipation", "sore",
}
OBJECTIVE_KW = {
    "bp", "blood pressure", "pulse", "temp", "temperature", "spo2", "saturation",
    "exam", "examination", "auscultation", "crepitations", "tenderness",
    "swelling noted", "pallor", "icterus", "murmur", "rate", "mmhg",
}
ASSESSMENT_KW = {
    "likely", "diagnosis", "dx", "suspect", "acute", "chronic", "syndrome",
    "infection", "itis", "deficiency", "angina", "diabetes", "hypertension",
}
PLAN_KW = {
    "prescribe", "start", "advise", "advice", "follow", "review", "refer",
    "test", "investigation", "rest", "fluids", "tab", "injection", "syrup",
    "discharge", "admit", "monitor", "repeat",
}

CODING_RULES = [
    ("I10", "Essential (primary) hypertension", ["hypertension", "high blood pressure", "bp high", "elevated bp"]),
    ("E11.9", "Type 2 diabetes mellitus without complications", ["diabetes", "sugar high", "hyperglycemia", "hba1c elevated"]),
    ("I20.0", "Unstable angina", ["chest pain", "angina", "crushing chest"]),
    ("R07.9", "Chest pain, unspecified", ["chest pain", "chest discomfort"]),
    ("J06.9", "Acute upper respiratory infection, unspecified", ["cold", "coryza", "sore throat", "uri"]),
    ("J02.9", "Acute pharyngitis, unspecified", ["sore throat", "pharyngitis"]),
    ("R50.9", "Fever, unspecified", ["fever", "pyrexia", "temperature high"]),
    ("A09", "Infectious gastroenteritis and colitis", ["loose motion", "diarrhea", "gastroenteritis", "food poisoning"]),
    ("E66.9", "Obesity, unspecified", ["obese", "obesity", "bmi high"]),
    ("R05.9", "Cough, unspecified", ["cough"]),
    ("R51.9", "Headache, unspecified", ["headache"]),
    ("M54.5", "Low back pain", ["back pain", "lumbago", "low back"]),
    ("E55.9", "Vitamin D deficiency, unspecified", ["vitamin d", "d deficiency"]),
    ("D64.9", "Anemia, unspecified", ["anemia", "anaemia", "hemoglobin low", "hb low"]),
]

NLQ_INTENTS = [
    ("revenue_today", [r"revenue.*(today|collected today)", r"collected.*today", r"income.*today"]),
    ("outstanding", [r"outstanding", r"dues?", r"receivable", r"unpaid"]),
    ("total_patients", [r"(how many|total).*(patients|registered)", r"patient.*(count|total)"]),
    ("appointments_today", [r"(appointments?|bookings?).*(today)?", r"how many.*(appointments|bookings)"]),
    ("completed_today", [r"completed.*(today)?", r"consultations? done"]),
]


def _tokens(text: str) -> set:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2}


def draft_soap(transcript: str) -> dict:
    subjective: list[str] = []
    objective: list[str] = []
    assessment: list[str] = []
    plan: list[str] = []

    current_speaker = "Doctor"
    for raw_line in transcript.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        low = line.lower()
        if low.startswith(("doctor", "dr.", "dr ", "physician")):
            current_speaker = "Doctor"
            line = line.split(":", 1)[1].strip() if ":" in line else line
        elif low.startswith(("patient", "pt:", "attendant")):
            current_speaker = "Patient"
            line = line.split(":", 1)[1].strip() if ":" in line else line

        if current_speaker == "Patient":
            subjective.append(f"- {line}")
            continue

        if any(k in low for k in PLAN_KW):
            plan.append(f"- {line}")
        elif any(k in low for k in OBJECTIVE_KW):
            objective.append(f"- {line}")
        elif any(k in low for k in ASSESSMENT_KW):
            assessment.append(f"- {line}")
        elif any(k in low for k in SUBJECTIVE_KW):
            subjective.append(f"- {line}")
        else:
            plan.append(f"- {line}")

    return {
        "subjective": "\n".join(subjective) or "- (no patient-reported symptoms captured)",
        "objective": "\n".join(objective) or "- (no examination findings captured)",
        "assessment": "\n".join(assessment) or "- (assessment pending clinician review)",
        "plan": "\n".join(plan) or "- (plan pending)",
    }


def suggest_codes(text: str, limit: int = 5) -> list[dict]:
    low = text.lower()
    suggestions = []
    for code, desc, keywords in CODING_RULES:
        evidence = [kw for kw in keywords if kw in low]
        if not evidence:
            continue
        confidence = min(95.0, 45.0 + 20.0 * len(evidence))
        if code == "R07.9" and "chest pain" in low and "angina" not in low:
            confidence = max(30.0, confidence - 25.0)
        suggestions.append(
            {"code": code, "description": desc, "confidence": round(confidence, 1), "evidence": evidence[:3]}
        )
    suggestions.sort(key=lambda s: -s["confidence"])
    return suggestions[:limit]


def answer_analytics_question(question: str, metrics: dict) -> tuple[Optional[str], dict]:
    low = question.lower().strip()

    def matches(patterns) -> bool:
        return any(re.search(p, low) for p in patterns)

    for metric, patterns in NLQ_INTENTS:
        if matches(patterns):
            if metric == "revenue_today":
                return (
                    f"Revenue collected today is ₹{metrics['revenue_today']:,.2f} "
                    f"(lifetime total ₹{metrics['revenue_total']:,.2f}).",
                    metrics,
                )
            if metric == "outstanding":
                return f"Outstanding receivables stand at ₹{metrics['outstanding']:,.2f}.", metrics
            if metric == "total_patients":
                return f"There are {metrics['total_patients']} active patients on record.", metrics
            if metric == "appointments_today":
                return f"{metrics['appointments_today']} appointments are booked today; {metrics['completed_today']} completed so far.", metrics
            if metric == "completed_today":
                return f"{metrics['completed_today']} of today's {metrics['appointments_today']} appointments are completed.", metrics
    return None, {}


def score_knowledge(query: str, docs: list) -> list[dict]:
    q_tokens = _tokens(query)
    if not q_tokens:
        return []
    scored = []
    for doc in docs:
        body_tokens = _tokens(doc.body)
        title_tokens = _tokens(doc.title)
        overlap = q_tokens & body_tokens
        score = len(overlap) / len(q_tokens) * 100
        if q_tokens & title_tokens:
            score += 15
        tags = _tokens(doc.tags or "")
        if q_tokens & tags:
            score += 10
        if score <= 0:
            continue
        first_para = doc.body.split("\n")[0]
        excerpt = first_para[:220]
        scored.append({"doc_id": doc.id, "title": doc.title, "score": round(min(score, 100), 1), "excerpt": excerpt})
    scored.sort(key=lambda s: -s["score"])
    return scored


def forecast_opd(daily_counts: dict, today, horizon_days: int) -> list[dict]:
    by_weekday = {}
    for day, count in daily_counts.items():
        wd = day.weekday()
        if day >= today:
            continue
        by_weekday.setdefault(wd, []).append((day, count))

    all_past = sorted(daily_counts.items())
    trend = 0.0
    if len(all_past) >= 14:
        half = len(all_past) // 2
        older = sum(c for _, c in all_past[:half]) / max(half, 1)
        newer = sum(c for _, c in all_past[half:]) / max(len(all_past) - half, 1)
        if older > 0:
            trend = max(-0.2, min(0.2, (newer - older) / older))

    out = []
    horizon = [today + timedelta(days=i) for i in range(1, horizon_days + 1)]
    for day in horizon:
        samples = sorted(by_weekday.get(day.weekday(), []))
        if not samples:
            out.append({
                "date": day.isoformat(), "weekday": day.strftime("%A"),
                "predicted_visits": None, "range_low": None, "range_high": None,
                "confidence": "low", "samples": 0,
            })
            continue
        recent = samples[-4:]
        avg = sum(c for _, c in recent) / len(recent)
        pred = max(0.0, round(avg * (1 + trend)))
        out.append({
            "date": day.isoformat(),
            "weekday": day.strftime("%A"),
            "predicted_visits": int(pred),
            "range_low": int(pred * 0.85),
            "range_high": int(pred * 1.15),
            "confidence": "medium" if len(samples) >= 4 else "low",
            "samples": len(samples),
        })
    return out


def bed_readiness(facts: dict) -> dict:
    score = 100
    blockers = []
    if facts.get("pending_urgent_orders"):
        blockers.append(f"{facts['pending_urgent_orders']} urgent/STAT lab orders pending")
        score -= 25 * min(facts["pending_urgent_orders"], 2)
    if facts.get("open_encounter"):
        blockers.append("IPD encounter still open — close before discharge")
        score -= 20
    if facts.get("overdue_stay"):
        blockers.append(f"stay exceeds expected {facts['expected_days']} days")
        score -= 10
    outstanding = facts.get("outstanding_amount") or 0
    if outstanding > 0:
        blockers.append(f"₹{outstanding:,.0f} outstanding on bills")
        score -= min(25, int(outstanding / 1000))
    if not blockers:
        blockers.append("no blockers detected — ready for discharge processing")

    return {
        "score": max(5, min(100, round(score))),
        "blockers": blockers,
        "ready": score >= 80,
    }


def denial_risk(invoice_facts: dict) -> dict:
    factors = []
    score = 0

    value = invoice_facts.get("grand_total") or 0
    if value > 25000:
        factors.append({"factor": "high_value_claim", "risk": "+25", "note": "claims above ₹25k face extra payer scrutiny"})
        score += 25
    discount_ratio = invoice_facts.get("discount_ratio") or 0
    if discount_ratio > 0.15:
        factors.append({"factor": "heavy_discount", "risk": "+30", "note": f"discount {discount_ratio:.0%} exceeds 15% without documented approval"})
        score += 30
    if not invoice_facts.get("has_phone"):
        factors.append({"factor": "missing_contact", "risk": "+20", "note": "patient phone missing — payer follow-up will fail"})
        score += 20
    if not invoice_facts.get("has_national_id") and value > 50000:
        factors.append({"factor": "missing_identity", "risk": "+15", "note": "no national ID on file for a high-value claim"})
        score += 15
    if invoice_facts.get("has_insurance_lines") and not invoice_facts.get("has_diagnosis_link"):
        factors.append({"factor": "coding_gap", "risk": "+10", "note": "insurance claim without linked encounter diagnosis"})
        score += 10

    tier = "LOW" if score < 20 else ("MEDIUM" if score < 50 else "HIGH")
    return {
        "score": min(score, 100),
        "tier": tier,
        "factors": factors,
        "recommendation": {
            "LOW": "submit as-is; standard audit sampling applies",
            "MEDIUM": "review flagged factors and attach documentation before submission",
            "HIGH": "hold submission; resolve factors or expect denial — prepare appeal pack",
        }[tier],
    }


def ar_priority(outstanding_amount: float, age_days: int) -> dict:
    weight_age = min(age_days, 120) / 30
    raw = outstanding_amount * weight_age
    if age_days < 8:
        bucket = "0-7"
    elif age_days < 31:
        bucket = "8-30"
    elif age_days < 61:
        bucket = "31-60"
    else:
        bucket = "60+"
    return {
        "priority_score": round(raw),
        "age_bucket": bucket,
        "suggested_action": {
            "0-7": "gentle reminder via WhatsApp/SMS",
            "8-30": "billing desk courtesy call",
            "31-60": "escalate to TPA/payer follow-up queue",
            "60+": "flag for AR agent negotiation or legal review",
        }[bucket],
    }
