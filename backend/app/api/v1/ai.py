from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import engine
from app.ai.gateway import active_provider, log_interaction, search_knowledge
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import AIInteraction, User
from app.schemas.ai import (
    CodingSuggestRequest,
    CodingSuggestion,
    FeedbackRequest,
    KnowledgeHit,
    KnowledgeSearchResponse,
)
from app.services.audit import from_request

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/knowledge/search", response_model=KnowledgeSearchResponse)
def knowledge_search(
    q: str = Query(min_length=2),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hits = search_knowledge(db, q)
    return KnowledgeSearchResponse(
        query=q,
        hits=[KnowledgeHit(**h) for h in hits[:5]],
    )


@router.post("/coding/suggest", response_model=list[CodingSuggestion])
def coding_suggest(
    payload: CodingSuggestRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    provider, _ = active_provider()
    suggestions = engine.suggest_codes(payload.text)
    log_interaction(
        db, user,
        feature="CODING_SUGGEST",
        input_summary=payload.text[:500],
        output_summary=str(suggestions)[:1500],
    )
    from_request(db, request, user, "AI_CALL", "ai", resource_id="coding_suggest", detail=f"provider={provider}")
    db.commit()
    return [CodingSuggestion(**s) for s in suggestions]


@router.post("/feedback/{interaction_id}")
def feedback(
    interaction_id: int,
    payload: FeedbackRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.get(AIInteraction, interaction_id)
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interaction not found")
    if entry.user_id is not None and entry.user_id != user.id and user.role not in ("SUPER_ADMIN",):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your interaction to review")
    entry.accepted = payload.accepted
    from_request(
        db, request, user, "AI_FEEDBACK", "ai",
        resource_id=interaction_id,
        detail=f"accepted={payload.accepted} feature={entry.feature}",
    )
    db.commit()
    return {"id": entry.id, "accepted": entry.accepted}
