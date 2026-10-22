from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from pydantic import BaseModel

from .config import settings

REVIEW_THRESHOLD = 0.6


def compute_status(start: date | None, end: date | None, today: date | None = None) -> str:
    """Derived at read time so badges never go stale and no migration is needed."""
    today = today or date.today()
    if start is None and end is None:
        return "Unknown"
    if start and start > today:
        return "Upcoming"
    if end is None:
        return "Active"
    if end < today:
        return "Expired"
    if (end - today).days <= settings.expiring_soon_days:
        return "Expiring Soon"
    return "Active"


class Party(BaseModel):
    name: str
    role: str | None = None


class SLAItem(BaseModel):
    metric: str
    target: str
    measurement: str | None = None
    remedy: str | None = None
    evidence: str | None = None


class ContractSummary(BaseModel):
    id: int
    title: str | None
    client_id: int | None
    client_name: str | None
    contract_type: str | None
    parties: list[Party]
    value: float | None
    value_basis: str | None
    currency: str | None
    start_date: date | None
    end_date: date | None
    status: str
    days_to_expiry: int | None
    needs_review: bool
    confidence: float
    processing_status: str
    sla_count: int
    file_name: str
    updated_at: datetime | None

    @classmethod
    def from_row(cls, c) -> "ContractSummary":
        today = date.today()
        return cls(
            id=c.id,
            title=c.title,
            client_id=c.client_id,
            client_name=c.client.name if c.client else None,
            contract_type=c.contract_type,
            parties=c.parties or [],
            value=c.value,
            value_basis=c.value_basis,
            currency=c.currency,
            start_date=c.start_date,
            end_date=c.end_date,
            status=compute_status(c.start_date, c.end_date, today),
            days_to_expiry=(c.end_date - today).days if c.end_date else None,
            needs_review=c.processing_status == "failed" or (c.confidence or 0) < REVIEW_THRESHOLD,
            confidence=c.confidence or 0.0,
            processing_status=c.processing_status,
            sla_count=len(c.slas or []),
            file_name=Path(c.file_path).name,
            updated_at=c.updated_at,
        )


class ContractDetail(ContractSummary):
    renewal_terms: str | None
    governing_law: str | None
    payment_terms: str | None
    slas: list[SLAItem]
    field_confidence: dict[str, float]
    warnings: list[str]
    agent_trace: list[dict]
    extractor_mode: str | None
    error: str | None
    file_path: str
    raw_text_preview: str | None

    @classmethod
    def from_row(cls, c) -> "ContractDetail":  # type: ignore[override]
        base = ContractSummary.from_row(c).model_dump()
        return cls(
            **base,
            renewal_terms=c.renewal_terms,
            governing_law=c.governing_law,
            payment_terms=c.payment_terms,
            slas=c.slas or [],
            field_confidence=c.field_confidence or {},
            warnings=c.warnings or [],
            agent_trace=c.agent_trace or [],
            extractor_mode=c.extractor_mode,
            error=c.error,
            file_path=c.file_path,
            raw_text_preview=c.raw_text_preview,
        )
