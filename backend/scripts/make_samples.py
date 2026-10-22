#!/usr/bin/env python
"""Generate realistic sample contracts into contracts/inbox/<Client>/ for UI development.

Dates are relative to today so every status badge (Active, Expiring Soon, Expired,
Upcoming, Needs Review) is represented. Includes a scanned (image-only) PDF, a blank
page and some non-contract noise to exercise OCR and the review workflow.

    python scripts/make_samples.py            # writes into contracts/inbox
    python scripts/make_samples.py --clean    # wipe the inbox + db first
"""
from __future__ import annotations

import argparse
import io
import shutil
import sys
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from xml.sax.saxutils import escape

import pymupdf
from dateutil.relativedelta import relativedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Spacer, Paragraph

ROOT = Path(__file__).resolve().parents[2]
TODAY = date.today()
WORDS = {6: "six", 10: "ten", 12: "twelve", 24: "twenty-four", 36: "thirty-six", 60: "sixty", 5: "five"}


def d(days: int) -> date:
    return TODAY + timedelta(days=days)


def fmt(dt: date, style: str) -> str:
    if style == "iso":
        return dt.isoformat()
    if style == "dmy":
        return f"{dt.day} {dt:%B %Y}"
    if style == "ordinal":
        n = dt.day
        suf = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
        return f"{n}{suf} day of {dt:%B}, {dt.year}"
    return f"{dt:%B} {dt.day}, {dt.year}"


@dataclass
class Spec:
    filename: str
    ctype: str
    title: str
    a: tuple[str, str]
    b: tuple[str, str]
    start: date
    months: int | None = 12
    end_style: str = "explicit"  # explicit | term | none
    money: str | None = None
    basis: str = "total"  # total | annual | monthly
    law: str = "State of New York"
    date_style: str = "long"
    renewal: str | None = None
    slas: bool = False
    net: int | None = 30
    folder: str | None = None
    scanned: bool = False


RENEW = "This Agreement shall automatically renew for successive one (1) year periods unless either party gives ninety (90) days' written notice of non-renewal."

SPECS = [
    Spec("Acme_MSA_2025.pdf", "msa", "Master Services Agreement", ("Acme Corporation", "Client"), ("Northwind Digital Services Ltd.", "Provider"),
         d(-400), 36, money="USD 1,800,000", renewal=RENEW, slas=True, folder="Acme Corporation"),
    Spec("Acme_SOW_03.pdf", "sow", "Statement of Work No. 3", ("Acme Corporation", "Client"), ("Northwind Digital Services Ltd.", "Provider"),
         d(-120), 5, money="USD 240,000", net=45, date_style="dmy", folder="Acme Corporation"),
    Spec("Acme_NDA_2023.pdf", "nda", "Mutual Non-Disclosure Agreement", ("Acme Corporation", "Disclosing Party"), ("Pied Piper Inc.", "Receiving Party"),
         d(-900), 24, end_style="term", law="State of Delaware", net=None, folder="Acme Corporation"),
    Spec("Globex_SaaS_Subscription.pdf", "saas", "SaaS Subscription Agreement", ("Globex Industries GmbH", "Customer"), ("CloudNimbus Software Inc.", "Provider"),
         d(-200), 12, money="EUR 96,000", basis="annual", law="Germany", renewal=RENEW, slas=True, folder="Globex Industries"),
    Spec("Globex_SLA_Premium.pdf", "sla", "Service Level Agreement", ("Globex Industries GmbH", "Customer"), ("CloudNimbus Software Inc.", "Provider"),
         d(-60), 24, law="Germany", slas=True, net=None, folder="Globex Industries"),
    Spec("Globex_Warehouse_Lease.pdf", "lease", "Commercial Lease Agreement", ("Harbour Estates plc", "Landlord"), ("Globex Industries GmbH", "Tenant"),
         d(30), 60, money="GBP 12,500", basis="monthly", law="England and Wales", net=None, folder="Globex Industries"),
    Spec("Initech_License_Perpetual.pdf", "license", "Software License Agreement", ("Initech LLC", "Licensee"), ("Veridian Labs Inc.", "Licensor"),
         d(-30), None, end_style="none", money="USD 75,000", law="State of Texas", folder="Initech"),
    Spec("Initech_Consulting_2026.pdf", "consulting", "Consulting Agreement", ("Initech LLC", "Client"), ("Rao & Partners Advisory", "Consultant"),
         d(-230), 10, money="Rs. 45,00,000", law="India", date_style="ordinal", folder="Initech"),
    Spec("Umbrella_Supply_Agreement.pdf", "supply", "Supply Agreement", ("Umbrella Logistics Ltd.", "Buyer"), ("Tyrell Components Co.", "Seller"),
         d(-353), 12, money="USD 3.2 million", law="State of California", folder="Umbrella Logistics"),
    Spec("Umbrella_DPA.pdf", "dpa", "Data Processing Agreement", ("Umbrella Logistics Ltd.", "Controller"), ("DataVault Systems B.V.", "Processor"),
         d(-60), 24, law="the Netherlands", slas=True, net=None, folder="Umbrella Logistics"),
    Spec("Hooli_MSA.pdf", "msa", "Master Services Agreement", ("Hooli Systems Inc.", "Client"), ("Bighead Consulting LLC", "Provider"),
         d(-65), 36, money="CAD 5,000,000", law="Province of Ontario", renewal=RENEW, slas=True, folder="Hooli Systems"),
    Spec("Hooli_SaaS_Old.pdf", "saas", "SaaS Subscription Agreement", ("Hooli Systems Inc.", "Customer"), ("Raviga Analytics Inc.", "Provider"),
         d(-385), 12, money="$48,000", basis="annual", law="State of California", date_style="iso", folder="Hooli Systems"),
    Spec("Hooli_Scanned_Consulting.pdf", "consulting", "Consulting Agreement", ("Hooli Systems Inc.", "Client"), ("Endframe Studios LLC", "Consultant"),
         d(-100), 6, money="USD 90,000", folder="Hooli Systems", scanned=True),
    Spec("Stark_Wayne_Vendor_Agreement.pdf", "supply", "Supply Agreement", ("Wayne Retail Group", "Buyer"), ("Stark Components Inc.", "Supplier"),
         d(-10), 24, money="USD 620,000", law="State of New York"),
]


def end_date(s: Spec) -> date | None:
    return s.start + relativedelta(months=s.months) - timedelta(days=1) if s.months else None


def clauses(s: Spec) -> list[tuple[str, str]]:
    (an, ar), (bn, br) = s.a, s.b
    out: list[tuple[str, str]] = []
    scope = {
        "msa": f"{bn} shall perform the services described in one or more Statements of Work executed under this Agreement. Each Statement of Work forms part of this Agreement.",
        "sow": f"{bn} shall deliver the deliverables and milestones set out in this Statement of Work, subject to the acceptance criteria agreed by the parties.",
        "nda": f"The {ar} may disclose Confidential Information to the {br} solely for evaluating a potential business relationship. The {br} shall protect Confidential Information with reasonable care.",
        "license": f"{bn} grants {an} a non-exclusive, non-transferable, perpetual license to use the software in object code form for its internal business purposes.",
        "saas": f"{bn} grants {an} access to the hosted software as a service (SaaS) for the duration of the subscription term. {an} shall not resell the service.",
        "sla": f"This Service Level Agreement sets out the service levels that {bn} shall meet when providing the hosted platform to {an}.",
        "lease": "The Landlord leases to the Tenant the warehouse premises at 14 Dockside Road for the term below. The Tenant shall pay a refundable security deposit equal to two months of rent.",
        "supply": f"The Seller shall supply, and the Buyer shall purchase, the goods listed in each purchase order. Delivery shall be made DAP to the Buyer's distribution centre.",
        "dpa": f"The {ar} appoints the {br} as data processor for personal data under GDPR. The {br} shall engage a sub-processor only with prior written consent.",
        "consulting": f"{bn} shall provide advisory services to {an} as an independent contractor and shall not be an employee of {an}.",
    }[s.ctype]
    out.append(("1. Scope", scope))

    end = end_date(s)
    if s.end_style == "explicit" and end:
        term = f"The term of this Agreement begins on the Effective Date and continues until {fmt(end, s.date_style)} (the “Expiration Date”), unless terminated earlier in accordance with this Agreement."
    elif s.end_style == "term" and s.months:
        term = f"The initial term of this Agreement is a term of {WORDS.get(s.months, s.months)} ({s.months}) months from the Effective Date."
    else:
        term = "This Agreement remains in force for as long as the licensed software is used, unless terminated for material breach on thirty (30) days' notice."
    out.append(("2. Term", term))

    if s.money:
        if s.basis == "annual":
            fees = f"{an} shall pay an annual subscription fee of {s.money}, invoiced annually in advance."
        elif s.basis == "monthly":
            fees = f"The Tenant shall pay monthly rent of {s.money}, payable on the first day of each month."
        else:
            fees = f"The total contract value of this Agreement is {s.money}, exclusive of applicable taxes."
        out.append(("3. Fees", fees))
    if s.net:
        out.append(("4. Payment", f"All undisputed invoices are payable within {s.net} days of the invoice date. Late amounts accrue interest at 1% per month."))
    if s.slas:
        sla = [
            "The platform shall achieve a monthly uptime of at least 99.9%, excluding scheduled maintenance. If availability falls below 99.9% in a month, a service credit of 5% of the monthly fee applies.",
            "Severity 1 (Critical) incidents: response within 30 minutes and resolution within 4 hours.",
            "Severity 2 (High) incidents: response within 2 hours and resolution within 1 business day.",
            "The recovery point objective (RPO) is 4 hours and the recovery time objective (RTO) is 8 hours.",
        ]
        out.append(("5. Service Levels", " ".join(sla)))
    if s.renewal:
        out.append(("6. Renewal", s.renewal))
    out.append(("7. Confidentiality", "Each party shall keep the other party's non-public information confidential and use it only to perform this Agreement."))
    out.append(("8. Liability", "Neither party is liable for indirect or consequential damages. Aggregate liability is limited to the fees paid in the twelve months preceding the claim."))
    out.append(("9. Governing Law", f"This Agreement is governed by the laws of {s.law}, without regard to conflict-of-laws principles."))
    out.append(("10. Signatures", f"Signed by authorised representatives of {an} and {bn}."))
    return out


def build_pdf(title_lines: list[str], sections: list[tuple[str, str]], intro: str | None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm, topMargin=20 * mm, bottomMargin=20 * mm)
    ss = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=ss["Title"], fontSize=16, spaceAfter=10)
    sh = ParagraphStyle("sh", parent=ss["Heading3"], fontSize=11, spaceBefore=8, spaceAfter=2)
    body = ParagraphStyle("b", parent=ss["BodyText"], fontSize=10.5, leading=15)
    story = [Paragraph(escape(t.upper()), h) for t in title_lines]
    if intro:
        story += [Paragraph(escape(intro), body), Spacer(1, 6)]
    for head, text in sections:
        story += [Paragraph(escape(head), sh), Paragraph(escape(text), body)]
    doc.build(story)
    return buf.getvalue()


def render(s: Spec) -> bytes:
    (an, ar), (bn, br) = s.a, s.b
    intro = (
        f"This {s.title} (the “Agreement”) is made as of {fmt(s.start, s.date_style)} (the “Effective Date”) by and between "
        f"{an}, a corporation duly organised under applicable law, with its principal office at 100 Main Street (“{ar}”), and "
        f"{bn}, a company with its registered office at 22 Market Square (“{br}”)."
    )
    pdf = build_pdf([s.title], clauses(s), intro)
    if not s.scanned:
        return pdf
    src, out = pymupdf.open(stream=pdf, filetype="pdf"), pymupdf.open()
    for page in src:
        pix = page.get_pixmap(dpi=200)
        np_ = out.new_page(width=page.rect.width, height=page.rect.height)
        np_.insert_image(np_.rect, stream=pix.tobytes("png"))
    return out.tobytes()


def write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print("  +", path.relative_to(ROOT))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clean", action="store_true", help="delete the inbox and database first")
    args = ap.parse_args()
    inbox = ROOT / "contracts" / "inbox"
    if args.clean:
        shutil.rmtree(inbox, ignore_errors=True)
        (ROOT / "contracts" / "contracts.db").unlink(missing_ok=True)
    inbox.mkdir(parents=True, exist_ok=True)

    print(f"Writing sample contracts relative to {TODAY}:")
    for s in SPECS:
        write(inbox / (s.folder or "") / s.filename, render(s))

    notes = build_pdf(
        ["Weekly sync - meeting notes"],
        [("Agenda", "Roadmap review, hiring update and the offsite budget."), ("Action items", "Priya to circulate the slides. Sam to book the venue.")],
        None,
    )
    write(inbox / "Hooli Systems" / "Hooli_Meeting_Notes.pdf", notes)

    blank = pymupdf.open()
    blank.new_page()
    write(inbox / "Initech" / "Blank_Page.pdf", blank.tobytes())
    print(f"Done - {len(SPECS) + 2} files.")


if __name__ == "__main__":
    sys.exit(main())
