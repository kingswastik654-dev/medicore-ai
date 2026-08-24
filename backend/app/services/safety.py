from sqlalchemy.orm import Session

from app.models import DrugInteraction, Patient, PrescriptionItem


def _allergy_tokens(patient: Patient) -> set:
    tokens = set()
    raw = (patient.allergies or "").lower()
    for chunk in raw.replace(";", ",").split(","):
        chunk = chunk.strip()
        for word in chunk.split():
            if len(word) >= 4:
                tokens.add(word)
    return tokens


def check_prescription(db: Session, patient: Patient, items: list[PrescriptionItem]) -> list[dict]:
    warnings: list[dict] = []
    drugs = [item.drug for item in items]

    allergy_tokens = _allergy_tokens(patient)
    for drug in drugs:
        haystacks = {drug.name.lower(), (drug.generic_name or "").lower()}
        for token in allergy_tokens:
            for hay in haystacks:
                if token and token in hay:
                    warnings.append(
                        {
                            "severity": "MAJOR",
                            "type": "ALLERGY",
                            "detail": f"Allergy on record ('{token}') may match {drug.name}. Verify before dispensing.",
                        }
                    )
                    break

    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            a, b = items[i].drug_id, items[j].drug_id
            pair = (
                db.query(DrugInteraction)
                .filter(
                    ((DrugInteraction.drug_a_id == a) & (DrugInteraction.drug_b_id == b))
                    | ((DrugInteraction.drug_a_id == b) & (DrugInteraction.drug_b_id == a))
                )
                .first()
            )
            if pair:
                warnings.append(
                    {
                        "severity": pair.severity,
                        "type": "INTERACTION",
                        "detail": f"{items[i].drug.name} + {items[j].drug.name}: {pair.description or 'interaction on record'}",
                    }
                )

    severity_rank = {"MINOR": 0, "MODERATE": 1, "MAJOR": 2}
    warnings.sort(key=lambda w: -severity_rank.get(w["severity"], 0))
    return warnings
