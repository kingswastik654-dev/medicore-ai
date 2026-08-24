import json
from typing import Optional

from fastapi import Depends
from sqlalchemy.orm import Session

from app.ai import engine
from app.core.config import get_settings
from app.db.session import get_db
from app.models import AIInteraction, KnowledgeDoc, User


def active_provider() -> tuple[str, Optional[str]]:
    settings = get_settings()
    if settings.openai_api_key and settings.ai_provider == "openai":
        return "openai", settings.openai_model
    return "heuristic", None


def log_interaction(
    db: Session,
    user: Optional[User],
    *,
    feature: str,
    input_summary: str,
    output_summary: str,
) -> AIInteraction:
    provider, model = active_provider()
    entry = AIInteraction(
        user_id=getattr(user, "id", None),
        username=getattr(user, "username", None),
        feature=feature,
        provider=provider,
        model=model,
        input_summary=input_summary[:4000],
        output_summary=json.dumps(output_summary, default=str)[:8000] if not isinstance(output_summary, str) else output_summary[:8000],
    )
    db.add(entry)
    return entry


def llm_complete(prompt: str, system: str = "") -> Optional[str]:
    settings = get_settings()
    provider, model = active_provider()
    if provider != "openai" or not model:
        return None
    try:
        import httpx

        headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
        payload = {
            "model": model,
            "messages": ([{"role": "system", "content": system}] if system else [])
            + [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
        resp = httpx.post(
            f"{settings.openai_base_url}/chat/completions",
            json=payload,
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        return None


def draft_soap_with_provider(transcript: str) -> dict:
    sections = engine.draft_soap(transcript)
    provider, model = active_provider()
    completion = llm_complete(
        transcript,
        system=(
            "You are a medical scribe. Structure the conversation into SOAP format. "
            'Reply with JSON keys: subjective, objective, assessment, plan. Plain text bullets only.'
        ),
    )
    if completion:
        try:
            parsed = json.loads(completion)
            for key in ("subjective", "objective", "assessment", "plan"):
                if isinstance(parsed.get(key), str) and parsed[key].strip():
                    sections[key] = parsed[key]
            return {**sections, "provider": provider, "model": model}
        except (json.JSONDecodeError, TypeError):
            pass
    return {**sections, "provider": provider, "model": model}


def search_knowledge(db: Session, query: str):
    docs = db.query(KnowledgeDoc).filter(KnowledgeDoc.is_active == True).all()  # noqa: E712
    return engine.score_knowledge(query, docs)


def current_user_identity(user: User) -> dict:
    return {"user_id": user.id, "username": user.username}
