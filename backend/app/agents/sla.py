"""Agent 4 - SLA specialist: pulls measurable service levels out of the contract."""
from __future__ import annotations

import re

from .base import SYSTEM_GUARD, BaseAgent, Context, LLMClient, clip_for_llm

UNIT = r"(?:minutes?|mins?|hours?|business hours?|business days?|working days?|days?)"
TIME_RE = re.compile(rf"(\d+(?:\.\d+)?)\s*[- ]?\s*({UNIT})", re.I)
SEV_RE = re.compile(r"\b(?:severity|priority|level|sev)\s?-?\s?([0-4])\b|\bP([0-4])\b|\b(critical|urgent|high|medium|low)\b", re.I)
PCT_RE = r"(\d{2,3}(?:\.\d+)?)\s?%"

SCHEMA = {
    "type": "object",
    "properties": {
        "slas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "metric": {"type": "string", "description": "e.g. Uptime, Response time (Severity 1), Resolution time (High)"},
                    "target": {"type": "string", "description": "e.g. 99.9%, 1 hour"},
                    "measurement": {"type": ["string", "null"], "description": "Window or method, e.g. monthly"},
                    "remedy": {"type": ["string", "null"], "description": "Credit/penalty for missing it, if stated"},
                    "evidence": {"type": "string", "description": "Short VERBATIM quote supporting this SLA."},
                },
                "required": ["metric", "target", "evidence"],
            },
        }
    },
    "required": ["slas"],
}


def _sentences(norm: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.;])\s+(?=[A-Z0-9(\"“])", norm) if s.strip()]


def _severity(sentence: str) -> str | None:
    m = SEV_RE.search(sentence)
    if not m:
        return None
    if m.group(1):
        return f"Severity {m.group(1)}"
    if m.group(2):
        return f"P{m.group(2)}"
    return m.group(3).title()


class SLAAgent(BaseAgent):
    name = "sla"

    def run_heuristic(self, ctx: Context) -> dict:
        found: list[dict] = []
        seen: set[tuple[str, str]] = set()

        def add(metric: str, target: str, sentence: str, remedy: str | None = None) -> None:
            key = (metric.lower(), target.lower())
            if key in seen or len(found) >= 15:
                return
            seen.add(key)
            found.append({"metric": metric, "target": target, "measurement": None, "remedy": remedy, "evidence": sentence[:240]})

        for s in _sentences(ctx.norm):
            low = s.lower()
            credit = re.search(r"service credits?[^.]{0,80}?" + PCT_RE, s, re.I)
            remedy = f"Service credit {credit.group(1)}%" if credit else None

            m = re.search(rf"(?:uptime|availability)[^.;]{{0,90}}?{PCT_RE}|{PCT_RE}[^.;]{{0,60}}?(?:uptime|availability)", s, re.I)
            if m:
                pct = next(g for g in m.groups() if g)
                add("Uptime / Availability", f"{pct}%", s, remedy)
                continue

            # A single sentence often carries several commitments, so each is matched independently.
            sev = _severity(s)
            suffix = f" ({sev})" if sev else ""
            for label, pat, with_sev in (
                ("Response time", r"\brespon(?:d|se|ding)\b", True),
                ("Resolution time", r"\b(?:resol(?:ve|ved|ution|ving)|fix(?:ed)?)\b", True),
                ("Recovery point objective (RPO)", r"\brpo\b|recovery point objective", False),
                ("Recovery time objective (RTO)", r"\brto\b|recovery time objective", False),
            ):
                km = re.search(pat, s, re.I)
                if not km:
                    continue
                tm = TIME_RE.search(s[km.end(): km.end() + 90])
                if tm:
                    add(label + (suffix if with_sev else ""), f"{tm.group(1)} {tm.group(2).lower()}", s, remedy)

        ctx.slas = found
        if found:
            ctx.field_confidence["slas"] = 0.75
        return {"note": f"{len(found)} SLA(s) via rules"}

    def run_llm(self, ctx: Context, llm: LLMClient) -> dict:
        out = llm.structured(
            system=SYSTEM_GUARD
            + " List every measurable service level (uptime, response/resolution times, RPO/RTO, support hours, "
            "credits) that the contract commits to. Return an empty list if there are none.",
            user=f"<document>\n{clip_for_llm(ctx.text)}\n</document>",
            tool_name="record_slas",
            description="Record the service-level commitments found in the contract.",
            schema=SCHEMA,
        )
        ctx.slas = [s for s in (out.get("slas") or []) if s.get("metric") and s.get("target")][:25]
        if ctx.slas:
            ctx.field_confidence["slas"] = 0.85
        return {"note": f"{len(ctx.slas)} SLA(s) via {llm.model}"}
