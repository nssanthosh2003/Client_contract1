"""Agent 5 - Validator: grounds every field against the source text and scores confidence.

Deterministic on purpose: it is the guard-rail that stops an LLM (or a sloppy regex)
from putting values in the database that the document does not actually contain.
"""
from __future__ import annotations

import re
from datetime import date

from .base import BaseAgent, Context

REQUIRED = {"parties": 0.25, "contract_type": 0.15, "start_date": 0.2, "end_date": 0.2}
OPTIONAL = ("title", "value", "renewal_terms", "governing_law", "payment_terms", "slas")
CURRENCIES = {"USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "CHF", "JPY"}


def squash(s: str) -> str:
    """Lowercase letters/digits only, so quotes, hyphens, line breaks and punctuation never cause a false miss."""
    return re.sub(r"[^0-9a-z]+", "", s.lower())


def _grounded(snippet: str, squashed_text: str) -> bool:
    s = squash(snippet)
    if len(s) < 4:
        return False
    return s in squashed_text or s[:60] in squashed_text


def _amount_in_text(amount: float, norm: str) -> bool:
    candidates = {f"{amount:,.0f}", f"{amount:,.2f}", f"{amount:.0f}", f"{amount:.2f}"}
    if amount >= 1e6:
        candidates |= {f"{amount / 1e6:g} million", f"{amount / 1e6:.1f} million"}
    if amount >= 1e3:
        candidates |= {f"{amount / 1e3:g}k", f"{amount / 1e3:g} thousand"}
    # Indian digit grouping, e.g. 12,50,000
    if amount >= 1e5 and float(amount).is_integer():
        s = f"{int(amount)}"
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head)
        candidates.add(f"{head},{tail}")
    low = norm.lower()
    return any(c.lower() in low for c in candidates)


class ValidatorAgent(BaseAgent):
    name = "validator"

    def run_heuristic(self, ctx: Context) -> dict:
        f, conf, ev, warns = ctx.fields, ctx.field_confidence, ctx.evidence, ctx.warnings
        low = ctx.norm.lower()
        sq = squash(ctx.norm)
        adjustments = 0

        # 1. Evidence grounding (catches hallucinated values in LLM mode)
        for key, snippet in list(ev.items()):
            if key not in f or key not in conf:
                continue
            if not _grounded(snippet, sq):
                conf[key] = round(conf[key] * 0.55, 2)
                adjustments += 1
                warns.append(f"'{key}': supporting quote was not found verbatim in the document - please verify.")

        # 2. Parties must actually appear in the text
        parties = []
        for p in f.get("parties", []):
            name = (p.get("name") or "").strip()
            if len(name) < 2:
                continue
            if name.lower() not in low:
                conf["parties"] = round(conf.get("parties", 0.5) * 0.7, 2)
                warns.append(f"Party '{name}' not found verbatim in the document.")
            if all(name.lower() != q["name"].lower() for q in parties):
                parties.append({"name": name, "role": (p.get("role") or None)})
        if parties:
            f["parties"] = parties
        else:
            f.pop("parties", None)
            conf.pop("parties", None)

        # 3. Value / currency sanity
        if f.get("value") is not None:
            try:
                f["value"] = float(f["value"])
            except (TypeError, ValueError):
                f.pop("value")
                conf.pop("value", None)
            else:
                if f["value"] <= 0:
                    f.pop("value")
                    conf.pop("value", None)
                elif not _amount_in_text(f["value"], ctx.norm):
                    conf["value"] = round(conf.get("value", 0.5) * 0.5, 2)
                    warns.append("Contract value does not appear literally in the document text - please verify.")
        if f.get("currency"):
            cur = str(f["currency"]).upper().strip()
            f["currency"] = cur if cur in CURRENCIES else None
        if f.get("value") is not None and not f.get("currency"):
            warns.append("Contract value found but currency could not be determined.")
            conf["value"] = round(conf.get("value", 0.5) * 0.8, 2)

        # 4. Date sanity
        s, e = f.get("start_date"), f.get("end_date")
        for label, d in (("start_date", s), ("end_date", e)):
            if isinstance(d, date) and not (1990 <= d.year <= 2100):
                f.pop(label)
                conf.pop(label, None)
                warns.append(f"{label} year {d.year} is implausible and was discarded.")
        s, e = f.get("start_date"), f.get("end_date")
        if s and e and e < s:
            warns.append("End date is earlier than start date - dates may be swapped or misread.")
            conf["start_date"] = round(conf.get("start_date", 0.5) * 0.5, 2)
            conf["end_date"] = round(conf.get("end_date", 0.5) * 0.5, 2)
        if s and e and (e - s).days > 365 * 30:
            warns.append("Contract term exceeds 30 years - please verify the dates.")
            conf["end_date"] = round(conf.get("end_date", 0.5) * 0.6, 2)

        # 5. SLA grounding
        grounded_slas = []
        for sla in ctx.slas:
            q = sla.get("evidence")
            if q and not _grounded(q, sq):
                warns.append(f"SLA '{sla.get('metric')}' could not be matched to the source text and was dropped.")
                continue
            grounded_slas.append(sla)
        ctx.slas = grounded_slas
        if not grounded_slas:
            conf.pop("slas", None)

        # 6. Overall confidence: required fields dominate; missing required = 0
        conf["contract_type"] = conf.get("contract_type", 0.0) if ctx.contract_type not in (None, "Other") else min(conf.get("contract_type", 0.3), 0.3)
        req = sum(w * conf.get(k, 0.0) for k, w in REQUIRED.items())
        opt_present = [conf[k] for k in OPTIONAL if k in conf]
        opt = sum(opt_present) / len(opt_present) if opt_present else 0.5
        raw = 0.85 * req + 0.15 * opt
        # Per-field scores top out around 0.85-0.9 (nothing is ever certain), so rescale: a clean,
        # fully-grounded extraction should read as ~0.8-0.95 overall, not ~0.68.
        overall = min(0.99, raw / 0.85)

        missing = [k for k in REQUIRED if k not in f and not (k == "contract_type" and ctx.contract_type not in (None, "Other"))]
        if missing:
            overall = min(overall, 0.55)  # a missing core field always lands in the review queue
        ctx.confidence = round(overall, 2)
        if missing:
            warns.append("Missing: " + ", ".join(m.replace("_", " ") for m in missing) + ".")
        # de-duplicate warnings, keep order
        ctx.warnings = list(dict.fromkeys(warns))
        return {"note": f"confidence {ctx.confidence:.0%}, {len(ctx.warnings)} warning(s), {adjustments} grounding miss(es)"}
