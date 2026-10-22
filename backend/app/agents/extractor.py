"""Agent 3 - Extractor: parties, title, value, dates, renewal, law, payment terms.

Heuristic mode uses layered regexes with keyword proximity; LLM mode asks Claude for
structured output *plus a verbatim evidence quote per field*, which the Validator
then checks against the source text to catch hallucinations.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from dateutil import parser as dateparser
from dateutil.relativedelta import relativedelta

from .base import SYSTEM_GUARD, BaseAgent, Context, LLMClient, clip_for_llm

MONTHS = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
DATE_RE = re.compile(
    rf"(?:{MONTHS}\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}"
    rf"|\d{{1,2}}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?{MONTHS}\.?,?\s+\d{{4}}"
    rf"|\d{{4}}-\d{{2}}-\d{{2}}"
    rf"|\d{{1,2}}[/.-]\d{{1,2}}[/.-]\d{{4}})",
    re.I,
)

START_KEYS = [
    (r"effective date(?:\W{0,4}(?:is|means|shall be))?", 0.9),
    (r"effective (?:as of|on|from)", 0.85),
    (r"commenc(?:es|ing|ement)(?: date)?(?: on| of)?", 0.85),
    (r"start date", 0.9),
    (r"begin(?:s|ning)? on", 0.8),
    (r"(?:made|entered into|dated)(?: and entered into)?(?: as of| on)?", 0.7),
]
END_KEYS = [
    (r"expir(?:ation|y) date", 0.9),
    (r"end date", 0.9),
    (r"expires? on", 0.9),
    (r"terminat(?:es|ion date)(?: on)?", 0.8),
    (r"(?:shall )?end(?:s|ing)? on", 0.85),
    (r"continue(?:s)?(?: in (?:full )?(?:force|effect))? until", 0.8),
    (r"until", 0.65),
    (r"through", 0.6),
]

WORD_NUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "eighteen": 18, "twenty-four": 24,
    "thirty-six": 36, "forty-eight": 48, "sixty": 60,
}

CURRENCY = {"$": "USD", "us$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "rs": "INR", "rs.": "INR"}
MONEY_RE = re.compile(
    r"(?<![A-Za-z])(?P<pre>USD|EUR|GBP|INR|CAD|AUD|SGD|CHF|JPY|US\$|\$|€|£|₹|Rs\.?)\s?(?P<num>\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s?(?P<mult>million|billion|thousand|lakh|crore|mn|k)\b)?"
    r"|(?<![\w,.])(?P<num2>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(?P<mult2>million|thousand|lakh|crore)?\s?(?P<post>USD|EUR|GBP|INR|CAD|AUD|SGD|CHF|JPY)\b",
    re.I,
)
MULT = {"million": 1e6, "mn": 1e6, "billion": 1e9, "thousand": 1e3, "k": 1e3, "lakh": 1e5, "crore": 1e7}
VALUE_KEYS = [
    ("total contract value", 1.0), ("total contract price", 0.97), ("contract value", 0.95), ("total value", 0.95),
    ("total consideration", 0.9), ("aggregate", 0.85), ("total fees", 0.9), ("purchase price", 0.85),
    ("annual fee", 0.75), ("annual subscription", 0.75), ("subscription fee", 0.7), ("annual rent", 0.7),
    ("monthly rent", 0.65), ("base salary", 0.65), ("fees", 0.5), ("price", 0.45), ("rent", 0.5), ("compensation", 0.5),
]
TOTAL_KEYS = ("total", "contract value", "aggregate", "purchase price")

LABELS = r"(?:Client|Customer|Provider|Service Provider|Supplier|Vendor|Licensor|Licensee|Company|Consultant|Landlord|Tenant|Disclosing Party|Receiving Party|Buyer|Seller|Employer|Employee)"
PARTY_RE = re.compile(
    r"between\s+(?P<a>[^()]{3,200}?)\s*\(\s*(?:the\s+)?[\"“”']?\s*(?P<ra>[A-Za-z ]{2,30}?)\s*[\"“”']?\s*\)\s*,?\s*(?:and|&)\s+(?P<b>[^()]{3,200}?)\s*\(\s*(?:the\s+)?[\"“”']?\s*(?P<rb>[A-Za-z ]{2,30}?)\s*[\"“”']?\s*\)",
    re.I,
)

SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": ["string", "null"]},
        "parties": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "role": {"type": ["string", "null"]}},
                "required": ["name"],
            },
        },
        "value": {"type": ["number", "null"], "description": "Total monetary value as a plain number; null if not stated."},
        "value_basis": {"type": ["string", "null"], "enum": ["total", "annual", "monthly", "other", None]},
        "currency": {"type": ["string", "null"], "description": "ISO 4217 code, e.g. USD."},
        "start_date": {"type": ["string", "null"], "description": "YYYY-MM-DD effective/start date."},
        "end_date": {"type": ["string", "null"], "description": "YYYY-MM-DD expiry/end date; null if open-ended or only a term length is given."},
        "term_months": {"type": ["integer", "null"], "description": "Initial term length in months if stated."},
        "renewal_terms": {"type": ["string", "null"], "description": "One or two sentences, paraphrased."},
        "governing_law": {"type": ["string", "null"]},
        "payment_terms": {"type": ["string", "null"]},
        "evidence": {
            "type": "object",
            "description": "For EVERY non-null field above, a short VERBATIM quote (<=200 chars) copied from the document that supports it.",
            "additionalProperties": {"type": "string"},
        },
    },
    "required": ["parties", "evidence"],
}


# ---------------------------------------------------------------- helpers
def parse_date(s: str | None) -> date | None:
    if not s:
        return None
    s = re.sub(r"(\d)(?:st|nd|rd|th)\b", r"\1", s, flags=re.I)
    s = re.sub(r"\bday\s+of\s+", "", s, flags=re.I)
    try:
        return dateparser.parse(s, dayfirst=False).date()
    except Exception:  # noqa: BLE001
        return None


def sentence_around(norm: str, start: int, end: int, cap: int = 320, headings: set[str] | None = None) -> str:
    s = max(norm.rfind(". ", 0, start) + 2, norm.rfind("; ", 0, start) + 2, 0)
    e = norm.find(". ", end)
    e = len(norm) if e == -1 else e + 1
    sentence = norm[s:e].strip()
    # Section headings are separate lines in the PDF but get glued to the next sentence once
    # whitespace is collapsed ("Payment All undisputed invoices..."): peel them off.
    for h in sorted(headings or (), key=len, reverse=True):
        if sentence.startswith(h + " "):
            sentence = sentence[len(h) + 1:]
            break
    return sentence[:cap]


def heading_lines(raw_text: str) -> set[str]:
    out = set()
    for line in raw_text.splitlines():
        line = line.strip()
        if 2 < len(line) < 45 and not re.search(r"[.;:,]$", line):
            out.add(re.sub(r"^\d+(?:\.\d+)*\.?\s*", "", line))
    return out


def parse_money(m: re.Match) -> tuple[float | None, str | None]:
    gd = m.groupdict()
    num = gd.get("num") or gd.get("num2")
    if not num:
        return None, None
    amount = float(num.replace(",", ""))
    mult = (gd.get("mult") or gd.get("mult2") or "").lower()
    amount *= MULT.get(mult, 1)
    cur_raw = (gd.get("pre") or gd.get("post") or "").lower()
    cur = CURRENCY.get(cur_raw, cur_raw.upper() or None)
    return amount, cur


def clean_party(s: str) -> str:
    s = s.strip(" ,;:")
    s = re.sub(r"^(?:by and )?(?:between\s+)?", "", s, flags=re.I)
    m = re.search(
        r",\s*(?:a|an)\s+[^,]*?\b(?:corporation|company|limited|partnership|entity|organi[sz]ation|LLC|LLP|Inc|incorporated|registered|duly)\b",
        s, re.I,
    )
    if m:
        s = s[: m.start()]
    s = re.sub(r"\s*,?\s*(?:having|with)\s+(?:its|their)\s+.*$", "", s, flags=re.I)
    s = re.sub(r"\s*,?\s*(?:a|an)\s+(?:[A-Z][a-z]+\s+)*(?:corporation|company|LLC|limited liability company)\b.*$", "", s)
    return s.strip(" ,;:")


def _date_after_keys(norm: str, keys: list[tuple[str, float]], window: int = 90) -> tuple[date, float, str] | None:
    best: tuple[int, date, float, str] | None = None
    for pat, conf in keys:
        for m in re.finditer(pat, norm, re.I):
            seg = norm[m.end(): m.end() + window]
            d = DATE_RE.search(seg)
            if not d:
                continue
            parsed = parse_date(d.group(0))
            if parsed and (best is None or m.start() < best[0]):
                best = (m.start(), parsed, conf, norm[m.start(): m.end() + d.end()])
    return (best[1], best[2], best[3]) if best else None


def _term_months(norm: str) -> tuple[int, str] | None:
    pats = [
        r"(?:initial\s+)?(?:term|period)\s+of\s+(?P<w>[A-Za-z\-]+)?\s*(?:\((?P<n>\d+)\)\s*)?(?P<unit>years?|months?)",
        r"(?P<n>\d+)\)?[- ]?(?P<unit>year|month)s?\s+(?:initial\s+)?term",
        r"(?P<w>[A-Za-z\-]+)\s*\((?P<n>\d+)\)[- ]?(?P<unit>year|month)s?\s+(?:initial\s+)?term",
    ]
    for p in pats:
        m = re.search(p, norm, re.I)
        if not m:
            continue
        gd = m.groupdict()
        n = gd.get("n")
        if not n and gd.get("w"):
            w = gd["w"].lower()
            n = WORD_NUM.get(w) or (w if w.isdigit() else None)
        if not n:
            continue
        n = int(n)
        months = n * 12 if gd["unit"].lower().startswith("year") else n
        return months, norm[m.start(): m.end()]
    return None


# ---------------------------------------------------------------- agent
class ExtractorAgent(BaseAgent):
    name = "extractor"

    # ------------------------------------------------ heuristic
    def run_heuristic(self, ctx: Context) -> dict:
        norm, f, conf, ev = ctx.norm, ctx.fields, ctx.field_confidence, ctx.evidence
        heads = heading_lines(ctx.text)

        # title
        for line in (ln.strip() for ln in ctx.pages[0].splitlines() if ln.strip()):
            if len(line) < 120 and re.search(r"agreement|contract|statement of work|\bSOW\b|lease|addendum|amendment", line, re.I):
                f["title"], conf["title"], ev["title"] = line, 0.8, line
                break
        else:
            first = next((ln.strip() for ln in ctx.pages[0].splitlines() if ln.strip()), None)
            if first:
                f["title"], conf["title"], ev["title"] = first[:200], 0.4, first[:200]

        # parties
        parties: list[dict] = []
        pm = PARTY_RE.search(norm[:4000])
        if pm:
            for name, role in ((pm["a"], pm["ra"]), (pm["b"], pm["rb"])):
                parties.append({"name": clean_party(name), "role": role.strip().title()})
            conf["parties"], ev["parties"] = 0.85, pm.group(0)[:240]
        else:
            for m in re.finditer(rf"^\s*({LABELS})\s*[:\-]\s*(.{{3,120}})$", "\n".join(ctx.pages[:3]), re.M | re.I):
                parties.append({"name": clean_party(m.group(2)), "role": m.group(1).title()})
            if parties:
                conf["parties"], ev["parties"] = 0.65, "; ".join(f"{p['role']}: {p['name']}" for p in parties)
        if parties:
            f["parties"] = parties

        # value
        self._value(ctx)

        # dates
        rev = re.search(rf"({DATE_RE.pattern})\s*\(\s*(?:the\s+)?[\"“”']?\s*Effective Date", norm, re.I)
        start = None
        if rev:
            d = parse_date(rev.group(1))
            if d:
                start, conf["start_date"], ev["start_date"] = d, 0.9, rev.group(0)
        if start is None:
            hit = _date_after_keys(norm, START_KEYS)
            if hit:
                start, conf["start_date"], ev["start_date"] = hit[0], hit[1], hit[2]
        if start:
            f["start_date"] = start

        end_hit = _date_after_keys(norm, END_KEYS)
        if end_hit and (start is None or end_hit[0] != start):
            f["end_date"], conf["end_date"], ev["end_date"] = end_hit[0], end_hit[1], end_hit[2]

        term = _term_months(norm)
        if term:
            f["term_months"] = term[0]
            ev["term_months"] = term[1]
            if "end_date" not in f and start:
                f["end_date"] = start + relativedelta(months=term[0]) - timedelta(days=1)
                conf["end_date"] = 0.6
                ev["end_date"] = term[1]
                ctx.warnings.append("End date was derived from the stated term length, not printed in the document.")

        # renewal
        m = re.search(r"auto(?:matic(?:ally)?)?[- ]?renew|renew(?:s|ed|al)\b", norm, re.I)
        if m:
            f["renewal_terms"] = ev["renewal_terms"] = sentence_around(norm, m.start(), m.end(), headings=heads)
            conf["renewal_terms"] = 0.75

        # governing law
        m = re.search(
            r"governed by(?:,)?(?: and construed (?:in accordance )?(?:with|under))?(?: the)? laws? of (?:the )?"
            r"((?:State|Commonwealth|Republic|Province|Kingdom)?\s*(?:of\s+)?[A-Z][A-Za-z]+(?:\s(?:and\s)?[A-Z][A-Za-z]+){0,3})",
            norm,
        )
        if m:
            f["governing_law"] = m.group(1).strip()
            ev["governing_law"], conf["governing_law"] = m.group(0), 0.8

        # payment terms
        m = re.search(r"\bnet\s?\d{1,3}\b|(?:payable|due|pay[a-z]*)\b[^.]{0,60}?within\s+[A-Za-z0-9\- ()]{1,25}?days", norm, re.I)
        if m:
            f["payment_terms"] = ev["payment_terms"] = sentence_around(norm, m.start(), m.end(), 260, headings=heads)
            conf["payment_terms"] = 0.75

        return {"note": f"{len([k for k in f if f[k] not in (None, [], '')])} fields via rules"}

    def _value(self, ctx: Context) -> None:
        norm, low = ctx.norm, ctx.norm.lower()
        best: tuple[float, float, str | None, str, str] | None = None  # score, amount, cur, basis, snippet
        biggest: tuple[float, str | None, str] | None = None
        for m in MONEY_RE.finditer(norm):
            amount, cur = parse_money(m)
            if not amount or amount <= 0:
                continue
            win = low[max(0, m.start() - 110): m.end() + 30]
            snippet = norm[max(0, m.start() - 80): m.end() + 20]
            if biggest is None or amount > biggest[0]:
                biggest = (amount, cur, snippet)
            score, key_hit = 0.0, ""
            for key, w in VALUE_KEYS:
                if key in win and w > score:
                    score, key_hit = w, key
            if score and (best is None or score > best[0]):
                basis = "total"
                if not any(k in key_hit for k in TOTAL_KEYS):
                    if re.search(r"per year|annual|yearly|per annum", win):
                        basis = "annual"
                    elif re.search(r"per month|monthly", win):
                        basis = "monthly"
                best = (score, amount, cur, basis, snippet)
        f, conf, ev = ctx.fields, ctx.field_confidence, ctx.evidence
        if best:
            f["value"], f["currency"], f["value_basis"] = best[1], best[2], best[3]
            conf["value"], ev["value"] = round(0.55 + 0.4 * best[0], 2), best[4]
        elif biggest:
            f["value"], f["currency"], f["value_basis"] = biggest[0], biggest[1], "other"
            conf["value"], ev["value"] = 0.35, biggest[2]
            ctx.warnings.append("Contract value is the largest amount found; no 'total value' wording was detected.")

    # ------------------------------------------------ LLM
    def run_llm(self, ctx: Context, llm: LLMClient) -> dict:
        out = llm.structured(
            system=SYSTEM_GUARD
            + " Extract the requested contract fields. Dates must be ISO (YYYY-MM-DD). "
            "Provide a verbatim evidence quote for every non-null field.",
            user=f"<document>\n{clip_for_llm(ctx.text)}\n</document>",
            tool_name="record_contract_fields",
            description="Record the extracted contract fields with evidence quotes.",
            schema=SCHEMA,
        )
        f, conf, ev = ctx.fields, ctx.field_confidence, ctx.evidence
        evidence = out.get("evidence") or {}
        for key in ("title", "value", "value_basis", "currency", "renewal_terms", "governing_law", "payment_terms", "term_months"):
            if out.get(key) not in (None, ""):
                f[key] = out[key]
        parties = [p for p in (out.get("parties") or []) if p.get("name")]
        if parties:
            f["parties"] = parties
        for key in ("start_date", "end_date"):
            d = parse_date(out.get(key)) if out.get(key) else None
            if d:
                f[key] = d
        for key in list(f):
            conf[key] = 0.85  # provisional; the Validator grounds each against the source text
            if evidence.get(key):
                ev[key] = evidence[key]
        if "end_date" not in f and f.get("term_months") and f.get("start_date"):
            f["end_date"] = f["start_date"] + relativedelta(months=int(f["term_months"])) - timedelta(days=1)
            conf["end_date"] = 0.6
            ctx.warnings.append("End date was derived from the stated term length, not printed in the document.")
        return {"note": f"{len(f)} fields via {llm.model}"}
