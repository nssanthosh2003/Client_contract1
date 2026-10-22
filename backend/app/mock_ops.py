"""MOCK PTRs (problem tracking reports) and invoices, generated deterministically per client.

Stand-ins for a real issue tracker and billing system. Keep the returned shapes and the UI keeps working.
"""
from __future__ import annotations

import random
import zlib
from datetime import date, timedelta

PTR_TITLES = [
    ("Boarding pass barcode rejected by gate readers after aircraft swap", "Departure Control"),
    ("Fare rule cache returns stale fares after the midnight sync", "Reservations"),
    ("Seat map does not refresh after an equipment change", "Reservations"),
    ("Check-in kiosk times out at the baggage prompt", "Check-in"),
    ("Duplicate e-ticket numbers issued on group bookings", "Reservations"),
    ("Frequent flyer miles not credited on codeshare segments", "Loyalty"),
    ("Weight and balance mismatch on the departure control report", "Departure Control"),
    ("Crew roster export fails for overnight pairings", "Crew"),
    ("Name-change fee charged twice on rebooking", "Ancillaries"),
    ("Rebooking loops on missed connections during disruptions", "Reservations"),
    ("Passenger SMS notifications arrive more than 10 minutes late", "Notifications"),
    ("Splitting a booking leaves orphaned ancillary services", "Ancillaries"),
    ("Bag tag print fails for interline transfers", "Baggage"),
    ("Schedule change alerts show the wrong time zone", "Notifications"),
    ("Loyalty tier does not update after a status match", "Loyalty"),
    ("Online check-in blocks passengers with long surnames", "Check-in"),
]
PTR_STATUSES = ["Open", "In analysis", "Fix in progress", "Ready for test", "Resolved", "Closed"]
SEVERITIES = ["Critical", "Major", "Minor"]
TEAM = ["Priya Nair", "Marcus Chen", "Ana Souza", "Tomasz Kowalski", "Fatima Khan", "Liam O'Brien"]

INVOICE_ITEMS = [
    ("Annual platform license", 96000),
    ("Monthly support and maintenance", 14500),
    ("Change request: fare display update", 22000),
    ("Change request: kiosk flow changes", 18500),
    ("Training: gate and ramp agents", 9000),
    ("Hosting and environments", 12500),
    ("Integration services", 31000),
]
CURRENCY = {"North America": ("USD", 1), "South America": ("USD", 1), "Africa": ("USD", 1), "Europe": ("EUR", 0.92), "Asia": ("INR", 83), "Oceania": ("AUD", 1.5)}


def build_ptrs(client_name: str) -> dict:
    rng = random.Random(zlib.crc32((client_name + ":ptr").encode()))
    today = date.today()
    picks = rng.sample(PTR_TITLES, rng.randint(8, 13))
    n0 = rng.randint(1000, 4000)
    items = []
    for i, (title, component) in enumerate(picks):
        status = rng.choices(PTR_STATUSES, [0.2, 0.18, 0.2, 0.1, 0.18, 0.14])[0]
        severity = rng.choices(SEVERITIES, [0.18, 0.42, 0.4])[0]
        age = rng.randint(1, 60)
        raised = today - timedelta(days=age)
        resolved_on = None
        if status in ("Resolved", "Closed"):
            resolved_on = raised + timedelta(days=rng.randint(1, max(1, age)))
        items.append(
            {
                "id": f"PTR-{n0 + i * 7}",
                "title": title,
                "component": component,
                "severity": severity,
                "status": status,
                "raised": raised.isoformat(),
                "resolved": resolved_on.isoformat() if resolved_on else None,
                "age_days": ((resolved_on or today) - raised).days,
                "assignee": rng.choice(TEAM),
                "target_release": f"R{26 + (1 if rng.random() > 0.5 else 0)}.{rng.randint(1, 4)}",
            }
        )
    items.sort(key=lambda p: (p["status"] in ("Resolved", "Closed"), SEVERITIES.index(p["severity"]), -p["age_days"]))
    open_items = [p for p in items if p["status"] not in ("Resolved", "Closed")]
    recent = [p for p in items if p["resolved"] and (today - date.fromisoformat(p["resolved"])).days <= 30]
    return {
        "mock": True,
        "ptrs": items,
        "statuses": PTR_STATUSES,
        "summary": {
            "total": len(items),
            "open": len(open_items),
            "critical_open": sum(p["severity"] == "Critical" for p in open_items),
            "avg_open_age_days": round(sum(p["age_days"] for p in open_items) / len(open_items)) if open_items else 0,
            "resolved_30d": len(recent),
        },
    }


def build_invoices(client_name: str, continent: str) -> dict:
    rng = random.Random(zlib.crc32((client_name + ":inv").encode()))
    today = date.today()
    code, factor = CURRENCY.get(continent, ("USD", 1))
    n = rng.randint(7, 10)
    base = 2026 * 1000 + rng.randint(10, 200)
    items = []
    for i in range(n):
        desc, amount = rng.choice(INVOICE_ITEMS)
        amount = round(amount * rng.uniform(0.85, 1.25) * factor, -2 if code != "INR" else -3)
        issued = today - timedelta(days=(n - 1 - i) * rng.randint(18, 26) + rng.randint(1, 6))
        due = issued + timedelta(days=30)
        paid_on = None
        if due < today:
            if rng.random() < 0.78:
                status, paid_on = "Paid", min(today, due - timedelta(days=rng.randint(-8, 12)))
            else:
                status = "Overdue"
        elif i == n - 1 and rng.random() < 0.3:
            status = "Draft"  # newest invoice not sent yet
        else:
            status = "Sent"
        items.append(
            {
                "number": f"INV-{base + i}",
                "description": desc,
                "issued": issued.isoformat(),
                "due": due.isoformat(),
                "paid_on": paid_on.isoformat() if paid_on else None,
                "amount": amount,
                "currency": code,
                "status": status,
                "days_overdue": (today - due).days if status == "Overdue" else 0,
            }
        )
    items.sort(key=lambda x: x["issued"], reverse=True)
    unpaid = [x for x in items if x["status"] in ("Sent", "Overdue")]
    upcoming = sorted((x for x in unpaid if x["status"] == "Sent"), key=lambda x: x["due"])
    return {
        "mock": True,
        "invoices": items,
        "summary": {
            "currency": code,
            "outstanding": sum(x["amount"] for x in unpaid),
            "overdue": sum(x["amount"] for x in items if x["status"] == "Overdue"),
            "overdue_count": sum(x["status"] == "Overdue" for x in items),
            "paid_ytd": sum(x["amount"] for x in items if x["status"] == "Paid" and x["paid_on"] and x["paid_on"][:4] == str(today.year)),
            "next_due": {"number": upcoming[0]["number"], "due": upcoming[0]["due"], "amount": upcoming[0]["amount"]} if upcoming else None,
        },
    }
