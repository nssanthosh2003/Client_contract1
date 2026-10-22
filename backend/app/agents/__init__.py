"""Orchestrator: runs the agent chain Reader -> Classifier -> Extractor -> SLA -> Validator."""
from __future__ import annotations

import time
from pathlib import Path

from ..config import settings
from .base import Context, LLMClient
from .classifier import ClassifierAgent
from .extractor import ExtractorAgent
from .reader import ReaderAgent
from .sla import SLAAgent
from .validator import ValidatorAgent

PIPELINE = [ReaderAgent(), ClassifierAgent(), ExtractorAgent(), SLAAgent(), ValidatorAgent()]


def build_llm() -> tuple[LLMClient | None, str | None]:
    """Returns (client, warning). Never raises: a broken LLM setup degrades to rules."""
    if not settings.use_llm:
        return None, None
    try:
        return LLMClient(), None
    except Exception as exc:  # noqa: BLE001
        return None, f"LLM unavailable ({type(exc).__name__}: {exc}); using rule-based extraction."


def run_pipeline(path: Path) -> Context:
    ctx = Context(path=path)
    llm, warning = build_llm()
    if warning:
        ctx.warnings.append(warning)
    ctx.mode = "llm" if llm else "heuristic"

    for agent in PIPELINE:
        t0 = time.perf_counter()
        status, info = "ok", {}
        try:
            info = agent.run(ctx, llm)
        except Exception as exc:  # noqa: BLE001
            if isinstance(agent, ReaderAgent):
                raise  # nothing to work with - let ingestion mark the file as failed
            status, info = "error", {"mode": "error", "note": f"{type(exc).__name__}: {exc}"}
            ctx.warnings.append(f"{agent.name} agent failed: {exc}")
        ctx.trace.append(
            {
                "agent": agent.name,
                "status": status,
                "mode": info.get("mode"),
                "ms": round((time.perf_counter() - t0) * 1000),
                "note": info.get("note", ""),
            }
        )
    return ctx
