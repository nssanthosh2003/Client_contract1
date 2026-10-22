"""Ingestion: file on disk -> agent pipeline -> database row (the local 'Blob Created' handler)."""
from __future__ import annotations

import hashlib
import logging
import threading
import time
from pathlib import Path

from sqlalchemy import select

from .agents import run_pipeline
from .agents.base import Context
from .config import settings
from .db import Client, Contract, SessionLocal

log = logging.getLogger("ingest")
_lock = threading.Lock()  # SQLite + one pipeline at a time keeps things simple and predictable

CLIENT_ROLES = {"client", "customer", "licensee", "buyer", "tenant", "employer", "disclosing party", "subscriber"}


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def wait_until_stable(path: Path, tries: int = 15, interval: float = 0.4) -> bool:
    """Wait for a copy/download to finish (size stops changing)."""
    last = -1
    for _ in range(tries):
        try:
            size = path.stat().st_size
        except FileNotFoundError:
            return False
        if size == last and size > 0:
            return True
        last = size
        time.sleep(interval)
    return path.exists()


def rel_path(path: Path) -> str:
    return path.resolve().relative_to(settings.inbox_dir.resolve()).as_posix()


def resolve_client_name(path: Path, fields: dict) -> str:
    parts = Path(rel_path(path)).parts
    if len(parts) > 1:  # contracts/inbox/<Client>/file.pdf
        return parts[0].replace("_", " ").strip()
    parties = fields.get("parties") or []
    for p in parties:
        if (p.get("role") or "").lower() in CLIENT_ROLES:
            return p["name"]
    return parties[0]["name"] if parties else "Unassigned"


def _columns(ctx: Context) -> dict:
    f = ctx.fields
    return {
        "title": f.get("title"),
        "contract_type": ctx.contract_type,
        "parties": f.get("parties", []),
        "value": f.get("value"),
        "value_basis": f.get("value_basis"),
        "currency": f.get("currency"),
        "start_date": f.get("start_date"),
        "end_date": f.get("end_date"),
        "renewal_terms": f.get("renewal_terms"),
        "governing_law": f.get("governing_law"),
        "payment_terms": f.get("payment_terms"),
        "slas": ctx.slas,
        "confidence": ctx.confidence,
        "field_confidence": ctx.field_confidence,
        "warnings": ctx.warnings,
        "agent_trace": ctx.trace,
        "extractor_mode": ctx.mode,
        "processing_status": "processed",
        "error": None,
        "raw_text_preview": ctx.norm[:2500],
    }


def process_file(path: str | Path, force: bool = False) -> int | None:
    """Run the pipeline for one PDF and upsert the result. Returns the contract id."""
    path = Path(path)
    with _lock:
        if not path.exists():
            return None
        rel, digest = rel_path(path), file_hash(path)
        with SessionLocal() as db:
            row = db.scalar(select(Contract).where(Contract.file_path == rel))
            if row and row.file_hash == digest and row.processing_status == "processed" and not force:
                return row.id

            fields: dict = {}
            try:
                ctx = run_pipeline(path)
                cols, fields = _columns(ctx), ctx.fields
                log.info("processed %s (%s, confidence %.2f)", rel, ctx.mode, ctx.confidence)
            except Exception as exc:  # noqa: BLE001
                log.warning("failed %s: %s", rel, exc)
                cols = {
                    "title": path.stem.replace("_", " "),
                    "processing_status": "failed",
                    "error": f"{type(exc).__name__}: {exc}",
                    "confidence": 0.0,
                    "warnings": [str(exc)],
                    "parties": [],
                    "slas": [],
                    "field_confidence": {},
                    "agent_trace": [],
                }

            client_name = resolve_client_name(path, fields)
            client = db.scalar(select(Client).where(Client.name == client_name))
            if client is None:
                client = Client(name=client_name)
                db.add(client)
                db.flush()

            if row is None:
                row = Contract(file_path=rel, file_hash=digest, client_id=client.id)
                db.add(row)
            row.file_hash, row.client_id = digest, client.id
            for k, v in cols.items():
                setattr(row, k, v)
            db.commit()
            return row.id


def scan_inbox() -> int:
    """Process every PDF under the inbox that is new/changed; drop rows whose file vanished."""
    inbox = settings.inbox_dir
    seen = set()
    for pdf in sorted(inbox.rglob("*.pdf")):
        seen.add(rel_path(pdf))
        try:
            process_file(pdf)
        except Exception:  # noqa: BLE001
            log.exception("scan failed for %s", pdf)
    with _lock, SessionLocal() as db:
        for row in db.scalars(select(Contract)).all():
            if row.file_path not in seen:
                db.delete(row)
        db.commit()
    return len(seen)


def remove_file_record(path: str | Path) -> None:
    try:
        rel = rel_path(Path(path))
    except ValueError:
        return
    with _lock, SessionLocal() as db:
        row = db.scalar(select(Contract).where(Contract.file_path == rel))
        if row:
            db.delete(row)
            db.commit()
