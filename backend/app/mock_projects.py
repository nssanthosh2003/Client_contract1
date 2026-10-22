"""MOCK project-status data, generated deterministically per client name.

This stands in for a real project tool (Jira, Azure DevOps, Linear...). The shape returned by
`build_project` is the contract the UI relies on: replace this module's body with calls to the
real tool and keep the same keys.
"""
from __future__ import annotations

import random
import re
import zlib
from datetime import date, timedelta

PROJECT_NAMES = [
    ("Platform Migration", "Build"),
    ("Customer Portal Revamp", "Build"),
    ("Data Warehouse Rollout", "Testing"),
    ("Billing Integration", "Build"),
    ("Mobile App Launch", "Testing"),
    ("Security Hardening", "Discovery"),
    ("Analytics Dashboard", "Build"),
    ("Onboarding Automation", "Rollout"),
]
PEOPLE = ["Priya Nair", "Marcus Chen", "Ana Souza", "Tomasz Kowalski", "Fatima Khan", "Liam O'Brien", "Hiro Tanaka", "Sara Lindqvist"]
LABELS = ["backend", "frontend", "api", "data", "infra", "design", "security", "qa"]
STORIES = [
    "Single sign-on for partner users", "Export invoices as CSV", "Role-based access for admins", "Migrate user profiles to new schema",
    "Email notifications for approvals", "Audit log for contract changes", "Bulk import of vendor records", "Rate limiting on public API",
    "Dashboard filters by region", "Fix timezone drift in scheduled reports", "Replace legacy PDF generator", "Accessibility pass on checkout flow",
    "Webhook retries with backoff", "Set up staging data refresh", "Search across attachments", "Two-factor sign-in",
    "Reconcile ledger totals nightly", "Archive inactive accounts", "Add usage metering events", "Performance budget for landing pages",
    "Document the integration endpoints", "Load test the reporting service",
]
BLOCKERS = [
    ("Waiting on client sign-off for the data-retention policy", "Release cannot be scheduled until the policy is approved.", "High"),
    ("Test environment is down for the third time this sprint", "QA cannot verify stories; reviews are piling up.", "Critical"),
    ("API credentials for the client's billing system not issued", "Integration work is paused for two stories.", "High"),
    ("Unclear ownership of the legacy reporting database", "Migration scripts cannot run without an owner's approval.", "Medium"),
    ("Third-party SMS provider approval is pending", "Notification stories cannot go live.", "Medium"),
    ("Security review slot not yet booked", "Hardening work cannot be marked done.", "High"),
]
COLUMNS = ["Backlog", "In progress", "In review", "Done"]
PRIORITIES = ["Low", "Medium", "High"]


def _initials(name: str) -> str:
    return "".join(w[0] for w in name.split()[:2]).upper()


def _key(client_name: str) -> str:
    letters = re.sub(r"[^A-Za-z]", "", client_name).upper()
    return (letters[:3] or "PRJ").ljust(3, "X")


def build_project(client_name: str) -> dict:
    rng = random.Random(zlib.crc32(client_name.encode()))
    today = date.today()
    key = _key(client_name)
    pname, phase = rng.choice(PROJECT_NAMES)
    team = rng.sample(PEOPLE, 5)

    # ---- stories (the sprint board)
    titles = rng.sample(STORIES, rng.randint(14, 18))
    sprint_len = 14
    elapsed = rng.randint(4, 11)
    velocity = rng.uniform(0.7, 1.2)  # <1 means behind plan, >1 ahead
    done_share = min(0.85, max(0.1, elapsed / sprint_len * velocity))
    rest = 1 - done_share
    weights = [("Backlog", 0.3 * rest), ("In progress", 0.4 * rest), ("In review", 0.3 * rest), ("Done", done_share)]
    stories = []
    for i, title in enumerate(titles):
        status = rng.choices([w[0] for w in weights], [w[1] for w in weights])[0]
        stories.append(
            {
                "key": f"{key}-{101 + i}",
                "title": title,
                "status": status,
                "assignee": None if status == "Backlog" and rng.random() < 0.5 else rng.choice(team),
                "points": rng.choice([1, 2, 3, 5, 8]),
                "priority": rng.choices(PRIORITIES, [0.25, 0.5, 0.25])[0],
                "labels": rng.sample(LABELS, rng.randint(1, 2)),
                "blocked": False,
            }
        )

    # ---- blockers, each tied to an open story
    open_stories = [s for s in stories if s["status"] in ("In progress", "In review", "Backlog")]
    n_blockers = rng.choice([0, 0, 1, 1, 2, 3])
    blockers = []
    for i, (title, impact, severity) in enumerate(rng.sample(BLOCKERS, n_blockers)):
        linked = open_stories[i % len(open_stories)] if open_stories else None
        if linked:
            linked["blocked"] = True
        blockers.append(
            {
                "id": f"BLK-{i + 1}",
                "title": title,
                "impact": impact,
                "severity": severity,
                "owner": rng.choice(team),
                "days_open": rng.randint(1, 12),
                "story_key": linked["key"] if linked else None,
                "status": "Escalated" if severity == "Critical" else "Open",
            }
        )
    blockers.sort(key=lambda b: ["Critical", "High", "Medium"].index(b["severity"]))

    # ---- sprint + burndown
    start = today - timedelta(days=elapsed)
    total = sum(s["points"] for s in stories)
    done = sum(s["points"] for s in stories if s["status"] == "Done")
    remaining = total - done
    ideal = [round(total * (1 - d / sprint_len), 1) for d in range(sprint_len + 1)]
    actual, prev = [], total
    for d in range(elapsed + 1):
        if d == 0:
            val = total
        elif d == elapsed:
            val = remaining
        else:
            target = total - (total - remaining) * (d / elapsed)
            val = max(remaining, min(prev, round(target + rng.uniform(-2, 2))))
        actual.append(val)
        prev = val

    # ---- milestones
    plan = [("Kickoff and scope sign-off", -62), ("Design approved", -34), ("Beta to client", rng.randint(-6, 10)), ("User acceptance testing", 31), ("Go live", 62)]
    milestones = []
    for name, offset in plan:
        due = today + timedelta(days=offset)
        if offset < -20:
            status = "Done"
        elif offset < 0:
            status = rng.choice(["Done", "Late"])
        elif offset <= 14:
            status = "In progress"
        else:
            status = "Upcoming"
        milestones.append({"name": name, "due": due.isoformat(), "status": status})

    # ---- team workload
    load = {}
    for s in stories:
        if s["assignee"] and s["status"] != "Done":
            w = load.setdefault(s["assignee"], {"name": s["assignee"], "initials": _initials(s["assignee"]), "open_points": 0, "open_stories": 0})
            w["open_points"] += s["points"]
            w["open_stories"] += 1
    workload = sorted(load.values(), key=lambda w: -w["open_points"])

    # ---- health
    ideal_now = ideal[min(elapsed, sprint_len)]
    behind = remaining - ideal_now
    critical = sum(b["severity"] == "Critical" for b in blockers)
    if critical or behind > 0.3 * total:
        health = "Off track"
    elif len(blockers) >= 2 or behind > 0.15 * total:
        health = "At risk"
    else:
        health = "On track"

    return {
        "mock": True,
        "project": {
            "name": pname,
            "phase": phase,
            "health": health,
            "lead": team[0],
            "sprint": {
                "name": f"Sprint {rng.randint(8, 24)}",
                "start": start.isoformat(),
                "end": (start + timedelta(days=sprint_len)).isoformat(),
                "days_left": max(0, sprint_len - elapsed),
                "points_total": total,
                "points_done": done,
                "percent_done": round(100 * done / total) if total else 0,
            },
        },
        "columns": COLUMNS,
        "stories": stories,
        "blockers": blockers,
        "milestones": milestones,
        "burndown": {"ideal": ideal, "actual": actual, "sprint_days": sprint_len, "elapsed": elapsed},
        "workload": workload,
    }
