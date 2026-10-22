from __future__ import annotations

import logging
import re
import threading
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, or_, select
from sqlalchemy.orm import Session, joinedload

from .config import ROOT, settings
from .db import Client, Contract, SessionLocal, init_db
from .ingest import process_file, scan_inbox
from .agents import build_llm
from .chat import answer as chat_answer
from .client_meta import client_meta
from .mock_ops import build_invoices, build_ptrs
from .mock_projects import build_project
from .schemas import ContractDetail, ContractSummary
from .watcher import InboxWatcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")
log = logging.getLogger("api")

watcher: InboxWatcher | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global watcher
    init_db()
    threading.Thread(target=scan_inbox, daemon=True, name="initial-scan").start()
    if settings.watch_inbox:
        watcher = InboxWatcher()
        watcher.start()
    mode = "Claude (" + settings.llm_model + ")" if settings.use_llm else "rule-based (no API key needed)"
    log.info("extraction mode: %s", mode)
    yield
    if watcher:
        watcher.stop()


app = FastAPI(title="Contract Hub", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])


def get_db():
    with SessionLocal() as db:
        yield db


def _get_or_404(db: Session, contract_id: int) -> Contract:
    row = db.scalar(select(Contract).options(joinedload(Contract.client)).where(Contract.id == contract_id))
    if not row:
        raise HTTPException(404, "Contract not found")
    return row


@app.get("/api/health")
def health():
    return {"ok": True, "extractor": "llm" if settings.use_llm else "heuristic", "model": settings.llm_model if settings.use_llm else None}


SORTABLE = {
    "end_date": Contract.end_date,
    "start_date": Contract.start_date,
    "value": Contract.value,
    "title": Contract.title,
    "confidence": Contract.confidence,
    "updated_at": Contract.updated_at,
}


@app.get("/api/contracts", response_model=list[ContractSummary])
def list_contracts(
    q: str | None = None,
    status: str | None = Query(None, description="Comma separated: Active,Expiring Soon,Expired,Upcoming,Unknown"),
    type: str | None = None,
    client_id: int | None = None,
    review: bool | None = None,
    sort: str = "end_date",
    order: str = "asc",
    db: Session = Depends(get_db),
):
    stmt = select(Contract).options(joinedload(Contract.client)).join(Client, isouter=True)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Contract.title.ilike(like),
                Client.name.ilike(like),
                Contract.contract_type.ilike(like),
                cast(Contract.parties, String).ilike(like),
                Contract.file_path.ilike(like),
            )
        )
    if type:
        stmt = stmt.where(Contract.contract_type == type)
    if client_id:
        stmt = stmt.where(Contract.client_id == client_id)
    col = SORTABLE.get(sort, Contract.end_date)
    stmt = stmt.order_by(col.desc().nulls_last() if order == "desc" else col.asc().nulls_last(), Contract.id)

    items = [ContractSummary.from_row(c) for c in db.scalars(stmt).unique().all()]
    if status:
        wanted = {s.strip() for s in status.split(",")}
        items = [i for i in items if i.status in wanted]
    if review is not None:
        items = [i for i in items if i.needs_review == review]
    return items


@app.get("/api/contracts/{contract_id}", response_model=ContractDetail)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    return ContractDetail.from_row(_get_or_404(db, contract_id))


@app.get("/api/contracts/{contract_id}/file")
def get_contract_file(contract_id: int, db: Session = Depends(get_db)):
    row = _get_or_404(db, contract_id)
    root = settings.inbox_dir.resolve()
    path = (root / row.file_path).resolve()
    if not path.is_relative_to(root) or not path.exists():
        raise HTTPException(404, "File missing on disk")
    return FileResponse(path, media_type="application/pdf", filename=path.name, content_disposition_type="inline")


@app.post("/api/contracts/{contract_id}/reprocess", response_model=ContractDetail)
def reprocess(contract_id: int, db: Session = Depends(get_db)):
    row = _get_or_404(db, contract_id)
    process_file(settings.inbox_dir / row.file_path, force=True)
    db.expire_all()
    return ContractDetail.from_row(_get_or_404(db, contract_id))


@app.post("/api/scan")
def rescan():
    return {"files": scan_inbox()}


@app.post("/api/upload", response_model=ContractDetail)
def upload(file: UploadFile = File(...), client: str | None = Form(None), db: Session = Depends(get_db)):
    name = Path(file.filename or "").name
    if not name.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    folder = settings.inbox_dir
    if client and client.strip():
        safe = re.sub(r"[^\w .\-]", "", client).strip() or "Unassigned"
        folder = folder / safe
        folder.mkdir(parents=True, exist_ok=True)
    dest = folder / name
    dest.write_bytes(file.file.read())
    cid = process_file(dest, force=True)
    if cid is None:
        raise HTTPException(500, "Could not process file")
    db.expire_all()
    return ContractDetail.from_row(_get_or_404(db, cid))


def _summaries(db: Session, client_id: int | None = None) -> list[ContractSummary]:
    stmt = select(Contract).options(joinedload(Contract.client))
    if client_id:
        stmt = stmt.where(Contract.client_id == client_id)
    return [ContractSummary.from_row(c) for c in db.scalars(stmt).unique().all()]


def _client_card(client: Client, items: list[ContractSummary]) -> dict:
    upcoming = [i for i in items if i.days_to_expiry is not None and i.days_to_expiry >= 0 and i.status in ("Active", "Expiring Soon")]
    nxt = min(upcoming, key=lambda i: i.days_to_expiry) if upcoming else None
    value: dict[str, float] = defaultdict(float)
    for i in items:
        if i.value and i.status in ("Active", "Expiring Soon") and i.value_basis in ("total", None, "other"):
            value[i.currency or "?"] += i.value
    return {
        "id": client.id,
        "name": client.name,
        **client_meta(client.name),
        "contract_count": len(items),
        "by_status": dict(Counter(i.status for i in items)),
        "needs_review": sum(i.needs_review for i in items),
        "next_expiry": {"date": nxt.end_date, "days": nxt.days_to_expiry, "title": nxt.title or nxt.file_name} if nxt else None,
        "active_value_by_currency": dict(value),
    }


@app.get("/api/clients")
def list_clients(db: Session = Depends(get_db)):
    by_client: dict[int, list[ContractSummary]] = defaultdict(list)
    for item in _summaries(db):
        if item.client_id:
            by_client[item.client_id].append(item)
    clients = db.scalars(select(Client)).all()
    cards = [_client_card(c, by_client[c.id]) for c in clients if by_client.get(c.id)]
    return sorted(cards, key=lambda c: c["name"].lower())


def _client_or_404(db: Session, client_id: int) -> Client:
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    return client


@app.get("/api/clients/{client_id}")
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = _client_or_404(db, client_id)
    return _client_card(client, _summaries(db, client_id))


@app.get("/api/clients/{client_id}/project")
def get_client_project(client_id: int, db: Session = Depends(get_db)):
    """MOCK data for now (see app/mock_projects.py); same shape a real project tool adapter would return."""
    client = _client_or_404(db, client_id)
    return {"client": {"id": client.id, "name": client.name}, **build_project(client.name)}


@app.get("/api/clients/{client_id}/ptrs")
def get_client_ptrs(client_id: int, db: Session = Depends(get_db)):
    """MOCK problem tracking reports (see app/mock_ops.py)."""
    client = _client_or_404(db, client_id)
    return {"client": {"id": client.id, "name": client.name}, **build_ptrs(client.name)}


@app.get("/api/clients/{client_id}/invoices")
def get_client_invoices(client_id: int, db: Session = Depends(get_db)):
    """MOCK invoices (see app/mock_ops.py)."""
    client = _client_or_404(db, client_id)
    return {"client": {"id": client.id, "name": client.name}, **build_invoices(client.name, client_meta(client.name)["continent"])}


def _chat_entry(db: Session, client: Client, full: bool) -> dict:
    meta = client_meta(client.name)
    contracts = [
        {
            "title": i.title, "type": i.contract_type, "status": i.status, "start_date": i.start_date.isoformat() if i.start_date else None,
            "end_date": i.end_date.isoformat() if i.end_date else None, "days_to_expiry": i.days_to_expiry, "value": i.value,
            "currency": i.currency, "value_basis": i.value_basis, "sla_count": i.sla_count, "needs_review": i.needs_review, "file_name": i.file_name,
        }
        for i in _summaries(db, client.id)
    ]
    ptr, inv, proj = build_ptrs(client.name), build_invoices(client.name, meta["continent"]), build_project(client.name)
    entry = {
        "id": client.id, "name": client.name, **meta, "contracts": contracts,
        "ptr_summary": ptr["summary"], "invoices_summary": inv["summary"],
        "ptrs": ptr["ptrs"] if full else [p for p in ptr["ptrs"] if p["severity"] == "Critical" and p["status"] not in ("Resolved", "Closed")],
        "invoices": inv["invoices"] if full else [i for i in inv["invoices"] if i["status"] == "Overdue"],
        "project_name": proj["project"]["name"], "project_health": proj["project"]["health"],
        "blockers": [{"severity": b["severity"], "title": b["title"], "owner": b["owner"], "days_open": b["days_open"]} for b in proj["blockers"]],
    }
    return entry


class ChatTurn(BaseModel):
    role: str
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    scope: str = "global"  # "global" or "client"
    client_id: int | None = None
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


@app.post("/api/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    from datetime import date as _date

    if req.scope == "client":
        if req.client_id is None:
            raise HTTPException(400, "client_id is required for a client chat")
        clients = [_chat_entry(db, _client_or_404(db, req.client_id), full=True)]
    else:
        counted = {i.client_id for i in _summaries(db) if i.client_id}
        clients = [_chat_entry(db, c, full=False) for c in db.scalars(select(Client).order_by(Client.name)).all() if c.id in counted]
    data = {"scope": "client" if req.scope == "client" else "global", "project": "TCS AgentAssist", "today": _date.today().isoformat(), "clients": clients}
    llm, _ = build_llm()
    return chat_answer(data, req.message, [t.model_dump() for t in req.history], llm)


@app.get("/api/stats")
def stats(client_id: int | None = None, db: Session = Depends(get_db)):
    items = _summaries(db, client_id)
    by_status = Counter(i.status for i in items)
    value_by_ccy: dict[str, float] = defaultdict(float)
    for i in items:
        if i.value and i.status in ("Active", "Expiring Soon") and i.value_basis in ("total", None, "other"):
            value_by_ccy[i.currency or "?"] += i.value
    return {
        "total": len(items),
        "by_status": dict(by_status),
        "needs_review": sum(i.needs_review for i in items),
        "expiring_30": sum(1 for i in items if i.days_to_expiry is not None and 0 <= i.days_to_expiry <= 30),
        "expiring_90": sum(1 for i in items if i.days_to_expiry is not None and 0 <= i.days_to_expiry <= 90),
        "active_value_by_currency": dict(value_by_ccy),
    }


@app.get("/api/facets")
def facets(client_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(Contract).options(joinedload(Contract.client))
    if client_id:
        stmt = stmt.where(Contract.client_id == client_id)
    items = db.scalars(stmt).unique().all()
    clients = Counter((c.client_id, c.client.name) for c in items if c.client)
    types = Counter(c.contract_type for c in items if c.contract_type)
    return {
        "clients": sorted(({"id": k[0], "name": k[1], "count": v} for k, v in clients.items()), key=lambda x: x["name"].lower()),
        "types": sorted(({"name": k, "count": v} for k, v in types.items()), key=lambda x: x["name"]),
    }


# Serve the built UI from the same process when it exists (optional; dev uses Vite on :5173)
_dist = ROOT / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="ui")
