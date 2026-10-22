"""Agent 2 - Classifier: decides what kind of contract this is."""
from __future__ import annotations

import re

from .base import SYSTEM_GUARD, BaseAgent, Context, LLMClient

CONTRACT_TYPES = [
    "Master Services Agreement",
    "Statement of Work",
    "Non-Disclosure Agreement",
    "Software License",
    "SaaS Subscription",
    "Service Level Agreement",
    "Employment Agreement",
    "Lease Agreement",
    "Supply / Purchase Agreement",
    "Consulting Agreement",
    "Partnership Agreement",
    "Data Processing Agreement",
    "Other",
]

# keyword -> weight. Hits in the title area (first ~600 chars) count triple.
KEYWORDS: dict[str, dict[str, float]] = {
    "Master Services Agreement": {"master services agreement": 5, "master service agreement": 5, "msa": 2, "services agreement": 3, "statements of work": 1.5},
    "Statement of Work": {"statement of work": 5, "sow": 2, "deliverables": 1.5, "milestones": 1.5, "acceptance criteria": 1.5},
    "Non-Disclosure Agreement": {"non-disclosure": 5, "nondisclosure": 5, "confidentiality agreement": 5, "confidential information": 2, "disclosing party": 2.5, "receiving party": 2.5},
    "Software License": {"software license": 5, "license agreement": 4, "licensor": 2, "licensee": 2, "perpetual license": 2},
    "SaaS Subscription": {"subscription agreement": 5, "saas": 3, "subscription fee": 2, "subscription term": 2, "subscribers": 1, "software as a service": 4},
    "Service Level Agreement": {"service level agreement": 5, "service levels": 2, "service credit": 2, "uptime": 1.5},
    "Employment Agreement": {"employment agreement": 5, "employee": 1.5, "employer": 1.5, "salary": 2, "probation": 2},
    "Lease Agreement": {"lease agreement": 5, "landlord": 3, "tenant": 3, "premises": 2, "security deposit": 2, "rent": 1},
    "Supply / Purchase Agreement": {"supply agreement": 5, "purchase agreement": 5, "purchase order": 2, "goods": 1.5, "delivery": 1, "buyer": 1.5, "seller": 1.5},
    "Consulting Agreement": {"consulting agreement": 5, "consultant": 2.5, "independent contractor": 2},
    "Partnership Agreement": {"partnership agreement": 5, "joint venture": 4, "profit sharing": 2, "partners": 1},
    "Data Processing Agreement": {"data processing agreement": 5, "data processor": 3, "data controller": 3, "gdpr": 2, "sub-processor": 2},
}

SCHEMA = {
    "type": "object",
    "properties": {
        "contract_type": {"type": "string", "enum": CONTRACT_TYPES},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "reason": {"type": "string", "description": "One short sentence."},
    },
    "required": ["contract_type", "confidence"],
}


class ClassifierAgent(BaseAgent):
    name = "classifier"

    def run_heuristic(self, ctx: Context) -> dict:
        low = ctx.norm.lower()
        head = low[:600]
        scores: dict[str, float] = {}
        for ctype, kws in KEYWORDS.items():
            s = 0.0
            for kw, w in kws.items():
                pat = r"\b" + re.escape(kw) + r"\b"
                s += min(len(re.findall(pat, low)), 4) * w
                if re.search(pat, head):
                    s += w * 3
            scores[ctype] = s
        best, top = max(scores.items(), key=lambda kv: kv[1])
        total = sum(scores.values())
        if top < 4 or total == 0:
            ctx.contract_type, conf = "Other", 0.3
        else:
            ctx.contract_type = best
            conf = min(0.95, 0.45 + 0.5 * (top / total) + min(top, 20) / 80)
        ctx.field_confidence["contract_type"] = round(conf, 2)
        return {"note": f"{ctx.contract_type} ({conf:.0%})"}

    def run_llm(self, ctx: Context, llm: LLMClient) -> dict:
        out = llm.structured(
            system=SYSTEM_GUARD + " Classify the contract into exactly one of the allowed types.",
            user=f"<document>\n{ctx.text[:8000]}\n</document>",
            tool_name="classify_contract",
            description="Report the contract type.",
            schema=SCHEMA,
        )
        ctype = out.get("contract_type")
        ctx.contract_type = ctype if ctype in CONTRACT_TYPES else "Other"
        ctx.field_confidence["contract_type"] = round(float(out.get("confidence", 0.7)), 2)
        return {"note": f"{ctx.contract_type} - {out.get('reason', '')}".strip(" -")}
