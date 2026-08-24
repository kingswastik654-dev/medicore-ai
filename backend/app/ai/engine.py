import re
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
