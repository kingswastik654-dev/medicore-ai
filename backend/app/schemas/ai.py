from typing import Optional

from pydantic import BaseModel, Field

from app.ai.engine import SCRIBE_DISCLAIMER


class KnowledgeHit(BaseModel):
    doc_id: int
    title: str
    score: float
    excerpt: str


class KnowledgeSearchResponse(BaseModel):
    query: str
    hits: list[KnowledgeHit]


class ScribeDraftRequest(BaseModel):
    transcript: str = Field(min_length=10, max_length=10000)


class ScribeDraft(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str
    provider: str
    model: Optional[str] = None
    disclaimer: str = SCRIBE_DISCLAIMER


class CodingSuggestion(BaseModel):
    code: str
    description: str
    confidence: float
    evidence: list[str]


class CodingSuggestRequest(BaseModel):
    text: str = Field(min_length=5)


class AnalyticsAnswer(BaseModel):
    question: str
    answer: str
    metric: Optional[str] = None
    data: dict = {}
    supported: bool = True
    provider: str


class FeedbackRequest(BaseModel):
    accepted: bool
